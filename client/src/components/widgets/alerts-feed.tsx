"use client";

import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { AlertEvent, Level } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const LEVEL_DOT: Record<Level, string> = {
  ok:   "bg-level-ok",
  warn: "bg-level-warn",
  crit: "bg-level-crit shadow-[0_0_8px_2px_rgba(248,113,113,0.5)]",
};

const LEVEL_BORDER: Record<Level, string> = {
  ok:   "border-level-ok/30",
  warn: "border-level-warn/30",
  crit: "border-level-crit/40",
};

export function AlertsFeed() {
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", { limit: 12 }],
    queryFn: () => api.get<AlertEvent[]>("/alerts?limit=12"),
    refetchInterval: 30_000,
  });

  // Live updates from /alerts namespace.
  useEffect(() => {
    const sock = connectNamespace("/alerts");
    sock.on("alert:fired", (payload: Omit<AlertEvent, "id">) => {
      qc.setQueryData<AlertEvent[]>(["alerts", { limit: 12 }], (cur) => {
        const next: AlertEvent = { id: Date.now(), ...payload };
        return [next, ...(cur ?? [])].slice(0, 12);
      });
    });
    return () => { sock.disconnect(); };
  }, [qc]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex items-center justify-between pb-2">
        <CardTitle>Recent alerts</CardTitle>
        <span className="text-[10px] text-text-mute tracking-wider uppercase">live</span>
      </CardHeader>
      <CardBody className="flex-1 overflow-y-auto space-y-2">
        {alerts.length === 0 && (
          <div className="text-sm text-text-mute py-6 text-center">no recent alerts</div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-start gap-3 px-3 py-2.5 rounded-xl bg-bg-elev/60 border",
              LEVEL_BORDER[a.level],
            )}
          >
            <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", LEVEL_DOT[a.level])} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm text-text-strong font-medium truncate">{a.name}</div>
                <div className="text-[10px] text-text-mute uppercase tracking-wider shrink-0">
                  {a.level}
                </div>
              </div>
              <div className="text-xs text-text-dim truncate">{a.detail ?? "—"}</div>
              <div className="text-[10px] text-text-mute mt-0.5">{relativeTime(a.ts)}</div>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
