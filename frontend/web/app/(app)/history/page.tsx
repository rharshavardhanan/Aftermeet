import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText, ListChecks, ArrowUpRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const q = (await searchParams).q?.trim() ?? "";
  const meetings = await prisma.meeting.findMany({
    where: {
      userId: session.user.id,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { aiOutput: { summary: { contains: q, mode: "insensitive" } } },
              { tasks: { some: { title: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { meetingDate: "desc" },
    include: { _count: { select: { tasks: true } }, aiOutput: { select: { summary: true } } },
  });

  return (
    <div className="container max-w-6xl space-y-6 py-8 animate-rise">
      <PageHeader
        title="History"
        description={
          q
            ? `${meetings.length} ${meetings.length === 1 ? "result" : "results"} for “${q}”`
            : `${meetings.length} ${meetings.length === 1 ? "meeting" : "meetings"} on the record`
        }
        actions={
          <Button asChild>
            <Link href="/workspace">
              <Plus className="size-4" /> New meeting
            </Link>
          </Button>
        }
      />

      {meetings.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q ? "No matches" : "No meetings yet"}
          description={
            q
              ? `Nothing matched “${q}”. Try a broader term, or clear the search.`
              : "Your processed meetings land here as a searchable record. Start with a transcript."
          }
          action={
            <Button asChild size="sm">
              <Link href={q ? "/history" : "/workspace"}>
                {q ? (
                  "Clear search"
                ) : (
                  <>
                    <Plus className="size-4" /> New meeting
                  </>
                )}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((m) => (
            <Link key={m.id} href={`/workspace/${m.id}`} className="group">
              <Card className="hover-lift h-full group-hover:border-ember/30">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug tracking-tight">
                      {m.title}
                    </h3>
                    <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 ease-ios group-hover:translate-x-0 group-hover:text-ember group-hover:opacity-100" />
                  </div>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {m.aiOutput?.summary ?? "No summary yet."}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span
                      className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                      title={formatDate(m.meetingDate)}
                    >
                      {formatRelative(m.meetingDate)}
                    </span>
                    <Badge variant="muted" className="gap-1 font-mono">
                      <ListChecks className="size-3" /> {m._count.tasks}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
