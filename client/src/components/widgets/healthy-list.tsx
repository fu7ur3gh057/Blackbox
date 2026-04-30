"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { CheckSummary } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick, Network, Server, Activity } from "lucide-react";

const ICON_BY_TYPE: Record<string, React.ElementType> = {
  cpu: Cpu, memory: MemoryStick, disk: HardDrive, http: Network, systemd: Server,
};

/**
 * Mirror of the reference's "Break" list — the calm side: things that
 * are fine right now. Reads /api/checks and filters to ok+null levels.
 */
export function HealthyList() {
  const { data = [] } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 30_000,
  });

  const calm = data.filter((c) => c.level === "ok" || c.level == null);

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between pb-1">
        <PanelTitle>Healthy</PanelTitle>
        <span className="text-[10px] text-ink-mute">{calm.length} of {data.length}</span>
      </PanelHeader>
      <PanelBody className="pt-2">
        {calm.length === 0 && (
          <div className="text-[12px] text-ink-mute py-6 text-center">no checks yet</div>
        )}
        {calm.map((c, i) => {
          const Icon = ICON_BY_TYPE[c.type] ?? Activity;
          return (
            <div
              key={c.name}
              className={cn(
                "flex items-center gap-3 py-2.5",
                i !== calm.length - 1 && "border-b border-dashed border-white/[0.06]",
              )}
            >
              <div className="h-8 w-8 rounded-full bg-accent-green/15 text-accent-pale flex items-center justify-center">
                <Icon size={14} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink-strong truncate">{c.name}</div>
                <div className="text-[11px] text-ink-mute">
                  {c.type} · {relativeTime(c.last_run_ts)}
                </div>
              </div>
              {c.last_value != null && (
                <span className="text-[12px] font-semibold text-ink-dim tabular-nums">
                  {c.last_value.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
