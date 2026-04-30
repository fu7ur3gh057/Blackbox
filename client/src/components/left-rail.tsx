"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Tip } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Boxes,
  Settings,
  SquareTerminal,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; Icon: LucideIcon; label: string }[] = [
  { href: "/",         Icon: LayoutDashboard, label: "Overview" },
  { href: "/checks",   Icon: Activity,        label: "Checks" },
  { href: "/alerts",   Icon: Bell,            label: "Alerts" },
  { href: "/docker",   Icon: Boxes,           label: "Docker" },
  { href: "/logs",     Icon: Terminal,        label: "Logs" },
  { href: "/terminal", Icon: SquareTerminal,  label: "Terminal" },
];

export function LeftRail() {
  const pathname = usePathname();
  return (
    <aside className="relative flex flex-col items-center py-5 gap-2 h-full">
      {/* logo — pure SVG, no PNG roundtrip and no basePath gotchas */}
      <Tip text="blackbox" side="right">
        <Link href="/" className="mb-3">
          <Logo size={36} />
        </Link>
      </Tip>

      {NAV.map(({ href, Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
        return (
          <Tip key={href} text={label} side="right">
            <Link
              href={href}
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
          </Tip>
        );
      })}

      <div className="mt-auto">
        <Tip text="settings" side="right">
          <button className="h-10 w-10 rounded-xl flex items-center justify-center text-ink-mute hover:text-ink hover:bg-white/[0.03] transition">
            <Settings size={16} strokeWidth={1.8} />
          </button>
        </Tip>
      </div>
    </aside>
  );
}
