/**
 * Shapes returned by the FastAPI handlers. Keep in sync with the
 * `schemas.py` files under `src/web/apis/<domain>` — when an endpoint
 * grows a field, add it here and the type checker will surface the
 * call sites that need it.
 */

export interface SystemSnapshot {
  cpu_pct: number;
  memory_pct: number;
  memory_used_gb: number;
  memory_total_gb: number;
  swap_pct: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
  uptime_seconds: number;
  disks: DiskUsage[];
}

export interface DiskUsage {
  path: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  pct: number;
}

export type Level = "ok" | "warn" | "crit";

export interface CheckSummary {
  name: string;
  type: string;
  interval: number;
  level: Level | null;
  last_run_ts: number | null;
  last_value: number | null;
  last_detail: string | null;
}

export interface CheckResult {
  id: number;
  ts: number;
  name: string;
  kind: string;
  level: Level;
  detail: string | null;
  metrics: Record<string, unknown> | null;
}

export interface AlertEvent {
  id: number;
  ts: number;
  name: string;
  level: Level;
  kind: string | null;
  detail: string | null;
  metrics: Record<string, unknown> | null;
}

export interface NotifierInfo {
  type: string;
  lang: string | null;
}

export interface LogEntry {
  ts: number;
  source: string;
  sig: string;
  first: boolean;
  line: string;
}

export interface LogSignature {
  sig: string;
  source: string;
  sample: string;
  first_seen: number;
  total: number;
}

// ── docker ───────────────────────────────────────────────────────────

export type DockerState =
  | "running" | "exited" | "paused" | "restarting" | "created" | "dead";

export interface DockerPort {
  URL: string;
  TargetPort: number;
  PublishedPort: number;
  Protocol: string;
}

export interface DockerContainer {
  ID: string;
  Name: string;
  Image: string;
  Service: string;
  Project: string;
  Created: number;
  State: DockerState | string;
  Status: string;
  Health: "healthy" | "unhealthy" | "starting" | "" | string;
  ExitCode: number;
  Publishers: DockerPort[] | null;
}

export interface DockerProject {
  compose: string;
  project: string;
  wanted: string[];
  starred: string[];
  containers: DockerContainer[];
  error: string | null;
}

export interface DockerEvent {
  ts: number;
  action: string;
  id: string;
  image: string;
  container: string;
  project: string;
  service: string;
  exit_code: number | null;
}
