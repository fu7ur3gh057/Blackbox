import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  level?: "ok" | "warn" | "crit" | null;
  glow?: boolean;
}

const LEVEL_BG: Record<NonNullable<KpiCardProps["level"]>, string> = {
  ok:   "text-level-ok",
  warn: "text-level-warn",
  crit: "text-level-crit",
};

export function KpiCard({ label, value, hint, level, glow }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="pt-5 pb-5">
        <div className="text-xs uppercase tracking-wider text-text-mute mb-3">{label}</div>
        <div
          className={cn(
            "text-3xl font-semibold tracking-tight",
            level ? LEVEL_BG[level] : "text-text-strong",
            glow && level === "crit" && "drop-shadow-[0_0_18px_rgba(248,113,113,0.6)]",
            glow && level === "warn" && "drop-shadow-[0_0_18px_rgba(251,191,36,0.5)]",
          )}
        >
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-text-dim">{hint}</div>}
      </CardBody>
    </Card>
  );
}
