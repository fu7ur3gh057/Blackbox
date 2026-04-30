"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { SystemSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * ECG-style sweeping pulse line. The path is duplicated so as one copy
 * slides off the left, another arrives from the right — seamless loop.
 * On every `check:result` event from /checks namespace we briefly bump
 * the stroke opacity to give it a "live" beat feel.
 */
export function Heartbeat() {
  const [bpm, setBpm] = useState(72); // dummy/perceived "system bpm"
  const [beatTrigger, setBeatTrigger] = useState(0);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!data) return;
    // amusing dummy mapping: more cpu/mem load → faster bpm
    const load = (data.cpu_pct + data.memory_pct) / 2;
    setBpm(60 + Math.round(load * 0.6));
  }, [data]);

  useEffect(() => {
    const sock = connectNamespace("/checks");
    sock.on("check:result", () => {
      setBeatTrigger((n) => n + 1);
      if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
      beatTimerRef.current = setTimeout(() => setBeatTrigger((n) => n), 600);
    });
    return () => { sock.disconnect(); };
  }, []);

  // ECG cycle (200 wide). Repeat 4 times for the 800-wide path that
  // scrolls. Baseline at y=50 (canvas is 100 tall), peaks reach ~y=12,
  // dips to ~y=78 — looks like a typical V-shaped QRS.
  const cycle = "0,50 30,50 38,46 44,12 52,86 58,46 70,50 100,50 110,52 116,42 124,55 132,48 200,50";
  const path = repeatCycle(cycle, 200, 4);

  return (
    <Panel className="overflow-hidden flex flex-col">
      <PanelHeader className="pb-1">
        <div className="flex items-center justify-between">
          <PanelTitle className="text-[13px] flex items-center gap-2">
            <Activity size={13} className="text-accent-pale" /> System pulse
          </PanelTitle>
          <span className="text-[11px] text-ink-mute tabular-nums">
            <span className="text-accent-pale font-semibold text-[13px]">{bpm}</span> bpm
          </span>
        </div>
      </PanelHeader>
      <PanelBody className="pt-2 pb-3 flex-1 flex flex-col">
        <div className="relative flex-1 min-h-[140px] overflow-hidden rounded-xl bg-black/40 border border-white/[0.04]">
          {/* horizontal grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            {[20, 40, 60, 80].map((y) => (
              <div
                key={y}
                className="absolute left-0 right-0 h-px bg-white/[0.04]"
                style={{ top: `${y}%` }}
              />
            ))}
          </div>

          {/* edge fade masks */}
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none" />

          <svg viewBox="0 0 800 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ecg-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"  stopColor="#B5D17A" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#B5D17A" stopOpacity="1" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="ecg-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#B5D17A" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#B5D17A" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g className={cn("ecg-scroll ecg-glow", beatTrigger && "ecg-glow")} style={{ animationDuration: `${600 / Math.max(40, bpm) * 6}s, 2.4s` }}>
              {/* fill below — gives it that ghostly aura */}
              <polygon
                points={`${path} 800,100 0,100`}
                fill="url(#ecg-fill)"
              />
              <polyline
                points={path}
                fill="none"
                stroke="url(#ecg-stroke)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* duplicate, offset by 800, so it scrolls seamlessly */}
              <g transform="translate(800 0)">
                <polygon points={`${path} 800,100 0,100`} fill="url(#ecg-fill)" />
                <polyline
                  points={path}
                  fill="none"
                  stroke="url(#ecg-stroke)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </g>

            {/* leading dot — the "current" position of the trace */}
            <circle cx="700" cy="50" r="3" fill="#FFFFFF">
              <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.5;1" dur="0.8s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </PanelBody>
    </Panel>
  );
}

function repeatCycle(cycle: string, width: number, times: number): string {
  const parts: string[] = [cycle];
  for (let i = 1; i < times; i++) {
    const offset = width * i;
    const shifted = cycle
      .split(" ")
      .map((p) => {
        const [x, y] = p.split(",").map(Number);
        return `${x + offset},${y}`;
      })
      .join(" ");
    parts.push(shifted);
  }
  return parts.join(" ");
}
