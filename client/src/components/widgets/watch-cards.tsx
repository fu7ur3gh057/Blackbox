"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { useDockerSnapshot } from "@/lib/use-snapshot";
import { cn } from "@/lib/utils";
import { Boxes, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

const STATE_DOT: Record<string, string> = {
  running:    "bg-level-ok",
  exited:     "bg-level-crit",
  paused:     "bg-level-warn",
  restarting: "bg-level-warn",
};

/**
 * "Ongoing" cards — repurposed from the reference: each docker project
 * is a card, containers shown as small avatar-circles with state-coloured
 * borders. Clean & dense, three across.
 */
export function WatchCards() {
  const data = useDockerSnapshot() ?? [];

  return (
    <Link
      href="/docker"
      className="block group focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-pale/50 rounded-card"
      aria-label="Open docker page"
    >
    <Panel className="transition-colors group-hover:border-accent-pale/30">
      <PanelHeader className="flex items-center justify-between pb-2">
        <PanelTitle className="flex items-center gap-2">
          <Boxes size={14} className="text-accent-pale" /> Ongoing services
        </PanelTitle>
        <span className="inline-flex items-center gap-1 text-[10px] text-ink-mute group-hover:text-accent-pale transition-colors">
          {data.length} project{data.length === 1 ? "" : "s"}
          <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </PanelHeader>
      <PanelBody className="pt-2">
        {data.length === 0 && (
          <div className="text-[12px] text-ink-mute py-8 text-center">
            no docker compose projects in <code className="text-ink-dim">config.report.docker</code>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.map((p) => {
            const total = p.containers.length;
            const running = p.containers.filter((c) => c.State === "running").length;
            const overlap = p.containers.slice(0, 5);
            const more = total - overlap.length;
            return (
              <div key={p.compose} className="rounded-card bg-canvas-elev2/70 border border-white/[0.04] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent-green/40 to-accent-bright/40 border border-white/15 flex items-center justify-center text-[11px] font-bold text-canvas">
                      {p.project[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="leading-tight min-w-0">
                      <div className="text-[12.5px] text-ink-strong font-medium truncate">{p.project}</div>
                      <div className="text-[10px] text-ink-mute">{running} of {total} running</div>
                    </div>
                  </div>
                  {p.error ? (
                    <span className="pill bg-level-crit/15 text-level-crit border border-level-crit/30">
                      <AlertCircle size={11} /> err
                    </span>
                  ) : running === total ? (
                    <span className="pill bg-level-ok/15 text-level-ok border border-level-ok/25">live</span>
                  ) : (
                    <span className="pill bg-level-warn/15 text-level-warn border border-level-warn/25">degraded</span>
                  )}
                </div>

                {p.error ? (
                  <div className="text-[11px] text-level-crit/90 leading-snug line-clamp-3">{p.error}</div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-2">
                      {overlap.map((c, i) => {
                        const name = c.Service ?? c.Name ?? "?";
                        const dot = STATE_DOT[c.State ?? ""] ?? "bg-ink-mute";
                        return (
                          <Tip
                            key={i}
                            text={
                              <span className="inline-flex items-center gap-2">
                                <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                                <span className="font-semibold">{name}</span>
                                <span className="text-ink-dim">{c.State}</span>
                              </span>
                            }
                          >
                            <div
                              className={cn(
                                "relative h-7 w-7 rounded-full bg-canvas-elev border-2 border-canvas flex items-center justify-center text-[10px] font-medium text-ink",
                              )}
                            >
                              {name[0]?.toUpperCase()}
                              <span className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-canvas", dot)} />
                            </div>
                          </Tip>
                        );
                      })}
                    </div>
                    {more > 0 && (
                      <span className="ml-2 pill bg-white/[0.05] text-ink-dim border border-white/[0.06]">
                        +{more}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PanelBody>
    </Panel>
    </Link>
  );
}
