"use client";

import { Card, CardBody } from "@/components/ui/card";
import { KpiCard } from "@/components/widgets/kpi-card";
import { api } from "@/lib/api";
import type { SystemSnapshot } from "@/lib/types";
import { formatPct } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

function pickLevel(pct: number): "ok" | "warn" | "crit" {
  if (pct >= 90) return "crit";
  if (pct >= 80) return "warn";
  return "ok";
}

export function SystemKpis() {
  const { data, isLoading } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 5_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardBody className="h-24 animate-pulse" /></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="CPU"
        value={formatPct(data.cpu_pct)}
        hint={`load 1m  ${data.load_1m.toFixed(2)}`}
        level={pickLevel(data.cpu_pct)}
        glow
      />
      <KpiCard
        label="Memory"
        value={formatPct(data.memory_pct)}
        hint={`${data.memory_used_gb.toFixed(1)} / ${data.memory_total_gb.toFixed(1)} GB`}
        level={pickLevel(data.memory_pct)}
        glow
      />
      <KpiCard
        label="Swap"
        value={formatPct(data.swap_pct)}
        hint={data.swap_pct > 0 ? "active" : "idle"}
        level={data.swap_pct > 0 ? "warn" : "ok"}
        glow
      />
      <KpiCard
        label="Uptime"
        value={formatUptime(data.uptime_seconds)}
        hint={`load 15m  ${data.load_15m.toFixed(2)}`}
      />
    </div>
  );
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}
