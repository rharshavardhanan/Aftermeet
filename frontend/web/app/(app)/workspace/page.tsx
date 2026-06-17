import type { Metadata } from "next";
import { Info } from "lucide-react";
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
        <div className="liquid-glass animate-fade-in-sm flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm text-foreground">
          <span className="glass-pill mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
            <Info className="size-3.5 text-ember" />
          </span>
          <p className="leading-relaxed">
            You&apos;re in <span className="font-medium">demo mode</span>. Set{" "}
            <code className="glass-pill rounded-md px-1.5 py-0.5 font-mono text-xs text-foreground">
              OPENAI_API_KEY
            </code>{" "}
            for full-quality extraction and audio transcription.
          </p>
        </div>
      )}
      <NewMeeting defaultRecord={sp.record === "1"} />
    </div>
  );
}
