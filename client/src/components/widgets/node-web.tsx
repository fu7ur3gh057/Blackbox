"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { CheckSummary, Level } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

const LEVEL: Record<Level, { fill: string; ring: string; glowColor: string }> = {
  ok:   { fill: "#B5D17A", ring: "#B5D17A", glowColor: "rgba(181,209,122,0.55)" },
  warn: { fill: "#FDE68A", ring: "#FDE68A", glowColor: "rgba(253,230,138,0.55)" },
  crit: { fill: "#FCA5A5", ring: "#FCA5A5", glowColor: "rgba(252,165,165,0.65)" },
};

const DUMMY: CheckSummary[] = [
  { name: "cpu",           type: "cpu",     interval: 30, level: "ok",   last_run_ts: null, last_value: 23, last_detail: null },
  { name: "memory",        type: "memory",  interval: 30, level: "warn", last_run_ts: null, last_value: 81, last_detail: null },
  { name: "disk-/",        type: "disk",    interval: 60, level: "ok",   last_run_ts: null, last_value: 42, last_detail: null },
  { name: "disk-/var",     type: "disk",    interval: 60, level: "crit", last_run_ts: null, last_value: 95, last_detail: null },
  { name: "systemd-nginx", type: "systemd", interval: 60, level: "ok",   last_run_ts: null, last_value: null, last_detail: null },
  { name: "http-api",      type: "http",    interval: 30, level: "ok",   last_run_ts: null, last_value: null, last_detail: null },
];

const VIEW = 200;
const CENTER = 100;
const ORBIT_R = 76;

/**
 * Orbital diagram of every configured check around a central blackbox
 * node. Pure SVG — no DOM-positioned nodes — so animations run on the
 * compositor and stay smooth at 60 fps.
 *
 * What's animated:
 *   • central halo ring expands + fades infinitely (smartCard core)
 *   • a slow rotating ring at the orbit radius (compass-like)
 *   • each connecting line carries a *travelling packet* — a small dot
 *     that runs from centre to its node, looping (`<animateMotion>`)
 *   • each node has a soft halo + a subtle drift along its own orbit
 *     (also via animateTransform, GPU-friendly)
 */
