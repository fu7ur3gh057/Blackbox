import { Reveal } from "@/components/reveal";
import { GaugeMeter } from "@/components/widgets/gauge-meter";
import { HealthyList } from "@/components/widgets/healthy-list";
import { Heartbeat } from "@/components/widgets/heartbeat";
import { LogsTeaser } from "@/components/widgets/logs-teaser";
import { NodeWeb } from "@/components/widgets/node-web";
import { PixelGrid } from "@/components/widgets/pixel-grid";
import { ServerLocation } from "@/components/widgets/server-location";
import { Statistics } from "@/components/widgets/statistics";
import { WatchCards } from "@/components/widgets/watch-cards";

/**
 * Smart layout — short and tall widgets pair up so the eye doesn't see
 * a 1:1 row where one card is twice the height of its neighbour. Tall
 * lefts lean against stacked rights:
 *
 *   1. Statistics                                    (full width)
 *   2. HealthyList (tall)  ║  NodeWeb / Heartbeat   (stacked, 1+1)
 *   3. GaugeMeter           ║  PixelGrid             (similar heights)
 *   4. WatchCards                                    (full width)
 *   5. ServerLocation                                (full width)
 */
export default function Dashboard() {
  return (
    <div className="space-y-5">
      <Reveal delay={0}><Statistics /></Reveal>

      {/* Tall list on the left, two stacked widgets on the right.
          The right column uses grid-rows-2 so NodeWeb + Heartbeat
          split the available height (= HealthyList's height) evenly. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Reveal delay={250}><HealthyList /></Reveal>
        <div className="grid grid-rows-[1fr_1fr] gap-5 min-h-0">
          <Reveal delay={400}><NodeWeb /></Reveal>
          <Reveal delay={550}><Heartbeat /></Reveal>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Reveal delay={800}><GaugeMeter /></Reveal>
        <Reveal delay={1000}><PixelGrid /></Reveal>
      </div>

      <Reveal delay={1200}><LogsTeaser /></Reveal>
      <Reveal delay={1500}><WatchCards /></Reveal>
      <Reveal delay={1800}><ServerLocation /></Reveal>
    </div>
  );
}
