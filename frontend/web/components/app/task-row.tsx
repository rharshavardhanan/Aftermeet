"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Clock, User, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, confidenceMeta, formatDate } from "@/lib/utils";
import { toggleTaskDone } from "@/app/actions/tasks";

export interface TaskRowData {
  id: string;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "DONE" | "ARCHIVED";
  confidence: number;
  sourceQuote: string | null;
  meetingTitle?: string;
}

const urgencyTone = { HIGH: "destructive", MEDIUM: "warning", LOW: "muted" } as const;

export function TaskRow({ task, showQuote = false }: { task: TaskRowData; showQuote?: boolean }) {
  const [done, setDone] = useState(task.status === "DONE");
  const [, startTransition] = useTransition();
  const conf = confidenceMeta(task.confidence);

  function toggle() {
    const nextDone = !done;
    setDone(nextDone); // optimistic
    startTransition(() => {
      toggleTaskDone(task.id, nextDone);
    });
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-foreground/20">
      <button onClick={toggle} className="mt-0.5 shrink-0" aria-label={done ? "Mark open" : "Mark done"}>
        {done ? (
          <CheckCircle2 className="size-[18px] text-success" />
        ) : (
          <Circle className="size-[18px] text-muted-foreground transition-colors group-hover:text-foreground" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium leading-snug", done && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.assignee && (
            <Badge variant="muted" className="gap-1">
              <User className="size-3" /> {task.assignee}
            </Badge>
          )}
          {task.dueDate && (
            <Badge variant={urgencyTone[task.urgency]} className="gap-1">
              <Clock className="size-3" /> {formatDate(task.dueDate, { month: "short", day: "numeric" })}
            </Badge>
          )}
          <Badge variant={conf.tone === "success" ? "success" : conf.tone === "warning" ? "warning" : "muted"}>
            {conf.label} · {Math.round(task.confidence * 100)}%
          </Badge>
          {task.meetingTitle && (
            <span className="truncate text-xs text-muted-foreground">{task.meetingTitle}</span>
          )}
        </div>
        {showQuote && task.sourceQuote && (
          <p className="mt-2.5 flex gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs italic leading-relaxed text-muted-foreground">
            <Quote className="mt-0.5 size-3 shrink-0 text-ember/70" />
            <span>{task.sourceQuote}</span>
          </p>
        )}
      </div>
    </div>
  );
}
