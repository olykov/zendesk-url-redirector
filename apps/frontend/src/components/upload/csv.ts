/**
 * Minimal CSV/TSV parser. Handles:
 *  - delimiter auto-detection (`,` `;` `\t`)
 *  - quoted fields with `""` escape
 *  - CRLF / LF line endings
 *  - BOM
 */

export interface ParsedCsv {
  delimiter: "," | ";" | "\t";
  headers: string[];
  rows: string[][];
}

const CANDIDATE_DELIMITERS: Array<"," | ";" | "\t"> = [",", ";", "\t"];

export function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts = CANDIDATE_DELIMITERS.map((d) => ({
    d,
    n: countUnquoted(headerLine, d),
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.n > 0 ? counts[0]!.d : ",";
}

function countUnquoted(line: string, ch: string): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === ch) n++;
  }
  return n;
}

export function parseCsv(input: string, opts?: { delimiter?: "," | ";" | "\t" }): ParsedCsv {
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const firstNewline = input.indexOf("\n");
  const headerLine = firstNewline === -1 ? input : input.slice(0, firstNewline);
  const delimiter = opts?.delimiter ?? detectDelimiter(headerLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      row.push(cell);
      // skip rows that are completely empty (single empty cell from trailing newline)
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }

  const headers = rows.length > 0 ? rows[0]!.map((h) => h.trim()) : [];
  const dataRows = rows.slice(1);
  return { delimiter, headers, rows: dataRows };
}

const FROM_HINTS = ["redirect_from", "from", "source", "old", "old_url", "source_url", "origin"];
const TO_HINTS = ["redirect_to", "to", "destination", "new", "new_url", "target", "dest"];
const STATUS_HINTS = ["redirect_status", "status", "code", "http_status", "http_code"];

export function autoMap(headers: string[]): {
  fromIdx: number | null;
  toIdx: number | null;
  statusIdx: number | null;
} {
  const norm = headers.map((h) => h.toLowerCase().trim());
  const find = (hints: string[]): number | null => {
    for (const h of hints) {
      const idx = norm.indexOf(h);
      if (idx >= 0) return idx;
    }
    return null;
  };
  return {
    fromIdx: find(FROM_HINTS),
    toIdx: find(TO_HINTS),
    statusIdx: find(STATUS_HINTS),
  };
}

export function normalizePath(value: string): string {
  const v = value.trim();
  if (v === "") return v;
  if (v.startsWith("http://") || v.startsWith("https://")) {
    try {
      const u = new URL(v);
      return u.pathname + (u.search ?? "");
    } catch {
      return v;
    }
  }
  return v.startsWith("/") ? v : `/${v}`;
}
