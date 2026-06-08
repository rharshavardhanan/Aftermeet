import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TranscriptPanel } from "@/components/workspace/transcript-panel";
import { OutputPanel, type OutputData } from "@/components/workspace/output-panel";
import { MeetingPanels } from "@/components/workspace/meeting-panels";
import { TaskRow, type TaskRowData } from "@/components/app/task-row";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Mom } from "@/lib/ai/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const m = await prisma.meeting.findUnique({ where: { id }, select: { title: true } });
  return { title: m?.title ?? "Meeting" };
}

export default async function MeetingView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      transcript: true,
      aiOutput: true,
      tasks: { orderBy: [{ status: "asc" }, { urgency: "desc" }] },
    },
  });

  if (!meeting || meeting.userId !== session?.user?.id) notFound();

  const ai = meeting.aiOutput;
  const output: OutputData | null = ai
    ? {
        summary: ai.summary,
        decisions: (ai.decisions as unknown as OutputData["decisions"]) ?? [],
        deadlines: (ai.deadlines as unknown as OutputData["deadlines"]) ?? [],
        risks: (ai.risks as unknown as OutputData["risks"]) ?? [],
        followupEmail: ai.followupEmail,
        mom: (ai.mom as unknown as Mom) ?? null,
        taskCount: meeting.tasks.length,
      }
    : null;

  const taskRows: TaskRowData[] = meeting.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    dueDate: t.dueDate?.toISOString() ?? null,
    urgency: t.urgency,
    status: t.status,
    confidence: t.confidence,
    sourceQuote: t.sourceQuote,
  }));
  const openTasks = taskRows.filter((t) => t.status !== "ARCHIVED");

  return (
    <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col">
      {/* header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/history" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{meeting.title}</h1>
            <p className="text-xs text-muted-foreground">
              {formatDate(meeting.meetingDate, { month: "long", day: "numeric", year: "numeric" })} ·{" "}
              {meeting.source.toLowerCase()}
            </p>
          </div>
        </div>
        <Badge variant={meeting.status === "COMPLETED" ? "success" : "muted"}>
          {meeting.status.toLowerCase()}
        </Badge>
      </div>

      {/* Panels — 3-column on desktop, segmented tabs on mobile */}
      <MeetingPanels
        taskCount={openTasks.length}
        transcript={
          meeting.transcript ? (
            <TranscriptPanel raw={meeting.transcript.rawText} wordCount={meeting.transcript.wordCount} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No transcript stored.</div>
          )
        }
        output={
          output ? (
            <OutputPanel data={output} meetingId={id} />
          ) : (
            <EmptyState title="Not yet processed" description="This meeting has no AI output." />
          )
        }
        tasks={
          openTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks"
              description="No action items were extracted from this meeting."
            />
          ) : (
            openTasks.map((t) => <TaskRow key={t.id} task={t} showQuote />)
          )
        }
      />
    </div>
  );
}
