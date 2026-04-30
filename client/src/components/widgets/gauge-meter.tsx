"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { useSystemSnapshot } from "@/lib/use-snapshot";
import { cn } from "@/lib/utils";

/**
 * Compact CPU dial. Half-circle gauge on the left, metric column on
 * the right. Smaller than the previous 360-px card so it pairs cleanly
 * with PixelGrid in a 2-up row.
 */
export function GaugeMeter() {
  const data = useSystemSnapshot();
  const pct = Math.max(0, Math.min(100, data?.cpu_pct ?? 0));
  const needleAngle = -90 + (pct / 100) * 180;
  const ARC_LEN = Math.PI * 80;
  const filled = (pct / 100) * ARC_LEN;

  const tone = pct >= 90 ? "crit" : pct >= 70 ? "warn" : "ok";
  const TONE: Record<string, { stroke: string; glow: string; label: string; pill: string }> = {
    ok:   { stroke: "url(#g-ok)",   glow: "rgba(224,224,229,0.55)", label: "text-accent-pale",  pill: "bg-accent-pale/[0.12] text-accent-pale border-accent-pale/30" },
    warn: { stroke: "url(#g-warn)", glow: "rgba(251,191,36,0.55)", label: "text-level-warn",   pill: "bg-level-warn/10 text-level-warn border-level-warn/30" },
    crit: { stroke: "url(#g-crit)", glow: "rgba(239,68,68,0.6)",  label: "text-level-crit",   pill: "bg-level-crit/10 text-level-crit border-level-crit/30" },
  };

  return (
    <Panel className="overflow-hidden">
      <PanelHeader className="flex items-center justify-between pb-2">
        <PanelTitle className="text-[13px]">CPU load</PanelTitle>
        <span className={cn("pill border font-mono uppercase", TONE[tone].pill)}>{tone}</span>
      </PanelHeader>
      <PanelBody className="pt-1 pb-4">
        <div className="grid grid-cols-[150px_1fr] gap-4 items-center">
          {/* compact dial */}
          <svg viewBox="0 0 200 120" className="w-full">
            <defs>
              <linearGradient id="g-ok"   x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E0E0E5" /><stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>
              <linearGradient id="g-warn" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E0E0E5" /><stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
              <linearGradient id="g-crit" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FBBF24" /><stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
              <radialGradient id="g-hub" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1A1D25" /><stop offset="100%" stopColor="#0A0B0F" />
              </radialGradient>
            </defs>

            {/* track + filled arc */}
            <path d="M 20 100 A 80 80 0 0 1 180 100"
              stroke="#1A1D25" fill="none" strokeWidth="10" strokeLinecap="round" />
            <path d="M 20 100 A 80 80 0 0 1 180 100"
              stroke={TONE[tone].stroke} fill="none" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${filled} ${ARC_LEN}`}
              style={{ filter: `drop-shadow(0 0 8px ${TONE[tone].glow})`, transition: "stroke-dasharray 0.6s ease-out" }}
            />

            {/* labelled major ticks at 0/25/50/75/100 */}
            {[0, 25, 50, 75, 100].map((v) => {
              const a = (-180 + (v / 100) * 180) * Math.PI / 180;
              return (
                <g key={v}>
                  <line
                    x1={100 + 70 * Math.cos(a)} y1={100 + 70 * Math.sin(a)}
                    x2={100 + 60 * Math.cos(a)} y2={100 + 60 * Math.sin(a)}
                    stroke="#3a3d4a" strokeWidth="1.4"
                  />
                  <text
                    x={100 + 50 * Math.cos(a)} y={100 + 50 * Math.sin(a) + 3}
                    textAnchor="middle" fontSize="9" fill="#6E6E7A"
                    fontFamily="ui-monospace, monospace"
                  >{v}</text>
                </g>
              );
            })}

            {/* needle */}
            <g className="gauge-needle"
              style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: "100px 100px" }}>
              <path d="M 100 38 L 97 100 L 103 100 Z" fill="#F0E5CC" />
              <circle cx="100" cy="100" r="6" fill="url(#g-hub)" stroke="#E0E0E5" strokeWidth="1" />
              <circle cx="100" cy="100" r="2" fill="#FFFFFF" />
            </g>
          </svg>

          {/* metric column — mono digits */}
          <div className="font-mono">
            <div className={cn("leading-none", TONE[tone].label)}>
              <span className="text-[26px] font-semibold tabular-nums">{pct.toFixed(1)}</span>
              <span className="text-[12px] text-ink-mute ml-1">%</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute mt-3">load avg</div>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-[11px]">
              <Triple label="1m"  value={data?.load_1m  ?? 0} />
              <Triple label="5m"  value={data?.load_5m  ?? 0} />
              <Triple label="15m" value={data?.load_15m ?? 0} />
            </div>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function Triple({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-ink-mute text-[9px]">{label}</div>
      <div className="text-ink-strong tabular-nums">{value.toFixed(2)}</div>
    </div>
  );
}
