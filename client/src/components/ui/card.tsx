import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * Glass card — single visual primitive for the dashboard. The glass-y
 * feel comes from `globals.css :: .glass` (backdrop-blur + saturate +
 * top-edge highlight). Compose padded sub-zones via CardHeader/Body.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("glass", className)} {...props} />
));
Card.displayName = "Card";

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative px-6 pt-5", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative px-6 pb-6", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.14em] text-text-dim",
        className,
      )}
      {...rest}
    />
  );
}
