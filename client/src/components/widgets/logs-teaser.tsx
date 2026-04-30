"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { fmtTime, sourceHue } from "@/components/logs/format";
import { useLogStream } from "@/lib/use-log-stream";
import { cn } from "@/lib/utils";
import { ChevronRight, Terminal } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const VISIBLE = 5;

/**
 * Compact teaser of the live log tail. Shows the last few matched lines
 * with source colouring and a "NEW · 1h" counter. The whole panel is a
 * link to /logs.
 *
 * Reuses the same WS hook as the full /logs page (`useLogStream`) so the
 * mini view stays in sync with whatever the user sees when they click in.
 */
export function LogsTeaser() {
  const stream = useLogStream(40);
  const lines = stream.lines.slice(-VISIBLE).reverse();
  const isEmpty = stream.lines.length === 0;

  const newLastHour = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - 3600;
    let n = 0;
    for (const l of stream.lines) if (l.first && l.ts >= cutoff) n++;
    return n;
  }, [stream.lines]);

  return (
    <Link
      href="/logs"
      className="group block focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-pale/50 rounded-card"
      aria-label="Open logs"
    >
      <Panel className="overflow-hidden transition-colors group-hover:border-accent-pale/30">
        <PanelHeader className="pb-2">
          <div className="flex items-center justify-between">
            <PanelTitle className="text-[13px] inline-flex items-center gap-2">
              <Terminal size={12} className="text-accent-pale" />
              Logs
            </PanelTitle>
            <div className="flex items-center gap-2">
              {newLastHour > 0 && (
                <span className="px-1.5 py-[1px] rounded text-[9px] font-bold tracking-[0.12em] font-mono bg-accent-pale/15 text-accent-pale ring-1 ring-accent-pale/35">
                  {newLastHour} NEW
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[10px] font-mono",
                  stream.connected
                    ? "bg-accent-pale/[0.10] text-accent-pale ring-1 ring-accent-pale/25"
                    : "bg-white/[0.04] text-ink-mute ring-1 ring-white/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    stream.connected ? "bg-accent-green pulse-green" : "bg-ink-mute",
                  )}
                />
                {stream.connected ? "live" : "offline"}
              </span>
            </div>
          </div>
        </PanelHeader>

        <PanelBody className="pt-0 pb-3">
          {/* Terminal-shaped frame */}
          <div className="rounded-xl border border-white/[0.05] bg-black/40 overflow-hidden">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Terminal size={20} className="text-ink-mute opacity-40 mb-1.5" />
                <div className="text-[11px] text-ink-dim font-mono">
                  no log lines yet
                </div>
                <div className="text-[10px] text-ink-mute font-mono mt-0.5">
                  configure <span className="text-accent-pale">logs.sources</span> in config.yaml
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.025]">
                {lines.map((l, i) => {
                  const hue = sourceHue(l.source);
                  return (
                    <div
                      key={`${l.ts}-${i}`}
                      className="flex items-center gap-3 px-3 py-1.5 font-mono text-[11.5px] leading-snug"
                    >
                      <span className="text-ink-mute tabular-nums shrink-0">
                        {fmtTime(l.ts)}
                      </span>
                      <span className={cn("inline-flex items-center gap-1.5 shrink-0 w-[80px]", hue.fg)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", hue.dot)} />
                        <span className="truncate text-[10px] uppercase tracking-wider">
                          {l.source}
                        </span>
                      </span>
                      <span className="flex-1 min-w-0 truncate text-zinc-300">
                        {l.first && (
                          <span className="mr-1.5 px-1 py-[0.5px] rounded text-[8.5px] font-bold tracking-wider bg-accent-pale/20 text-accent-pale ring-1 ring-accent-pale/35 align-middle">
                            NEW
                          </span>
                        )}
                        {l.line}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer strip */}
          <div className="flex items-center justify-between mt-2.5 px-1 text-[10px] font-mono text-ink-mute">
            <span>
              <span className="text-ink-dim">$</span>{" "}
              <span className="text-accent-pale">tail -f</span> blackbox
              <span className="cursor-blink text-accent-pale">_</span>
            </span>
            <span className="inline-flex items-center gap-1 text-ink-dim group-hover:text-accent-pale transition-colors">
              open all
              <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </PanelBody>
      </Panel>
    </Link>
  );
}
