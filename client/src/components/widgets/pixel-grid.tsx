"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { AlertEvent } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const HOURS = 24;

/**
 * 24-bar spectrum of the last 24h of alerts. Bar height ~ alert count,
 * tone shifts pale → bright → crit by severity. A scan-line sweeps the
 * whole range to keep it feeling alive even when nothing is happening.
 */
export function PixelGrid() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", { range: "24h", limit: 500 }],
    queryFn: () =>
      api.get<AlertEvent[]>(`/alerts?before=${Math.floor(Date.now()/1000)+1}&limit=500`),
    refetchInterval: 60_000,
  });

  const buckets = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - HOURS * 3600;
    const out: Array<{ count: number; crit: number; warn: number }> = Array.from(
      { length: HOURS },
      () => ({ count: 0, crit: 0, warn: 0 }),
    );
    for (const a of alerts) {
      const idx = Math.floor((a.ts - start) / 3600);
      if (idx < 0 || idx >= HOURS) continue;
      out[idx].count++;
      if (a.level === "crit") out[idx].crit++;
      else if (a.level === "warn") out[idx].warn++;
    }
    return out;
  }, [alerts]);

  const total = buckets.reduce((s, b) => s + b.count, 0);
  const peak = Math.max(1, ...buckets.map((b) => b.count));

  // SVG canvas: 24 bars over a 240×60 stage gives 8px wide bars + 2px gap.
  const W = 240, H = 60, BAR = 8, GAP = 2;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader className="flex items-center justify-between pb-1">
        <PanelTitle className="text-[13px]">Activity · 24h</PanelTitle>
        <span className="pill-ghost tabular-nums">{total}</span>
      </PanelHeader>
      <PanelBody className="pt-2 pb-3">
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[72px]"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="bar-cool" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%"  stopColor="#E0E0E5" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="bar-warn" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%"  stopColor="#FBBF24" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="bar-crit" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%"  stopColor="#EF4444" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* horizontal grid */}
            {[0.25, 0.5, 0.75].map((p) => (
              <line
                key={p}
                x1="0" x2={W}
                y1={H - p * H} y2={H - p * H}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="0.5"
                strokeDasharray="2 3"
              />
            ))}
            {/* baseline */}
            <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="rgba(224,224,229,0.18)" strokeWidth="0.6" />

            {/* bars */}
            {buckets.map((b, i) => {
              const x = i * (BAR + GAP);
              const isNow = i === HOURS - 1;
              const empty = b.count === 0;
              const minH = empty ? 1.5 : 4;
              const h = empty ? minH : Math.max(minH, (b.count / peak) * (H - 4));
              const fill =
                b.crit > 0 ? "url(#bar-crit)"
                : b.warn > 0 ? "url(#bar-warn)"
                : empty ? "rgba(255,255,255,0.05)"
                : "url(#bar-cool)";

              return (
                <g key={i}>
                  <title>
                    {`${HOURS - 1 - i === 0 ? "now" : `${HOURS - 1 - i}h ago`} · ${b.count} alerts`}
                  </title>
                  <rect
                    x={x}
                    y={H - h}
                    width={BAR}
                    height={h}
                    rx={1.2}
                    fill={fill}
                  >
                    <animate
                      attributeName="height"
                      from="0"
                      to={h}
                      dur="0.6s"
                      begin={`${i * 0.025}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="y"
                      from={H}
                      to={H - h}
                      dur="0.6s"
                      begin={`${i * 0.025}s`}
                      fill="freeze"
                    />
                  </rect>
                  {isNow && !empty && (
                    <circle cx={x + BAR / 2} cy={H - h - 1.5} r="1.4" fill="#FFFFFF">
                      <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* scan beam — sweeps left → right */}
            <g>
              <rect x="-2" y="0" width="2" height={H} fill="rgba(255,255,255,0.5)">
                <animate
                  attributeName="x"
                  values={`-2;${W};${W}`}
                  keyTimes="0;0.85;1"
                  dur="6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.6;0"
                  keyTimes="0;0.5;1"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          </svg>
        </div>

        <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-ink-mute">
          <span>−24h</span>
          <span>−12h</span>
          <span className="text-accent-pale">now</span>
        </div>
      </PanelBody>
    </Panel>
  );
}
