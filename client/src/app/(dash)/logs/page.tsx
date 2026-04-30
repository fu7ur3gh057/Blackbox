import { PageStub } from "@/components/widgets/page-stub";
import { Terminal } from "lucide-react";

export default function LogsPage() {
  return (
    <PageStub
      Icon={Terminal}
      title="Logs"
      blurb="Stream of every log line that matched a configured pattern, plus the dedup view that drives Telegram digests."
      bullets={[
        "Live feed via the /logs Socket.IO namespace, filtered per source",
        "Top-signatures table backed by `log_signatures` — sortable by occurrences",
        "Tail of the JSONL storage so you can scroll back without leaving the UI",
        "Save-search & export to file for incident write-ups",
      ]}
    />
  );
}
