"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { CheckSummary } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Cpu, HardDrive, Heart, Layers, MemoryStick,
  Network, Server,
} from "lucide-react";

const ICON_BY_TYPE: Record<string, React.ElementType> = {
  cpu: Cpu,
  memory: MemoryStick,
  disk: HardDrive,
  http: Network,
  systemd: Server,
};

const LEVEL_THEME: Record<string, { dot: string; text: string; bg: string; ring: string }> = {
  ok:   { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-400/10", ring: "ring-emerald-400/30" },
  warn: { dot: "bg-amber-400",   text: "text-amber-300",   bg: "bg-amber-400/10",   ring: "ring-amber-400/35" },
  crit: { dot: "bg-rose-400",    text: "text-rose-300",    bg: "bg-rose-400/10",    ring: "ring-rose-400/40" },
  none: { dot: "bg-text-mute",   text: "text-text-mute",   bg: "bg-white/[0.04]",   ring: "ring-white/10" },
};

export function ChecksGrid() {
  const { data = [] } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 15_000,
  });

  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-3">
        <CardTitle>Checks</CardTitle>
        <span className="text-[10px] text-text-mute">
          {data.length} configured
        </span>
      </CardHeader>
      <CardBody className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.map((c) => {
          const Icon = ICON_BY_TYPE[c.type] ?? Activity;
          const theme = LEVEL_THEME[c.level ?? "none"];
          return (
            <div
              key={c.name}
              className={cn(
                "glass-inner p-3.5 flex items-center gap-3.5 transition group",
                "hover:bg-white/[0.045]",
              )}
            >
              <div
                className={cn(
                  "relative h-10 w-10 rounded-xl flex items-center justify-center ring-1",
                  theme.bg, theme.ring, theme.text,
                )}
              >
                <Icon size={18} />
                {c.level === "crit" && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-400 pulse-crit" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <div className="text-[13px] font-medium text-text-strong truncate">{c.name}</div>
                  <span className={cn("text-[10px] uppercase tracking-wider", theme.text)}>
                    {c.level ?? "—"}
                  </span>
                </div>
                <div className="text-[11px] text-text-mute truncate">
                  {c.type} · every {c.interval}s · {relativeTime(c.last_run_ts)}
                </div>
              </div>

              {c.last_value != null && (
                <div className={cn("text-[18px] font-semibold tabular-nums shrink-0", theme.text)}>
                  {c.last_value.toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="col-span-full text-sm text-text-mute text-center py-6">
            no checks configured
          </div>
        )}
      </CardBody>
    </Card>
  );
}
