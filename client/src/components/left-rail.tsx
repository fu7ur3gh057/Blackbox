"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Boxes,
  Terminal,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; Icon: LucideIcon; label: string }[] = [
  { href: "/",        Icon: LayoutDashboard, label: "Overview" },
  { href: "/checks",  Icon: Activity,        label: "Checks" },
  { href: "/alerts",  Icon: Bell,            label: "Alerts" },
  { href: "/docker",  Icon: Boxes,           label: "Docker" },
  { href: "/logs",    Icon: Terminal,        label: "Logs" },
];

export function LeftRail() {
  const pathname = usePathname();
  return (
    <aside className="relative flex flex-col items-center py-5 gap-2 h-full">
      {/* logo — terminal prompt, white on dark with pale-green ring */}
      <Link href="/" className="mb-3" title="blackbox">
        <div className="h-9 w-9 rounded-2xl bg-canvas-elev2 border border-accent-pale/40 flex items-center justify-center text-ink-strong font-bold font-mono text-[18px]">
          &gt;
        </div>
      </Link>

      {NAV.map(({ href, Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "group relative h-10 w-10 rounded-xl flex items-center justify-center transition",
              active
                ? "bg-accent-pale/12 text-accent-pale"
                : "text-ink-mute hover:text-ink hover:bg-white/[0.03]",
            )}
          >
            {active && (
              <span className="absolute -left-[1.4rem] top-2 bottom-2 w-[3px] rounded-full bg-accent-pale" />
            )}
            <Icon size={17} strokeWidth={1.8} />
          </Link>
        );
      })}

      <div className="mt-auto">
        <button
          title="settings"
          className="h-10 w-10 rounded-xl flex items-center justify-center text-ink-mute hover:text-ink hover:bg-white/[0.03] transition"
        >
          <Settings size={16} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
