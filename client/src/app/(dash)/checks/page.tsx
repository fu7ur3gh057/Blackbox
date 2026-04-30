"use client";

import { api } from "@/lib/api";
import type { CheckResult, CheckSummary, Level } from "@/lib/types";
import { useChecksSnapshot } from "@/lib/use-snapshot";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ChevronDown,
  Cpu,
  HardDrive,
  Loader2,
  MemoryStick,
  Network,
  Play,
  Search,
  Server,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

const TYPE_ICON: Record<string, LucideIcon> = {
  cpu: Cpu, memory: MemoryStick, disk: HardDrive,
  http: Network, systemd: Server,
};

type LevelFilter = Level | "all";

/**
 * Configured-checks page. Reads `useChecksSnapshot()` (WS-backed,
 * shared with the dashboard widgets) so the grid stays live without
 * polling. Each card lazily fetches its own per-check history for the
 * inline sparkline + expanded chart.
 */
export default function ChecksPage() {
  const checks = useChecksSnapshot() ?? [];
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    let ok = 0, warn = 0, crit = 0, never = 0;
    for (const c of checks) {
      if (c.level === "ok") ok++;
      else if (c.level === "warn") warn++;
      else if (c.level === "crit") crit++;
      else never++;
    }
    return { total: checks.length, ok, warn, crit, never };
  }, [checks]);

  const filtered = useMemo(() => {
    return checks.filter((c) => {
      if (level !== "all" && c.level !== level) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
    });
  }, [checks, query, level]);

  async function runAll() {
    setBusy(true);
    try {
      await Promise.allSettled(checks.map((c) => api.post(`/checks/${c.name}/run`)));
      qc.invalidateQueries({ queryKey: ["snapshot", "checks"] });
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-card border border-white/[0.05] bg-canvas-elev p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center">
              <Activity size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-ink-strong tracking-tight">Checks</h1>
              <p className="text-[11.5px] text-ink-mute font-mono">
                live state via /checks socket — last value · interval · history
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Counter label="total" value={summary.total} />
            <Counter label="ok"    value={summary.ok}    tone="ok" />
            <Counter label="warn"  value={summary.warn}  tone="warn" />
            <Counter label="crit"  value={summary.crit}  tone="crit" />
            {summary.never > 0 && <Counter label="pending" value={summary.never} />}
            <button
              onClick={runAll}
              disabled={busy || checks.length === 0}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono ring-1 transition-colors",
                "bg-accent-pale/15 text-accent-pale ring-accent-pale/30 hover:bg-accent-pale/25",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              title="re-run every check now"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              run all
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-[420px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter by name or type…"
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-white/[0.05] bg-canvas-elev px-6 py-14 text-center">
          <Activity size={32} className="mx-auto text-ink-mute opacity-40 mb-2" />
          <div className="text-[13px] text-ink-strong font-medium">
            {checks.length === 0 ? "no checks configured" : "no matches"}
          </div>
          <div className="text-[11px] text-ink-mute font-mono mt-1">
            {checks.length === 0
              ? <>add entries under <span className="text-accent-pale">checks:</span> in config.yaml</>
              : "loosen the filters above"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => <CheckCard key={c.name} check={c} />)}
        </div>
      )}
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

const LEVEL_TONE: Record<Level | "none", { text: string; bg: string; ring: string; fill: string }> = {
  ok:   { text: "text-level-ok",   bg: "bg-level-ok/[0.10]",   ring: "ring-level-ok/25",   fill: "#84F4A3" },
  warn: { text: "text-level-warn", bg: "bg-level-warn/[0.10]", ring: "ring-level-warn/25", fill: "#FBBF24" },
  crit: { text: "text-level-crit", bg: "bg-level-crit/[0.10]", ring: "ring-level-crit/30", fill: "#EF4444" },
  none: { text: "text-ink-mute",   bg: "bg-white/[0.04]",      ring: "ring-white/10",      fill: "#7C7F84" },
};

