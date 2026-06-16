"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Clock, SquarePen, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImmersiveRoute } from "./nav-routes";

// iOS-style floating liquid-glass tab bar. A frosted, rounded pill hovers above
// the home indicator; a glass capsule slides between tabs with iOS easing — the
// "liquid" selection feel. "New" is the primary action (ember). "Extension" is
// intentionally absent: Chrome extensions don't exist on mobile.
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

// Per-tab width in px — the sliding capsule is exactly one tab wide and is
// translated by activeIndex * TAB_W, so this must match the Link width (w-16).
const TAB_W = 64;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;

  const activeIndex = tabs.findIndex((t) => isActive(pathname, t.href));

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_0.75rem)] z-40 flex justify-center md:hidden"
    >
      <div className="liquid-glass pointer-events-auto relative flex rounded-[24px] p-1.5">
        {/* Sliding liquid-glass selection capsule. */}
        <span
          aria-hidden
          className={cn(
            "ease-ios absolute bottom-1.5 left-1.5 top-1.5 rounded-[18px] transition-transform duration-500",
            activeIndex < 0 ? "opacity-0" : "glass-pill opacity-100",
          )}
          style={{ width: TAB_W, transform: `translateX(${Math.max(activeIndex, 0) * TAB_W}px)` }}
        />

        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const tint = t.primary
            ? active
              ? "text-ember"
              : "text-ember/75"
            : active
              ? "text-foreground"
              : "text-muted-foreground";
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative z-10 flex h-14 w-16 flex-col items-center justify-center gap-1 transition-transform active:scale-90",
                tint,
              )}
            >
              <t.icon className="size-[24px]" strokeWidth={active || t.primary ? 2.2 : 1.9} />
              <span className="text-[10px] font-medium leading-none tracking-tight">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
