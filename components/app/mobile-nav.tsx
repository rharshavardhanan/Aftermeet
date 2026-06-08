"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Clock, SquarePen, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImmersiveRoute } from "./nav-routes";

// Flat iOS-style tab bar. Tabs move between sections; "New" is the primary
// action, tinted ember but inline (no floating FAB — that's a Material pattern).
// "Extension" is intentionally absent: Chrome extensions don't exist on mobile.
type Tab = {
  href: string;
  label: string;
  icon: typeof House;
  primary?: boolean;
};

const tabs: Tab[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/history", label: "History", icon: Clock },
  { href: "/workspace", label: "New", icon: SquarePen, primary: true },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/75 backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto flex h-[52px] max-w-md items-stretch">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          // The "New" tab reads as primary: ember when active, ember-muted when not.
          const tint = t.primary
            ? active
              ? "text-ember"
              : "text-ember/70"
            : active
              ? "text-ember"
              : "text-muted-foreground";
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 pt-1 transition-opacity active:opacity-50",
                tint,
              )}
            >
              <t.icon className="size-[26px]" strokeWidth={active || t.primary ? 2.1 : 1.9} />
              <span className="text-[10px] font-medium leading-none tracking-tight">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
