"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SystemSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

/**
 * Half-circle speedometer. Needle rotates from -90° (0 %) to +90° (100 %).
 * The colored arc fills in proportional to the value via stroke-dasharray;
 * tick marks sit just outside the arc; centred metric below.
 */
export function GaugeMeter() {
  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 5_000,
  });
  const pct = Math.max(0, Math.min(100, data?.cpu_pct ?? 0));
  const needleAngle = -90 + (pct / 100) * 180;

  // The arc sweeps a half circle: r=80 → length = πr ≈ 251.3
  const ARC_LENGTH = Math.PI * 80;
  const filled = (pct / 100) * ARC_LENGTH;

  const tone =
    pct >= 90 ? "crit" : pct >= 70 ? "warn" : "ok";
  const TONE: Record<string, { stroke: string; glow: string; label: string }> = {
    ok:   { stroke: "url(#gauge-ok)",   glow: "rgba(167,139,250,0.55)", label: "text-accent-lavender" },
    warn: { stroke: "url(#gauge-warn)", glow: "rgba(251,191,36,0.55)",  label: "text-level-warn" },
    crit: { stroke: "url(#gauge-crit)", glow: "rgba(252,165,165,0.6)",  label: "text-level-crit" },
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader className="pb-1">
        <div className="flex items-center justify-between">
          <PanelTitle className="text-[13px]">CPU load</PanelTitle>
          <span className="pill-ghost">{tone}</span>
        </div>
      </PanelHeader>
      <PanelBody className="pt-3 flex flex-col items-center">
        <svg viewBox="0 0 200 130" className="w-full max-w-[260px]">
          <defs>
            <linearGradient id="gauge-ok" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>
            <linearGradient id="gauge-warn" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
            <linearGradient id="gauge-crit" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#FCA5A5" />
            </linearGradient>
            <radialGradient id="gauge-hub" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#1A1D25" />
              <stop offset="100%" stopColor="#0A0B0F" />
            </radialGradient>
          </defs>

          {/* track */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            stroke="#1A1D25" fill="none" strokeWidth="14" strokeLinecap="round"
          />
          {/* filled arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            stroke={TONE[tone].stroke}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${ARC_LENGTH}`}
            style={{ filter: `drop-shadow(0 0 10px ${TONE[tone].glow})`, transition: "stroke-dasharray 0.6s ease-out" }}
          />

          {/* tick marks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = -180 + i * 18;
            const r1 = 70;
            const r2 = i % 5 === 0 ? 60 : 64;
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={100 + r1 * Math.cos(rad)}
                y1={100 + r1 * Math.sin(rad)}
                x2={100 + r2 * Math.cos(rad)}
                y2={100 + r2 * Math.sin(rad)}
                stroke="#3a3d4a"
                strokeWidth={i % 5 === 0 ? 1.6 : 1}
              />
            );
          })}

          {/* needle */}
          <g
            className="gauge-needle"
            style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: "100px 100px" }}
          >
            <defs>
              <linearGradient id="needle-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F0E5CC" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>
            <path d="M 100 35 L 96 100 L 104 100 Z" fill="url(#needle-grad)" />
            <circle cx="100" cy="100" r="8" fill="url(#gauge-hub)" stroke="#A78BFA" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="2.5" fill="#F0E5CC" />
          </g>
        </svg>

        <div className="mt-1 text-center">
          <div className={cn("text-[40px] leading-none font-semibold tabular-nums", TONE[tone].label)}>
            {pct.toFixed(1)}<span className="text-[18px] text-ink-mute">%</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            load 1m {data?.load_1m?.toFixed(2) ?? "—"}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
