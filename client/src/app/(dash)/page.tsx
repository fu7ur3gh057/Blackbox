import { GaugeMeter } from "@/components/widgets/gauge-meter";
import { HealthyList } from "@/components/widgets/healthy-list";
import { Heartbeat } from "@/components/widgets/heartbeat";
import { NodeWeb } from "@/components/widgets/node-web";
import { PixelGrid } from "@/components/widgets/pixel-grid";
import { RecentChecks } from "@/components/widgets/recent-checks";
import { Statistics } from "@/components/widgets/statistics";
import { WatchCards } from "@/components/widgets/watch-cards";

export default function Dashboard() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-5">
          <Statistics />

          {/* Unique-widget row: gauge speedometer + LED-pixel grid +
              ECG heartbeat + orbital node-web. 2 cols on lg, 4 on xl. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <GaugeMeter />
            <PixelGrid />
            <Heartbeat />
            <NodeWeb />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-5">
          <RecentChecks />
          <HealthyList />
        </div>
      </div>

      <WatchCards />
    </div>
  );
}
