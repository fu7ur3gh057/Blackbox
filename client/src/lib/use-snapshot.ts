"use client";

import { api } from "@/lib/api";
import { connectNamespace, releaseNamespace, type Namespace } from "@/lib/socket";
import type { CheckSummary, DockerProject, SystemSnapshot } from "@/lib/types";
import { useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Generic seed-then-stream snapshot hook backed by TanStack Query.
 *
 * - `queryKey` / `queryFn` provide the REST seed and survive across
 *   mounts via TQ's cache. Polling is OFF — the WS tick is the source
 *   of truth once seeded.
 * - On each `<event>` push from `<namespace>`, we `setQueryData` with
 *   the mapped payload — components reading via `useQuery` re-render
 *   without an extra fetch.
 * - Mutations (e.g. `POST /api/docker/monitor`) can call
 *   `qc.invalidateQueries({ queryKey })` to force a fresh REST read
 *   without waiting for the next WS tick.
 */
function useSnapshot<TWire, T>({
  namespace,
  event,
  queryKey,
  queryFn,
  mapper,
}: {
  namespace: Namespace;
  event: string;
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  mapper: (wire: TWire) => T;
}): T | undefined {
  const qc = useQueryClient();

  const { data } = useQuery<T>({
    queryKey,
    queryFn,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    const sock = connectNamespace(namespace);
    const onTick = (wire: TWire) => {
      qc.setQueryData<T>(queryKey, mapper(wire));
    };
    sock.on(event, onTick);
    return () => {
      sock.off(event, onTick);
      releaseNamespace(namespace);
    };
    // queryKey is a primitive array; stringify guards against new array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, event, JSON.stringify(queryKey), mapper, qc]);

  return data;
}

// ── concrete wrappers (typed; no parameters needed at call sites) ──

const SYSTEM_KEY: QueryKey = ["snapshot", "system"];
const SYSTEM_FETCH = () => api.get<SystemSnapshot>("/system");
const SYSTEM_MAPPER = (w: SystemSnapshot) => w;

export function useSystemSnapshot(): SystemSnapshot | undefined {
  return useSnapshot<SystemSnapshot, SystemSnapshot>({
    namespace: "/system",
    event: "system:tick",
    queryKey: SYSTEM_KEY,
    queryFn: SYSTEM_FETCH,
    mapper: SYSTEM_MAPPER,
  });
}

const CHECKS_KEY: QueryKey = ["snapshot", "checks"];
const CHECKS_FETCH = () => api.get<CheckSummary[]>("/checks");
const CHECKS_MAPPER = (w: { checks: CheckSummary[] }) => w.checks;

export function useChecksSnapshot(): CheckSummary[] | undefined {
  return useSnapshot<{ checks: CheckSummary[] }, CheckSummary[]>({
    namespace: "/checks",
    event: "checks:tick",
    queryKey: CHECKS_KEY,
    queryFn: CHECKS_FETCH,
    mapper: CHECKS_MAPPER,
  });
}

const DOCKER_KEY: QueryKey = ["snapshot", "docker"];
const DOCKER_FETCH = () => api.get<DockerProject[]>("/docker");
const DOCKER_MAPPER = (w: { projects: DockerProject[] }) => w.projects;

export function useDockerSnapshot(): DockerProject[] | undefined {
  return useSnapshot<{ projects: DockerProject[] }, DockerProject[]>({
    namespace: "/docker",
    event: "docker:tick",
    queryKey: DOCKER_KEY,
    queryFn: DOCKER_FETCH,
    mapper: DOCKER_MAPPER,
  });
}

/** Force a one-shot refresh of the docker snapshot via REST — used after
 * mutations (Discovery → add, etc.) so the UI updates without waiting on
 * the periodic WS tick. */
export function refreshDockerSnapshot(qc: QueryClient): Promise<unknown> {
  return qc.invalidateQueries({ queryKey: DOCKER_KEY });
}