export function NodeWeb() {
  const { data } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 15_000,
  });

  const checks = data && data.length > 0 ? data : DUMMY;
  const n = checks.length;
  const isPreview = !data || data.length === 0;

  return (
    <Panel className="overflow-hidden flex flex-col">
      <PanelHeader className="pb-1">
        <div className="flex items-center justify-between">
          <PanelTitle className="text-[13px]">Network · {n} checks</PanelTitle>
          <span className="pill-ghost">{isPreview ? "preview" : "live"}</span>
        </div>
      </PanelHeader>
      <PanelBody className="pt-2 flex-1 flex items-center justify-center">
        <div className="relative aspect-square w-full max-h-[280px]">
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <defs>
              <radialGradient id="orbit-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(181,209,122,0.12)" />
                <stop offset="60%"  stopColor="rgba(181,209,122,0.04)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="rgba(181,209,122,0.45)" />
                <stop offset="100%" stopColor="rgba(181,209,122,0.05)" />
              </linearGradient>
              <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="rgba(214,242,107,0.55)" />
                <stop offset="100%" stopColor="rgba(214,242,107,0)"    />
              </radialGradient>
              <linearGradient id="core-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor="#E8FF8F" />
                <stop offset="100%" stopColor="#B5D17A" />
              </linearGradient>
            </defs>

            {/* Background halo */}
            <circle cx={CENTER} cy={CENTER} r="98" fill="url(#orbit-bg)" />

            {/* Slowly rotating tick ring at orbit radius */}
            <g transform-origin={`${CENTER} ${CENTER}`}>
              <circle
                cx={CENTER} cy={CENTER} r={ORBIT_R}
                fill="none" stroke="rgba(181,209,122,0.18)"
                strokeWidth="0.6" strokeDasharray="1.5 4"
              >
                <animateTransform
                  attributeName="transform"
                  attributeType="XML"
                  type="rotate"
                  from={`0 ${CENTER} ${CENTER}`}
                  to={`360 ${CENTER} ${CENTER}`}
                  dur="60s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={CENTER} cy={CENTER} r={ORBIT_R - 18}
                fill="none" stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.4" strokeDasharray="1 3"
              />
            </g>

            {/* Connecting lines + travelling packets */}
            {checks.map((_, i) => {
              const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
              const x = CENTER + ORBIT_R * Math.cos(angle);
              const y = CENTER + ORBIT_R * Math.sin(angle);
              const dur = 3 + (i % 4) * 0.8; // slight per-node variation
              const delay = (i * dur) / n;
              return (
                <g key={`line-${i}`}>
                  <line
                    x1={CENTER} y1={CENTER}
                    x2={x} y2={y}
                    stroke="url(#line-grad)"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                  {/* packet — travels centre → node, loops */}
                  <circle r="1.4" fill="#E8FF8F" opacity="0.9" filter="url(#)">
                    <animateMotion
                      dur={`${dur}s`}
                      begin={`-${delay}s`}
                      repeatCount="indefinite"
                      path={`M ${CENTER} ${CENTER} L ${x} ${y}`}
                      keyTimes="0;1"
                      keyPoints="0;1"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;0.9;0.9;0"
                      keyTimes="0;0.1;0.85;1"
                      dur={`${dur}s`}
                      begin={`-${delay}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}

            {/* Per-node nodes (now SVG-native, smoother on GPU) */}
            {checks.map((c, i) => {
              const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
              const x = CENTER + ORBIT_R * Math.cos(angle);
              const y = CENTER + ORBIT_R * Math.sin(angle);
              const lvl = (c.level ?? "ok") as Level;
              const t = LEVEL[lvl];
              const driftDur = 4 + (i % 3) * 0.7;
              const haloDelay = i * 0.25;
              return (
                <g key={`node-${i}`}>
                  {/* drift wrapper — node + halo gently slide along their
                      own short tangent so the diagram breathes */}
                  <g>
                    <animateTransform
                      attributeName="transform"
                      attributeType="XML"
                      type="translate"
                      values="0,0; 0,-2; 0,0; 0,2; 0,0"
                      dur={`${driftDur}s`}
                      begin={`-${i * 0.4}s`}
                      repeatCount="indefinite"
                    />

                    {/* expanding halo */}
                    <circle
                      cx={x} cy={y} r="6"
                      fill="none" stroke={t.ring} strokeWidth="0.8"
                      opacity="0"
                    >
                      <animate attributeName="r"       values="5;14"   dur="3s" begin={`${haloDelay}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.55;0" dur="3s" begin={`${haloDelay}s`} repeatCount="indefinite" />
                    </circle>

                    {/* glow blob behind core */}
                    <circle cx={x} cy={y} r="6" fill={t.glowColor} opacity="0.55" />

                    {/* node core */}
                    <circle
                      cx={x} cy={y} r="4.6"
                      fill={t.fill}
                      stroke="#0A0E0B"
                      strokeWidth="1.2"
                    />
                    {/* highlight glint */}
                    <circle cx={x - 1.2} cy={y - 1.2} r="0.8" fill="#FFFFFF" opacity="0.6" />
                  </g>

                  {/* tooltip via <title> child */}
                  <title>
                    {`${c.name} · ${c.level ?? "—"}${c.last_value != null ? ` · ${c.last_value.toFixed(0)}%` : ""}`}
                  </title>
                </g>
              );
            })}

            {/* Central blackbox core — last so it draws on top */}
            <g>
              {/* big soft glow */}
              <circle cx={CENTER} cy={CENTER} r="22" fill="url(#core-glow)" />

              {/* breathing halo ring */}
              <circle
                cx={CENTER} cy={CENTER} r="11"
                fill="none" stroke="rgba(214,242,107,0.55)" strokeWidth="0.8"
              >
                <animate attributeName="r"       values="10;18"   dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.55;0" dur="2.4s" repeatCount="indefinite" />
              </circle>

              {/* core square (rounded), the "b" */}
              <rect
                x={CENTER - 9} y={CENTER - 9} width="18" height="18" rx="4"
                fill="url(#core-fill)" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6"
              />
              <text
                x={CENTER} y={CENTER + 3.5}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
                fontSize="9"
                fontWeight="700"
                fill="#0A0E0B"
              >
                b
              </text>
            </g>
          </svg>
        </div>
      </PanelBody>
    </Panel>
  );
}
