import type { Metadata } from "next";
import Link from "next/link";
import {
  Plus,
  ListChecks,
  CircleCheck,
  Gauge,
  FileText,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { serverApi } from "@/lib/server-api";
import { PageHeader } from "@/components/app/page-header";
import { TaskRow, type TaskRowData } from "@/components/app/task-row";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

interface DashTask {
  id: string;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "DONE" | "ARCHIVED";
  confidence: number;
  sourceQuote: string | null;
  meeting: { title: string };
}
interface DashMeeting {
  id: string;
  title: string;
  meetingDate: string;
  source: string;
  _count: { tasks: number };
}
interface DashboardData {
  stats: { meetingsTotal: number; openCount: number; completedTasks: number; productivity: number };
  openTasks: DashTask[];
  upcoming: { id: string; title: string; dueDate: string | null }[];
  recentMeetings: DashMeeting[];
}

export default async function DashboardPage() {
  const session = await auth();
  const data = await serverApi<DashboardData>("/dashboard");
  const { recentMeetings, openTasks, upcoming } = data;
  const { meetingsTotal, openCount, completedTasks, productivity } = data.stats;

  const stats = [
    { label: "Meetings", value: meetingsTotal, icon: FileText },
    { label: "Open tasks", value: openCount, icon: ListChecks },
    { label: "Completed", value: completedTasks, icon: CircleCheck },
    { label: "Productivity", value: `${productivity}%`, icon: Gauge },
  ];

  const toRow = (t: DashTask): TaskRowData => ({
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    dueDate: t.dueDate,
    urgency: t.urgency,
    status: t.status,
    confidence: t.confidence,
    sourceQuote: t.sourceQuote,
    meetingTitle: t.meeting.title,
  });

  return (
    <div className="container max-w-6xl space-y-8 py-8 animate-rise">
      <PageHeader
        title={`Good ${greeting()}${session?.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}`}
        description="Here's what needs your attention today."
        actions={
          <Button asChild>
            <Link href="/workspace">
              <Plus className="size-4" /> New meeting
            </Link>
          </Button>
        }
      />

      {/* stat ledger — one glass panel, hairline-divided like a record */}
      <div className="liquid-glass grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "p-5",
              i % 2 === 1 && "border-l border-border/70",
              i >= 2 && "border-t border-border/70 sm:border-t-0",
              i > 0 && "sm:border-l sm:border-border/70",
            )}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="glass-pill flex size-6 items-center justify-center rounded-lg text-ember">
                <s.icon className="size-3.5" strokeWidth={1.75} />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{s.label}</span>
            </div>
            <p
              className={cn(
                "mt-3 font-display text-3xl font-semibold tracking-[-0.02em] tnum",
                i === 3 && "text-ember",
              )}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending action items */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Pending action items</CardTitle>
            <Link
              href="/history"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {openTasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No open tasks"
                description="Process a meeting and your action items will land here, ready to clear."
                action={
                  <Button asChild size="sm">
                    <Link href="/workspace">Start a meeting</Link>
                  </Button>
                }
              />
            ) : (
              openTasks.map((t) => <TaskRow key={t.id} task={toRow(t)} />)
            )}
          </CardContent>
        </Card>

        {/* Side column */}
        <div className="space-y-6">
          {/* Today's read */}
          <Card className="border-ember/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <span className="glass-pill flex size-6 items-center justify-center rounded-lg text-ember">
                  <Sparkles className="size-3.5" />
                </span>
                Today&apos;s read
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/85">
                {openCount > 0
                  ? `You have ${openCount} open ${openCount === 1 ? "task" : "tasks"}. ${
                      upcoming.length
                        ? `${upcoming.length} have deadlines coming up — clear those first.`
                        : "None have hard deadlines yet."
                    }`
                  : "All clear. Bring your next meeting and stay ahead of it."}
              </p>
            </CardContent>
          </Card>

          {/* Upcoming follow-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Upcoming deadlines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {upcoming.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No deadlines on the horizon.
                </p>
              ) : (
                upcoming.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-foreground/[0.04]"
                  >
                    <span className="truncate">{t.title}</span>
                    <Badge variant="warning" className="shrink-0 font-mono">
                      {t.dueDate ? formatRelative(t.dueDate) : ""}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent meetings */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Recent meetings</CardTitle>
          <Link
            href="/history"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            History
          </Link>
        </CardHeader>
        <CardContent>
          {recentMeetings.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No meetings yet"
              description="Paste your first transcript and watch it sort itself into tasks, decisions, and minutes."
              action={
                <Button asChild size="sm">
                  <Link href="/workspace">
                    <Plus className="size-4" /> New meeting
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {recentMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/workspace/${m.id}`}
                  className="hover-lift group flex items-center justify-between gap-4 rounded-xl px-3 py-3 hover:bg-foreground/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium tracking-tight">{m.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {formatRelative(m.meetingDate)} · {m._count.tasks} tasks · {m.source.toLowerCase()}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 ease-ios group-hover:translate-x-0 group-hover:text-ember group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
