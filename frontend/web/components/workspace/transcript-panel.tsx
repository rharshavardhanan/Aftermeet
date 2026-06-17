"use client";

import { useMemo } from "react";
import { CopyButton } from "@/components/ui/copy-button";

/** Parses "Name: text" lines into speaker turns; falls back to plain paragraphs. */
function parse(raw: string) {
  return raw
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([A-Z][\w .'-]{1,28}):\s*(.*)$/);
      return m ? { speaker: m[1], text: m[2] } : { speaker: null, text: line };
    });
}

export function TranscriptPanel({ raw, wordCount }: { raw: string; wordCount: number }) {
  const turns = useMemo(() => parse(raw), [raw]);
  const speakers = useMemo(
    () => [...new Set(turns.map((t) => t.speaker).filter(Boolean))] as string[],
    [turns],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="liquid-glass z-10 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Transcript
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            <span className="tabular-nums text-foreground/70">{wordCount}</span> words
            {speakers.length ? (
              <>
                {" "}
                <span className="text-muted-foreground/50">·</span>{" "}
                <span className="tabular-nums text-foreground/70">{speakers.length}</span> speakers
              </>
            ) : null}
          </p>
        </div>
        <CopyButton value={raw} />
      </div>
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 text-[13px] leading-relaxed">
        {turns.map((t, i) => (
          <div key={i} className="text-pretty">
            {t.speaker && (
              <span className="mr-2 font-display font-semibold tracking-tight text-foreground">
                {t.speaker}
              </span>
            )}
            <span className="text-foreground/85">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
