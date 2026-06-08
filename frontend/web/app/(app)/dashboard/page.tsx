import type { Metadata } from "next";
import Link from "next/link";
import {
  Plus,
  ListChecks,
  CalendarClock,
  Gauge,
  FileText,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { auth, getCurrentWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/page-header";
import { TaskRow, type TaskRowData } from "@/components/app/task-row";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const workspace = await getCurrentWorkspace(userId);

  const [recentMeetings, openTasks, counts, completedTasks, upcoming] = await Promise.all([
    prisma.meeting.findMany({
      where: { userId },
      orderBy: { meetingDate: "desc" },
      take: 5,
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.task.findMany({
      where: { userId, status: "OPEN" },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { meeting: { select: { title: true } } },
    }),
    prisma.$transaction([
      prisma.meeting.count({ where: { userId } }),
      prisma.task.count({ where: { userId, status: "OPEN" } }),
      prisma.task.count({ where: { userId } }),
    ]),
    prisma.task.count({ where: { userId, status: "DONE" } }),
    prisma.task.findMany({
      where: { userId, status: "OPEN", dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 4,
      include: { meeting: { select: { title: true } } },
    }),
  ]);

  const [meetingsTotal, openCount, totalTasks] = counts;
  const productivity = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const stats = [
    { label: "Meetings", value: meetingsTotal, icon: FileText },
    { label: "Open tasks", value: openCount, icon: ListChecks },
    { label: "Completed", value: completedTasks, icon: CalendarClock },
    { label: "Productivity", value: `${productivity}%`, icon: Gauge },
  ];

  const toRow = (t: (typeof openTasks)[number]): TaskRowData => ({
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    dueDate: t.dueDate?.toISOString() ?? null,
    urgency: t.urgency,
    status: t.status,
    confidence: t.confidence,
    sourceQuote: t.sourceQuote,
    meetingTitle: t.meeting.title,
  });

  return (
    <div className="container max-w-6xl space-y-8 py-8">
      <PageHeader
        title={`Good ${greeting()}${session?.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}`}
        description="Here's what needs your attention."
        actions={
          <Button asChild>
            <Link href="/workspace">
              <Plus className="size-4" /> New meeting
            </Link>
          </Button>
        }
      />

      {/* stat ledger */}
      <div className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-card [&>*]:border-border sm:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "p-5",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              i > 0 && "sm:border-l",
            )}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <s.icon className="size-3.5" strokeWidth={1.75} />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{s.label}</span>
            </div>
            <p
              className={cn(
                "mt-3 text-3xl font-semibold tracking-[-0.02em] tnum",
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
            <CardTitle>Pending action items</CardTitle>
            <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {openTasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No open tasks"
                description="Process a meeting and your action items will land here."
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
          {/* AI insight */}
          <Card className="border-ember/25 bg-ember/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-ember" /> AI insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
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
              <CardTitle>Upcoming deadlines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {upcoming.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                upcoming.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{t.title}</span>
                    <Badge variant="warning" className="shrink-0">
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
          <CardTitle>Recent meetings</CardTitle>
          <Link href="/history" className="text-sm text-muted-foreground hover:text-foreground">
            History
          </Link>
        </CardHeader>
        <CardContent>
          {recentMeetings.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No meetings yet"
              description="Start your first AI meeting workspace — paste a transcript and watch it organize itself."
              action={
                <Button asChild size="sm">
                  <Link href="/workspace">
                    <Plus className="size-4" /> New meeting
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {recentMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/workspace/${m.id}`}
                  className="group flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium group-hover:underline">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(m.meetingDate)} · {m._count.tasks} tasks · {m.source.toLowerCase()}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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
