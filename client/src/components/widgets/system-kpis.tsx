"use client";

import { KpiCard } from "@/components/widgets/kpi-card";
import { api } from "@/lib/api";
import type { SystemSnapshot } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const HISTORY_DEPTH = 24; // 24 ticks × 5s = 2 min sparkline window

interface History {
  cpu: number[];
  mem: number[];
  swap: number[];
}

export function SystemKpis() {
  const historyRef = useRef<History>({ cpu: [], mem: [], swap: [] });

  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 5_000,
  });

  // accumulate sparkline points client-side; cheap and avoids burning a
  // backend endpoint just for an in-memory ring buffer
  useEffect(() => {
    if (!data) return;
    const h = historyRef.current;
    h.cpu  = [...h.cpu,  data.cpu_pct].slice(-HISTORY_DEPTH);
    h.mem  = [...h.mem,  data.memory_pct].slice(-HISTORY_DEPTH);
    h.swap = [...h.swap, data.swap_pct].slice(-HISTORY_DEPTH);
  }, [data]);

  const h = historyRef.current;

  function delta(arr: number[]): number | undefined {
    if (arr.length < 2) return undefined;
    return arr[arr.length - 1] - arr[0];
  }

  if (!data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass h-[148px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="CPU usage"
        value={`${data.cpu_pct.toFixed(1)}%`}
        hint={`load 1m  ${data.load_1m.toFixed(2)}`}
        delta={delta(h.cpu)}
        glow={pickGlow(data.cpu_pct, "accent")}
        spark={h.cpu}
      />
      <KpiCard
        label="Memory"
        value={`${data.memory_pct.toFixed(1)}%`}
        hint={`${data.memory_used_gb.toFixed(1)} / ${data.memory_total_gb.toFixed(1)} GB`}
        delta={delta(h.mem)}
        glow={pickGlow(data.memory_pct, "violet")}
        spark={h.mem}
      />
      <KpiCard
        label="Swap"
        value={`${data.swap_pct.toFixed(1)}%`}
        hint={data.swap_pct > 0 ? "actively paging" : "idle"}
        delta={delta(h.swap)}
        glow={data.swap_pct > 50 ? "warn" : "cyan"}
        spark={h.swap}
      />
      <KpiCard
        label="Uptime"
        value={formatUptime(data.uptime_seconds)}
        hint={`load 15m  ${data.load_15m.toFixed(2)}`}
        glow="none"
      />
    </div>
  );
}

function pickGlow(pct: number, normal: "accent" | "violet"): "accent" | "violet" | "warn" | "crit" {
  if (pct >= 90) return "crit";
  if (pct >= 80) return "warn";
  return normal;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}
