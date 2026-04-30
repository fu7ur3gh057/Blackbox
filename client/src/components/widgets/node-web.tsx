"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { CheckSummary, Level } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const LEVEL: Record<Level, { fill: string; ring: string; glow: string }> = {
  ok:   { fill: "#22FF66", ring: "rgba(34,255,102,0.55)",  glow: "drop-shadow(0 0 14px rgba(34,255,102,0.55))" },
  warn: { fill: "#FDE68A", ring: "rgba(253,230,138,0.55)",  glow: "drop-shadow(0 0 14px rgba(253,230,138,0.55))" },
  crit: { fill: "#FCA5A5", ring: "rgba(252,165,165,0.65)",  glow: "drop-shadow(0 0 16px rgba(252,165,165,0.65))" },
};

const DUMMY: CheckSummary[] = [
  { name: "cpu",           type: "cpu",     interval: 30, level: "ok",   last_run_ts: null, last_value: 23, last_detail: null },
  { name: "memory",        type: "memory",  interval: 30, level: "warn", last_run_ts: null, last_value: 81, last_detail: null },
  { name: "disk-/",        type: "disk",    interval: 60, level: "ok",   last_run_ts: null, last_value: 42, last_detail: null },
  { name: "disk-/var",     type: "disk",    interval: 60, level: "crit", last_run_ts: null, last_value: 95, last_detail: null },
  { name: "systemd-nginx", type: "systemd", interval: 60, level: "ok",   last_run_ts: null, last_value: null, last_detail: null },
  { name: "http-api",      type: "http",    interval: 30, level: "ok",   last_run_ts: null, last_value: null, last_detail: null },
];

/**
 * Orbital graph: a central "blackbox" node with each configured check
 * floating around it on a ring. Lines connect everything to the centre
 * with subtle gradient fades; node colour reflects the current level
 * and a halo ring pulses outward.
 */
export function NodeWeb() {
  const { data } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 15_000,
  });

  const checks = data && data.length > 0 ? data : DUMMY;
  const n = checks.length;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader className="pb-1">
        <div className="flex items-center justify-between">
          <PanelTitle className="text-[13px]">Network · {n} checks</PanelTitle>
          <span className="pill-ghost">{!data || data.length === 0 ? "preview" : "live"}</span>
        </div>
      </PanelHeader>
      <PanelBody className="pt-2">
        <div className="relative aspect-square max-h-[260px] mx-auto">
          {/* concentric rings */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
            <defs>
              <radialGradient id="orbit-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(34,255,102,0.10)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <linearGradient id="orbit-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="rgba(34,255,102,0.45)" />
                <stop offset="100%" stopColor="rgba(34,255,102,0.05)" />
              </linearGradient>
            </defs>

            <circle cx="100" cy="100" r="95" fill="url(#orbit-bg)" />
            <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
            <circle cx="100" cy="100" r="65" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />

            {/* connecting lines from centre to each node */}
            {checks.map((_, i) => {
              const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
              const x = 100 + 75 * Math.cos(angle);
              const y = 100 + 75 * Math.sin(angle);
              return (
                <line
                  key={i}
                  x1="100" y1="100"
                  x2={x} y2={y}
                  stroke="url(#orbit-line)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* central blackbox node */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-accent-green to-accent-bright flex items-center justify-center text-[14px] font-bold text-canvas shadow-chip">
              b
              <span
                className="absolute inset-0 rounded-2xl"
                style={{ animation: "node-ring 2.4s ease-out infinite", border: "2px solid rgba(34,255,102,0.45)" }}
              />
            </div>
          </div>

          {/* orbiting check nodes */}
          {checks.map((c, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            const x = 50 + 37.5 * Math.cos(angle);   // % position based on container
            const y = 50 + 37.5 * Math.sin(angle);
            const lvl = (c.level ?? "ok") as Level;
            const t = LEVEL[lvl];
            return (
              <div
                key={c.name}
                title={`${c.name} · ${c.level ?? "—"}${c.last_value != null ? ` · ${c.last_value.toFixed(0)}%` : ""}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  animation: `float-orbit ${4 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`,
                }}
              >
                <div className="relative">
                  {/* halo ring */}
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      animation: "node-ring 2.6s ease-out infinite",
                      animationDelay: `${i * 0.2}s`,
                      border: `1.5px solid ${t.ring}`,
                    }}
                  />
                  {/* dot */}
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full ring-2 ring-canvas",
                      "flex items-center justify-center text-[10px] font-bold text-canvas",
                    )}
                    style={{
                      background: t.fill,
                      filter: t.glow,
                    }}
                  >
                    {c.name[0]?.toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PanelBody>
    </Panel>
  );
}
