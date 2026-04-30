import { PageStub } from "@/components/widgets/page-stub";
import { Boxes } from "lucide-react";

export default function DockerPage() {
  return (
    <PageStub
      Icon={Boxes}
      title="Docker"
      blurb="Live `docker compose ps` for every project listed under config.report.docker. Same data the daemon uses to build the Telegram digest, but in a frame you can scan in one glance."
      bullets={[
        "Project cards with health pill (live / degraded / err)",
        "Per-container status + uptime + last health-check result",
        "One-click `docker compose logs -f --tail 100` slide-over panel",
        "Restart / pull / down actions, gated by an admin confirmation",
      ]}
    />
  );
}
