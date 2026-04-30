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
 * staggered, terminal-style — every panel un-blurs in turn. Delays span
 * ~2.5s to give the boot sequence weight without dragging.
 */
export default function Dashboard() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <Reveal delay={0}><Statistics /></Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Reveal delay={350}><RecentChecks /></Reveal>
        <Reveal delay={500}><HealthyList /></Reveal>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Reveal delay={700}><GaugeMeter /></Reveal>
        <Reveal delay={850}><PixelGrid /></Reveal>
        <Reveal delay={1000}><Heartbeat /></Reveal>
        <Reveal delay={1150}><NodeWeb /></Reveal>
      </div>

      <Reveal delay={1350}><ServerLocation /></Reveal>
      <Reveal delay={1550}><WatchCards /></Reveal>
    </div>
  );
}
