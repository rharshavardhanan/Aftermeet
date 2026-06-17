"use client";

import { useState } from "react";
import { FileText, Sparkles, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

type PanelKey = "output" | "tasks" | "transcript";

/**
 * Meeting body. Desktop: a fixed 3-panel grid (transcript · output · tasks).
 * Mobile: a segmented control swaps one full-height panel at a time — three
 * narrow side-by-side columns are unusable on a phone, and this also makes the
 * transcript reachable on mobile (it was previously hidden entirely).
 *
 * Each panel renders once; mobile visibility is toggled with `hidden lg:block`,
 * so there's no duplicated/independent client state.
 */
export function MeetingPanels({
  transcript,
  output,
  tasks,
  taskCount,
}: {
  transcript: React.ReactNode;
  output: React.ReactNode;
  tasks: React.ReactNode;
  taskCount: number;
}) {
  const [tab, setTab] = useState<PanelKey>("output");

  const segments: { key: PanelKey; label: string; icon: typeof FileText; badge?: number }[] = [
    { key: "output", label: "Output", icon: Sparkles },
    { key: "tasks", label: "Tasks", icon: ListChecks, badge: taskCount },
    { key: "transcript", label: "Transcript", icon: FileText },
  ];

  const hide = (key: PanelKey) => tab !== key && "hidden lg:block";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile segmented control */}
      <div className="border-b border-border p-2 lg:hidden">
        <div className="liquid-glass grid grid-cols-3 gap-1 rounded-xl p-1">
          {segments.map((s) => {
            const active = tab === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setTab(s.key)}
                aria-pressed={active}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-all duration-300 ease-ios active:scale-95",
                  active ? "glass-pill text-foreground" : "text-muted-foreground",
                )}
              >
                <s.icon
                  className={cn("size-4", active && "text-ember")}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {s.label}
                {s.badge ? (
                  <span className="font-mono tnum text-[11px] text-muted-foreground">{s.badge}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panels */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
        {/* transcript */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto border-border lg:flex-none lg:border-r",
            hide("transcript"),
          )}
        >
          {transcript}
        </div>

        {/* output */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto border-border lg:flex-none lg:border-r",
            hide("output"),
          )}
        >
          <div className="liquid-glass sticky top-0 z-10 hidden rounded-none border-x-0 border-t-0 px-5 py-3 lg:block">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              The record
            </p>
          </div>
          <div className="p-4">{output}</div>
        </div>

        {/* tasks */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto lg:flex-none", hide("tasks"))}>
          <div className="liquid-glass sticky top-0 z-10 hidden items-center gap-2 rounded-none border-x-0 border-t-0 px-5 py-3 lg:flex">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tasks
            </p>
            {taskCount > 0 && (
              <span className="font-mono tnum text-[11px] text-muted-foreground">{taskCount}</span>
            )}
          </div>
          <div className="space-y-2.5 p-4">{tasks}</div>
        </div>
      </div>
    </div>
  );
}
