"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PanelsTopLeft,
  History,
  Settings,
  CreditCard,
  Chrome,
  PanelLeftClose,
  PanelLeft,
  Plus,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "New meeting", icon: PanelsTopLeft },
  { href: "/history", label: "History", icon: History },
];
const secondary = [
  { href: "/extension", label: "Extension", icon: Chrome },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const Item = ({ href, label, icon: Icon }: (typeof nav)[number]) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "group flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150",
          active
            ? "bg-secondary font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon
          className={cn("size-[18px] shrink-0 transition-colors", active && "text-ember")}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-subtle/40 px-3 py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-[64px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-1")}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark />
          {!collapsed && <span className="text-sm font-semibold tracking-tight">Aftermeet</span>}
        </Link>
      </div>

      <div className="mt-5">
        {!collapsed ? (
          <Button asChild size="sm" className="w-full justify-start gap-2">
            <Link href="/workspace">
              <Plus className="size-4" /> New meeting
            </Link>
          </Button>
        ) : (
          <Button asChild size="icon" className="mx-auto">
            <Link href="/workspace" title="New meeting">
              <Plus className="size-4" />
            </Link>
          </Button>
        )}
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-0.5">
        {nav.map((n) => (
          <Item key={n.href} {...n} />
        ))}
        <div className="my-3 h-px bg-border" />
        {secondary.map((n) => (
          <Item key={n.href} {...n} />
        ))}
      </nav>

      <Button
        variant="ghost"
        size="sm"
        className={cn("text-muted-foreground", collapsed ? "justify-center px-0" : "justify-start")}
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        {!collapsed && <span>Collapse</span>}
      </Button>
    </aside>
  );
}
