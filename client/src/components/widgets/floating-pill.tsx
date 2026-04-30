"use client";

import { api } from "@/lib/api";
import type { SystemSnapshot } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  if (d > 0) return `${d}d`;
  const h = Math.floor(secs / 3600);
  return `${h}h`;
}

/**
 * Bottom-right pill on the cream surround, mirroring the "+278k" badge
 * on the reference. We surface uptime — the kind of number you want
 * permanently visible on a monitoring tool.
 */
export function FloatingPill() {
  const { data } = useQuery({
    queryKey: ["system"],
    queryFn: () => api.get<SystemSnapshot>("/system"),
    refetchInterval: 30_000,
  });

  if (!data) return null;

  return (
    <div className="fixed bottom-7 right-7 z-30 pointer-events-none">
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full bg-accent-lavender pl-3 pr-4 py-2 shadow-chip">
        <div className="h-7 w-7 rounded-full bg-canvas/80 flex items-center justify-center">
          <ArrowUpRight size={14} className="text-accent-lavender" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-canvas/70 font-medium">uptime</div>
          <div className="text-[15px] font-bold text-canvas tabular-nums">
            {formatUptime(data.uptime_seconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
