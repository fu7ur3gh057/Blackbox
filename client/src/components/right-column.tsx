"use client";

import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { AlertEvent, CheckSummary, Level, NotifierInfo, SystemSnapshot } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
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
 * Wide right column (~460 px). Replaces the narrow icon-only rail and
 * the dashboard sidebar at once. Top-to-bottom:
 *   • Status strip   ws-dot · clock · worst-level pill
 *   • Mini gauges    horizontal CPU / RAM / SWAP bars
 *   • Recent alerts  scrollable feed (live)
 *   • Quick actions  run all / test alert / refresh
 *   • Footer         settings (placeholder)
 */
export function RightColumn() {
  return (
    <aside className="h-full flex flex-col gap-4 px-5 py-5 overflow-hidden">
      <StatusStrip />
      <MiniGauges />
      <div className="h-px bg-white/[0.06]" />
      <RecentAlertsFeed />
      <div className="h-px bg-white/[0.06]" />
      <QuickActions />
      <SettingsRow />
    </aside>
  );
}

// ── status strip ──────────────────────────────────────────────────────────

function StatusStrip() {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <ConnectionPill />
      <ServerClock />
      <WorstLevelPill />
    </div>
  );
}

type WsState = "connecting" | "online" | "offline";
function useWsStatus(): WsState {
  const [state, setState] = useState<WsState>("connecting");
  useEffect(() => {
    const sock = connectNamespace("/alerts");
    const ok = () => setState("online");
    const off = () => setState("offline");
    sock.on("connect", ok);
    sock.on("disconnect", off);
    sock.on("connect_error", off);
    return () => {
      sock.off("connect", ok);
      sock.off("disconnect", off);
      sock.off("connect_error", off);
      sock.disconnect();
    };
  }, []);
  return state;
}

function ConnectionPill() {
  const status = useWsStatus();
  const cfg = {
    online:     { dot: "bg-accent-green",  pulse: "pulse-green", label: "live"     },
    offline:    { dot: "bg-level-crit",    pulse: "pulse-crit",  label: "offline"  },
    connecting: { dot: "bg-level-warn",    pulse: "",            label: "syncing"  },
  }[status];
  return (
    <div className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
      <span className={cn("h-2 w-2 rounded-full", cfg.dot, cfg.pulse)} />
      <span className="text-[11px] uppercase tracking-[0.16em] font-mono text-ink-dim">
        {cfg.label}
      </span>
    </div>
  );
}

function ServerClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return (
    <div className="font-mono text-[15px] tabular-nums text-ink-strong" title={now.toString()}>
      {hh}:<span className="text-accent-pale">{mm}</span>
      <span className="text-ink-mute text-[11px] ml-1">{ss}</span>
    </div>
  );
}

function WorstLevelPill() {
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
    ok:   { Icon: ShieldCheck,   color: "text-level-ok",   bg: "bg-level-ok/10",   ring: "ring-level-ok/25" },
    warn: { Icon: AlertTriangle, color: "text-level-warn", bg: "bg-level-warn/10", ring: "ring-level-warn/30" },
    crit: { Icon: AlertOctagon,  color: "text-level-crit", bg: "bg-level-crit/10", ring: "ring-level-crit/40" },
    none: { Icon: Activity,      color: "text-ink-mute",   bg: "bg-white/[0.04]",  ring: "ring-white/10" },
  }[worst];
  const total = (buckets.warn || 0) + (buckets.crit || 0);
  return (
    <Link
      href="/alerts"
      className={cn(
        "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border",
        "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] transition",
      )}
      title={`worst level: ${worst}`}
    >
      <span className={cn("h-6 w-6 rounded-full flex items-center justify-center ring-1", cfg.bg, cfg.color, cfg.ring)}>
        <cfg.Icon size={12} />
      </span>
      <span className="text-[11px] font-mono uppercase tracking-wider text-ink-strong">
        {total > 0 ? `${total} active` : "all good"}
      </span>
    </Link>
  );
}

// ── mini gauges ───────────────────────────────────────────────────────────

