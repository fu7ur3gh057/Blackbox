"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { AlertEvent, Level } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

const LEVEL_THEME: Record<Level, {
  Icon: React.ElementType;
  bg: string; text: string; ring: string; pulse?: string;
}> = {
  ok:   { Icon: CheckCircle2, bg: "bg-emerald-400/10", text: "text-emerald-300", ring: "ring-emerald-400/25" },
  warn: { Icon: AlertTriangle, bg: "bg-amber-400/10",  text: "text-amber-300",  ring: "ring-amber-400/30" },
  crit: { Icon: AlertCircle,   bg: "bg-rose-400/10",   text: "text-rose-300",   ring: "ring-rose-400/40", pulse: "pulse-crit" },
};

export function AlertsFeed() {
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", { limit: 12 }],
    queryFn: () => api.get<AlertEvent[]>("/alerts?limit=12"),
    refetchInterval: 30_000,
  });

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
      <CardHeader className="flex items-center justify-between pb-3">
        <CardTitle>Recent alerts</CardTitle>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-ok" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-mute">live</span>
        </div>
      </CardHeader>
      <CardBody className="flex-1 overflow-y-auto space-y-2.5 pt-2 max-h-[600px]">
        {alerts.length === 0 && (
          <div className="text-sm text-text-mute py-12 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-400/60" size={24} />
            all quiet
          </div>
        )}
        {alerts.map((a) => {
          const t = LEVEL_THEME[a.level];
          return (
            <div
              key={a.id}
              className="glass-inner px-3 py-2.5 flex items-start gap-3 hover:bg-white/[0.04] transition"
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center ring-1 shrink-0",
                  t.bg, t.text, t.ring, t.pulse,
                )}
              >
                <t.Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[13px] font-medium text-text-strong truncate">{a.name}</div>
                  <div className="text-[10px] text-text-mute shrink-0">{relativeTime(a.ts)}</div>
                </div>
                <div className="text-[11.5px] text-text-dim leading-snug line-clamp-2">
                  {a.detail ?? "—"}
                </div>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
