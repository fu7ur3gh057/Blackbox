import { Sparkline } from "@/components/widgets/sparkline";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type Glow = "accent" | "violet" | "cyan" | "warn" | "crit" | "none";
type Tone = "ok" | "warn" | "crit" | "neutral";

const GLOW_CLASS: Record<Glow, string> = {
  accent: "text-glow-accent text-accent",
  violet: "text-glow-violet text-violet-accent",
  cyan:   "text-glow-cyan text-cyan-accent",
  warn:   "text-glow-warn text-amber-300",
  crit:   "text-glow-crit text-rose-300",
  none:   "text-text-strong",
};

const SPARK_COLOR: Record<Glow, string> = {
  accent: "#F97316",
  violet: "#A78BFA",
  cyan:   "#22D3EE",
  warn:   "#FBBF24",
  crit:   "#F87171",
  none:   "#F4F4F5",
};

const TONE_BADGE: Record<Tone, string> = {
  ok:      "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  warn:    "bg-amber-400/10 text-amber-300 border-amber-400/25",
  crit:    "bg-rose-400/10 text-rose-300 border-rose-400/30",
  neutral: "bg-white/[0.04] text-text-dim border-white/10",
};

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  /** sign of `delta` drives the arrow + colour; absolute value gets shown as % */
  delta?: number;
  /** `true` (default) means "going up is bad" — applies to CPU, Memory etc. */
  badIfUp?: boolean;
  glow?: Glow;
  spark?: number[];
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  badIfUp = true,
  glow = "none",
  spark,
}: KpiCardProps) {
  const tone: Tone = (() => {
    if (delta == null || Math.abs(delta) < 0.05) return "neutral";
    const isUp = delta > 0;
    return isUp === badIfUp ? "warn" : "ok";
  })();

  const Icon =
    delta == null || Math.abs(delta) < 0.05
      ? Minus
      : delta > 0
      ? ArrowUpRight
      : ArrowDownRight;

  return (
    <div className="glass p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-mute">{label}</div>
        {delta != null && (
          <span className={cn("pill border", TONE_BADGE[tone])}>
            <Icon size={11} />
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      <div className={cn("text-[34px] leading-none font-semibold tracking-tight", GLOW_CLASS[glow])}>
        {value}
      </div>

      {hint && <div className="text-[11px] text-text-dim">{hint}</div>}

      {spark && spark.length > 1 && (
        <div className="-mx-1.5 -mb-1.5 mt-auto">
          <Sparkline data={spark} color={SPARK_COLOR[glow]} height={42} />
        </div>
      )}
    </div>
  );
}
