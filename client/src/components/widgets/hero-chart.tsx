"use client";

import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { CheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Range = "1h" | "6h" | "24h" | "7d";
const RANGE_SECONDS: Record<Range, number> = {
  "1h": 3600, "6h": 6 * 3600, "24h": 24 * 3600, "7d": 7 * 86400,
};

type Metric = { name: string; label: string; color: string; glowClass: string };
const METRICS: Metric[] = [
  { name: "cpu",    label: "CPU",    color: "#F97316", glowClass: "text-glow-accent text-accent" },
  { name: "memory", label: "Memory", color: "#A78BFA", glowClass: "text-glow-violet text-violet-accent" },
];

/**
 * Hero card on the dashboard — stays visually dominant.
 * Big metric number with glow on the left, range tabs on the right,
 * dramatic gradient area chart filling the bottom half.
 */
export function HeroChart() {
  const [metricIdx, setMetricIdx] = useState(0);
  const [range, setRange] = useState<Range>("1h");
  const m = METRICS[metricIdx];
  const since = Math.floor(Date.now() / 1000 - RANGE_SECONDS[range]);
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["checks", m.name, "history", range],
    queryFn: () =>
      api.get<CheckResult[]>(`/checks/${m.name}/history?since=${since}&limit=500`),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const sock = connectNamespace("/checks");
    sock.on("check:result", (payload: { name: string }) => {
      if (payload.name !== m.name) return;
      qc.invalidateQueries({ queryKey: ["checks", m.name, "history"] });
    });
    return () => { sock.disconnect(); };
  }, [m.name, qc]);

  const points = useMemo(
    () =>
      data
        .map((r) => ({
          ts: r.ts * 1000,
          value: typeof r.metrics?.value === "number" ? (r.metrics.value as number) : null,
        }))
        .filter((p): p is { ts: number; value: number } => p.value !== null),
    [data],
  );

  const last = points.at(-1)?.value;
  const first = points[0]?.value;
  const delta = last != null && first != null ? last - first : null;

  return (
    <div className="glass relative overflow-hidden">
      {/* huge soft glow blob in the upper-right corner — pure decoration */}
      <div
        className="absolute -top-20 -right-12 h-72 w-72 rounded-full opacity-40 pointer-events-none blur-3xl"
        style={{ background: `radial-gradient(circle, ${m.color} 0%, transparent 70%)` }}
      />

      <div className="relative px-7 pt-6 flex items-start justify-between gap-4">
        {/* metric switcher */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.025] border border-white/[0.06] w-fit">
            {METRICS.map((mm, i) => (
              <button
                key={mm.name}
                onClick={() => setMetricIdx(i)}
                className={cn(
                  "px-3 py-1 text-[11px] uppercase tracking-wider rounded-full transition",
                  i === metricIdx
                    ? "bg-white/10 text-text-strong"
                    : "text-text-mute hover:text-text-dim",
                )}
              >
                {mm.label}
              </button>
            ))}
          </div>

          <div className="flex items-baseline gap-3 mt-3">
            <div className={cn("text-[68px] leading-none font-semibold tracking-tight", m.glowClass)}>
              {last != null ? `${last.toFixed(1)}%` : "—"}
            </div>
            {delta != null && (
              <div
                className={cn(
                  "pill border",
                  delta > 0
                    ? "bg-amber-400/10 text-amber-300 border-amber-400/25"
                    : "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
                )}
              >
                {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="text-[11px] text-text-mute mt-1.5">
            {points.length} samples · since {new Date(since * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        {/* range tabs */}
        <div className="flex items-center gap-0.5 p-1 rounded-full bg-white/[0.025] border border-white/[0.06]">
          {(Object.keys(RANGE_SECONDS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1 text-[11px] rounded-full transition",
                range === r
                  ? "bg-gradient-to-br from-accent to-orange-400 text-bg-base font-semibold"
                  : "text-text-dim hover:text-text-strong",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[220px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={m.color} stopOpacity={0.55} />
                <stop offset="55%"  stopColor={m.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="hero-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={m.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={m.color} stopOpacity={1}   />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              tick={{ fontSize: 10, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "3 3" }}
              contentStyle={{
                background: "rgba(18,20,26,0.85)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(t) => new Date(t as number).toLocaleString()}
              formatter={(v: number) => [`${v.toFixed(1)}%`, m.label]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#hero-stroke)"
              strokeWidth={2.5}
              fill="url(#hero-grad)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 5, stroke: m.color, strokeWidth: 2, fill: "#0A0B0F" }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-mute">
            no samples yet — check is starting up
          </div>
        )}
      </div>
    </div>
  );
}
