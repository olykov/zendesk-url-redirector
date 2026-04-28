"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowRightLeft, Plus, FileUp, Trash2, SlidersHorizontal, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncFooter } from "@/components/sync-footer";
import { useAuthVia } from "@/lib/session-context";

const NAV: Array<{
  href: string;
  label: string;
  icon: typeof ArrowRightLeft;
  group: "Manage" | "System";
}> = [
  { href: "/redirects", label: "All redirects", icon: ArrowRightLeft, group: "Manage" },
  { href: "/add", label: "New redirect", icon: Plus, group: "Manage" },
  { href: "/upload", label: "Batch upload", icon: FileUp, group: "Manage" },
  { href: "/delete", label: "Delete by ID", icon: Trash2, group: "Manage" },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal, group: "System" },
];

function initials(name?: string | null): string {
  if (!name) return "··";
  const parts = name.split(/[.\s@]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "·").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function Sidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname() ?? "";
  const via = useAuthVia();
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <aside className="flex h-screen w-[232px] flex-col border-r border-line bg-surface">
      {/* brand */}
      <div className="px-4 pt-4 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[6px] bg-fg text-bg">
            <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">Redirector</div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 mt-0.5 font-medium">
              Zendesk Guide
            </div>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-2.5 overflow-y-auto">
        {groups.map((group) => (
          <div key={group} className="mb-5">
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-4">
              {group}
            </div>
            <div className="space-y-px">
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-[6px] px-2 py-1.5",
                      "text-[13px] transition-colors",
                      active
                        ? "bg-surface-2 text-fg"
                        : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        active ? "text-fg" : "text-fg-3 group-hover:text-fg-2",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* footer: sync status + user */}
      <div className="border-t border-line">
        <SyncFooter />
      </div>
      <div className="border-t border-line p-2.5">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-fg-2">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] text-fg">{userName ?? "Signed in"}</div>
            {via && (
              <div className="text-[9.5px] uppercase tracking-[0.12em] text-fg-4 mt-0.5 font-medium">
                via {via}
              </div>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="grid h-6 w-6 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-2 hover:text-fg transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
