"use client";

import { cn } from "@/lib/utils";
import type { DockerPort } from "@/lib/types";
import { ExternalLink } from "lucide-react";

const HTTP_PORTS = new Set([
  80, 443, 3000, 3001, 5000,
  8000, 8001, 8080, 8081, 8443, 8765, 8888,
  9000, 9090, 9091,
]);

interface PortPillProps {
  port: DockerPort;
  hostname?: string;
}

const BASE = "inline-flex items-center gap-1 px-1.5 py-[2px] rounded text-[10px] ring-1 transition-colors";

/**
 * One port. Three rendering modes:
 *   - published HTTP-likely → clickable accent pill that opens in a tab
 *   - published other → muted neutral pill (still shows host port)
 *   - internal-only (PublishedPort = 0) → dim "int" badge with the
 *     container's listening port — useful context even for services that
 *     never expose outside the docker network (postgres/redis behind app)
 */
export function PortPill({ port, hostname }: PortPillProps) {
  // Internal — not published to the host.
  if (port.PublishedPort <= 0) {
    return (
      <span
        className={cn(BASE, "bg-white/[0.025] text-ink-mute ring-white/[0.04]")}
        title={`internal: ${port.Protocol || "tcp"} ${port.TargetPort}`}
      >
        <span className="font-mono tabular-nums">{port.TargetPort}</span>
        <span className="text-[8.5px] uppercase tracking-wider opacity-70">int</span>
      </span>
    );
  }

  const isTcp = (port.Protocol || "tcp").toLowerCase() === "tcp";
  const isHttp = isTcp && HTTP_PORTS.has(port.PublishedPort);
  const host = hostname || (typeof window !== "undefined" ? window.location.hostname : "localhost");
  const scheme = port.PublishedPort === 443 || port.PublishedPort === 8443 ? "https" : "http";
  const href = port.URL || `${scheme}://${host}:${port.PublishedPort}`;
  const label = `${port.PublishedPort}${port.PublishedPort !== port.TargetPort ? `→${port.TargetPort}` : ""}`;

  const inner = (
    <>
      <span className="font-mono tabular-nums">{label}</span>
      <span className="text-[8.5px] text-ink-mute uppercase tracking-wider">{port.Protocol || "tcp"}</span>
      {isHttp && <ExternalLink size={9} className="opacity-70" />}
    </>
  );

  if (isHttp) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(BASE, "bg-accent-pale/[0.08] text-accent-pale ring-accent-pale/25 hover:bg-accent-pale/15")}
        title={href}
      >
        {inner}
      </a>
    );
  }
  return (
    <span
      className={cn(BASE, "bg-white/[0.04] text-ink-dim ring-white/[0.06]")}
      title={`${port.Protocol || "tcp"} ${port.PublishedPort}`}
    >
      {inner}
    </span>
  );
}
