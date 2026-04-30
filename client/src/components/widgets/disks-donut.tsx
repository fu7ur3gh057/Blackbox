"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SystemSnapshot } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

const PALETTE = ["#F97316", "#FBBF24", "#34D399", "#60A5FA", "#A78BFA"];

export function DisksDonut() {
  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 10_000,
  });

  const disks = data?.disks ?? [];
  const total = disks.reduce((s, d) => s + d.used_gb, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Disks</CardTitle>
      </CardHeader>
      <CardBody className="grid grid-cols-2 gap-4 items-center">
        <div className="relative h-44">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={disks}
                dataKey="used_gb"
                nameKey="path"
                innerRadius={48}
                outerRadius={72}
                strokeWidth={0}
              >
                {disks.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-2xl font-semibold text-text-strong">
              {formatBytes(total)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-text-mute">used</div>
          </div>
        </div>

        <div className="space-y-2.5">
          {disks.map((d, i) => (
            <div key={d.path} className="flex items-center gap-2.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-text-strong truncate font-mono text-[11px]">{d.path}</div>
                <div className="text-text-mute">
                  {formatBytes(d.used_gb)} / {formatBytes(d.total_gb)}
                </div>
              </div>
              <div className="text-text-strong tabular-nums">{d.pct.toFixed(0)}%</div>
            </div>
          ))}
          {disks.length === 0 && (
            <div className="text-sm text-text-mute">no disks reported</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
