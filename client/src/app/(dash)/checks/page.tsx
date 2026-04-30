"use client";

import { api } from "@/lib/api";
import type { CheckResult, CheckSummary, Level } from "@/lib/types";
import { useChecksSnapshot } from "@/lib/use-snapshot";
import { cn, relativeTime } from "@/lib/utils";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  Cpu,
  HardDrive,
  History,
  Loader2,
  MemoryStick,
  Network,
  Play,
  Search,
  Server,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  // History drawer — single global slot. Expanding history doesn't
  // disrupt the card grid this way; closing a card and opening another
  // swaps the drawer body without animation jank.
  const [drawerCheck, setDrawerCheck] = useState<CheckSummary | null>(null);

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
          {filtered.map((c) => (
            <CheckCard
              key={c.name}
              check={c}
              onShowHistory={() => setDrawerCheck(c)}
            />
          ))}
        </div>
      )}

      {drawerCheck && (
        <HistoryDrawer
          check={drawerCheck}
          onClose={() => setDrawerCheck(null)}
        />
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

function CheckCard({
  check, onShowHistory,
}: {
  check: CheckSummary;
  onShowHistory: () => void;
}) {
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();
  const Icon = TYPE_ICON[check.type] ?? Activity;
  const tone = LEVEL_TONE[check.level ?? "none"];

  // Inline sparkline — short window, just enough for a thumbnail.
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
          onClick={onShowHistory}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10.5px] font-mono ring-1 transition-colors ml-auto",
            "bg-white/[0.04] text-ink-dim ring-white/[0.06] hover:bg-white/[0.08] hover:text-accent-pale",
          )}
        >
          <History size={11} />
          history
        </button>
      </div>
    </div>
  );
}

// ── history drawer ───────────────────────────────────────────────────


type DrawerRange = "1h" | "6h" | "24h" | "7d";
const DRAWER_RANGE_S: Record<DrawerRange, number> = {
  "1h":  3600,
  "6h":  6 * 3600,
  "24h": 24 * 3600,
  "7d":  7 * 24 * 3600,
};

const EVENTS_PAGE = 50;
const CHART_LIMIT = 300;

