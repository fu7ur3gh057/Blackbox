"use client";

import { api } from "@/lib/api";
import type { CheckSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertOctagon, AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * Wide hero strip at the very top of the dashboard. Reads `/api/checks`
 * and aggregates the worst level across all checks; the visual mood
 * (icon + glow + title) shifts to match.
 */
export function StatusBanner() {
  const { data = [] } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api.get<CheckSummary[]>("/checks"),
    refetchInterval: 15_000,
  });

  const buckets = data.reduce(
    (acc, c) => {
      const lvl = c.level ?? "none";
      acc[lvl] = (acc[lvl] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const worst: "ok" | "warn" | "crit" | "none" =
    buckets.crit ? "crit" : buckets.warn ? "warn" : data.length > 0 ? "ok" : "none";

  const cfg = {
    ok: {
      Icon: ShieldCheck, title: "All systems normal",
      sub: `${data.length} check${data.length === 1 ? "" : "s"} reporting healthy`,
      from: "from-emerald-500/30", to: "to-emerald-400/0",
      iconBg: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
      titleColor: "text-emerald-100",
    },
    warn: {
      Icon: AlertTriangle, title: `${buckets.warn ?? 0} warning${buckets.warn === 1 ? "" : "s"}`,
      sub: "elevated metrics — keep an eye on it",
      from: "from-amber-500/30", to: "to-amber-400/0",
      iconBg: "bg-amber-400/15 text-amber-300 ring-amber-400/35",
      titleColor: "text-amber-100",
    },
    crit: {
      Icon: AlertOctagon, title: `${buckets.crit} critical alert${buckets.crit === 1 ? "" : "s"}`,
      sub: "needs attention now",
      from: "from-rose-500/35", to: "to-rose-400/0",
      iconBg: "bg-rose-400/15 text-rose-300 ring-rose-400/40",
      titleColor: "text-rose-100",
    },
    none: {
      Icon: Activity, title: "Awaiting first samples",
      sub: "checks haven’t reported yet",
      from: "from-violet-500/25", to: "to-violet-400/0",
      iconBg: "bg-white/[0.04] text-text-dim ring-white/10",
      titleColor: "text-text-strong",
    },
  }[worst];

  return (
    <div className={cn("glass relative overflow-hidden")}>
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1/2 pointer-events-none bg-gradient-to-r",
          cfg.from, cfg.to,
        )}
      />
      <div className="relative flex items-center gap-5 px-7 py-5">
        <div
          className={cn(
            "h-12 w-12 rounded-2xl flex items-center justify-center ring-1 shrink-0",
            cfg.iconBg,
            worst === "crit" && "pulse-crit",
          )}
        >
          <cfg.Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-[18px] font-semibold tracking-tight", cfg.titleColor)}>
            {cfg.title}
          </div>
          <div className="text-[12px] text-text-dim mt-0.5">{cfg.sub}</div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          {(["ok", "warn", "crit"] as const).map((lvl) => {
            const n = buckets[lvl] ?? 0;
            const c = {
              ok:   "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
              warn: "text-amber-300 bg-amber-400/10 border-amber-400/25",
              crit: "text-rose-300 bg-rose-400/10 border-rose-400/30",
            }[lvl];
            return (
              <div key={lvl} className={cn("pill border", c)}>
                <span className="text-[10px] uppercase">{lvl}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
