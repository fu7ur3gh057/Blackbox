"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/",       label: "Overview" },
  { href: "/checks", label: "Checks" },
  { href: "/alerts", label: "Alerts" },
  { href: "/docker", label: "Docker" },
  { href: "/logs",   label: "Logs" },
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
    <header className="sticky top-0 z-40 px-6 pt-5 pb-3">
      <div className="glass flex items-center gap-5 px-5 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="relative">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-accent via-rose-500 to-violet-accent shadow-glow" />
            <div className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none" />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-tight bg-gradient-to-r from-text-strong via-orange-200 to-violet-accent bg-clip-text text-transparent">
              blackbox
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-mute mt-0.5">
              monitoring
            </div>
          </div>
        </Link>

        {/* Tabs */}
        <nav className="hidden md:flex items-center gap-0.5 ml-2 p-1 rounded-full bg-white/[0.025] border border-white/[0.06]">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname?.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative px-4 py-1.5 text-[13px] rounded-full transition",
                  active
                    ? "text-bg-base font-semibold"
                    : "text-text-dim hover:text-text-strong",
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-br from-accent to-orange-400 shadow-glow" />
                )}
                <span className="relative">{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <button className="hidden lg:flex items-center gap-2 h-9 w-56 px-3 text-xs text-text-mute rounded-full bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.12] transition">
            <Search size={14} />
            <span>Search</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-text-dim">⌘ K</kbd>
          </button>
          <button className="relative h-9 w-9 rounded-full bg-white/[0.025] border border-white/[0.06] flex items-center justify-center text-text-dim hover:text-text-strong transition">
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_2px_rgba(249,115,22,0.6)]" />
          </button>
          <div className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-white/[0.025] border border-white/[0.06]">
            <div className="relative h-7 w-7 rounded-full bg-gradient-to-br from-accent/40 to-violet-accent/40 border border-white/15 flex items-center justify-center text-xs font-bold text-text-strong">
              {me.data?.username?.[0]?.toUpperCase() ?? "?"}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-bg-base pulse-ok" />
            </div>
            <div className="text-xs leading-tight">
              <div className="text-text-strong font-medium">{me.data?.username ?? "—"}</div>
              <div className="text-text-mute text-[10px] uppercase tracking-wider">admin</div>
            </div>
            <button onClick={onLogout} className="ml-2 text-text-dim hover:text-rose-300 transition" title="logout">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
