import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="container pb-10">
      <div className="liquid-glass rounded-3xl px-6 py-12 sm:px-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground text-pretty">
              The calm workspace that turns meetings into execution.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {[
              { h: "Product", items: [["Features", "#features"], ["Extension", "#extension"], ["Pricing", "#pricing"]] },
              { h: "Company", items: [["About", "#"], ["Blog", "#"], ["Careers", "#"]] },
              { h: "Legal", items: [["Privacy", "#"], ["Terms", "#"], ["Security", "#"]] },
            ].map((col) => (
              <div key={col.h}>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {col.h}
                </p>
                <ul className="space-y-2 text-sm">
                  {col.items.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="text-muted-foreground transition-colors duration-200 ease-ios hover:text-foreground">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span className="font-mono tabular-nums">© {new Date().getFullYear()} Aftermeet. All rights reserved.</span>
          <span>Made for people who&apos;d rather be doing the work.</span>
        </div>
      </div>
    </footer>
  );
}
