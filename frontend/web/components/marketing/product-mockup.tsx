import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Static, pixel-clean representation of the workspace. Used in the hero so the
 * value is legible in two seconds without a video. No live data, no animation
 * beyond a faint entrance.
 */
export function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl animate-fade-in">
      <div className="liquid-glass overflow-hidden rounded-2xl shadow-float">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <div className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-ember" />
            <span className="font-medium text-foreground">Q3 Roadmap Sync</span>
            <span className="font-mono tabular-nums">· processed in 4.2s</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr_0.9fr]">
          {/* transcript */}
          <div className="hidden border-r border-border/60 p-4 md:block">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Transcript
            </p>
            <div className="space-y-3 text-[12.5px] leading-relaxed">
              {[
                ["Alex", "Let's lock the launch for the 14th. Sarah, can you own the press kit?"],
                ["Sarah", "Yes — I'll have a draft by Friday and loop in design."],
                ["Marco", "We still have the API rate-limit risk to resolve before then."],
              ].map(([who, line]) => (
                <div key={who}>
                  <span className="font-medium text-foreground">{who}</span>
                  <p className="text-muted-foreground">{line}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI output */}
          <div className="border-r border-border/60 p-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              AI output
            </p>
            <div className="space-y-2.5">
              {["Summary", "Key Decisions", "Action Items", "Follow-up Email", "Meeting Minutes"].map(
                (s, i) => (
                  <div
                    key={s}
                    className="glass-pill flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px]"
                  >
                    <span className="font-medium">{s}</span>
                    {i === 0 ? (
                      <Badge variant="success">Ready</Badge>
                    ) : (
                      <span className="text-muted-foreground">›</span>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* tasks */}
          <div className="p-4">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Tasks
            </p>
            <div className="space-y-2.5">
              {[
                { t: "Own press kit draft", who: "Sarah", due: "Fri", done: false, hi: true },
                { t: "Resolve API rate-limit", who: "Marco", due: "Jun 12", done: false, hi: false },
                { t: "Confirm launch date", who: "Alex", due: "—", done: true, hi: false },
              ].map((task) => (
                <div
                  key={task.t}
                  className="glass-pill rounded-lg p-3"
                >
                  <div className="flex items-start gap-2">
                    {task.done ? (
                      <CheckCircle2 className="mt-0.5 size-4 text-success" />
                    ) : (
                      <Circle className="mt-0.5 size-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-[13px] font-medium ${task.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {task.t}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge variant="muted">{task.who}</Badge>
                        <Badge variant={task.hi ? "warning" : "muted"}>{task.due}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* soft floor reflection + ember floor-glow under the artifact */}
      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-20 w-3/4 -translate-x-1/2 rounded-[100%] bg-foreground/[0.07] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 left-1/2 h-16 w-1/3 -translate-x-1/2 rounded-[100%] bg-ember/10 blur-3xl" />
    </div>
  );
}
