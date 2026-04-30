import { Reveal } from "@/components/reveal";
import { GaugeMeter } from "@/components/widgets/gauge-meter";
import { HealthyList } from "@/components/widgets/healthy-list";
import { Heartbeat } from "@/components/widgets/heartbeat";
import { NodeWeb } from "@/components/widgets/node-web";
import { PixelGrid } from "@/components/widgets/pixel-grid";
import { RecentChecks } from "@/components/widgets/recent-checks";
import { Statistics } from "@/components/widgets/statistics";
import { WatchCards } from "@/components/widgets/watch-cards";

/**
 * Each widget is wrapped in <Reveal delay /> so the dashboard "boots up"
 * staggered, terminal-style — no hard pop after auth. Delays are tuned
 * so left-column and right-column cascades happen in parallel.
 */
export default function Dashboard() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-5">
          <Reveal delay={0}><Statistics /></Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <Reveal delay={200}><GaugeMeter /></Reveal>
            <Reveal delay={280}><PixelGrid /></Reveal>
            <Reveal delay={360}><Heartbeat /></Reveal>
            <Reveal delay={440}><NodeWeb /></Reveal>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-5">
          <Reveal delay={120}><RecentChecks /></Reveal>
          <Reveal delay={200}><HealthyList /></Reveal>
        </div>
      </div>

      <Reveal delay={560}><WatchCards /></Reveal>
    </div>
  );
}
