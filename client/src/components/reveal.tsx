"use client";

import { cn } from "@/lib/utils";

/**
 * Staggered entrance wrapper. Drop the widget inside, set `delay` (ms),
 * the .reveal keyframe in globals.css does the rest:
 *
 *     <Reveal delay={120}><Widget /></Reveal>
 *
 * The forwards-fill keeps the final state once the animation lands so
 * the layout doesn't pop back to opacity 0.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("reveal", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
