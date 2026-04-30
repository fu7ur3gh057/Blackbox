import { PageStub } from "@/components/widgets/page-stub";
import { Bell } from "lucide-react";

export default function AlertsPage() {
  return (
    <PageStub
      Icon={Bell}
      title="Alerts"
      blurb="Full timeline of every alert that left a notifier. Alerts are pulled from the SQLite log so they survive daemon restarts."
      bullets={[
        "Filter by check name, level (warn / crit / ok) and date range",
        "Cursor-based pagination — old alerts are kept until you choose to prune them",
        "Inline metrics view (the same payload that went to Telegram)",
        "Quick re-trigger button to manually fire a notifier with a saved message",
      ]}
    />
  );
}