function MiniGauges() {
  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 5_000,
  });
  return (
    <div className="grid grid-cols-3 gap-3">
      <Gauge label="CPU"  value={data?.cpu_pct    ?? 0} />
      <Gauge label="RAM"  value={data?.memory_pct ?? 0} />
      <Gauge label="SWAP" value={data?.swap_pct   ?? 0} />
    </div>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 90 ? "bg-level-crit" :
    value >= 70 ? "bg-level-warn" :
    "bg-accent-pale";
  return (
    <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono">{label}</span>
        <span className="text-[13px] font-semibold text-ink-strong tabular-nums">
          {value.toFixed(0)}<span className="text-[10px] text-ink-mute">%</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-700", tone)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

// ── recent alerts feed ────────────────────────────────────────────────────

const LEVEL_THEME: Record<Level, { bg: string; text: string; ring: string }> = {
  ok:   { bg: "bg-level-ok/10",   text: "text-level-ok",   ring: "ring-level-ok/25" },
  warn: { bg: "bg-level-warn/10", text: "text-level-warn", ring: "ring-level-warn/30" },
  crit: { bg: "bg-level-crit/10", text: "text-level-crit", ring: "ring-level-crit/40" },
};

function RecentAlertsFeed() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", { limit: 20 }],
    queryFn: () => api.get<AlertEvent[]>("/alerts?limit=20"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const sock = connectNamespace("/alerts");
    sock.on("alert:fired", (payload: Omit<AlertEvent, "id">) => {
      qc.setQueryData<AlertEvent[]>(["alerts", { limit: 20 }], (cur) => {
        const next: AlertEvent = { id: Date.now(), ...payload };
        return [next, ...(cur ?? [])].slice(0, 20);
      });
    });
    return () => { sock.disconnect(); };
  }, [qc]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] uppercase tracking-[0.16em] text-ink-dim font-mono">
          Recent alerts
        </h3>
        <span className="text-[10px] text-ink-mute">{alerts.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {alerts.length === 0 && (
          <div className="text-[12px] text-ink-mute text-center py-12">
            <ShieldCheck className="mx-auto mb-2 text-level-ok/60" size={20} />
            all quiet
          </div>
        )}
        {alerts.map((a) => {
          const t = LEVEL_THEME[a.level];
          return (
            <div
              key={a.id}
              className="rounded-xl bg-white/[0.025] border border-white/[0.05] px-3 py-2 hover:bg-white/[0.04] transition"
            >
              <div className="flex items-start gap-2.5">
                <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold ring-1 shrink-0", t.bg, t.text, t.ring)}>
                  {a.name?.[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-ink-strong truncate">{a.name}</span>
                    <span className="text-[10px] text-ink-mute font-mono shrink-0">{relativeTime(a.ts)}</span>
                  </div>
                  <div className="text-[11px] text-ink-dim leading-snug line-clamp-2">{a.detail ?? "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── quick actions row ─────────────────────────────────────────────────────

function QuickActions() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function runAll() {
    setBusy("run");
    try {
      const checks = await api.get<CheckSummary[]>("/checks");
      await Promise.allSettled(checks.map((c) => api.post(`/checks/${c.name}/run`)));
      qc.invalidateQueries({ queryKey: ["checks"] });
    } finally { setTimeout(() => setBusy(null), 700); }
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
    } catch { /* noop */ } finally { setTimeout(() => setBusy(null), 700); }
  }
  function refresh() {
    setBusy("refresh");
    qc.invalidateQueries();
    setTimeout(() => setBusy(null), 700);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Action Icon={Zap}       label="run"     onClick={runAll}    active={busy === "run"} />
      <Action Icon={Send}      label="test"    onClick={testAlert} active={busy === "test"} />
      <Action Icon={RefreshCw} label="refresh" onClick={refresh}   active={busy === "refresh"} spin={busy === "refresh"} />
    </div>
  );
}

function Action({
  Icon, label, onClick, active, spin,
}: {
  Icon: LucideIcon; label: string; onClick: () => void; active?: boolean; spin?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl flex items-center justify-center gap-2 border transition",
        active
          ? "bg-accent-pale/15 text-accent-pale border-accent-pale/35"
          : "bg-white/[0.025] text-ink-dim border-white/[0.05] hover:text-accent-pale hover:border-accent-pale/30",
      )}
    >
      <Icon size={14} strokeWidth={1.8} className={cn(spin && "animate-spin")} />
      <span className="text-[11px] uppercase tracking-wider font-mono">{label}</span>
    </button>
  );
}

// ── settings row ──────────────────────────────────────────────────────────

function SettingsRow() {
  return (
    <div className="flex items-center justify-between text-[10px] font-mono text-ink-mute pt-1">
      <span className="uppercase tracking-[0.16em]">v0.1.0</span>
      <button title="settings" className="flex items-center gap-1.5 text-ink-dim hover:text-ink-strong transition">
        <Settings size={12} strokeWidth={1.8} />
        settings
      </button>
    </div>
  );
}
