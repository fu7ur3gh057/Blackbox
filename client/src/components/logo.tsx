"use client";

import { cn } from "@/lib/utils";

/**
 * Vector logo — captures the idea of the original artwork: a contained
 * box with light leaking out. Built from primitives so we can theme +
 * animate it in code, no PNG assets to ship.
 *
 * Pieces:
 *   - radial halo behind the cube
 *   - cube outline (rounded square)
 *   - pulsing core dot inside
 *   - 4 short rays at the cardinal directions, drifting in opacity
 */
export function Logo({
  size = 40,
  className,
  animate = true,
}: {
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        {/* halo: white core with a tiny violet kiss at the edge — gives
            the leak a slight neon shift instead of cold pure white */}
        <radialGradient id="logo-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="60%"  stopColor="#C084FC" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="logo-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0E0E5" />
        </linearGradient>
      </defs>

      {/* halo glow */}
      <circle cx="20" cy="20" r="19" fill="url(#logo-halo)" />

      {/* cube outline — rounded square */}
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="4"
        fill="none"
        stroke="url(#logo-edge)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* corner accents (highlight along top-left edge) */}
      <path
        d="M 8 11 L 8 8 L 11 8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* pulsing core dot */}
      <circle cx="20" cy="20" r="3.6" fill="#FFFFFF">
        {animate && (
          <>
            <animate attributeName="r" values="3.2;4.2;3.2" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;1;0.8" dur="2.2s" repeatCount="indefinite" />
          </>
        )}
      </circle>
      <circle cx="20" cy="20" r="1.4" fill="#C084FC" />

      {/* escape rays — short tick marks at the 4 cardinal directions */}
      <g stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
        <line x1="20" y1="1.5" x2="20" y2="4">
          {animate && <animate attributeName="opacity" values="0.4;1;0.4" dur="2.2s" repeatCount="indefinite" />}
        </line>
        <line x1="38.5" y1="20" x2="36" y2="20">
          {animate && <animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" />}
        </line>
        <line x1="20" y1="38.5" x2="20" y2="36">
          {animate && <animate attributeName="opacity" values="0.4;1;0.4" dur="2.2s" repeatCount="indefinite" />}
        </line>
        <line x1="1.5" y1="20" x2="4" y2="20">
          {animate && <animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" />}
        </line>
      </g>
    </svg>
  );
}
