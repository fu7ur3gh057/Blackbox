"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { CheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Range = "Days" | "Weeks" | "Months";
const RANGE_SECONDS: Record<Range, number> = {
  Days: 24 * 3600,
  Weeks: 7 * 86400,
  Months: 30 * 86400,
};

/**
 * Compact hero card — small, balanced, fits the inset-canvas language
 * of the new template. Single primary line (CPU), dotted secondary
 * line (Memory) on top so the widget reads at a glance.
 */
export function Statistics() {
  const [range, setRange] = useState<Range>("Days");
  const since = Math.floor(Date.now() / 1000 - RANGE_SECONDS[range]);
  const qc = useQueryClient();

  const cpuQ = useQuery({
    queryKey: ["checks", "cpu", "history", range],
    queryFn: () => api.get<CheckResult[]>(`/checks/cpu/history?since=${since}&limit=200`),
    refetchInterval: 30_000,
  });
  const memQ = useQuery({
    queryKey: ["checks", "memory", "history", range],
    queryFn: () => api.get<CheckResult[]>(`/checks/memory/history?since=${since}&limit=200`),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const sock = connectNamespace("/checks");
    sock.on("check:result", (p: { name: string }) => {
      if (p.name === "cpu" || p.name === "memory") {
        qc.invalidateQueries({ queryKey: ["checks", p.name, "history"] });
      }
    });
    return () => { sock.disconnect(); };
  }, [qc]);

  const points = useMemo(() => {
    const cpuMap = new Map<number, number>();
    (cpuQ.data ?? []).forEach((r) => {
      const v = r.metrics?.value;
      if (typeof v === "number") cpuMap.set(Math.floor(r.ts), v);
    });
    const memMap = new Map<number, number>();
    (memQ.data ?? []).forEach((r) => {
      const v = r.metrics?.value;
      if (typeof v === "number") memMap.set(Math.floor(r.ts), v);
    });
    const allTs = Array.from(new Set([...cpuMap.keys(), ...memMap.keys()])).sort();
    return allTs.map((ts) => ({
      ts: ts * 1000,
      cpu: cpuMap.get(ts) ?? null,
      mem: memMap.get(ts) ?? null,
    }));
  }, [cpuQ.data, memQ.data]);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <PanelTitle>Statistics</PanelTitle>
          <button className="flex items-center gap-1 text-[11px] text-ink-mute hover:text-ink-dim">
            CPU & Memory <ChevronDown size={12} />
          </button>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
          {(Object.keys(RANGE_SECONDS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1 text-[11px] rounded-full transition",
                range === r
                  ? "pill-active"
                  : "text-ink-mute hover:text-ink-dim",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </PanelHeader>

      <PanelBody className="pt-3">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 12, right: 8, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="stat-cpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeDasharray="3 5" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => {
                  const d = new Date(t);
                  return range === "Days"
                    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : `${d.getDate()}`;
                }}
                tick={{ fontSize: 10, fill: "#6E6E7A" }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#6E6E7A" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}`}
                width={36}
              />
              <Tooltip
                cursor={{ stroke: "rgba(196,181,253,0.30)", strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "rgba(33,36,49,0.95)",
                  border: "1px solid rgba(196,181,253,0.20)",
                  borderRadius: 12, fontSize: 12,
                }}
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#A78BFA"
                strokeWidth={2}
                fill="url(#stat-cpu)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: "#A78BFA", stroke: "#0F1119", strokeWidth: 2 }}
                name="CPU %"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="mem"
                stroke="#F0ABFC"
                strokeWidth={1.5}
                strokeDasharray="3 4"
                dot={false}
                isAnimationActive={false}
                name="Memory %"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tiny legend */}
        <div className="flex items-center gap-4 text-[10px] text-ink-mute pt-3 mt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-lavender" /> CPU
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full border border-dashed border-accent-pink" /> Memory
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
