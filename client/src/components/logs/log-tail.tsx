"use client";

import type { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDown, Terminal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogRow } from "./log-row";

interface LogTailProps {
  lines: LogEntry[];
  query: string;
  total: number;
  paused: boolean;
  onSourceClick: (source: string) => void;
  onSigClick: (sig: string) => void;
  emptyMessage?: string;
}

/**
 * Scroll-locked log tail. Auto-sticks to the bottom while the user is at
 * the bottom; once they scroll up, sticky-mode releases and a "jump to
 * live" pill shows the count of new lines that arrived since.
 */
export function LogTail({
  lines,
  query,
  total,
  paused,
  onSourceClick,
  onSigClick,
  emptyMessage,
}: LogTailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastLenRef = useRef(0);
  const [stick, setStick] = useState(true);
  const [newCount, setNewCount] = useState(0);

  // Keep the tail glued to the bottom while sticky.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const grew = lines.length - lastLenRef.current;
    if (stick) {
      el.scrollTop = el.scrollHeight;
      setNewCount(0);
    } else if (grew > 0) {
      setNewCount((c) => c + grew);
    }
    lastLenRef.current = lines.length;
  }, [lines.length, stick]);

  // Re-sync sticky state on resize (otherwise the threshold drifts).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const atBottom =
        el.scrollHeight - (el.scrollTop + el.clientHeight) < 24;
      if (atBottom && stick && lastLenRef.current > 0) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stick]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 24;
    if (atBottom !== stick) {
      setStick(atBottom);
      if (atBottom) setNewCount(0);
    }
  }

  function jumpToLive() {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStick(true);
    setNewCount(0);
  }

  return (
    <div className="relative h-full flex flex-col rounded-card border border-white/[0.05] bg-canvas-elev overflow-hidden">
      {/* Top strip — terminal title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-black/40">
        <div className="flex items-center gap-2 text-[11px] font-mono text-ink-mute">
          <Terminal size={12} className="text-accent-pale" />
          <span className="text-ink-dim">$</span>
          <span className="text-accent-pale">tail</span>
          <span>-f</span>
          <span className="text-zinc-400">/var/log/blackbox.jsonl</span>
          <span className="cursor-blink text-accent-pale">_</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-ink-mute tabular-nums">
          <span>showing</span>
          <span className="text-ink-dim">{lines.length}</span>
          <span>/</span>
          <span className="text-ink-dim">{total}</span>
          {paused && (
            <span className="ml-2 px-1.5 py-[1px] rounded bg-level-warn/12 text-level-warn ring-1 ring-level-warn/30 uppercase tracking-[0.12em] font-bold">
              paused
            </span>
          )}
        </div>
      </div>

      {/* Scroll body */}
      <div
        ref={ref}
        onScroll={onScroll}
        className={cn(
          "relative flex-1 min-h-0 overflow-y-auto",
          "bg-[radial-gradient(1200px_400px_at_20%_-20%,rgba(214,242,107,0.04),transparent_60%)]",
        )}
      >
        {lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6 py-12">
            <Terminal size={28} className="text-ink-mute opacity-40" />
            <div className="text-[12px] text-ink-dim font-mono">
              {emptyMessage ?? "waiting for log lines…"}
            </div>
            <div className="text-[10px] text-ink-mute font-mono">
              configure sources in <span className="text-accent-pale">config.yaml → logs:</span>
            </div>
          </div>
        ) : (
          <div>
            {lines.map((entry, i) => (
              <LogRow
                key={`${entry.ts}-${i}`}
                entry={entry}
                query={query}
                onSourceClick={onSourceClick}
                onSigClick={onSigClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Jump to live floating button */}
      {!stick && lines.length > 0 && (
        <button
          type="button"
          onClick={jumpToLive}
          className={cn(
            "absolute bottom-4 right-4 z-10",
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5",
            "bg-canvas-elev2 border border-accent-pale/40 text-accent-pale",
            "text-[11px] font-mono shadow-chip",
            "hover:bg-accent-pale/10 transition-colors",
          )}
        >
          <ArrowDown size={12} />
          jump to live
          {newCount > 0 && (
            <span className="ml-1 tabular-nums text-ink-strong">· {newCount} new</span>
          )}
        </button>
      )}
    </div>
  );
}
