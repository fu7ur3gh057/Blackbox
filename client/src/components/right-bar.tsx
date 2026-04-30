"use client";

import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { CheckSummary, NotifierInfo, SystemSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Fixed 64px right rail. Top-to-bottom:
 *   • WS connection dot
 *   • Worst-level summary with badge (links to /alerts)
 *   • 3 mini vertical gauges (CPU / RAM / SWAP)
 *   • Quick actions: run all, test alert, refresh
 *   • Server clock
 *   • Settings (placeholder)
 */
export function RightBar() {
  return (
    <aside className="h-full flex flex-col items-center py-5 gap-4">
      <ConnectionDot />
      <Divider />
      <WorstLevel />
      <Divider />
      <MiniGauges />
      <Divider />
      <QuickActions />
      <div className="mt-auto flex flex-col items-center gap-3 pt-2">
        <ServerClock />
        <SettingsButton />
      </div>
    </aside>
  );
}

function Divider() {
  return <span className="block h-px w-7 bg-white/[0.06]" />;
}

// ── connection status ─────────────────────────────────────────────────────

type WsState = "connecting" | "online" | "offline";

function useWsStatus(): WsState {
  const [state, setState] = useState<WsState>("connecting");
  useEffect(() => {
    const sock = connectNamespace("/alerts");
    const onOk = () => setState("online");
    const onOff = () => setState("offline");
    sock.on("connect", onOk);
    sock.on("disconnect", onOff);
    sock.on("connect_error", onOff);
    return () => {
      sock.off("connect", onOk);
      sock.off("disconnect", onOff);
      sock.off("connect_error", onOff);
      sock.disconnect();
    };
  }, []);
  return state;
}

function ConnectionDot() {
  const status = useWsStatus();
  const cfg = {
    online:     { dot: "bg-accent-green", pulse: "pulse-green", label: "live" },
    offline:    { dot: "bg-level-crit",   pulse: "pulse-crit",  label: "off"  },
    connecting: { dot: "bg-level-warn",   pulse: "",            label: "..."  },
  }[status];
  return (
    <div className="flex flex-col items-center gap-1.5" title={`websocket ${status}`}>
      <span className={cn("h-2.5 w-2.5 rounded-full", cfg.dot, cfg.pulse)} />
      <span className="text-[8px] uppercase tracking-[0.18em] text-ink-mute font-mono">
        {cfg.label}
      </span>
    </div>
  );
}

// ── worst-level summary ───────────────────────────────────────────────────

function WorstLevel() {
  const { data = [] } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 15_000,
  });
  const buckets = data.reduce(
    (acc, c) => {
      const lvl = c.level ?? "none";
      acc[lvl] = (acc[lvl] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const worst: "ok" | "warn" | "crit" | "none" =
    buckets.crit ? "crit" : buckets.warn ? "warn" : data.length > 0 ? "ok" : "none";
  const cfg = {
    ok:   { Icon: ShieldCheck,   color: "text-level-ok",   bg: "bg-level-ok/10",   ring: "ring-level-ok/25",   pulse: false },
    warn: { Icon: AlertTriangle, color: "text-level-warn", bg: "bg-level-warn/10", ring: "ring-level-warn/30", pulse: false },
    crit: { Icon: AlertOctagon,  color: "text-level-crit", bg: "bg-level-crit/10", ring: "ring-level-crit/40", pulse: true  },
    none: { Icon: Activity,      color: "text-ink-mute",   bg: "bg-white/[0.04]",  ring: "ring-white/10",      pulse: false },
  }[worst];
  const total = (buckets.warn || 0) + (buckets.crit || 0);
  return (
    <Link href="/alerts" className="relative" title={`worst level: ${worst}`}>
      <div
        className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center ring-1 transition",
          cfg.bg, cfg.color, cfg.ring,
          cfg.pulse && "pulse-crit",
        )}
      >
        <cfg.Icon size={16} />
      </div>
      {total > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-level-crit text-canvas text-[9px] font-bold flex items-center justify-center font-mono">
          {total}
        </span>
      )}
    </Link>
  );
}