function HistoryDrawer({
  check, onClose,
}: {
  check: CheckSummary;
  onClose: () => void;
}) {
  const [range, setRange] = useState<DrawerRange>("24h");
  const since = Math.floor(Date.now() / 1000) - DRAWER_RANGE_S[range];

  // Two queries:
  //   - chartQuery — capped at CHART_LIMIT, used for the trend line + stats
  //   - eventsInf — infinite-paginated table; loads more on scroll
  const chartQuery = useQuery({
    queryKey: ["checks", check.name, "chart", { since, key: range }],
    queryFn: () =>
      api.get<CheckResult[]>(
        `/checks/${encodeURIComponent(check.name)}/history?since=${since}&limit=${CHART_LIMIT}`,
      ),
    staleTime: 30_000,
  });

  const eventsInf = useInfiniteQuery({
    queryKey: ["checks", check.name, "events", { since, key: range }],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        since: String(since),
        limit: String(EVENTS_PAGE),
      });
      if (pageParam) params.set("before", String(pageParam));
      return api.get<CheckResult[]>(
        `/checks/${encodeURIComponent(check.name)}/history?${params}`,
      );
    },
    // Backend returns the newest `limit` rows in the range, chronological.
    // Cursor for the *next-older* page is the OLDEST ts in this page.
    getNextPageParam: (lastPage) => {
      if (lastPage.length < EVENTS_PAGE) return undefined;
      return lastPage[0]?.ts;
    },
    staleTime: 30_000,
  });

  // Flatten infinite-pages, newest first for the table.
  const events = useMemo(() => {
    const all = (eventsInf.data?.pages ?? []).flat();
    // each page is chronological; later pages are older. Flatten then sort
    // newest-first.
    return all.slice().sort((a, b) => b.ts - a.ts);
  }, [eventsInf.data]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver inside the scrollable body — auto-load more.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && eventsInf.hasNextPage && !eventsInf.isFetchingNextPage) {
            eventsInf.fetchNextPage();
          }
        }
      },
      { root, rootMargin: "120px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [eventsInf, range]);

  // ESC closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const Icon = TYPE_ICON[check.type] ?? Activity;
  const tone = LEVEL_TONE[check.level ?? "none"];

  // Stats are computed from the chart sample (already a bounded window).
  const chartPoints = chartQuery.data ?? [];
  const stats = useMemo(() => {
    const vals: number[] = [];
    let okN = 0, warnN = 0, critN = 0;
    for (const r of chartPoints) {
      if (r.level === "ok") okN++;
      else if (r.level === "warn") warnN++;
      else if (r.level === "crit") critN++;
      const v = (r.metrics as { value?: number } | null)?.value;
      if (typeof v === "number") vals.push(v);
    }
    vals.sort((a, b) => a - b);
    const min = vals[0];
    const max = vals[vals.length - 1];
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    return { ok: okN, warn: warnN, crit: critN, min, max, avg, count: chartPoints.length };
  }, [chartPoints]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm animate-[reveal-in_0.2s_ease-out]"
        onClick={onClose}
      />
      <div className="w-full max-w-[640px] h-full bg-canvas-elev border-l border-white/[0.06] flex flex-col animate-[reveal-in_0.2s_ease-out] shadow-canvas">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center ring-1", tone.bg, tone.text, tone.ring)}>
              <Icon size={16} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink-strong truncate">{check.name}</div>
              <div className="text-[10.5px] font-mono text-ink-mute uppercase tracking-wider">
                {check.type} · every {check.interval}s
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            title="close (Esc)"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-mute hover:bg-white/[0.05] hover:text-ink-strong transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Range chips */}
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-1.5">
          <Clock size={11} className="text-ink-mute mr-1" />
          {(["1h", "6h", "24h", "7d"] as DrawerRange[]).map((r) => (
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
          <span className="ml-auto text-[10px] font-mono text-ink-mute tabular-nums">
            chart {chartPoints.length} · events {events.length}{eventsInf.hasNextPage ? "+" : ""}
          </span>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {/* Chart */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={11} className="text-ink-mute" />
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-dim font-mono">trend</span>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/[0.04] p-3">
              {chartQuery.isLoading ? (
                <div className="h-[120px] flex items-center justify-center text-[11px] font-mono text-ink-mute">
                  loading…
                </div>
              ) : chartPoints.length === 0 ? (
                <div className="h-[120px] flex items-center justify-center text-[11px] font-mono text-ink-mute">
                  no samples in this range
                </div>
              ) : (
                <InteractiveChart points={chartPoints} unit={unitFor(check.type)} />
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="min" value={stats.min} unit={unitFor(check.type)} />
              <Stat label="avg" value={stats.avg} unit={unitFor(check.type)} />
              <Stat label="max" value={stats.max} unit={unitFor(check.type)} />
              <Stat label="ok"   value={stats.ok}   tone="ok" />
              <Stat label="warn" value={stats.warn} tone="warn" />
              <Stat label="crit" value={stats.crit} tone="crit" />
            </div>
          </div>

          {/* Event log — infinite scroll */}
          <div className="px-5 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-dim font-mono">events</span>
              <span className="text-[10px] text-ink-mute font-mono">· newest first · scroll for older</span>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/[0.04] divide-y divide-white/[0.04]">
              {eventsInf.isLoading && events.length === 0 ? (
                <div className="px-3 py-4 text-[11px] font-mono text-ink-mute text-center">
                  loading…
                </div>
              ) : events.length === 0 ? (
                <div className="px-3 py-4 text-[11px] font-mono text-ink-mute text-center">
                  nothing yet
                </div>
              ) : (
                events.map((r) => {
                  const t = LEVEL_TONE[r.level as Level] ?? LEVEL_TONE.none;
                  const v = (r.metrics as { value?: number } | null)?.value;
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-[88px_56px_1fr_auto] gap-3 px-3 py-2 text-[11px] font-mono items-center"
                    >
                      <span className="text-ink-mute tabular-nums">{relativeTime(r.ts)}</span>
                      <span className={cn(
                        "uppercase tracking-wider text-[9.5px] inline-flex items-center gap-1",
                        t.text,
                      )}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fill }} />
                        {r.level}
                      </span>
                      <span className="text-ink-dim truncate">{r.detail || "—"}</span>
                      <span className={cn("tabular-nums", t.text)}>
                        {v != null ? formatValue(v) + unitFor(check.type) : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sentinel + status — always rendered so the observer can pick
                it up even when there's no next page (it just sits there). */}
            <div ref={sentinelRef} className="mt-2 px-3 py-2 text-center text-[10px] font-mono text-ink-mute">
              {eventsInf.isFetchingNextPage
                ? "loading older…"
                : eventsInf.hasNextPage
                ? "scroll to load older"
                : events.length > 0
                ? "— end of range —"
                : ""}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({
  label, value, unit, tone,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  tone?: Level;
}) {
  const t = tone ? LEVEL_TONE[tone] : null;
  return (
    <div className="rounded-lg bg-black/40 border border-white/[0.04] px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.16em] text-ink-mute font-mono">{label}</div>
      <div className={cn(
        "text-[16px] font-mono font-semibold tabular-nums leading-tight mt-0.5",
        t?.text ?? "text-ink-strong",
      )}>
        {value == null ? "—" : formatValue(value)}
        {unit && value != null && <span className="text-[10px] text-ink-mute ml-1">{unit}</span>}
      </div>
    </div>
  );
}

// ── interactive chart with tooltip ────────────────────────────────────


type Pt = { ts: number; v: number; level: Level; detail: string | null };

function InteractiveChart({ points, unit }: { points: CheckResult[]; unit: string }) {
  const padded = useMemo<Pt[]>(() => {
    return points
      .map((p) => ({
        ts: p.ts,
        v: typeof (p.metrics as { value?: number } | null)?.value === "number"
          ? (p.metrics as { value: number }).value
          : null,
        level: p.level as Level,
        detail: p.detail,
      }))
      .filter((p): p is Pt => p.v != null);
  }, [points]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 140 });
  const [hover, setHover] = useState<{ px: number; py: number; pt: Pt } | null>(null);

  // Track container size — chart redraws + tooltip math depend on it.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (padded.length === 0 || size.w === 0) {
    return <div ref={wrapRef} className="relative h-[140px]" />;
  }

  const minTs = padded[0].ts;
  const maxTs = padded[padded.length - 1].ts;
  const tsRange = Math.max(1, maxTs - minTs);
  const ys = padded.map((p) => p.v);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const yRange = Math.max(1, maxY - minY);

  // Map domain → pixel coords. We render at the actual container size
  // (no preserveAspectRatio gymnastics) so tooltip math is straightforward.
  const padX = 4;
  const padY = 8;
  const usableW = size.w - padX * 2;
  const usableH = size.h - padY * 2;
  const xy = (p: Pt) => {
    const x = padX + ((p.ts - minTs) / tsRange) * usableW;
    const y = padY + (1 - (p.v - minY) / yRange) * usableH;
    return { x, y };
  };

  let path = "";
  for (let i = 0; i < padded.length; i++) {
    const { x, y } = xy(padded[i]);
    path += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  const area = `${path} L ${padX + usableW} ${padY + usableH} L ${padX} ${padY + usableH} Z`;

  const last = padded[padded.length - 1];
  const lastTone = LEVEL_TONE[last.level] ?? LEVEL_TONE.none;
  const { x: lastX, y: lastY } = xy(last);

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    // Find nearest point by ts. Binary search keeps this fast for 300 pts.
    const target = minTs + ((px - padX) / usableW) * tsRange;
    let lo = 0, hi = padded.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (padded[mid].ts < target) lo = mid + 1;
      else hi = mid;
    }
    const pt = padded[lo];
    if (!pt) return;
    const c = xy(pt);
    setHover({ px: c.x, py: c.y, pt });
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-[140px] cursor-crosshair"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={padX} x2={padX + usableW}
            y1={padY + p * usableH} y2={padY + p * usableH}
            stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" strokeWidth="0.5"
          />
        ))}

        <path d={area} fill="url(#chart-fill)" />
        <path d={path} fill="none" stroke="#E0E0E5" strokeWidth={1.4} strokeLinejoin="round" />

        {/* hover crosshair + dot */}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={hover.px} x2={hover.px}
              y1={padY} y2={padY + usableH}
              stroke="rgba(255,255,255,0.25)" strokeDasharray="2 2" strokeWidth="0.8"
            />
            <circle cx={hover.px} cy={hover.py} r={3.4} fill={(LEVEL_TONE[hover.pt.level] ?? LEVEL_TONE.none).fill} />
            <circle cx={hover.px} cy={hover.py} r={5.5} fill="none" stroke={(LEVEL_TONE[hover.pt.level] ?? LEVEL_TONE.none).fill} strokeOpacity="0.4" />
          </g>
        )}

        {/* trailing dot */}
        <circle cx={lastX} cy={lastY} r={2.4} fill={lastTone.fill} />
      </svg>

      {/* Tooltip — positioned in container space, flips above/below the
          point and clamps to container edges so it never escapes. */}
      {hover && (
        <ChartTooltip
          x={hover.px}
          y={hover.py}
          ts={hover.pt.ts}
          value={hover.pt.v}
          unit={unit}
          level={hover.pt.level}
          detail={hover.pt.detail}
          containerW={size.w}
          containerH={size.h}
        />
      )}
    </div>
  );
}

function ChartTooltip({
  x, y, ts, value, unit, level, detail, containerW, containerH,
}: {
  x: number; y: number;
  ts: number; value: number; unit: string;
  level: Level; detail: string | null;
  containerW: number; containerH: number;
}) {
  const TIP_W = 200;
  const TIP_H = 78;
  const GAP = 12;
  // Prefer above the point; fall back to below if no room. Clamp X.
  const above = y > TIP_H + GAP;
  const top = above ? y - TIP_H - GAP : y + GAP;
  const left = Math.max(4, Math.min(containerW - TIP_W - 4, x - TIP_W / 2));
  const tone = LEVEL_TONE[level] ?? LEVEL_TONE.none;
  const date = new Date(ts * 1000);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  // Suppress unused-warning — we have container H from the caller for
  // future "always inside" logic; it's already used above (y > TIP_H+GAP).
  void containerH;

  return (
    <div
      className={cn(
        "absolute z-10 pointer-events-none",
        "rounded-lg bg-canvas-elev2/95 backdrop-blur-sm",
        "border border-white/[0.08] shadow-soft",
        "px-3 py-2 font-mono",
      )}
      style={{ left, top, width: TIP_W }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          {hh}:{mm}:{ss}
        </span>
        <span className={cn(
          "px-1.5 py-[1px] rounded text-[8.5px] font-bold tracking-wider uppercase",
          tone.bg, tone.text,
        )}>
          {level}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-[18px] font-semibold tabular-nums leading-none", tone.text)}>
          {formatValue(value)}
        </span>
        {unit && <span className="text-[10px] text-ink-mute">{unit}</span>}
      </div>
      {detail && (
        <div className="text-[10px] text-ink-dim leading-snug truncate mt-1" title={detail}>
          {detail}
        </div>
      )}
    </div>
  );
}

// ── sparkline (compact, used inside cards) ───────────────────────────


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
