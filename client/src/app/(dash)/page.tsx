import { Reveal } from "@/components/reveal";
import { GaugeMeter } from "@/components/widgets/gauge-meter";
import { HealthyList } from "@/components/widgets/healthy-list";
import { Heartbeat } from "@/components/widgets/heartbeat";
import { NodeWeb } from "@/components/widgets/node-web";
import { PixelGrid } from "@/components/widgets/pixel-grid";
import { RecentChecks } from "@/components/widgets/recent-checks";
import { ServerLocation } from "@/components/widgets/server-location";
import { Statistics } from "@/components/widgets/statistics";
import { WatchCards } from "@/components/widgets/watch-cards";

/**
 * Each widget is wrapped in <Reveal delay /> so the dashboard "boots up"
 * staggered, terminal-style. Delays span ~3.5s — the boot sequence
 * deliberately reads like a system loading screen, every panel
 * un-blurs in turn instead of all popping at once.
 */
export default function Dashboard() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <Reveal delay={0}><Statistics /></Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Reveal delay={500}><RecentChecks /></Reveal>
        <Reveal delay={750}><HealthyList /></Reveal>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Reveal delay={1000}><GaugeMeter /></Reveal>
        <Reveal delay={1250}><PixelGrid /></Reveal>
        <Reveal delay={1500}><Heartbeat /></Reveal>
        <Reveal delay={1750}><NodeWeb /></Reveal>
      </div>

      <Reveal delay={2050}><WatchCards /></Reveal>
      <Reveal delay={2350}><ServerLocation /></Reveal>
    </div>
  );
}
