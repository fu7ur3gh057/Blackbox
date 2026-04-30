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
 * Top row: Statistics on the left (8/12 on lg, 9/12 on xl) with a
 * narrow sidebar (Recent + Healthy) on the right of the main content
 * area. Below the row everything stays full-width.
 *
 * Each widget is wrapped in <Reveal delay /> for a staggered fade-in
 * after auth.
 */
export default function Dashboard() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          <Reveal delay={0}><Statistics /></Reveal>
        </div>
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-5">
          <Reveal delay={300}><RecentChecks /></Reveal>
          <Reveal delay={550}><HealthyList /></Reveal>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Reveal delay={800}><GaugeMeter /></Reveal>
        <Reveal delay={1000}><PixelGrid /></Reveal>
        <Reveal delay={1200}><Heartbeat /></Reveal>
        <Reveal delay={1400}><NodeWeb /></Reveal>
      </div>

      <Reveal delay={1700}><WatchCards /></Reveal>
      <Reveal delay={2000}><ServerLocation /></Reveal>
    </div>
  );
}
