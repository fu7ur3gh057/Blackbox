"use client";

import { api } from "@/lib/api";
import { connectNamespace, releaseNamespace } from "@/lib/socket";
import type { AlertEvent, Level } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Filter,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 100;

type LevelFilter = Level | "all";
type RangeFilter = "24h" | "7d" | "30d" | "all";

const RANGE_SECONDS: Record<RangeFilter, number | null> = {
  "24h": 24 * 3600,
  "7d":  7 * 24 * 3600,
  "30d": 30 * 24 * 3600,
  "all": null,
};

/**
 * Full alerts timeline. Reads /api/alerts (cursor-paged via `before=`
 * ts), subscribes to `/alerts` WS for live appends, exposes filter
 * chips for level + a free-text search, plus a 24h/7d/all time-range
 * toggle. Each row expands to show the metrics payload.
 */
export default function AlertsPage() {
  const qc = useQueryClient();
  const [level, setLevel] = useState<LevelFilter>("all");
  const [range, setRange] = useState<RangeFilter>("7d");
  const [query, setQuery] = useState("");

  const queryKey = useMemo(
    () => ["alerts", "page", { level, range }] as const,
    [level, range],
  );

  const { data: alerts = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (level !== "all") params.set("level", level);
      params.set("before", String(Math.floor(Date.now() / 1000) + 60));
      const all = await api.get<AlertEvent[]>(`/alerts?${params}`);
      const rs = RANGE_SECONDS[range];
      if (rs === null) return all;
      const since = Math.floor(Date.now() / 1000) - rs;
      return all.filter((a) => a.ts >= since);
    },
    staleTime: 30_000,
  });

  // Live updates: prepend new alert events that match current filters.
  useEffect(() => {
    const sock = connectNamespace("/alerts");
    const onFired = (payload: Omit<AlertEvent, "id">) => {
      qc.setQueryData<AlertEvent[]>(queryKey, (cur) => {
        if (level !== "all" && payload.level !== level) return cur;
        const next: AlertEvent = { id: Date.now(), ...payload };
        return [next, ...(cur ?? [])];
      });
    };
    sock.on("alert:fired", onFired);
    return () => {
      sock.off("alert:fired", onFired);
      releaseNamespace("/alerts");
    };
  }, [qc, queryKey, level]);

  const filtered = useMemo(() => {
    if (!query) return alerts;
    const q = query.toLowerCase();
    return alerts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.detail || "").toLowerCase().includes(q) ||
        (a.kind || "").toLowerCase().includes(q),
    );
  }, [alerts, query]);

  const summary = useMemo(() => {
    let warn = 0, crit = 0, ok = 0;
    for (const a of alerts) {
      if (a.level === "crit") crit++;
      else if (a.level === "warn") warn++;
      else ok++;
    }
    return { total: alerts.length, warn, crit, ok };
  }, [alerts]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-card border border-white/[0.05] bg-canvas-elev p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center">
              <Bell size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-ink-strong tracking-tight">Alerts</h1>
              <p className="text-[11.5px] text-ink-mute font-mono">
                full timeline · live via /alerts socket
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Counter label="total" value={summary.total} />
            <Counter label="ok"    value={summary.ok}   tone="ok" />
            <Counter label="warn"  value={summary.warn} tone="warn" />
            <Counter label="crit"  value={summary.crit} tone="crit" />
          </div>
        </div>

        {summary.total > 0 && (
          <div className="mt-4">
            <SeverityBar ok={summary.ok} warn={summary.warn} crit={summary.crit} />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-[420px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="grep alerts…"
              className={cn(
                "w-full pl-8 pr-7 py-1.5 rounded-full",
                "bg-black/40 border border-white/[0.06]",
                "text-[12px] font-mono text-ink-strong placeholder:text-ink-mute",
                "focus:outline-none focus:border-accent-pale/50 focus:bg-black/60",
              )}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-strong">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono mr-1">level</span>
            {(["all", "ok", "warn", "crit"] as LevelFilter[]).map((l) => (
              <LevelChip key={l} level={l} active={level === l} onClick={() => setLevel(l)} />
            ))}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Filter size={11} className="text-ink-mute" />
            {(["24h", "7d", "30d", "all"] as RangeFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10.5px] font-mono uppercase tracking-wider transition-colors",
                  range === r
                    ? "bg-accent-pale/15 text-accent-pale ring-1 ring-accent-pale/30"
                    : "bg-white/[0.04] text-ink-dim ring-1 ring-white/[0.06] hover:bg-white/[0.08]",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-[12px] text-ink-mute font-mono">loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState query={query} hasAny={alerts.length > 0} />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((a) => <AlertRow key={a.id} alert={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────


function Counter({ label, value, tone }: { label: string; value: number; tone?: Level }) {
  const cfg = tone ? {
    ok:   { text: "text-level-ok",   border: "border-level-ok/25",   bg: "bg-level-ok/[0.06]" },
    warn: { text: "text-level-warn", border: "border-level-warn/25", bg: "bg-level-warn/[0.06]" },
    crit: { text: "text-level-crit", border: "border-level-crit/30", bg: "bg-level-crit/[0.06]" },
  }[tone] : null;
  return (
    <span className={cn(
      "inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono border",
      cfg ? `${cfg.bg} ${cfg.border}` : "bg-white/[0.04] border-white/[0.06]",
    )}>
      <span className={cn("text-[14px] font-semibold tabular-nums", cfg?.text ?? "text-ink-strong")}>
        {value}
      </span>
      <span className="uppercase tracking-wider text-[9.5px] text-ink-mute">{label}</span>
    </span>
  );
}

function SeverityBar({ ok, warn, crit }: { ok: number; warn: number; crit: number }) {
  const total = Math.max(1, ok + warn + crit);
  const segs = [
    { name: "ok",   v: ok,   color: "bg-level-ok",   tcol: "text-level-ok",   tbg: "bg-level-ok/15" },
    { name: "warn", v: warn, color: "bg-level-warn", tcol: "text-level-warn", tbg: "bg-level-warn/15" },
    { name: "crit", v: crit, color: "bg-level-crit", tcol: "text-level-crit", tbg: "bg-level-crit/15" },
  ].filter((s) => s.v > 0);
  return (
    <div>
      <div className="flex items-center h-2 rounded-full overflow-hidden bg-black/40 border border-white/[0.04]">
        {segs.map((s) => (
          <div key={s.name} className={cn("h-full", s.color)} style={{ width: `${(s.v / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] font-mono">
        {segs.map((s) => (
          <span key={s.name} className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded", s.tbg, s.tcol)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
            {s.name} · <span className="tabular-nums font-semibold">{s.v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function LevelChip({ level, active, onClick }: { level: LevelFilter; active: boolean; onClick: () => void }) {
  const cfg = {
    all:  { text: "text-ink-strong", bg: "bg-white/[0.06]",      ring: "ring-white/[0.10]" },
    ok:   { text: "text-level-ok",   bg: "bg-level-ok/[0.10]",   ring: "ring-level-ok/25" },
    warn: { text: "text-level-warn", bg: "bg-level-warn/[0.10]", ring: "ring-level-warn/25" },
    crit: { text: "text-level-crit", bg: "bg-level-crit/[0.10]", ring: "ring-level-crit/30" },
  }[level];
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[10.5px] font-mono uppercase tracking-wider transition-all",
        active ? cn(cfg.bg, cfg.text, "ring-1", cfg.ring) : "bg-transparent text-ink-mute/70 ring-1 ring-white/[0.04]",
      )}
    >
      {level}
    </button>
  );
}

const LEVEL_CFG: Record<Level, {
  Icon: typeof AlertTriangle; text: string; bg: string; ring: string; pillBg: string;
}> = {
  ok:   { Icon: CheckCircle2,  text: "text-level-ok",   bg: "bg-level-ok/[0.10]",   ring: "ring-level-ok/25",   pillBg: "bg-level-ok/15" },
  warn: { Icon: AlertTriangle, text: "text-level-warn", bg: "bg-level-warn/[0.10]", ring: "ring-level-warn/25", pillBg: "bg-level-warn/15" },
  crit: { Icon: AlertOctagon,  text: "text-level-crit", bg: "bg-level-crit/[0.10]", ring: "ring-level-crit/30", pillBg: "bg-level-crit/15" },
};

function AlertRow({ alert }: { alert: AlertEvent }) {
  const [open, setOpen] = useState(false);
  const cfg = LEVEL_CFG[alert.level] ?? LEVEL_CFG.ok;
  const hasMetrics = alert.metrics && Object.keys(alert.metrics).length > 0;

  return (
    <div className="px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
      <div className="flex items-start gap-3">
        <span className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center ring-1 shrink-0",
          cfg.bg, cfg.text, cfg.ring,
        )}>
          <cfg.Icon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[13.5px] font-semibold text-ink-strong truncate">{alert.name}</span>
              <span className={cn("px-1.5 py-[1px] rounded text-[9px] font-bold tracking-[0.12em] uppercase font-mono", cfg.pillBg, cfg.text)}>
                {alert.level}
              </span>
              {alert.kind && (
                <span className="text-[10px] text-ink-mute font-mono">· {alert.kind}</span>
              )}
            </div>
            <span className="text-[10.5px] text-ink-mute font-mono shrink-0">{relativeTime(alert.ts)}</span>
          </div>
          {alert.detail && (
            <div className={cn("text-[12px] text-ink-dim mt-1 leading-relaxed", !open && "line-clamp-2")}>
              {alert.detail}
            </div>
          )}
          {hasMetrics && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-2 text-[10.5px] font-mono text-accent-pale/80 hover:text-accent-pale"
            >
              {open ? "▾ hide metrics" : "▸ show metrics"}
            </button>
          )}
          {open && hasMetrics && (
            <pre className="mt-2 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.05] text-[10.5px] font-mono text-zinc-300 whitespace-pre-wrap break-all">
              {JSON.stringify(alert.metrics, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query, hasAny }: { query: string; hasAny: boolean }) {
  return (
    <div className="px-6 py-14 text-center">
      <ShieldCheck size={32} className="mx-auto text-level-ok/50 mb-3" />
      <div className="text-[13px] text-ink-strong font-medium">
        {query ? "no matches" : hasAny ? "no alerts in this range" : "all quiet"}
      </div>
      <div className="text-[11px] text-ink-mute font-mono mt-1">
        {query ? "try a different search" : "alerts fire when checks cross their warn/crit thresholds"}
      </div>
    </div>
  );
}
