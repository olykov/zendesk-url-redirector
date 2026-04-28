import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/lib/auth";
import { QueryProvider } from "@/lib/query-client";
import { SessionTokenProvider } from "@/lib/session-context";
import { SessionProvider } from "next-auth/react";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Redirector — Zendesk Guide",
  description: "Manage Zendesk Guide redirect rules.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <SessionProvider session={session}>
          <QueryProvider>
            <SessionTokenProvider
              accessToken={session?.accessToken ?? null}
              via={session?.via ?? null}
            >
              {children}
            </SessionTokenProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
