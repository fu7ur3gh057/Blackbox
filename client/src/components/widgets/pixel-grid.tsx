"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { AlertEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const ROWS = 4;
const COLS = 6;
const TOTAL = ROWS * COLS;

/**
 * 24-cell grid representing the last 24 hours, oldest top-left → newest
 * bottom-right. Each cell colours by alert volume in that hour. Cells
 * fade-in sequentially on mount (`pixel-pop`); the latest cell pulses
 * to draw attention to "now".
 */
export function PixelGrid() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", { range: "24h", limit: 500 }],
    queryFn: () =>
      api.get<AlertEvent[]>(`/alerts?before=${Math.floor(Date.now()/1000)+1}&limit=500`),
    refetchInterval: 60_000,
  });

  // Aggregate alerts into the last 24 hourly buckets. Cell index 0 is the
  // oldest hour (24h ago), index 23 is "now".
  const cells = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const startBucket = now - TOTAL * 3600;
    const counts: Array<{ count: number; crit: number }> = Array.from(
      { length: TOTAL },
      () => ({ count: 0, crit: 0 }),
    );
    for (const a of alerts) {
      const idx = Math.floor((a.ts - startBucket) / 3600);
      if (idx < 0 || idx >= TOTAL) continue;
      counts[idx].count++;
      if (a.level === "crit") counts[idx].crit++;
    }
    return counts;
  }, [alerts]);

  const totalAlerts = cells.reduce((s, c) => s + c.count, 0);

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between pb-1">
        <PanelTitle className="text-[13px]">Activity · 24h</PanelTitle>
        <span className="pill-ghost tabular-nums">{totalAlerts}</span>
      </PanelHeader>
      <PanelBody className="pt-4">
        <div className="grid grid-cols-6 gap-1.5">
          {cells.map((c, i) => {
            const intensity = c.count;
            const isNow = i === TOTAL - 1;
            const cls = pickClass(intensity, c.crit > 0);
            return (
              <div
                key={i}
                title={`${i - TOTAL + 1 === 0 ? "now" : `${TOTAL - 1 - i}h ago`} · ${intensity} alerts`}
                className={cn(
                  "pixel-cell aspect-square rounded-md transition-colors",
                  cls,
                  isNow && "pixel-now ring-1 ring-accent-green/40",
                )}
                style={{ animationDelay: `${i * 35}ms` }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 text-[10px] text-ink-mute">
          <span className="uppercase tracking-wider">24h ago</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white/[0.04]" />
            <span className="h-2 w-2 rounded-sm bg-accent-green/30" />
            <span className="h-2 w-2 rounded-sm bg-accent-green/60" />
            <span className="h-2 w-2 rounded-sm bg-accent-bright/70" />
            <span className="h-2 w-2 rounded-sm bg-level-crit/80" />
          </div>
          <span className="uppercase tracking-wider text-accent-pale">now</span>
        </div>
      </PanelBody>
    </Panel>
  );
}

function pickClass(count: number, hasCrit: boolean): string {
  if (count === 0) return "bg-white/[0.035] border border-white/[0.04]";
  if (hasCrit) return "bg-level-crit/70 shadow-[0_0_12px_rgba(252,165,165,0.45)]";
  if (count >= 6) return "bg-accent-bright/70 shadow-[0_0_12px_rgba(255,255,255,0.4)]";
  if (count >= 3) return "bg-accent-green/60 shadow-[0_0_10px_rgba(143,191,152,0.4)]";
  return "bg-accent-green/30";
}
