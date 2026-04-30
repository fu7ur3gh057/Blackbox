import { cn } from "@/lib/utils";
import * as React from "react";

/** Panel — small elevated card on the dark canvas. */
export const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  // h-full so panels in the same grid row stretch to match the tallest
  // sibling — gives clean 1-1 / 1-1-1 alignment without per-widget tweaks.
  <div ref={ref} className={cn("panel h-full", className)} {...props} />
));
Panel.displayName = "Panel";

export function PanelHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative px-5 pt-4", className)} {...rest} />;
}

export function PanelBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative px-5 pb-5", className)} {...rest} />;
}

export function PanelTitle({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[14px] font-semibold tracking-tight text-ink-strong inline-flex items-center gap-2",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className="text-accent-pale font-mono opacity-70">&gt;</span>
      {children}
    </h3>
  );
}

/* Backwards-compat exports */
export const Card = Panel;
export const CardHeader = PanelHeader;
export const CardBody = PanelBody;
export const CardTitle = PanelTitle;
