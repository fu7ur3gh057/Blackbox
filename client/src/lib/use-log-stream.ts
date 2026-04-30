"use client";

import { api } from "@/lib/api";
import { connectNamespace, releaseNamespace } from "@/lib/socket";
import type { LogEntry } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const CAP = 2000;

export interface LogStream {
  lines: LogEntry[];
  paused: boolean;
  queued: number;
  connected: boolean;
  setPaused: (p: boolean) => void;
  resume: () => void;
  clear: () => void;
}

/**
 * Seeds an in-memory tail buffer from `/api/logs/recent` and keeps it
 * live by listening to `log:line` on the `/logs` namespace.
 *
 * Pause keeps the WS subscribed but routes incoming lines into a queue
 * so the visible buffer freezes; `resume()` flushes the queue back in.
 * Buffer is capped at CAP — drops the oldest when overflowed.
 */
export function useLogStream(initial = 200): LogStream {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const [paused, setPausedState] = useState(false);
  const [queued, setQueued] = useState(0);
  const [connected, setConnected] = useState(false);

  const queueRef = useRef<LogEntry[]>([]);
  const pausedRef = useRef(false);

  // Initial seed — /recent returns newest-first; reverse for chronological tail.
  useEffect(() => {
    let cancelled = false;
    api
      .get<LogEntry[]>(`/logs/recent?limit=${initial}`)
      .then((rows) => {
        if (cancelled) return;
        setLines(rows.slice().reverse());
      })
      .catch(() => {
        /* WS will supply data; empty seed is fine */
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    const sock = connectNamespace("/logs");

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onLine = (ev: LogEntry) => {
      if (pausedRef.current) {
        queueRef.current.push(ev);
        setQueued(queueRef.current.length);
        return;
      }
      setLines((prev) => {
        const next = prev.length >= CAP ? prev.slice(prev.length - CAP + 1) : prev.slice();
        next.push(ev);
        return next;
      });
    };

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("connect_error", onDisconnect);
    sock.on("log:line", onLine);
    queueMicrotask(() => setConnected(sock.connected));

    return () => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("connect_error", onDisconnect);
      sock.off("log:line", onLine);
      releaseNamespace("/logs");
    };
  }, []);

  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
  }, []);

  const resume = useCallback(() => {
    const flush = queueRef.current;
    queueRef.current = [];
    pausedRef.current = false;
    setPausedState(false);
    setQueued(0);
    if (flush.length === 0) return;
    setLines((prev) => {
      const merged = prev.concat(flush);
      return merged.length > CAP ? merged.slice(merged.length - CAP) : merged;
    });
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    queueRef.current = [];
    setQueued(0);
  }, []);

  return { lines, paused, queued, connected, setPaused, resume, clear };
}
