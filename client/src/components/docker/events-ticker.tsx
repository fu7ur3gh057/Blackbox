"use client";

import { connectNamespace, releaseNamespace } from "@/lib/socket";
import type { DockerEvent } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Activity, Pause, Play, RotateCw, Skull, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CAP = 30;
const VISIBLE = 4;

type Tone = "ok" | "warn" | "crit" | "info";

interface ActionStyle {
  Icon: typeof Activity;
  tone: Tone;
  label: string;
}

const ACTION_STYLE: Record<string, ActionStyle> = {
  start:                       { Icon: Play,    tone: "ok",   label: "started" },
  stop:                        { Icon: X,       tone: "warn", label: "stopped" },
  die:                         { Icon: Skull,   tone: "crit", label: "died" },
  kill:                        { Icon: Skull,   tone: "crit", label: "killed" },
  restart:                     { Icon: RotateCw, tone: "warn", label: "restarted" },
  oom:                         { Icon: Skull,   tone: "crit", label: "OOM-killed" },
  pause:                       { Icon: Pause,   tone: "warn", label: "paused" },
  unpause:                     { Icon: Play,    tone: "info", label: "unpaused" },
  destroy:                     { Icon: X,       tone: "crit", label: "destroyed" },
  create:                      { Icon: Activity, tone: "info", label: "created" },
  rename:                      { Icon: Activity, tone: "info", label: "renamed" },
  update:                      { Icon: Activity, tone: "info", label: "updated" },
  "health_status: healthy":    { Icon: Play,     tone: "ok",   label: "healthy" },
  "health_status: unhealthy":  { Icon: Skull,    tone: "crit", label: "unhealthy" },
  "health_status: starting":   { Icon: Activity, tone: "info", label: "starting" },
};

const TONE_CLASS: Record<Tone, string> = {
  ok:   "bg-level-ok/12   text-level-ok   ring-level-ok/30",
  warn: "bg-level-warn/12 text-level-warn ring-level-warn/30",
  crit: "bg-level-crit/12 text-level-crit ring-level-crit/30",
  info: "bg-accent-pale/[0.10] text-accent-pale ring-accent-pale/25",
};

/**
 * Live `docker events` strip. Listens on `/docker` namespace's
 * `docker:event`, keeps the last CAP events in memory, renders the most
 * recent VISIBLE. Newest at the top with a brief flash-in animation.
 */
export function EventsTicker() {
  const [events, setEvents] = useState<DockerEvent[]>([]);
  const flashRef = useRef<number>(0);

  useEffect(() => {
    const sock = connectNamespace("/docker");
    const onEvent = (e: DockerEvent) => {
      flashRef.current = Date.now();
      setEvents((prev) => {
        const next = [e, ...prev];
        return next.length > CAP ? next.slice(0, CAP) : next;
      });
    };
    sock.on("docker:event", onEvent);
    return () => {
      sock.off("docker:event", onEvent);
      releaseNamespace("/docker");
    };
  }, []);

  if (events.length === 0) {
    return (
      <div className="rounded-card border border-white/[0.05] bg-canvas-elev px-5 py-3">
        <div className="flex items-center gap-2 text-[11px] text-ink-mute font-mono">
          <Activity size={12} className="text-accent-pale" />
          <span className="uppercase tracking-[0.16em] text-[10px]">events</span>
          <span>·</span>
          <span>waiting for activity</span>
          <span className="cursor-blink text-accent-pale ml-0.5">_</span>
        </div>
      </div>
    );
  }

  const visible = events.slice(0, VISIBLE);
  return (
    <div className="rounded-card border border-white/[0.05] bg-canvas-elev p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] font-mono text-ink-mute">
          <Activity size={12} className="text-accent-pale" />
          <span className="uppercase tracking-[0.16em] text-[10px]">events</span>
          <span className="text-ink-dim">· {events.length}</span>
        </div>
        <span className="text-[10px] font-mono text-ink-mute">live · `docker events`</span>
      </div>
      <ul className="space-y-1">
        {visible.map((e, i) => (
          <EventRow key={`${e.ts}-${e.id}-${i}`} event={e} fresh={i === 0} />
        ))}
      </ul>
    </div>
  );
}

function EventRow({ event, fresh }: { event: DockerEvent; fresh: boolean }) {
  const style = ACTION_STYLE[event.action] ?? ACTION_STYLE.update;
  const tone = TONE_CLASS[style.tone];
  const target = event.service
    ? `${event.project}/${event.service}`
    : event.container || event.id;
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-2.5 py-1.5 rounded-lg font-mono text-[11.5px]",
        "transition-all",
        fresh && "animate-[reveal-in_0.4s_ease-out]",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center h-5 w-5 rounded ring-1",
          tone,
        )}
      >
        <style.Icon size={11} />
      </span>
      <span className="text-ink-mute tabular-nums w-[58px] shrink-0">
        {relativeTime(event.ts)}
      </span>
      <span className={cn("uppercase tracking-wider text-[10px] w-[88px] shrink-0", tone.split(" ")[1])}>
        {style.label}
      </span>
      <span className="text-zinc-300 truncate flex-1 min-w-0">
        {target}
      </span>
      {event.exit_code != null && event.exit_code !== 0 && (
        <span className="px-1.5 py-[1px] rounded text-[9.5px] font-mono bg-level-crit/12 text-level-crit ring-1 ring-level-crit/25 shrink-0">
          exit {event.exit_code}
        </span>
      )}
    </li>
  );
}
