"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SystemSnapshot } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

const PALETTE = [
  { stroke: "#F97316", glow: "rgba(249,115,22,0.55)" },   // orange
  { stroke: "#A78BFA", glow: "rgba(167,139,250,0.55)" },  // violet
  { stroke: "#22D3EE", glow: "rgba(34,211,238,0.50)" },   // cyan
  { stroke: "#FB7185", glow: "rgba(251,113,133,0.55)" },  // rose
  { stroke: "#34D399", glow: "rgba(52,211,153,0.55)" },   // emerald
];

export function DisksDonut() {
  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 10_000,
  });

  const disks = data?.disks ?? [];
  const totalUsed = disks.reduce((s, d) => s + d.used_gb, 0);

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between pb-3">
        <CardTitle>Storage</CardTitle>
        <span className="text-[10px] text-text-mute">{disks.length} mount{disks.length === 1 ? "" : "s"}</span>
      </CardHeader>
      <CardBody className="grid grid-cols-2 gap-5 items-center pt-2">
        <div className="relative h-44">
          <ResponsiveContainer>
            <PieChart>
              <defs>
                {PALETTE.map((c, i) => (
                  <linearGradient key={i} id={`disk-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor={c.stroke} stopOpacity={1} />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity={0.55} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={disks}
                dataKey="used_gb"
                nameKey="path"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
                strokeWidth={0}
                cornerRadius={4}
              >
                {disks.map((_, i) => (
                  <Cell key={i} fill={`url(#disk-grad-${i % PALETTE.length})`} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-2xl font-semibold text-text-strong">{formatBytes(totalUsed)}</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-text-mute mt-0.5">used total</div>
          </div>
        </div>

        <div className="space-y-2.5">
          {disks.map((d, i) => {
            const c = PALETTE[i % PALETTE.length];
            return (
              <div
                key={d.path}
                className="glass-inner px-3 py-2 flex items-center gap-3"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: c.stroke, boxShadow: `0 0 8px 1px ${c.glow}` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-text-strong font-mono truncate">{d.path}</div>
                  <div className="text-[10px] text-text-mute">
                    {formatBytes(d.used_gb)} / {formatBytes(d.total_gb)}
                  </div>
                </div>
                <div
                  className="text-[15px] font-semibold tabular-nums"
                  style={{ color: c.stroke }}
                >
                  {d.pct.toFixed(0)}%
                </div>
              </div>
            );
          })}
          {disks.length === 0 && (
            <div className="text-sm text-text-mute">no disks reported</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
