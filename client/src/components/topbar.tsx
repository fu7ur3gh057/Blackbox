"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string }[] = [
  { href: "/",        label: "Dashboard" },
  { href: "/checks",  label: "Checks" },
  { href: "/alerts",  label: "Alerts" },
  { href: "/docker",  label: "Docker" },
  { href: "/logs",    label: "Logs" },
];

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => auth.me(), retry: false });

  async function onLogout() {
    try { await auth.logout(); } catch { /* ignore */ }
    qc.clear();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex items-center gap-6 px-8 py-4 bg-bg-base/80 backdrop-blur-md border-b border-border-soft">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_2px_rgba(249,115,22,0.6)]" />
        <span className="font-semibold tracking-tight text-text-strong">blackbox</span>
      </Link>

      <nav className="flex items-center gap-1 rounded-full bg-bg-surface/60 border border-border-soft px-1 py-1">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-full transition",
                active
                  ? "bg-accent text-bg-base font-medium shadow-[0_0_24px_-6px_rgba(249,115,22,0.6)]"
                  : "text-text-dim hover:text-text-strong",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <button className="p-2 rounded-full bg-bg-surface/60 border border-border-soft text-text-dim hover:text-text-strong">
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-bg-surface/60 border border-border-soft">
          <div className="h-7 w-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-semibold text-accent">
            {me.data?.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="text-xs">
            <div className="text-text-strong leading-tight">{me.data?.username ?? "—"}</div>
            <div className="text-text-mute leading-tight">admin</div>
          </div>
          <button onClick={onLogout} className="ml-1 text-text-dim hover:text-text-strong" title="logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
