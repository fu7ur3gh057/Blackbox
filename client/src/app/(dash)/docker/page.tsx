"use client";

import { DiscoverySection } from "@/components/docker/discovery-section";
import { EventsTicker } from "@/components/docker/events-ticker";
import { ProjectCard } from "@/components/docker/project-card";
import { RoleGate } from "@/components/role-gate";
import { useDockerSnapshot } from "@/lib/use-snapshot";
import { cn } from "@/lib/utils";
import { AlertCircle, Boxes, CheckCircle2, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Live view of every compose project listed in `config.report.docker`.
 * Re-uses the WS `docker:tick` snapshot so it stays in sync without
 * polling. Filter state is local (search + only-unhealthy toggle) and
 * applied per project card.
 */
export default function DockerPage() {
  return (
    <RoleGate allowed={["admin"]}>
      <DockerPageInner />
    </RoleGate>
  );
}

function DockerPageInner() {
  const projects = useDockerSnapshot() ?? [];
  const [search, setSearch] = useState("");
  const [onlyUnhealthy, setOnlyUnhealthy] = useState(false);

  const summary = useMemo(() => {
    let total = 0, running = 0, unhealthy = 0, errored = 0;
    const stateCounts: Record<string, number> = {};
    for (const p of projects) {
      if (p.error) errored++;
      for (const c of p.containers ?? []) {
        total++;
        if (c.State === "running") running++;
        if (c.Health && c.Health !== "healthy" && c.Health !== "") unhealthy++;
        stateCounts[c.State] = (stateCounts[c.State] || 0) + 1;
      }
    }
    return { total, running, unhealthy, errored, stateCounts, projectCount: projects.length };
  }, [projects]);

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="rounded-card border border-white/[0.05] bg-canvas-elev p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-green/12 text-accent-pale flex items-center justify-center">
              <Boxes size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-ink-strong tracking-tight">
                Docker
              </h1>
              <p className="text-[11.5px] text-ink-mute font-mono">
                live `docker compose ps` for every project under{" "}
                <span className="text-ink-dim">config.report.docker</span>
              </p>
            </div>
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Counter label="projects" value={summary.projectCount} />
            <Counter label="containers" value={summary.total} />
            <Counter label="running" value={summary.running} tone={summary.running === summary.total ? "ok" : undefined} />
            {summary.unhealthy > 0 && (
              <Counter label="unhealthy" value={summary.unhealthy} tone="warn" />
            )}
            {summary.errored > 0 && (
              <Counter label="errors" value={summary.errored} tone="crit" />
            )}
          </div>
        </div>

        {/* Spectrum bar */}
        {summary.total > 0 && (
          <div className="mt-4">
            <SpectrumBar counts={summary.stateCounts} total={summary.total} />
          </div>
        )}

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-[420px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="filter by service / image…"
              className={cn(
                "w-full pl-8 pr-7 py-1.5 rounded-full",
                "bg-black/40 border border-white/[0.06]",
                "text-[12px] font-mono text-ink-strong placeholder:text-ink-mute",
                "focus:outline-none focus:border-accent-pale/50 focus:bg-black/60",
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-strong"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOnlyUnhealthy((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors",
              onlyUnhealthy
                ? "bg-level-warn/12 border-level-warn/30 text-level-warn"
                : "bg-white/[0.04] border-white/[0.06] text-ink-dim hover:bg-white/[0.08]",
            )}
          >
            <Filter size={11} />
            only unhealthy
          </button>
        </div>
      </div>

      {/* Live `docker events` strip */}
      <EventsTicker />

      {/* Discovery — only renders if there's something off-radar */}
      <DiscoverySection />

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="rounded-card border border-white/[0.05] bg-canvas-elev px-6 py-10 text-center">
          <Boxes size={32} className="mx-auto text-ink-mute opacity-40 mb-2" />
          <div className="text-[13px] text-ink-dim font-mono">no docker projects configured</div>
          <div className="text-[11px] text-ink-mute font-mono mt-1">
            add a project under{" "}
            <span className="text-accent-pale">config.report.docker:</span> in config.yaml
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.compose}
              project={p}
              search={search}
              onlyUnhealthy={onlyUnhealthy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Counter({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "crit";
}) {
  const cfg = {
    ok:   { text: "text-level-ok",   border: "border-level-ok/25",   bg: "bg-level-ok/[0.06]",   Icon: CheckCircle2 },
    warn: { text: "text-level-warn", border: "border-level-warn/25", bg: "bg-level-warn/[0.06]", Icon: AlertCircle },
    crit: { text: "text-level-crit", border: "border-level-crit/30", bg: "bg-level-crit/[0.06]", Icon: AlertCircle },
  };
  const c = tone ? cfg[tone] : null;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono border",
        c
          ? `${c.bg} ${c.border} ${c.text}`
          : "bg-white/[0.04] border-white/[0.06] text-ink-dim",
      )}
    >
      <span className={cn("text-[14px] font-semibold tabular-nums", c?.text ?? "text-ink-strong")}>
        {value}
      </span>
      <span className="uppercase tracking-wider text-[9.5px] text-ink-mute">{label}</span>
    </span>
  );
}

function SpectrumBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  const segments = [
    { state: "running",    label: "running",    color: "bg-level-ok",  textBg: "bg-level-ok/15",   text: "text-level-ok" },
    { state: "restarting", label: "restarting", color: "bg-level-warn", textBg: "bg-level-warn/15", text: "text-level-warn" },
    { state: "paused",     label: "paused",     color: "bg-level-warn/70", textBg: "bg-level-warn/15", text: "text-level-warn" },
    { state: "exited",     label: "exited",     color: "bg-level-crit", textBg: "bg-level-crit/15", text: "text-level-crit" },
    { state: "dead",       label: "dead",       color: "bg-level-crit/80", textBg: "bg-level-crit/15", text: "text-level-crit" },
    { state: "created",    label: "created",    color: "bg-ink-mute",  textBg: "bg-white/[0.04]", text: "text-ink-mute" },
  ].map((s) => ({ ...s, count: counts[s.state] || 0 }))
   .filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex items-center h-2 rounded-full overflow-hidden bg-black/40 border border-white/[0.04]">
        {segments.map((s) => (
          <div
            key={s.state}
            className={cn("h-full", s.color)}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px] font-mono">
        {segments.map((s) => (
          <span
            key={s.state}
            className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded", s.textBg, s.text)}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
            {s.label} · <span className="tabular-nums font-semibold">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
