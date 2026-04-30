"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";

interface TipProps {
  text: ReactNode;
  children: ReactNode;
  side?: Side;
  /** ms before the tooltip appears on hover. 0 = instant. */
  delay?: number;
  /** display mode of the wrapper — defaults to inline-flex; switch to
   * "block" when wrapping a card-sized element so width inherits. */
  as?: "inline" | "block";
  className?: string;
}

/**
 * Project-themed tooltip wrapper. Replaces the native `title=` attribute
 * with a styled card rendered through a portal — same hover/focus
 * triggers, smart flipping near viewport edges, escapes any container
 * that has overflow:hidden.
 *
 * Usage:
 *   <Tip text="Open web terminal">
 *     <Link href="/terminal">…</Link>
 *   </Tip>
 *
 * For SVG / canvas pieces where wrapping isn't an option, see
 * `useTipAt({x, y, text})` below — pin the tooltip at an absolute
 * coordinate.
 */
export function Tip({
  text, children, side = "top", delay = 350, as = "inline", className,
}: TipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; flip: Side } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function place() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // Defer the actual flip math to render — the tooltip itself reads
    // its own measured size (see ChartTooltip pattern). For now compute
    // a target anchor; flipping is handled in the floater via clamp.
    let x = cx, y = r.top, flip: Side = side;
    switch (side) {
      case "top":    x = cx; y = r.top;    break;
      case "bottom": x = cx; y = r.bottom; break;
      case "left":   x = r.left;  y = cy;  break;
      case "right":  x = r.right; y = cy;  break;
    }
    // Auto-flip vertical sides when too close to a viewport edge.
    if (side === "top" && r.top < 80)                   flip = "bottom";
    if (side === "bottom" && (window.innerHeight - r.bottom) < 80) flip = "top";
    setPos({ x, y, flip });
  }

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(place, delay);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(null);
  }
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const wrapperClass = cn(
    as === "block" ? "block" : "inline-flex items-center",
    className,
  );

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      className={wrapperClass}
    >
      {children}
      {pos && <Floater x={pos.x} y={pos.y} side={pos.flip} text={text} />}
    </span>
  );
}

/**
 * Standalone tooltip pinned at viewport coordinates — used by SVG
 * pieces (NodeWeb / PixelGrid) where we can't wrap the trigger.
 * Caller decides when to render based on its own hover state.
 */
export function FloatingTip({
  x, y, text, side = "top",
}: {
  x: number;
  y: number;
  text: ReactNode;
  side?: Side;
}) {
  if (typeof document === "undefined") return null;
  return <Floater x={x} y={y} side={side} text={text} />;
}

// ── internal floater ─────────────────────────────────────────────────


function Floater({
  x, y, side, text,
}: {
  x: number; y: number; side: Side; text: ReactNode;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ left: number; top: number } | null>(null);

  // Measure the tooltip after mount, then flip / clamp to viewport.
  useEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const GAP = 8;
    let left = x, top = y;
    switch (side) {
      case "top":    left = x - w / 2; top = y - h - GAP; break;
      case "bottom": left = x - w / 2; top = y + GAP;     break;
      case "left":   left = x - w - GAP; top = y - h / 2; break;
      case "right":  left = x + GAP;     top = y - h / 2; break;
    }
    // Clamp inside viewport with a small margin.
    const M = 6;
    left = Math.max(M, Math.min(window.innerWidth - w - M, left));
    top  = Math.max(M, Math.min(window.innerHeight - h - M, top));
    setAdjusted({ left, top });
  }, [x, y, side, text]);

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: "fixed",
        left: adjusted?.left ?? x,
        top:  adjusted?.top  ?? y,
        zIndex: 200,
        opacity: adjusted ? 1 : 0,
        pointerEvents: "none",
      }}
      className={cn(
        "max-w-[280px] px-2.5 py-1.5 rounded-lg",
        "bg-canvas-elev2/95 backdrop-blur-sm",
        "border border-white/[0.08] shadow-soft",
        "font-mono text-[11px] leading-snug text-ink-strong",
        "transition-opacity duration-100",
      )}
    >
      {text}
    </div>,
    document.body,
  );
}
