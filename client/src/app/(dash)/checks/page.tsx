import { PageStub } from "@/components/widgets/page-stub";
import { Activity } from "lucide-react";

export default function ChecksPage() {
  return (
    <PageStub
      Icon={Activity}
      title="Checks"
      blurb="Every cpu / memory / disk / http / systemd probe configured in config.yaml. From this page you'll inspect the latest result, scrub through history and fire a check on demand."
      bullets={[
        "Full table with current level, last value, and time-since-last-run",
        "Per-check history graph with the same range tabs as the dashboard",
        "Manual `Run now` button that kicks the broker task without waiting for the next interval",
        "Inline mute toggle so noisy checks can be silenced without editing YAML",
      ]}
    />
  );
}
