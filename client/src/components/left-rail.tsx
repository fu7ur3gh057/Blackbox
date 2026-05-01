"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Tip } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Boxes,
  Settings,
  SquareTerminal,
  Terminal,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  Icon: LucideIcon;
  label: string;
  /** When true, only role=admin sees this item. Staff / viewer get
   * neither the icon nor the route. */
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/",         Icon: LayoutDashboard, label: "Overview" },
  { href: "/checks",   Icon: Activity,        label: "Checks" },
  { href: "/alerts",   Icon: Bell,            label: "Alerts" },
  { href: "/docker",   Icon: Boxes,           label: "Docker",   adminOnly: true },
  { href: "/logs",     Icon: Terminal,        label: "Logs" },
  { href: "/terminal", Icon: SquareTerminal,  label: "Terminal", adminOnly: true },
  { href: "/users",    Icon: UsersIcon,       label: "Users",    adminOnly: true },
];

export function LeftRail() {
  const pathname = usePathname();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => auth.me(), retry: false });
  const isAdmin = me.data?.role === "admin";
  const visible = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="relative flex flex-col items-center py-5 gap-2 h-full">
      {/* logo — pure SVG, no PNG roundtrip and no basePath gotchas */}
      <Tip text="blackbox" side="right">
        <Link href="/" className="mb-3">
          <Logo size={36} />
        </Link>
      </Tip>

      {visible.map(({ href, Icon, label }) => {
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
