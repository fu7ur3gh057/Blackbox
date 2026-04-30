"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { AlertEvent, Level } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const LEVEL_DOT: Record<Level, string> = {
  ok:   "bg-level-ok",
  warn: "bg-level-warn",
  crit: "bg-level-crit",
};

const LEVEL_INITIAL_BG: Record<Level, string> = {
  ok:   "bg-level-ok/20 text-level-ok",
  warn: "bg-level-warn/20 text-level-warn",
  crit: "bg-level-crit/20 text-level-crit",
};

/** Compact list of latest alerts. Style mirrors a chat-like rows feel
 *  from the reference: small avatar circle (with check name initial),
 *  bold name, tiny meta line, dot status. */
export function RecentChecks() {
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", { limit: 6 }],
    queryFn: () => api.get<AlertEvent[]>("/alerts?limit=6"),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const sock = connectNamespace("/alerts");
    sock.on("alert:fired", (payload: Omit<AlertEvent, "id">) => {
      qc.setQueryData<AlertEvent[]>(["alerts", { limit: 6 }], (cur) => {
        const next: AlertEvent = { id: Date.now(), ...payload };
        return [next, ...(cur ?? [])].slice(0, 6);
      });
    });
    return () => { sock.disconnect(); };
  }, [qc]);

  return (
    <Panel>
      <PanelHeader className="flex items-center justify-between pb-1">
        <PanelTitle>Latest alerts</PanelTitle>
        <span className="text-[10px] text-ink-mute uppercase tracking-wider">live</span>
      </PanelHeader>
      <PanelBody className="pt-2 space-y-0">
        {alerts.length === 0 && (
          <div className="text-[12px] text-ink-mute py-6 text-center">all quiet — no alerts</div>
        )}
        {alerts.map((a, i) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-3 py-2.5",
              i !== alerts.length - 1 && "border-b border-dashed border-white/[0.06]",
            )}
          >
            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold", LEVEL_INITIAL_BG[a.level])}>
              {a.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-ink-strong truncate">{a.name}</div>
              <div className="text-[11px] text-ink-mute truncate">{a.detail ?? "—"}</div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className={cn("h-1.5 w-1.5 rounded-full", LEVEL_DOT[a.level])} />
              <span className="text-[10px] text-ink-mute mt-1">{relativeTime(a.ts)}</span>
            </div>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}
