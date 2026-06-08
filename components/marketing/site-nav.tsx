"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chrome } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#features", label: "Features" },
  { href: "#extension", label: "Extension" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <nav
        className={cn(
          "flex h-14 w-full max-w-3xl items-center justify-between rounded-full border px-2 py-2 transition-all duration-300 ease-out-expo",
          scrolled
            ? "border-border/80 bg-background/70 shadow-subtle backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="pl-2">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/login">
              <Chrome className="size-4" />
              Start free
            </Link>
          </Button>
        </div>
      </nav>
    </div>
  );
}
