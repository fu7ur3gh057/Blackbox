"use client";

import type { DockerContainer, DockerProject } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  RotateCw,
  Star,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { ActionsMenu } from "./actions-menu";
import { PortPill } from "./port-pill";

const STATE_TONE: Record<string, { dot: string; text: string; bg: string }> = {
  running:    { dot: "bg-level-ok",   text: "text-level-ok",   bg: "bg-level-ok/10" },
  exited:     { dot: "bg-level-crit", text: "text-level-crit", bg: "bg-level-crit/10" },
  dead:       { dot: "bg-level-crit", text: "text-level-crit", bg: "bg-level-crit/10" },
  paused:     { dot: "bg-level-warn", text: "text-level-warn", bg: "bg-level-warn/10" },
  restarting: { dot: "bg-level-warn", text: "text-level-warn", bg: "bg-level-warn/10" },
  created:    { dot: "bg-ink-mute",   text: "text-ink-mute",   bg: "bg-white/[0.04]" },
};

const STATE_ICON: Record<string, typeof Play> = {
  running: Play, exited: XCircle, dead: XCircle, paused: Pause,
  restarting: RotateCw, created: Circle,
};

interface ProjectCardProps {
  project: DockerProject;
  search: string;
  onlyUnhealthy: boolean;
}

