"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Boxes, AlertCircle } from "lucide-react";

interface DockerProject {
  compose: string;
  project: string;
  wanted: string[];
  starred: string[];
  containers: Array<{
    Service?: string;
    Name?: string;
    State?: string;
    Status?: string;
  }>;
  error: string | null;
}

function chipColor(state: string | undefined): string {
  switch (state) {
    case "running":   return "bg-emerald-400/10 text-emerald-300 border-emerald-400/25";
    case "exited":    return "bg-rose-400/10 text-rose-300 border-rose-400/30";
    case "paused":    return "bg-amber-400/10 text-amber-300 border-amber-400/25";
    case "restarting":return "bg-amber-400/10 text-amber-300 border-amber-400/25";
    default:          return "bg-white/[0.04] text-text-dim border-white/10";
  }
}

export function DockerGrid() {
  const { data = [] } = useQuery({
    queryKey: ["docker"],
    queryFn: () => api.get<DockerProject[]>("/docker"),
    refetchInterval: 20_000,
  });

  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Boxes size={13} className="text-cyan-accent" /> Docker compose
        </CardTitle>
        <span className="text-[10px] text-text-mute">
          {data.length} project{data.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardBody className="space-y-3 pt-2">
        {data.length === 0 && (
          <div className="text-sm text-text-mute py-6 text-center">
            no compose projects in <code className="text-text-dim">config.report.docker</code>
          </div>
        )}
        {data.map((proj) => (
          <div key={proj.compose} className="glass-inner p-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text-strong">{proj.project}</span>
                {proj.error && <AlertCircle size={12} className="text-rose-300" />}
              </div>
              <span className="text-[10px] text-text-mute font-mono truncate max-w-[60%]" title={proj.compose}>
                {proj.compose}
              </span>
            </div>
            {proj.error ? (
              <div className="text-[12px] text-rose-300 bg-rose-400/5 border border-rose-400/20 rounded-lg px-3 py-2">
                {proj.error}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {proj.containers.map((c, i) => {
                  const name = c.Service ?? c.Name ?? "?";
                  return (
                    <span
                      key={i}
                      className={cn("pill border", chipColor(c.State))}
                      title={c.Status}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          c.State === "running" ? "bg-emerald-400" : "bg-rose-400",
                        )}
                      />
                      {name}
                    </span>
                  );
                })}
                {proj.containers.length === 0 && (
                  <span className="text-[11px] text-text-mute">no containers</span>
                )}
              </div>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
