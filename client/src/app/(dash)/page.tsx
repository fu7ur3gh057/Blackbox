import { Reveal } from "@/components/reveal";
import { GaugeMeter } from "@/components/widgets/gauge-meter";
import { HealthyList } from "@/components/widgets/healthy-list";
import { Heartbeat } from "@/components/widgets/heartbeat";
import { NodeWeb } from "@/components/widgets/node-web";
import { PixelGrid } from "@/components/widgets/pixel-grid";
import { ServerLocation } from "@/components/widgets/server-location";
import { Statistics } from "@/components/widgets/statistics";
import { WatchCards } from "@/components/widgets/watch-cards";

/**
 * Single-column dashboard now that the right sidebar (recent alerts +
 * status cluster + quick actions) lives in the fixed RightColumn.
 *
 *   1. Statistics (full width)
 *   2. Healthy + Network (NodeWeb) — 2-up under stats
 *   3. Gauge / Pixel / Heartbeat — 3-up
 *   4. Watch cards
 *   5. Server location
 *
 * Each step staggered with <Reveal /> for a deliberate fade-in.
 */
export default function Dashboard() {
  return (
    <div className="space-y-5">
      <Reveal delay={0}><Statistics /></Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Reveal delay={250}><HealthyList /></Reveal>
        <Reveal delay={500}><NodeWeb /></Reveal>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Reveal delay={800}><GaugeMeter /></Reveal>
        <Reveal delay={1000}><PixelGrid /></Reveal>
        <Reveal delay={1200}><Heartbeat /></Reveal>
      </div>

      <Reveal delay={1500}><WatchCards /></Reveal>
      <Reveal delay={1800}><ServerLocation /></Reveal>
    </div>
  );
}