function CheckCard({ check }: { check: CheckSummary }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();
  const Icon = TYPE_ICON[check.type] ?? Activity;
  const tone = LEVEL_TONE[check.level ?? "none"];

  // Hour window — enough datapoints for a sparkline at most check
  // intervals without pulling down megabytes of history.
  const since = Math.floor(Date.now() / 1000) - 6 * 3600;
  const { data: history = [] } = useQuery({
    queryKey: ["checks", check.name, "history", { since }],
    queryFn: () =>
      api.get<CheckResult[]>(
        `/checks/${encodeURIComponent(check.name)}/history?since=${since}&limit=80`,
      ),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  async function runNow() {
    setRunning(true);
    try {
      await api.post(`/checks/${check.name}/run`);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["snapshot", "checks"] });
        qc.invalidateQueries({ queryKey: ["checks", check.name, "history"] });
      }, 800);
    } finally {
      setTimeout(() => setRunning(false), 800);
    }
  }

  return (
    <div className="rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1", tone.bg, tone.text, tone.ring)}>
              <Icon size={15} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink-strong truncate">{check.name}</div>
              <div className="text-[10px] font-mono text-ink-mute uppercase tracking-wider">{check.type}</div>
            </div>
          </div>
          <span className={cn(
            "px-1.5 py-[1px] rounded text-[9px] font-bold tracking-[0.12em] uppercase font-mono",
            check.level ? cn(tone.bg, tone.text) : "bg-white/[0.04] text-ink-mute",
          )}>
            {check.level ?? "—"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-3">
          {check.last_value != null ? (
            <div className="flex items-baseline">
              <span className={cn("font-mono font-semibold text-[28px] tabular-nums leading-none", tone.text)}>
                {formatValue(check.last_value)}
              </span>
              <span className="text-[12px] text-ink-mute ml-1">{unitFor(check.type)}</span>
            </div>
          ) : (
            <div className="text-[12px] text-ink-mute font-mono">no value yet</div>
          )}
          <Sparkline points={history} className="ml-auto" />
        </div>

        {check.last_detail && (
          <div className="text-[11.5px] text-ink-dim mt-2 leading-snug line-clamp-2">
            {check.last_detail}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-[10.5px] font-mono text-ink-mute">
          <span>every {check.interval}s</span>
          <span>·</span>
          <span>{check.last_run_ts ? `last run ${relativeTime(check.last_run_ts)}` : "never run"}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.04] bg-black/20 flex items-center gap-2">
        <button
          onClick={runNow}
          disabled={running}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10.5px] font-mono ring-1 transition-colors",
            "bg-white/[0.04] text-ink-dim ring-white/[0.06] hover:bg-white/[0.08] hover:text-ink-strong",
            "disabled:opacity-60 disabled:cursor-wait",
          )}
        >
          {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          run
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10.5px] font-mono ring-1 transition-colors ml-auto",
            open
              ? "bg-accent-pale/[0.10] text-accent-pale ring-accent-pale/25"
              : "bg-white/[0.04] text-ink-dim ring-white/[0.06] hover:bg-white/[0.08]",
          )}
        >
          <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
          {open ? "hide history" : `history (${history.length})`}
        </button>
      </div>

      {/* Expanded history */}
      {open && (
        <div className="border-t border-white/[0.04] bg-black/20 px-5 py-4">
          {history.length === 0 ? (
            <div className="text-[11px] text-ink-mute font-mono text-center py-4">no history yet</div>
          ) : (
            <>
              <Sparkline points={history} large className="mb-3" />
              <div className="rounded-lg bg-black/40 border border-white/[0.04] divide-y divide-white/[0.04] max-h-[240px] overflow-y-auto">
                {history.slice().reverse().slice(0, 30).map((r) => {
                  const t = LEVEL_TONE[r.level as Level] ?? LEVEL_TONE.none;
                  const v = (r.metrics as { value?: number } | null)?.value;
                  return (
                    <div key={r.id} className="grid grid-cols-[80px_60px_1fr_auto] gap-3 px-3 py-1.5 text-[10.5px] font-mono items-center">
                      <span className="text-ink-mute tabular-nums">{relativeTime(r.ts)}</span>
                      <span className={cn("uppercase tracking-wider text-[9.5px]", t.text)}>{r.level}</span>
                      <span className="text-ink-dim truncate">{r.detail || "—"}</span>
                      <span className={cn("tabular-nums", t.text)}>
                        {v != null ? formatValue(v) + unitFor(check.type) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── sparkline ────────────────────────────────────────────────────────


function Sparkline({
  points, large, className,
}: {
  points: CheckResult[];
  large?: boolean;
  className?: string;
}) {
  const W = large ? 600 : 100;
  const H = large ? 60 : 28;

  const padded = useMemo(() => {
    return points
      .map((p) => ({
        ts: p.ts,
        v: typeof (p.metrics as { value?: number } | null)?.value === "number"
          ? (p.metrics as { value: number }).value
          : null,
        level: p.level as Level,
      }))
      .filter((p): p is { ts: number; v: number; level: Level } => p.v != null);
  }, [points]);

  if (padded.length === 0) {
    return <div className={cn("opacity-40 text-[10px] text-ink-mute font-mono", className)}>—</div>;
  }
  const xs = padded.map((p) => p.ts);
  const minTs = Math.min(...xs);
  const maxTs = Math.max(...xs);
  const tsRange = Math.max(1, maxTs - minTs);
  const ys = padded.map((p) => p.v);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const yRange = Math.max(1, maxY - minY);

  const path = padded
    .map((p, i) => {
      const x = ((p.ts - minTs) / tsRange) * W;
      const y = H - ((p.v - minY) / yRange) * H * 0.85 - H * 0.05;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const last = padded[padded.length - 1];
  const lastTone = LEVEL_TONE[last.level] ?? LEVEL_TONE.none;
  const lastX = ((last.ts - minTs) / tsRange) * W;
  const lastY = H - ((last.v - minY) / yRange) * H * 0.85 - H * 0.05;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn(large ? "w-full h-[60px]" : "w-[100px] h-[28px]", className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="#E0E0E5" strokeWidth={large ? 1.4 : 1.2} strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={large ? 2.4 : 1.8} fill={lastTone.fill} />
    </svg>
  );
}

// ── format ────────────────────────────────────────────────────────────


function formatValue(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 100)  return v.toFixed(0);
  if (Math.abs(v) >= 10)   return v.toFixed(1);
  return v.toFixed(2);
}

function unitFor(type: string): string {
  if (type === "cpu" || type === "memory" || type === "disk") return "%";
  return "";
}
