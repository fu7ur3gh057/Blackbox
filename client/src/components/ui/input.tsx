import { cn } from "@/lib/utils";
import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl bg-canvas-elev border border-white/[0.06] px-4 text-sm text-ink-strong",
        "placeholder:text-ink-mute outline-none focus:border-accent-green/50 focus:bg-canvas-elev2 transition",
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = "Input";
