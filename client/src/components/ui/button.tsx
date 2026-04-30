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
    "bg-accent text-bg-base hover:bg-accent/90 shadow-[0_0_28px_-6px_rgba(249,115,22,0.6)]",
  ghost:
    "bg-transparent text-text-dim hover:text-text-strong hover:bg-bg-surface",
  outline:
    "bg-transparent text-text-strong border border-border hover:bg-bg-surface",
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
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
