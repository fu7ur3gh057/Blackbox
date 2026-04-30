"use client";

import { api } from "@/lib/api";
import { refreshDockerSnapshot } from "@/lib/use-snapshot";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronDown, Copy, Loader2, Plus, Telescope } from "lucide-react";
import { useState } from "react";

interface DiscoveredProject {
  name: string;
  status: string;
  compose: string;
  services: string[];
  ports: number[];
}

interface DiscoveryResponse {
  discovered: DiscoveredProject[];
  error: string | null;
}

/**
 * Lists compose projects running on the host that aren't yet listed in
 * `config.report.docker`. Each entry can be expanded to copy a ready-to-paste
 * YAML snippet — wizard pattern, no auto-write.
 */
export function DiscoverySection() {
  const { data, isLoading } = useQuery({
    queryKey: ["docker-discovered"],
    queryFn: () => api.get<DiscoveryResponse>("/docker/discovered"),
    refetchInterval: 60_000,
  });

  const list = data?.discovered ?? [];

  if (data?.error) {
    return (
      <Wrapper count={null}>
        <div className="text-[12px] text-level-crit/90 font-mono">
          discovery failed: {data.error}
        </div>
      </Wrapper>
    );
  }

  if (isLoading) {
    return (
      <Wrapper count={null}>
        <div className="text-[11px] text-ink-mute font-mono">scanning host…</div>
      </Wrapper>
    );
  }

  if (list.length === 0) {
    return (
      <Wrapper count={0}>
        <div className="text-[11px] text-ink-mute font-mono">
          all running compose projects on this host are already under monitoring
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper count={list.length}>
      <div className="space-y-2">
        {list.map((p) => (
          <DiscoveredRow key={p.compose} project={p} />
        ))}
      </div>
    </Wrapper>
  );
}

function Wrapper({ children, count }: { children: React.ReactNode; count: number | null }) {
  return (
    <div className="rounded-card border border-accent-pale/20 bg-accent-pale/[0.025] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Telescope size={14} className="text-accent-pale" />
        <h2 className="text-[13px] font-semibold text-ink-strong tracking-tight">
          Discovered
        </h2>
        {count !== null && count > 0 && (
          <span className="px-1.5 py-[1px] rounded text-[9.5px] font-bold tracking-wider font-mono bg-accent-pale/15 text-accent-pale ring-1 ring-accent-pale/30">
            {count}
          </span>
        )}
        <span className="text-[10.5px] text-ink-mute font-mono">
          running on host but not under monitoring
        </span>
      </div>
      {children}
    </div>
  );
}

function DiscoveredRow({ project }: { project: DiscoveredProject }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  async function add() {
    setAdding(true);
    setError(null);
    setWarning(null);
    try {
      const res = await api.post<{ ok: boolean; warning: string | null }>(
        "/docker/monitor",
        { compose: project.compose, services: project.services },
      );
      if (res.warning) setWarning(res.warning);
      // Refresh both lists in parallel so the project drops off Discovery
      // and shows up in the main grid in the same render frame — no need
      // to wait for the next WS tick.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["docker-discovered"] }),
        refreshDockerSnapshot(qc),
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.05] bg-canvas-elev overflow-hidden">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.025] transition-colors text-left"
        >
          <div className="h-7 w-7 rounded-lg bg-accent-pale/[0.10] text-accent-pale flex items-center justify-center text-[12px] font-bold">
            {project.name[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-ink-strong truncate">
              {project.name}
              {project.status && (
                <span className="ml-2 text-[10px] text-ink-mute font-mono">{project.status}</span>
              )}
            </div>
            <div className="text-[10px] font-mono text-ink-mute truncate" title={project.compose}>
              {project.compose}
            </div>
          </div>
          {project.ports.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
              {project.ports.slice(0, 4).map((p) => (
                <span
                  key={p}
                  className="px-1.5 py-[2px] rounded text-[9.5px] font-mono bg-white/[0.04] text-ink-dim ring-1 ring-white/[0.06]"
                >
                  {p}
                </span>
              ))}
              {project.ports.length > 4 && (
                <span className="text-[9.5px] text-ink-mute font-mono">+{project.ports.length - 4}</span>
              )}
            </div>
          )}
          {project.services.length > 0 && (
            <span className="text-[10px] text-ink-dim font-mono">
              {project.services.length} svc
            </span>
          )}
          <ChevronDown
            size={13}
            className={cn(
              "text-ink-mute transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={add}
          disabled={adding}
          className={cn(
            "flex items-center gap-1.5 px-3 border-l border-white/[0.05]",
            "text-[11px] font-mono transition-colors",
            "bg-accent-pale/[0.06] text-accent-pale hover:bg-accent-pale/[0.14]",
            "disabled:opacity-60 disabled:cursor-wait",
          )}
          title="add this project to config.report.docker"
        >
          {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          {adding ? "adding…" : "add"}
        </button>
      </div>
      {warning && (
        <div className="px-4 py-2 border-t border-level-warn/30 bg-level-warn/[0.06] text-[10.5px] font-mono text-level-warn flex items-start gap-2">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          {warning}
        </div>
      )}
      {error && (
        <div className="px-4 py-2 border-t border-level-crit/30 bg-level-crit/[0.06] text-[10.5px] font-mono text-level-crit flex items-start gap-2">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {open && (
        <ExpandedYaml project={project} />
      )}
    </div>
  );
}

function ExpandedYaml({ project }: { project: DiscoveredProject }) {
  const yaml = renderYaml(project);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="border-t border-white/[0.04] bg-black/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-mono text-ink-mute uppercase tracking-wider">
          add to <span className="text-accent-pale">config.report.docker</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono ring-1 transition-colors",
            copied
              ? "bg-level-ok/15 text-level-ok ring-level-ok/30"
              : "bg-white/[0.04] text-ink-dim ring-white/[0.06] hover:bg-white/[0.08]",
          )}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="font-mono text-[11.5px] text-zinc-300 whitespace-pre-wrap break-all">
        {yaml}
      </pre>
      <div className="mt-3 text-[10.5px] text-ink-mute font-mono leading-relaxed">
        paste under <span className="text-accent-pale">report:</span>{" "}
        <span className="text-accent-pale">docker:</span> in your config.yaml,
        then{" "}
        <span className="text-accent-pale">systemctl restart blackbox</span>.
      </div>
    </div>
  );
}

function renderYaml(p: DiscoveredProject): string {
  const lines = [
    `  - compose: "${p.compose}"`,
  ];
  if (p.services.length > 0) {
    lines.push(`    containers: [${p.services.join(", ")}]`);
  }
  return lines.join("\n");
}