// ── mini vertical gauges ──────────────────────────────────────────────────

function MiniGauges() {
  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 5_000,
  });
  const cpu = data?.cpu_pct ?? 0;
  const mem = data?.memory_pct ?? 0;
  const swp = data?.swap_pct ?? 0;
  const title = `CPU ${cpu.toFixed(0)}%   RAM ${mem.toFixed(0)}%   SWP ${swp.toFixed(0)}%`;

  return (
    <div className="flex items-end gap-1.5" title={title}>
      <Bar value={cpu} label="C" />
      <Bar value={mem} label="R" />
      <Bar value={swp} label="S" />
    </div>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  const tone =
    value >= 90 ? "bg-level-crit" :
    value >= 70 ? "bg-level-warn" :
    "bg-accent-pale";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-2 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={cn("absolute bottom-0 left-0 right-0 transition-[height] duration-700", tone)}
          style={{ height: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-[8px] text-ink-mute font-mono tracking-wider">{label}</span>
    </div>
  );
}

// ── quick actions ─────────────────────────────────────────────────────────

function QuickActions() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function runAll() {
    setBusy("run");
    try {
      const checks = await api.get<CheckSummary[]>("/checks");
      await Promise.allSettled(
        checks.map((c) => api.post(`/checks/${c.name}/run`)),
      );
      qc.invalidateQueries({ queryKey: ["checks"] });
    } finally {
      setTimeout(() => setBusy(null), 700);
    }
  }
  async function testAlert() {
    setBusy("test");
    try {
      const ns = await api.get<NotifierInfo[]>("/notifiers");
      if (ns[0]) {
        await api.post(`/notifiers/${ns[0].type}/test`, {
          message: "Test alert from dashboard",
          level: "warn",
        });
      }
    } catch {
      /* feedback is the busy ring; failure swallowed */
    } finally {
      setTimeout(() => setBusy(null), 700);
    }
  }
  function refresh() {
    setBusy("refresh");
    qc.invalidateQueries();
    setTimeout(() => setBusy(null), 700);
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <ActionBtn Icon={Zap}       title="Run all checks"  onClick={runAll}    active={busy === "run"} />
      <ActionBtn Icon={Send}      title="Send test alert" onClick={testAlert} active={busy === "test"} />
      <ActionBtn Icon={RefreshCw} title="Refresh data"    onClick={refresh}   active={busy === "refresh"} spin={busy === "refresh"} />
    </div>
  );
}

function ActionBtn({
  Icon, title, onClick, active, spin,
}: {
  Icon: LucideIcon;
  title: string;
  onClick: () => void;
  active?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "h-9 w-9 rounded-xl flex items-center justify-center transition",
        active
          ? "bg-accent-pale/15 text-accent-pale ring-1 ring-accent-pale/30"
          : "text-ink-mute hover:text-accent-pale hover:bg-white/[0.04]",
      )}
    >
      <Icon size={14} strokeWidth={1.8} className={cn(spin && "animate-spin")} />
    </button>
  );
}

// ── server clock ──────────────────────────────────────────────────────────

function ServerClock() {
  // Avoid SSR/CSR mismatch — only render once hydrated
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <div className="text-center font-mono leading-tight" title={now.toString()}>
      <div className="text-[13px] font-semibold text-ink-strong tabular-nums">{hh}</div>
      <div className="text-[13px] font-semibold text-accent-pale tabular-nums">{mm}</div>
    </div>
  );
}

// ── settings (placeholder) ────────────────────────────────────────────────

function SettingsButton() {
  return (
    <button
      title="settings"
      className="h-9 w-9 rounded-xl flex items-center justify-center text-ink-mute hover:text-ink-strong hover:bg-white/[0.04] transition"
    >
      <Settings size={14} strokeWidth={1.8} />
    </button>
  );
}
