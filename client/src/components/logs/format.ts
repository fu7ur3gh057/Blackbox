/** Shared helpers for the /logs page (severity, source hashing, time fmt). */

export type Severity = "crit" | "warn" | "info" | "debug";

const SEV_RE = /\b(ERROR|ERR|FATAL|CRITICAL|EXCEPTION|WARN|WARNING|INFO|DEBUG|TRACE)\b/i;

export function detectSeverity(line: string): Severity | null {
  const m = line.match(SEV_RE);
  if (!m) return null;
  const v = m[0].toUpperCase();
  if (v.startsWith("ERR") || v === "FATAL" || v === "CRITICAL" || v === "EXCEPTION") return "crit";
  if (v.startsWith("WARN")) return "warn";
  if (v === "INFO") return "info";
  return "debug";
}

export const SEV_LABEL: Record<Severity, string> = {
  crit: "ERR",
  warn: "WRN",
  info: "INF",
  debug: "DBG",
};

export const SEV_CLASS: Record<Severity, string> = {
  crit: "bg-level-crit/12 text-level-crit ring-1 ring-level-crit/30",
  warn: "bg-level-warn/12 text-level-warn ring-1 ring-level-warn/30",
  info: "bg-[#7BA9D9]/12 text-[#9BC0E5] ring-1 ring-[#7BA9D9]/25",
  debug: "bg-white/[0.04] text-ink-mute ring-1 ring-white/10",
};

/** Deterministic per-source hue from the project's neon palette. The
 * Tailwind-arbitrary class strings are picked up by JIT at build time. */
const SOURCE_HUES = [
  { fg: "text-neon-violet",    dot: "bg-neon-violet" },
  { fg: "text-neon-pink",      dot: "bg-neon-pink" },
  { fg: "text-neon-turquoise", dot: "bg-neon-turquoise" },
  { fg: "text-neon-carrot",    dot: "bg-neon-carrot" },
  { fg: "text-neon-brown",     dot: "bg-neon-brown" },
  { fg: "text-neon-burgundy",  dot: "bg-neon-burgundy" },
];

export function sourceHue(source: string): { fg: string; dot: string } {
  let h = 0;
  for (let i = 0; i < source.length; i++) {
    h = ((h * 31) + source.charCodeAt(i)) >>> 0;
  }
  return SOURCE_HUES[h % SOURCE_HUES.length];
}

export function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
