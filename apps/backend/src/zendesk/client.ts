import { request } from "undici";

export interface ZendeskRule {
  id: string;
  brand_id: string | null;
  redirect_from: string;
  redirect_to: string;
  redirect_status: string;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  records: ZendeskRule[];
  meta?: {
    has_more?: boolean;
    after_cursor?: string | null;
  };
}

export interface ZendeskClientOptions {
  subdomain: string;
  email: string;
  apiToken: string;
  timeoutMs: number;
}

export class ZendeskApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Zendesk API ${status}: ${body.slice(0, 500)}`);
  }
}

export class ZendeskClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly opts: ZendeskClientOptions) {
    this.baseUrl = `https://${opts.subdomain}.zendesk.com`;
    const token = Buffer.from(`${opts.email}/token:${opts.apiToken}`).toString("base64");
    this.authHeader = `Basic ${token}`;
  }

  async *iterateRedirectRules(): AsyncGenerator<ZendeskRule> {
    let cursor: string | null = null;
    while (true) {
      const params = new URLSearchParams({ "page[size]": "30" });
      if (cursor) params.set("page[after]", cursor);
      const data = await this.requestJson<ListResponse>(
        "GET",
        `/api/v2/guide/redirect_rules?${params.toString()}`,
      );
      for (const rule of data.records ?? []) yield rule;
      if (!data.meta?.has_more || !data.meta.after_cursor) return;
      cursor = data.meta.after_cursor;
    }
  }

  async getRedirectRule(id: string): Promise<ZendeskRule | null> {
    try {
      const data = await this.requestJson<{ redirect_rule?: ZendeskRule; record?: ZendeskRule }>(
        "GET",
        `/api/v2/guide/redirect_rules/${encodeURIComponent(id)}`,
      );
      return data.redirect_rule ?? data.record ?? null;
    } catch (err) {
      if (err instanceof ZendeskApiError && err.status === 404) return null;
      throw err;
    }
  }

  async createRedirectRule(input: {
    redirect_from: string;
    redirect_to: string;
    redirect_status: string;
    brand_id?: string;
  }): Promise<ZendeskRule> {
    const payload = { redirect_rule: input };
    const { status, headers, body } = await this.rawRequest(
      "POST",
      "/api/v2/guide/redirect_rules",
      payload,
    );
    if (status >= 400) throw new ZendeskApiError(status, body);

    let createdId: string | null = null;
    if (body) {
      try {
        const parsed = JSON.parse(body) as { redirect_rule?: ZendeskRule; record?: ZendeskRule };
        const obj = parsed.redirect_rule ?? parsed.record;
        if (obj?.id) return obj;
        if (obj?.id) createdId = obj.id;
      } catch {
        // empty / non-JSON body — we'll try other strategies below
      }
    }
    const location = headers.location;
    if (!createdId && typeof location === "string") {
      const tail = location.replace(/\/+$/, "").split("/").pop();
      if (tail) createdId = tail;
    }
    if (createdId) {
      const fetched = await this.getRedirectRule(createdId);
      if (fetched) return fetched;
    }

    // Last resort: scan list and find by redirect_from + redirect_to.
    for await (const rule of this.iterateRedirectRules()) {
      if (rule.redirect_from === input.redirect_from && rule.redirect_to === input.redirect_to) {
        return rule;
      }
    }
    throw new Error("created rule not found via response, location, or list scan");
  }

  async deleteRedirectRule(id: string): Promise<void> {
    const { status, body } = await this.rawRequest(
      "DELETE",
      `/api/v2/guide/redirect_rules/${encodeURIComponent(id)}`,
    );
    if (status >= 400 && status !== 404) throw new ZendeskApiError(status, body);
  }

  private async requestJson<T>(method: string, path: string): Promise<T> {
    const { status, body } = await this.rawRequest(method, path);
    if (status >= 400) throw new ZendeskApiError(status, body);
    return body ? (JSON.parse(body) as T) : ({} as T);
  }

  private async rawRequest(
    method: string,
    path: string,
    json?: unknown,
  ): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
    const url = `${this.baseUrl}${path}`;
    const res = await request(url, {
      method: method as "GET" | "POST" | "DELETE",
      headers: {
        authorization: this.authHeader,
        accept: "application/json",
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
      headersTimeout: this.opts.timeoutMs,
      bodyTimeout: this.opts.timeoutMs,
    });
    const body = await res.body.text();
    return { status: res.statusCode, headers: res.headers, body };
  }
}
