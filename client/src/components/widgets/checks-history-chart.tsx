"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { CheckResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Range = "1h" | "6h" | "24h" | "7d";

const RANGE_SECONDS: Record<Range, number> = {
  "1h":   3600,
  "6h":   6 * 3600,
  "24h":  24 * 3600,
  "7d":   7 * 86400,
};

export function ChecksHistoryChart({
  name,
  title,
  color = "#F97316",
}: {
  name: string;
  title: string;
  color?: string;
}) {
  const [range, setRange] = useState<Range>("1h");
  const since = Math.floor(Date.now() / 1000 - RANGE_SECONDS[range]);
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["checks", name, "history", range],
    queryFn: () =>
      api.get<CheckResult[]>(`/checks/${encodeURIComponent(name)}/history?since=${since}&limit=500`),
    refetchInterval: 30_000,
  });

  // live append
  useEffect(() => {
    const sock = connectNamespace("/checks");
    sock.on("check:result", (payload: { name: string }) => {
      if (payload.name !== name) return;
      qc.invalidateQueries({ queryKey: ["checks", name, "history"] });
    });
    return () => { sock.disconnect(); };
  }, [name, qc]);

  const points = useMemo(
    () =>
      data
        .map((r) => ({
          ts: r.ts * 1000,
          value: typeof r.metrics?.value === "number" ? (r.metrics.value as number) : null,
        }))
        .filter((p) => p.value !== null),
    [data],
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex items-center justify-between pb-2">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-1 rounded-full bg-bg-elev/70 border border-border-soft p-0.5">
          {(Object.keys(RANGE_SECONDS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-0.5 text-[11px] rounded-full transition",
                range === r
                  ? "bg-accent text-bg-base font-medium"
                  : "text-text-dim hover:text-text-strong",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 8, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) =>
                new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }
              stroke="#374151"
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#374151"
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#1E2128",
                border: "1px solid #262A33",
                borderRadius: 12,
                fontSize: 12,
                color: "#F4F4F5",
              }}
              labelFormatter={(t) => new Date(t as number).toLocaleString()}
              formatter={(v: number) => [`${v.toFixed(1)}%`, title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${name})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {points.length === 0 && (
          <div className="text-sm text-text-mute text-center py-12">
            no data yet for this range
          </div>
        )}
      </CardBody>
    </Card>
  );
}