export function ProjectCard({ project, search, onlyUnhealthy }: ProjectCardProps) {
  const all = project.containers ?? [];

  const filtered = useMemo(() => {
    return all.filter((c) => {
      if (onlyUnhealthy) {
        const sick = c.State !== "running" || (c.Health && c.Health !== "healthy" && c.Health !== "");
        if (!sick) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hit =
          c.Service?.toLowerCase().includes(q) ||
          c.Name?.toLowerCase().includes(q) ||
          c.Image?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [all, search, onlyUnhealthy]);

  const { total, running, unhealthy, projectPorts } = useMemo(() => {
    const total = all.length;
    const running = all.filter((c) => c.State === "running").length;
    const unhealthy = all.filter(
      (c) => c.Health && c.Health !== "healthy" && c.Health !== "",
    ).length;
    // Distinct published ports across all containers — host-level pin.
    const seen = new Set<string>();
    const projectPorts: typeof project.containers[number]["Publishers"] = [];
    for (const c of all) {
      for (const p of c.Publishers ?? []) {
        if (!p.PublishedPort || p.PublishedPort <= 0) continue;
        const key = `${p.PublishedPort}/${p.Protocol || "tcp"}`;
        if (seen.has(key)) continue;
        seen.add(key);
        projectPorts.push(p);
      }
    }
    return { total, running, unhealthy, projectPorts };
  }, [all]);

  const status: "live" | "degraded" | "err" =
    project.error ? "err" :
    running === total && unhealthy === 0 ? "live" : "degraded";

  return (
    <div className="rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/[0.04] bg-black/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent-green/40 to-accent-bright/40 border border-white/15 flex items-center justify-center text-[14px] font-bold text-canvas">
            {project.project[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink-strong truncate flex items-center gap-2">
              {project.project}
              {project.starred.length > 0 && (
                <Star size={12} className="text-accent-pale fill-accent-pale" />
              )}
            </div>
            <div className="text-[10px] font-mono text-ink-mute truncate" title={project.compose}>
              {project.compose}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {projectPorts.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {projectPorts.slice(0, 6).map((p, i) => (
                <PortPill key={i} port={p} />
              ))}
              {projectPorts.length > 6 && (
                <span className="text-[10px] text-ink-mute font-mono">+{projectPorts.length - 6}</span>
              )}
            </div>
          )}
          <StatusPill status={status} running={running} total={total} unhealthy={unhealthy} />
          <ActionsMenu scope={{ kind: "project", project: project.project }} />
        </div>
      </div>

      {/* Body */}
      {project.error ? (
        <div className="px-5 py-4 text-[12px] font-mono text-level-crit/90 leading-snug">
          <AlertCircle size={12} className="inline mr-1.5 -mt-0.5" />
          {project.error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-6 text-[12px] text-ink-mute text-center">
          {all.length === 0
            ? "no containers — has the project been brought up?"
            : "no matches under current filters"}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.025]">
          {filtered.map((c) => (
            <ContainerRow key={c.ID} c={c} starred={project.starred.includes(c.Service)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  status, running, total, unhealthy,
}: {
  status: "live" | "degraded" | "err";
  running: number;
  total: number;
  unhealthy: number;
}) {
  const cfg = {
    live:     { Icon: CheckCircle2, bg: "bg-level-ok/12",   ring: "ring-level-ok/30",   text: "text-level-ok",   label: `live · ${running}/${total}` },
    degraded: { Icon: AlertCircle,  bg: "bg-level-warn/12", ring: "ring-level-warn/30", text: "text-level-warn", label: `degraded · ${running}/${total}${unhealthy ? ` · ${unhealthy} unhealthy` : ""}` },
    err:      { Icon: XCircle,      bg: "bg-level-crit/12", ring: "ring-level-crit/30", text: "text-level-crit", label: "error" },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-mono uppercase tracking-wider ring-1",
        cfg.bg, cfg.ring, cfg.text,
      )}
    >
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function ContainerRow({ c, starred }: { c: DockerContainer; starred: boolean }) {
  const tone = STATE_TONE[c.State] ?? STATE_TONE.created;
  const Icon = STATE_ICON[c.State] ?? Circle;
  // Show ALL ports — published as HTTP/neutral pills, internal-only as a
  // muted "int" badge so the user can see "this is what redis listens on".
  // Dedup on (PublishedPort or TargetPort) + protocol to drop IPv4/IPv6
  // duplicates that docker emits for the same binding.
  const ports = (() => {
    const seen = new Set<string>();
    const out = [];
    // Sort published first, then internal — accent pills lead.
    const all = [...(c.Publishers ?? [])].sort(
      (a, b) => (b.PublishedPort > 0 ? 1 : 0) - (a.PublishedPort > 0 ? 1 : 0),
    );
    for (const p of all) {
      const key = `${p.PublishedPort || "i"}-${p.TargetPort}-${p.Protocol || "tcp"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  })();
  const image = shortImage(c.Image);
  const uptime = parseStatus(c.Status);
  const health = c.Health;

  return (
    <div className="grid grid-cols-[180px_1fr_auto] gap-3 px-5 py-2.5 items-center hover:bg-white/[0.02] transition-colors">
      {/* service + state */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("inline-flex h-5 w-5 rounded items-center justify-center", tone.bg, tone.text)}>
          <Icon size={11} className={c.State === "restarting" ? "animate-spin" : ""} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-ink-strong truncate flex items-center gap-1.5">
            {c.Service}
            {starred && <Star size={9} className="text-accent-pale fill-accent-pale shrink-0" />}
          </div>
          <div className="text-[10px] font-mono text-ink-mute truncate" title={c.Image}>{image}</div>
        </div>
      </div>

      {/* status text + uptime + health + ports */}
      <div className="min-w-0 flex items-center gap-3 flex-wrap">
        <span className={cn("text-[11px] font-mono", tone.text)}>{c.State}</span>
        {uptime && <span className="text-[10px] text-ink-mute font-mono">{uptime}</span>}
        {health && health !== "" && (
          <HealthChip health={health} />
        )}
        {ports.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {ports.slice(0, 4).map((p, i) => (
              <PortPill key={i} port={p} />
            ))}
            {ports.length > 4 && (
              <span className="text-[10px] text-ink-mute font-mono">+{ports.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* exit code + per-service actions */}
      <div className="flex items-center gap-2">
        {c.ExitCode !== 0 && c.State !== "running" && (
          <span className="px-1.5 py-[1px] rounded text-[9.5px] font-mono bg-level-crit/12 text-level-crit ring-1 ring-level-crit/25">
            exit {c.ExitCode}
          </span>
        )}
        <ActionsMenu scope={{ kind: "service", project: c.Project, service: c.Service }} />
      </div>
    </div>
  );
}

function HealthChip({ health }: { health: string }) {
  const cfg = {
    healthy:   { bg: "bg-level-ok/10",   text: "text-level-ok",   ring: "ring-level-ok/25" },
    starting:  { bg: "bg-level-warn/10", text: "text-level-warn", ring: "ring-level-warn/25" },
    unhealthy: { bg: "bg-level-crit/10", text: "text-level-crit", ring: "ring-level-crit/30" },
  }[health] ?? { bg: "bg-white/[0.04]", text: "text-ink-mute", ring: "ring-white/[0.06]" };
  return (
    <span
      className={cn(
        "px-1.5 py-[1px] rounded text-[9.5px] font-mono uppercase tracking-wider ring-1",
        cfg.bg, cfg.text, cfg.ring,
      )}
    >
      {health}
    </span>
  );
}

function shortImage(img: string): string {
  if (!img) return "";
  // strip registry/host prefix (anything before the last "/")
  const slash = img.lastIndexOf("/");
  return slash >= 0 ? img.slice(slash + 1) : img;
}

function parseStatus(status: string): string | null {
  if (!status) return null;
  // examples: "Up 29 hours (healthy)", "Up 5 minutes", "Exited (0) 3 minutes ago"
  const m = status.match(/^(?:Up|Exited.*?)\s+(\d+\s+\w+)/i);
  return m ? m[1] : status.split(" ").slice(0, 3).join(" ");
}
