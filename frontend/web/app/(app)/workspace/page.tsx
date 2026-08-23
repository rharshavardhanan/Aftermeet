import type { Metadata } from "next";
import { Info } from "lucide-react";
import { getHealth } from "@/lib/api-client";
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
  // Transcription and extraction both run on the backend now, so it is the only
  // side that knows whether a provider key is present. A down backend reads as
  // demo mode rather than failing the page.
  const aiOn = await getHealth()
    .then((h) => h.ai === "up")
    .catch(() => false);

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
              GROQ_API_KEY
            </code>{" "}
            on the backend for full-quality transcription and extraction.
          </p>
        </div>
      )}
      <NewMeeting defaultRecord={sp.record === "1"} />
    </div>
  );
}
