"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { CheckSummary } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";

const ICON = {
  ok:    <CheckCircle2 className="text-level-ok" size={18} />,
  warn:  <AlertTriangle className="text-level-warn" size={18} />,
  crit:  <AlertCircle className="text-level-crit" size={18} />,
  none:  <HelpCircle className="text-text-mute" size={18} />,
};

export function ChecksGrid() {
  const { data = [] } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 15_000,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Checks</CardTitle>
      </CardHeader>
      <CardBody className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {data.map((c) => (
          <div
            key={c.name}
            className={cn(
              "px-3 py-2.5 rounded-xl bg-bg-elev/60 border border-border-soft",
              "flex items-center gap-3",
            )}
          >
            <div className="shrink-0">{ICON[c.level ?? "none"]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-strong font-medium truncate">{c.name}</div>
              <div className="text-[11px] text-text-mute truncate">
                {c.type} · every {c.interval}s · {relativeTime(c.last_run_ts)}
              </div>
            </div>
            {c.last_value != null && (
              <div className="text-sm tabular-nums text-text-dim shrink-0">
                {c.last_value.toFixed(1)}%
              </div>
            )}
          </div>
        ))}
        {data.length === 0 && (
          <div className="col-span-full text-sm text-text-mute text-center py-6">
            no checks configured
          </div>
        )}
      </CardBody>
    </Card>
  );
}
