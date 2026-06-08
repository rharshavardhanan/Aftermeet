"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-reveal wrapper — fades + rises its children into view once, when they
 * enter the viewport. Uses a CSS transition (not a keyframe) so a `delay` can
 * stagger siblings. Honors prefers-reduced-motion and degrades to visible if
 * IntersectionObserver is unavailable (e.g. SSR / old WebViews).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  // Once the entrance is done we drop the stagger delay so later transitions
  // (e.g. hover lift on cards) stay snappy instead of inheriting the delay.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setSettled(true), delay + 750);
    return () => clearTimeout(id);
  }, [shown, delay]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: settled ? "0ms" : `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] motion-reduce:!transform-none motion-reduce:!transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
