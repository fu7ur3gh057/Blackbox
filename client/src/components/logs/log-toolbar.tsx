"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SEV_CLASS, SEV_LABEL, sourceHue, type Severity } from "./format";

interface LogToolbarProps {
  sources: string[];
  selectedSources: Set<string>;
  toggleSource: (s: string) => void;

  selectedSeverities: Set<Severity>;
  toggleSeverity: (s: Severity) => void;

  query: string;
  setQuery: (q: string) => void;

  paused: boolean;
  queued: number;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;

  totalLines: number;
  matchedLines: number;
  connected: boolean;
}

const ALL_SEVERITIES: Severity[] = ["crit", "warn", "info", "debug"];

/**
 * Top toolbar for /logs — source chips, severity chips, fuzzy search,
 * pause/resume, clear, and live status pill.
 */
export function LogToolbar({
  sources,
  selectedSources,
  toggleSource,
  selectedSeverities,
  toggleSeverity,
  query,
  setQuery,
  paused,
  queued,
  onPause,
  onResume,
  onClear,
  totalLines,
  matchedLines,
  connected,
}: LogToolbarProps) {
  // Local debounce so each keystroke doesn't re-filter the whole buffer.
  const [local, setLocal] = useState(query);
  useEffect(() => setLocal(query), [query]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(local), 180);
    return () => clearTimeout(t);
  }, [local, setQuery]);

  return (
    <div className="rounded-card border border-white/[0.05] bg-canvas-elev px-4 py-3 space-y-3">
      {/* Top row: live pill + counts + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Connection / live state */}
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-mono",
            paused
              ? "bg-level-warn/12 text-level-warn ring-1 ring-level-warn/30"
              : connected
              ? "bg-accent-pale/[0.12] text-accent-pale ring-1 ring-accent-pale/30"
              : "bg-level-crit/10 text-level-crit ring-1 ring-level-crit/30",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              paused
                ? "bg-level-warn"
                : connected
                ? "bg-accent-green pulse-green"
                : "bg-level-crit",
            )}
          />
          <span className="uppercase tracking-[0.16em] font-bold">
            {paused ? "paused" : connected ? "live" : "offline"}
          </span>
          {paused && queued > 0 && (
            <span className="text-ink-strong tabular-nums">· {queued} queued</span>
          )}
        </div>

        {/* Counts */}
        <div className="text-[11px] font-mono text-ink-mute tabular-nums">
          <span className="text-ink-dim">{matchedLines}</span>
          <span className="mx-1">/</span>
          <span>{totalLines}</span>
          <span className="ml-1">lines</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[420px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input
            type="text"
            value={local}
            placeholder="grep…"
            onChange={(e) => setLocal(e.target.value)}
            className={cn(
              "w-full pl-8 pr-7 py-1.5 rounded-full",
              "bg-black/40 border border-white/[0.06]",
              "text-[12px] font-mono text-ink-strong placeholder:text-ink-mute",
              "focus:outline-none focus:border-accent-pale/50 focus:bg-black/60",
              "transition-colors",
            )}
          />
          {local && (
            <button
              type="button"
              onClick={() => setLocal("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-strong"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={paused ? onResume : onPause}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors",
              paused
                ? "bg-accent-pale/15 border-accent-pale/40 text-accent-pale hover:bg-accent-pale/25"
                : "bg-white/[0.04] border-white/[0.06] text-ink-dim hover:bg-white/[0.08]",
            )}
            title={paused ? "resume stream" : "pause stream"}
          >
            {paused ? <Play size={11} /> : <Pause size={11} />}
            {paused ? "resume" : "pause"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-[11px] font-mono text-ink-dim hover:bg-white/[0.08] transition-colors"
            title="clear buffer"
          >
            <Trash2 size={11} />
            clear
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-start gap-4 flex-wrap pt-1">
        {/* Severities */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono mr-1">
            level
          </span>
          {ALL_SEVERITIES.map((s) => {
            const active = selectedSeverities.size === 0 || selectedSeverities.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeverity(s)}
                className={cn(
                  "px-2 py-[3px] rounded text-[9px] font-bold tracking-[0.12em] font-mono transition-all",
                  active ? SEV_CLASS[s] : "text-ink-mute/60 ring-1 ring-white/[0.05] bg-transparent",
                )}
              >
                {SEV_LABEL[s]}
              </button>
            );
          })}
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute font-mono mr-1">
              src
            </span>
            {sources.map((src) => {
              const active = selectedSources.size === 0 || selectedSources.has(src);
              const hue = sourceHue(src);
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => toggleSource(src)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[10px] font-mono transition-all",
                    active
                      ? "bg-white/[0.05] ring-1 ring-white/10 text-ink-strong"
                      : "bg-transparent ring-1 ring-white/[0.04] text-ink-mute/60",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", hue.dot, !active && "opacity-40")} />
                  <span className={active ? hue.fg : ""}>{src}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
