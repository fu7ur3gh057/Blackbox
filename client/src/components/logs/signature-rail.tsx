"use client";

import { api } from "@/lib/api";
import type { LogSignature } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { sourceHue } from "./format";

interface SignatureRailProps {
  selectedSig: string | null;
  onSelect: (sig: string | null) => void;
  newLastHour: number;
}

/**
 * Left-rail listing the top signatures by total occurrences. Polled
 * every 30s; click a row to filter the tail by that signature, click
 * "all" at the top to clear.
 */
export function SignatureRail({ selectedSig, onSelect, newLastHour }: SignatureRailProps) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["log-signatures"],
    queryFn: () => api.get<LogSignature[]>("/logs/signatures?limit=50"),
    refetchInterval: 30_000,
  });

  const max = Math.max(1, ...data.map((s) => s.total));

  return (
    <div className="h-full flex flex-col rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
      {/* Header strip */}
      <div className="px-4 py-3 border-b border-white/[0.05] bg-black/30">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-dim font-mono">
            signatures
          </div>
          <span className="pill-ghost tabular-nums">{data.length}</span>
        </div>
        {/* NEW counter */}
        <div
          className={cn(
            "mt-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 border font-mono",
            newLastHour > 0
              ? "bg-accent-pale/[0.08] border-accent-pale/30"
              : "bg-white/[0.02] border-white/[0.04]",
          )}
        >
          <Sparkles
            size={12}
            className={cn(newLastHour > 0 ? "text-accent-pale" : "text-ink-mute")}
          />
          <span className="text-[10px] uppercase tracking-wider text-ink-dim">new · 1h</span>
          <span
            className={cn(
              "ml-auto text-[12px] tabular-nums font-semibold",
              newLastHour > 0 ? "text-accent-pale" : "text-ink-mute",
            )}
          >
            {newLastHour}
          </span>
        </div>
      </div>

      {/* Filter row */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "px-4 py-2 text-left text-[11px] font-mono border-b border-white/[0.04] transition-colors",
          selectedSig === null
            ? "bg-accent-pale/[0.08] text-accent-pale"
            : "text-ink-dim hover:bg-white/[0.025]",
        )}
      >
        <span className="opacity-70">›</span> all signatures
      </button>

      {/* Signature list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-6 text-[11px] text-ink-mute font-mono">loading…</div>
        )}
        {!isLoading && data.length === 0 && (
          <div className="px-4 py-6 text-[11px] text-ink-mute font-mono">
            no signatures yet
          </div>
        )}
        {data.map((s) => {
          const active = selectedSig === s.sig;
          const hue = sourceHue(s.source);
          const ratio = s.total / max;
          return (
            <button
              key={s.sig}
              type="button"
              onClick={() => onSelect(active ? null : s.sig)}
              className={cn(
                "group relative w-full text-left px-3 py-2 border-b border-white/[0.025] transition-colors",
                active ? "bg-accent-pale/[0.08]" : "hover:bg-white/[0.025]",
              )}
            >
              {/* volume bar (background, behind content) */}
              <span
                className="absolute inset-y-0 left-0 bg-accent-pale/[0.04] pointer-events-none"
                style={{ width: `${Math.max(2, ratio * 100)}%` }}
              />

              <div className="relative flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", hue.dot)} />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-mono shrink-0",
                    hue.fg,
                  )}
                >
                  {s.source}
                </span>
                <span className="ml-auto text-[11px] font-mono tabular-nums text-ink-dim">
                  {fmtCount(s.total)}
                </span>
              </div>

              <div
                className={cn(
                  "relative mt-1 text-[11px] font-mono truncate",
                  active ? "text-ink-strong" : "text-ink-dim group-hover:text-zinc-300",
                )}
                title={s.sample}
              >
                {s.sample}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fmtCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return String(n);
}
