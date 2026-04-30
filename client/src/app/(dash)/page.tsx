import { HealthyList } from "@/components/widgets/healthy-list";
import { RecentChecks } from "@/components/widgets/recent-checks";
import { Statistics } from "@/components/widgets/statistics";
import { WatchCards } from "@/components/widgets/watch-cards";

export default function Dashboard() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          <Statistics />
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
