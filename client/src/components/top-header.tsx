"use client";

import { auth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function TopHeader() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => auth.me(), retry: false });

  async function onLogout() {
    try { await auth.logout(); } catch {}
    qc.clear();
    router.replace("/login");
  }

  const username = me.data?.username ?? "—";

  return (
    <header className="flex items-center justify-between gap-4 px-7 py-5">
      {/* wordmark — terminal prompt, white text */}
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-accent-pale text-base">$</span>
        <span className="text-lg tracking-tight text-ink-strong">blackbox</span>
        <span className="text-accent-pale cursor-blink text-base">_</span>
      </div>

      {/* right cluster */}
      <div className="flex items-center gap-2.5">
        <button className="hidden lg:flex items-center gap-2 h-9 w-44 px-3 text-[11px] text-ink-mute rounded-full bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.10] transition">
          <Search size={13} />
          <span>Search anything…</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-ink-dim">⌘K</kbd>
        </button>
        <button className="relative h-9 w-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-ink-dim hover:text-ink-strong transition">
          <Bell size={14} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-bright" />
        </button>
        <div className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <div className="relative h-7 w-7 rounded-full bg-gradient-to-br from-accent-green to-accent-bright flex items-center justify-center text-[11px] font-bold text-canvas">
            {username[0]?.toUpperCase() ?? "?"}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-level-ok ring-2 ring-canvas pulse-green" />
          </div>
          <div className="text-xs leading-tight">
            <div className="text-ink-strong font-medium">{username}</div>
            <div className="text-ink-mute text-[10px]">admin</div>
          </div>
          <ChevronDown size={13} className="text-ink-mute" />
          <button onClick={onLogout} className="ml-1 text-ink-mute hover:text-accent-bright transition" title="logout">
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </header>
  );
}

