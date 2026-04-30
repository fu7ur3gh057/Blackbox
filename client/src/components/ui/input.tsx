import { cn } from "@/lib/utils";
import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl bg-bg-input border border-border px-4 text-sm text-text-strong",
        "placeholder:text-text-mute outline-none focus:border-accent/60 focus:bg-bg-elev transition",
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = "Input";
