"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { connectNamespace } from "@/lib/socket";
import type { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Terminal, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SOURCE_HUE: Record<string, string> = {};
const PALETTE_HEX = ["#F97316", "#A78BFA", "#22D3EE", "#34D399", "#FB7185", "#FBBF24", "#60A5FA"];

function colorFor(source: string): string {
  if (SOURCE_HUE[source]) return SOURCE_HUE[source];
  const idx = Object.keys(SOURCE_HUE).length % PALETTE_HEX.length;
  SOURCE_HUE[source] = PALETTE_HEX[idx];
  return SOURCE_HUE[source];
}

const MAX_LINES = 200;

export function LogsStream() {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // initial backfill from REST
  useQuery({
    queryKey: ["logs", "recent"],
    queryFn: async () => {
      const rows = await api.get<LogEntry[]>("/logs/recent?limit=50");
      setLines(rows.slice().reverse()); // oldest first
      return rows;
    },
    refetchOnMount: "always",
    staleTime: Infinity,
  });

  useEffect(() => {
    const sock = connectNamespace("/logs");
    sock.on("log:line", (entry: LogEntry) => {
      if (paused) return;
      setLines((prev) => [...prev, entry].slice(-MAX_LINES));
    });
    return () => { sock.disconnect(); };
  }, [paused]);

  // auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || paused) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [lines, paused]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Terminal size={13} className="text-violet-accent" /> Live logs
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-mute">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            className={cn(
              "pill border transition",
              paused
                ? "bg-amber-400/10 text-amber-300 border-amber-400/25"
                : "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
            )}
          >
            {paused ? <Play size={11} /> : <Pause size={11} />}
            {paused ? "paused" : "live"}
          </button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div
          ref={scrollRef}
          className="font-mono text-[11.5px] leading-relaxed h-[280px] overflow-y-auto px-5 py-3 bg-black/30 border-t border-white/[0.04]"
        >
          {lines.length === 0 && (
            <div className="text-text-mute italic py-12 text-center">
              waiting for log lines from configured sources…
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} className="flex gap-3 py-0.5 group">
              <span className="text-text-mute shrink-0 tabular-nums">
                {new Date(l.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span
                className="px-1.5 rounded shrink-0 text-[10px] font-medium uppercase tracking-wide"
                style={{
                  color: colorFor(l.source),
                  background: `${colorFor(l.source)}1A`,
                  border: `1px solid ${colorFor(l.source)}33`,
                }}
              >
                {l.source}
              </span>
              <span className="text-text whitespace-pre-wrap break-all">
                {l.line}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
