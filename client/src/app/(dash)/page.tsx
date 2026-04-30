import { AlertsFeed } from "@/components/widgets/alerts-feed";
import { ChecksGrid } from "@/components/widgets/checks-grid";
import { DisksDonut } from "@/components/widgets/disks-donut";
import { DockerGrid } from "@/components/widgets/docker-grid";
import { HeroChart } from "@/components/widgets/hero-chart";
import { LogsStream } from "@/components/widgets/logs-stream";
import { StatusBanner } from "@/components/widgets/status-banner";
import { SystemKpis } from "@/components/widgets/system-kpis";

export default function Dashboard() {
  return (
    <div className="px-6 pb-8 space-y-5">
      <StatusBanner />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5 min-w-0">
          <SystemKpis />
          <HeroChart />

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
            <ChecksGrid />
            <DisksDonut />
          </div>

          <DockerGrid />
          <LogsStream />
        </div>

        <aside className="xl:sticky xl:top-[112px] xl:self-start min-w-0">
          <AlertsFeed />
        </aside>
      </div>
    </div>
  );
}
