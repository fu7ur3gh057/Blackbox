import { AlertsFeed } from "@/components/widgets/alerts-feed";
import { ChecksGrid } from "@/components/widgets/checks-grid";
import { ChecksHistoryChart } from "@/components/widgets/checks-history-chart";
import { DisksDonut } from "@/components/widgets/disks-donut";
import { SystemKpis } from "@/components/widgets/system-kpis";

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* main column */}
      <div className="space-y-4">
        <SystemKpis />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ChecksHistoryChart name="cpu" title="CPU" color="#F97316" />
          <ChecksHistoryChart name="memory" title="Memory" color="#FBBF24" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <ChecksGrid />
          <DisksDonut />
        </div>
      </div>

      {/* right sidebar */}
      <aside className="lg:sticky lg:top-[80px] lg:self-start lg:max-h-[calc(100vh-100px)]">
        <AlertsFeed />
      </aside>
    </div>
  );
}
