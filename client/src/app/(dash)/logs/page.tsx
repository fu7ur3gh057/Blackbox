"use client";

import { LogTail } from "@/components/logs/log-tail";
import { LogToolbar } from "@/components/logs/log-toolbar";
import { SignatureRail } from "@/components/logs/signature-rail";
import { detectSeverity, type Severity } from "@/components/logs/format";
import { useLogStream } from "@/lib/use-log-stream";
import { useCallback, useMemo, useState } from "react";

/**
 * Live log tail page. Composes the four parts: toolbar, signature rail,
 * tail body. All filtering is client-side over the in-memory buffer
 * (kept by `useLogStream` — the WS supplies new lines and the seed comes
 * from /api/logs/recent).
 */
export default function LogsPage() {
  const stream = useLogStream(200);

  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(new Set());
  const [selectedSig, setSelectedSig] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const toggleSource = useCallback((src: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  }, []);

  const toggleSeverity = useCallback((sev: Severity) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }, []);

  // Unique source list — derived from buffer so it grows as new sources appear.
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const l of stream.lines) set.add(l.source);
    return Array.from(set).sort();
  }, [stream.lines]);

  // First-seen signatures within the last hour — drives "NEW · 1h" counter.
  const newLastHour = useMemo(() => {
    const cutoff = Math.floor(Date.now() / 1000) - 3600;
    let n = 0;
    for (const l of stream.lines) {
      if (l.first && l.ts >= cutoff) n++;
    }
    return n;
  }, [stream.lines]);

  // Apply filters.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sevSet = selectedSeverities;
    const srcSet = selectedSources;
    return stream.lines.filter((l) => {
      if (selectedSig && l.sig !== selectedSig) return false;
      if (srcSet.size > 0 && !srcSet.has(l.source)) return false;
      if (sevSet.size > 0) {
        const sev = detectSeverity(l.line);
        if (!sev || !sevSet.has(sev)) return false;
      }
      if (q && !l.line.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stream.lines, selectedSig, selectedSources, selectedSeverities, query]);

  const onSourceClickInRow = useCallback(
    (src: string) => {
      // Single-source isolate on click — replace any existing selection.
      setSelectedSources(new Set([src]));
    },
    [],
  );

  const onSigClickInRow = useCallback((sig: string) => {
    setSelectedSig((cur) => (cur === sig ? null : sig));
  }, []);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-136px)]">
      <LogToolbar
        sources={sources}
        selectedSources={selectedSources}
        toggleSource={toggleSource}
        selectedSeverities={selectedSeverities}
        toggleSeverity={toggleSeverity}
        query={query}
        setQuery={setQuery}
        paused={stream.paused}
        queued={stream.queued}
        onPause={() => stream.setPaused(true)}
        onResume={stream.resume}
        onClear={stream.clear}
        totalLines={stream.lines.length}
        matchedLines={filtered.length}
        connected={stream.connected}
      />

      {/* Active sig banner — quick visual cue + clear button */}
      {selectedSig && (
        <div className="flex items-center gap-3 rounded-card border border-accent-pale/30 bg-accent-pale/[0.05] px-4 py-2 text-[11px] font-mono">
          <span className="text-ink-dim">filtering by signature</span>
          <code className="text-accent-pale">{selectedSig.slice(0, 12)}…</code>
          <button
            type="button"
            onClick={() => setSelectedSig(null)}
            className="ml-auto text-ink-mute hover:text-ink-strong"
          >
            clear
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="hidden lg:block min-h-0">
          <SignatureRail
            selectedSig={selectedSig}
            onSelect={setSelectedSig}
            newLastHour={newLastHour}
          />
        </div>

        <div className="min-h-0">
          <LogTail
            lines={filtered}
            query={query}
            total={stream.lines.length}
            paused={stream.paused}
            onSourceClick={onSourceClickInRow}
            onSigClick={onSigClickInRow}
            emptyMessage={
              stream.lines.length > 0
                ? "no matches — try clearing filters"
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
