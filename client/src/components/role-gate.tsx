"use client";

import { auth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react";
import { type ReactNode } from "react";

interface RoleGateProps {
  /** Roles that ARE allowed to see the children. Anything else → blocker UI. */
  allowed: ("admin" | "staff" | "viewer")[];
  children: ReactNode;
}

/**
 * Wrap a page body to block staff / viewer from admin-only surface area.
 * The /api side already returns 403, but this stops the client from even
 * trying — instant blocker UI, no flash of "loading then forbidden".
 */
export function RoleGate({ allowed, children }: RoleGateProps) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => auth.me(), retry: false });
  const role = me.data?.role;
  const ok = role && allowed.includes(role as "admin" | "staff" | "viewer");

  if (me.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[12px] font-mono text-ink-mute">checking access…</div>
      </div>
    );
  }
  if (!ok) {
    return (
      <div className="rounded-card border border-level-warn/30 bg-level-warn/[0.06] px-5 py-5 max-w-[640px]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-level-warn/15 text-level-warn flex items-center justify-center shrink-0">
            <ShieldOff size={16} strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-level-warn">Access denied</div>
            <div className="text-[11.5px] text-ink-dim mt-1 leading-relaxed font-mono">
              your role <span className="text-ink-strong">{role ?? "—"}</span> doesn't allow this
              page. Required: <span className="text-ink-strong">{allowed.join(" or ")}</span>.
              Ask an admin to upgrade your account.
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
