import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  // session.error is set by the jwt callback when Keycloak token refresh fails
  // (refresh_token expired). Catch it here at SSR so the user is bumped to the
  // login screen before any page chrome paints.
  if (session.error) redirect("/login?reason=expired");
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar userName={session.user?.email ?? session.user?.name} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1280px] px-10 py-10">{children}</div>
      </main>
    </div>
  );
}
