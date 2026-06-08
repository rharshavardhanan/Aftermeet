import type { Metadata } from "next";
import { isAiConfigured } from "@/lib/openai";
import { PageHeader } from "@/components/app/page-header";
import { NewMeeting } from "@/components/workspace/new-meeting";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "New meeting" };

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string }>;
}) {
  const sp = await searchParams;
  const aiOn = isAiConfigured();

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <PageHeader
        title="New meeting"
        description="Bring a transcript. Get tasks, decisions, and minutes."
        actions={
          aiOn ? (
            <Badge variant="success">AI ready</Badge>
          ) : (
            <Badge variant="warning">Demo mode</Badge>
          )
        }
      />
      {!aiOn && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
          Running in <span className="font-medium">demo mode</span> — set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">OPENAI_API_KEY</code> for
          full-quality extraction and audio transcription.
        </div>
      )}
      <NewMeeting defaultRecord={sp.record === "1"} />
    </div>
  );
}
