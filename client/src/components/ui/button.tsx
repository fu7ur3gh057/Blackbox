import { cn } from "@/lib/utils";
import * as React from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-lavender text-canvas hover:bg-accent-lavender_strong shadow-chip",
  ghost:
    "bg-transparent text-ink-dim hover:text-ink-strong hover:bg-white/[0.04]",
  outline:
    "bg-transparent text-ink-strong border border-white/[0.10] hover:bg-white/[0.04]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
