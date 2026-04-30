"use client";

import { api } from "@/lib/api";
import { refreshDockerSnapshot } from "@/lib/use-snapshot";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  Loader2,
  Play,
  RotateCw,
  Square,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Scope =
  | { kind: "project"; project: string }
  | { kind: "service"; project: string; service: string };

interface ActionDef {
  id: string;
  label: string;
  Icon: typeof Play;
  tone: "neutral" | "warn" | "crit";
  confirm: string;
}

const PROJECT_ACTIONS: ActionDef[] = [
  { id: "up",      label: "up -d",  Icon: Play,     tone: "neutral", confirm: "Bring all services up?" },
  { id: "restart", label: "restart", Icon: RotateCw, tone: "warn",    confirm: "Restart all services?" },
  { id: "pull",    label: "pull",   Icon: Download, tone: "neutral", confirm: "Pull latest images for this project?" },
  { id: "down",    label: "down",   Icon: Square,   tone: "crit",    confirm: "Bring everything down? This stops AND removes containers." },
];

const SERVICE_ACTIONS: ActionDef[] = [
  { id: "start",   label: "start",   Icon: Play,     tone: "neutral", confirm: "Start this service?" },
  { id: "restart", label: "restart", Icon: RotateCw, tone: "warn",    confirm: "Restart this service?" },
  { id: "stop",    label: "stop",    Icon: Square,   tone: "crit",    confirm: "Stop this service?" },
];

interface ActionsMenuProps {
  scope: Scope;
}

/**
 * Drop-down with project / service actions. POSTs to the action
 * endpoint, shows a confirm before destructive ops, and surfaces the
 * subprocess result inline. The /docker namespace pushes a fresh tick
 * right after the action so the UI re-renders without waiting on the
 * 15s polling cadence.
 */
export function ActionsMenu({ scope }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside close — both the button and the portal'd menu count as "inside".
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const actions = scope.kind === "project" ? PROJECT_ACTIONS : SERVICE_ACTIONS;
  const qc = useQueryClient();

  // Position the portal'd menu next to the button. Flip up when there's
  // not enough space below — important on long pages where bottom cards
  // would otherwise drop the menu below the viewport.
  //
  // Anchor: right-edge of menu aligns with right-edge of button (the
  // dropdown reads "below this button"). Width is fixed (160px) so
  // measuring the rendered menu isn't necessary; height is computed
  // from the number of items so flip-up lands snug, not floating.
  const MENU_W = 160;
  const ITEM_H = 30;
  const PAD = 8;
  const menuH = actions.length * ITEM_H + PAD;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const calc = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const flip = spaceBelow < menuH + 12;
      const top = flip ? r.top - menuH - 4 : r.bottom + 4;
      const left = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, r.right - MENU_W));
      setPos({ top, left, flip });
    };
    calc();
    window.addEventListener("scroll", calc, true);
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc, true);
      window.removeEventListener("resize", calc);
    };
  }, [open, menuH]);

  async function run(action: ActionDef) {
    if (action.tone === "crit" && !window.confirm(action.confirm)) return;
    setRunning(action.id);
    setError(null);
    setOpen(false);
    try {
      const url =
        scope.kind === "project"
          ? `/docker/${encodeURIComponent(scope.project)}/${action.id}`
          : `/docker/${encodeURIComponent(scope.project)}/${encodeURIComponent(scope.service)}/${action.id}`;
      const res = await api.post<{ ok: boolean; code: number; stderr: string }>(url);
      if (!res.ok) {
        setError(res.stderr || `exit ${res.code}`);
      }
      // Don't wait for the WS tick — pull a fresh snapshot now so the UI
      // reflects the action's outcome immediately.
      await refreshDockerSnapshot(qc);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_W,
              zIndex: 100,
            }}
            className={cn(
              "rounded-xl bg-canvas-elev2 border border-white/[0.06] shadow-soft",
              "py-1 text-[11.5px] font-mono",
            )}
          >
            {actions.map((a) => {
              const tone =
                a.tone === "crit" ? "text-level-crit hover:bg-level-crit/[0.08]" :
                a.tone === "warn" ? "text-level-warn hover:bg-level-warn/[0.08]" :
                "text-ink-strong hover:bg-white/[0.05]";
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); run(a); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                    tone,
                  )}
                >
                  <a.Icon size={11} className="opacity-80" />
                  {a.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={running !== null}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-mono transition-colors",
          "bg-white/[0.04] border-white/[0.06] text-ink-dim hover:bg-white/[0.08] hover:text-ink-strong",
          "disabled:opacity-60 disabled:cursor-wait",
        )}
      >
        {running ? <Loader2 size={11} className="animate-spin" /> : null}
        {running ?? "actions"}
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {menu}
      {error && (
        <div className="absolute right-0 top-full mt-1 z-20 max-w-[280px] px-2.5 py-1.5 rounded-lg bg-level-crit/15 text-level-crit ring-1 ring-level-crit/30 text-[10.5px] font-mono leading-snug">
          {error}
        </div>
      )}
    </div>
  );
}
