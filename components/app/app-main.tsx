"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isImmersiveRoute } from "./nav-routes";

/**
 * App content region. Adds bottom-nav clearance on mobile so the fixed bottom
 * bar never covers the last items — except on immersive routes, where the nav
 * is hidden and the screen owns its own height.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = isImmersiveRoute(pathname);
  return (
    <main className={cn("flex-1 animate-rise", !immersive && "pb-mobilenav md:pb-0")}>
      {children}
    </main>
  );
}
