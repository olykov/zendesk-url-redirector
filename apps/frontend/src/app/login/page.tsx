import { redirect } from "next/navigation";
import { ArrowRightLeft, Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { isBasicEnabled, isKeycloakEnabled } from "@/lib/auth-flags";
import { BasicForm } from "./basic-form";
import { KeycloakButton } from "./keycloak-button";

const DEFAULT_DESTINATION = "/redirects";

function safeCallback(value: string | string[] | undefined): string {
  if (typeof value !== "string") return DEFAULT_DESTINATION;
  // Only accept same-origin paths to prevent open-redirect injection.
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_DESTINATION;
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const expired = params.reason === "expired";

  const session = await auth();
  // If a still-valid session somehow lands here, send the user where they wanted.
  if (session && !session.error && !expired) redirect(callbackUrl);

  const basic = isBasicEnabled();
  const keycloak = isKeycloakEnabled();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <div className="absolute inset-0 canvas-grid opacity-50" aria-hidden />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, oklch(22% 0.005 270) 0%, transparent 70%)",
        }}
      />

      <div className="relative grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="grid h-8 w-8 place-items-center rounded-[6px] bg-fg text-bg">
              <ArrowRightLeft className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-semibold tracking-tight">Redirector</div>
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 mt-0.5 font-medium">
                Zendesk Guide
              </div>
            </div>
          </div>

          {expired && (
            <div className="mb-6 flex items-start gap-2.5 rounded-[6px] border border-warn/30 bg-warn/10 px-3 py-2.5 text-[12.5px] text-warn">
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="text-fg-2">
                <span className="font-medium">Your session expired.</span>{" "}
                <span className="text-fg-3">Sign in again to continue where you left off.</span>
              </div>
            </div>
          )}

          <h1 className="text-[24px] font-semibold tracking-tight text-fg leading-tight">
            Sign in to continue
          </h1>
          <p className="mt-2 text-[13px] text-fg-3 leading-relaxed">
            {keycloak && basic
              ? "Sign in with your username and password, or use your organization SSO."
              : keycloak
                ? "Authenticate with your organization Keycloak account."
                : "Use the credentials configured for this instance."}
          </p>

          {!basic && !keycloak ? (
            <div className="mt-8 rounded-[8px] border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger">
              No authentication method is configured. Set <code className="font-mono">BASIC_AUTH_ENABLED=true</code>{" "}
              or fill the Keycloak environment variables.
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              {basic && <BasicForm callbackUrl={callbackUrl} />}

              {basic && keycloak && (
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[10.5px] uppercase tracking-[0.16em] text-fg-4 font-medium">
                    or
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}

              {keycloak && (
                <KeycloakButton callbackUrl={callbackUrl} variant={basic ? "secondary" : "primary"} />
              )}
            </div>
          )}

          {process.env.NEXT_PUBLIC_INSTANCE_LABEL && (
            <div className="mt-12 pt-6 border-t border-line text-[11px] text-fg-4 leading-relaxed text-center">
              {process.env.NEXT_PUBLIC_INSTANCE_LABEL}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
