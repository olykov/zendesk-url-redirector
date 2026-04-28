import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";

const DEFAULT_LABEL = "Continue with Keycloak";

export function KeycloakButton({
  callbackUrl,
  variant = "primary",
}: {
  callbackUrl: string;
  variant?: "primary" | "secondary";
}) {
  async function login() {
    "use server";
    await signIn("keycloak", { redirectTo: callbackUrl });
  }

  const label = process.env.NEXT_PUBLIC_OPENID_BUTTON_LABEL?.trim() || DEFAULT_LABEL;

  return (
    <form action={login} className="w-full">
      <Button type="submit" variant={variant} size="lg" className="w-full">
        {label}
      </Button>
    </form>
  );
}
