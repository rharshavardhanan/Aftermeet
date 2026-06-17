"use client";

import { useState } from "react";
import { Globe, Search, Check, ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Lang = { code: string; label: string };

/**
 * iOS action-sheet language picker. Replaces the native <select> — far nicer for
 * 45 languages on a phone: a searchable, tappable list in a bottom sheet.
 */
export function LanguageSheet({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Lang[];
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const current = options.find((o) => o.code === value) ?? options[0];
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <SheetTrigger
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        title="Spoken language — helps with non-English audio"
      >
        <Globe className="size-3.5 shrink-0" />
        <span className="text-foreground">{current?.label}</span>
        <ChevronDown className="size-3.5" />
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="px-5 pb-2">Spoken language</SheetTitle>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search languages"
              aria-label="Search languages"
              className="h-10 w-full rounded-xl border border-input bg-card/60 pl-9 pr-3 text-sm backdrop-blur-sm placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => {
                onChange(o.code);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-foreground/[0.04] active:bg-foreground/[0.06]",
                o.code === value ? "font-medium text-ember" : "text-foreground",
              )}
            >
              {o.label}
              {o.code === value && <Check className="size-4 shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No language matches &ldquo;{q}&rdquo;.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
