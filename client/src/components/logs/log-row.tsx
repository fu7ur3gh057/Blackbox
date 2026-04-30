"use client";

import { cn } from "@/lib/utils";
import type { LogEntry } from "@/lib/types";
import { detectSeverity, fmtTime, SEV_CLASS, SEV_LABEL, sourceHue } from "./format";
import { memo } from "react";

interface LogRowProps {
  entry: LogEntry;
  query: string;
  onSourceClick?: (source: string) => void;
  onSigClick?: (sig: string) => void;
}

/**
 * One row of the live tail. Mono throughout, severity chip on the left
 * shoulder, source pill, NEW badge for first-seen signatures.
 *
 * Search hits are wrapped in <mark> with a soft accent background so the
 * eye lands on them without disrupting the line shape.
 */
export const LogRow = memo(function LogRow({
  entry,
  query,
  onSourceClick,
  onSigClick,
}: LogRowProps) {
  const sev = detectSeverity(entry.line);
  const hue = sourceHue(entry.source);
  const isNew = entry.first;

  return (
    <div
      className={cn(
        "group relative grid grid-cols-[64px_92px_42px_1fr] gap-3 px-3 py-1.5",
        "font-mono text-[12px] leading-[1.55] text-ink-dim",
        "border-b border-white/[0.025]",
        "hover:bg-white/[0.025] transition-colors",
        isNew && "bg-accent-pale/[0.04]",
      )}
    >
      {/* NEW left stripe */}
      {isNew && (
        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent-pale shadow-[0_0_8px_rgba(224,224,229,0.6)]" />
      )}

      {/* timestamp */}
      <span className="text-ink-mute tabular-nums select-none">{fmtTime(entry.ts)}</span>

      {/* source pill — clickable */}
      <button
        type="button"
        onClick={() => onSourceClick?.(entry.source)}
        className={cn(
          "truncate text-left text-[11px] uppercase tracking-wider hover:underline decoration-dotted underline-offset-4",
          hue.fg,
        )}
        title={`filter by source: ${entry.source}`}
      >
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle", hue.dot)} />
        {entry.source}
      </button>

      {/* severity chip */}
      <span className="flex items-center">
        {sev ? (
          <span
            className={cn(
              "px-1.5 py-[1px] rounded text-[9px] font-bold tracking-[0.12em]",
              SEV_CLASS[sev],
            )}
          >
            {SEV_LABEL[sev]}
          </span>
        ) : (
          <span className="text-ink-mute/50 text-[9px]">·</span>
        )}
      </span>

      {/* line text + NEW chip + sig click */}
      <div className="min-w-0 flex items-start gap-2">
        {isNew && (
          <span
            className="shrink-0 mt-[2px] px-1.5 py-[1px] rounded text-[9px] font-bold tracking-[0.12em] bg-accent-pale/15 text-accent-pale ring-1 ring-accent-pale/40 animate-[pulse_2s_ease-in-out_infinite]"
            title="first time this signature was seen"
          >
            NEW
          </span>
        )}
        <span className="text-zinc-300 break-all whitespace-pre-wrap min-w-0">
          {highlight(entry.line, query)}
        </span>
        <button
          type="button"
          onClick={() => onSigClick?.(entry.sig)}
          title={`filter by signature ${entry.sig.slice(0, 8)}`}
          className="ml-auto shrink-0 opacity-0 group-hover:opacity-70 transition-opacity text-[10px] text-ink-mute hover:text-accent-pale font-mono"
        >
          {entry.sig.slice(0, 6)}
        </button>
      </div>
    </div>
  );
});

function highlight(line: string, query: string) {
  if (!query) return line;
  const q = query.toLowerCase();
  const lower = line.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < line.length) {
    const j = lower.indexOf(q, i);
    if (j < 0) {
      out.push(line.slice(i));
      break;
    }
    if (j > i) out.push(line.slice(i, j));
    out.push(
      <mark
        key={key++}
        className="bg-accent-pale/30 text-ink-strong px-0.5 rounded-sm"
      >
        {line.slice(j, j + q.length)}
      </mark>,
    );
    i = j + q.length;
  }
  return out;
}
