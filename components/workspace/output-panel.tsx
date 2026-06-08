"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Gavel,
  ListChecks,
  CalendarClock,
  AlertTriangle,
  Mail,
  ScrollText,
  Download,
  Printer,
  FileUp,
  Loader2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { momToMarkdown, momToHtml, downloadText, printToPdf } from "@/lib/export";
import type { Mom } from "@/lib/ai/schema";

interface Decision { decision: string; rationale: string | null; confidence: number }
interface Deadline { what: string; date: string | null; owner: string | null }
interface Risk { risk: string; severity: "LOW" | "MEDIUM" | "HIGH" }

export interface OutputData {
  summary: string;
  decisions: Decision[];
  deadlines: Deadline[];
  risks: Risk[];
  followupEmail: string;
  mom: Mom | null;
  taskCount: number;
}

const sevTone = { HIGH: "destructive", MEDIUM: "warning", LOW: "muted" } as const;

export function OutputPanel({ data, meetingId }: { data: OutputData; meetingId?: string }) {
  const { summary, decisions, deadlines, risks, followupEmail, mom, taskCount } = data;
  const [exporting, setExporting] = useState(false);

  async function exportToGoogleDocs() {
    if (!meetingId) return;
    setExporting(true);
    const t = toast.loading("Creating your Google Doc…");
    try {
      const res = await fetch("/api/google/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok) {
        toast.error(body.message ?? "Couldn't export to Google Docs", { id: t });
        return;
      }
      toast.success("Minutes exported to Google Docs", {
        id: t,
        description: "Opening your document…",
      });
      if (body.url) window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Couldn't reach Google. Check your connection and try again.", { id: t });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Accordion type="multiple" defaultValue={["summary", "actions"]} className="px-1">
      {/* Summary */}
      <Section id="summary" icon={FileText} title="Summary">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{summary}</p>
        </div>
        <div className="mt-2">
          <CopyButton value={summary} />
        </div>
      </Section>

      {/* Decisions */}
      <Section id="decisions" icon={Gavel} title="Key Decisions" count={decisions.length}>
        {decisions.length === 0 ? (
          <Empty>No firm decisions were detected.</Empty>
        ) : (
          <ul className="space-y-3">
            {decisions.map((d, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{d.decision}</p>
                {d.rationale && <p className="mt-1 text-xs text-muted-foreground">{d.rationale}</p>}
                <Badge variant="muted" className="mt-2">
                  {Math.round(d.confidence * 100)}% confidence
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Action items pointer */}
      <Section id="actions" icon={ListChecks} title="Action Items" count={taskCount}>
        <p className="text-sm text-muted-foreground">
          {taskCount} action {taskCount === 1 ? "item" : "items"} extracted — manage them in the Tasks
          panel, where you can assign, edit, and complete each one.
        </p>
      </Section>

      {/* Deadlines */}
      <Section id="deadlines" icon={CalendarClock} title="Deadlines" count={deadlines.length}>
        {deadlines.length === 0 ? (
          <Empty>No concrete deadlines were mentioned.</Empty>
        ) : (
          <ul className="space-y-2">
            {deadlines.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span>{d.what}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {d.owner && <Badge variant="muted">{d.owner}</Badge>}
                  {d.date && <Badge variant="warning">{d.date}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Risks */}
      <Section id="risks" icon={AlertTriangle} title="Risks" count={risks.length}>
        {risks.length === 0 ? (
          <Empty>No risks were flagged.</Empty>
        ) : (
          <ul className="space-y-2">
            {risks.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span>{r.risk}</span>
                <Badge variant={sevTone[r.severity]}>{r.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Follow-up email */}
      <Section id="email" icon={Mail} title="Follow-up Email">
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-subtle/40 p-4 font-sans text-sm leading-relaxed">
          {followupEmail || "No email generated."}
        </pre>
        <div className="mt-2 flex gap-1">
          <CopyButton value={followupEmail} label="Copy email" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            asChild
          >
            <a
              href={`mailto:?subject=${encodeURIComponent("Meeting follow-up")}&body=${encodeURIComponent(
                followupEmail,
              )}`}
            >
              <Mail className="size-3.5" /> Open in mail
            </a>
          </Button>
        </div>
      </Section>

      {/* MoM */}
      <Section id="mom" icon={ScrollText} title="Meeting Minutes">
        {!mom ? (
          <Empty>Minutes are not available.</Empty>
        ) : (
          <div>
            <MomView mom={mom} />
            <div className="mt-3 flex flex-wrap gap-1">
              {meetingId && (
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={exportToGoogleDocs}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileUp className="size-3.5" />
                  )}
                  {exporting ? "Exporting…" : "Google Docs"}
                </Button>
              )}
              <CopyButton value={momToMarkdown(mom)} label="Copy Markdown" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={() => downloadText(`${slug(mom.title)}-minutes.md`, momToMarkdown(mom))}
              >
                <Download className="size-3.5" /> Markdown
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={() => printToPdf(`${mom.title} — Minutes`, momToHtml(mom))}
              >
                <Printer className="size-3.5" /> PDF
              </Button>
            </div>
          </div>
        )}
      </Section>
    </Accordion>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  count,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={id}>
      <AccordionTrigger>
        <span className="flex items-center gap-2.5">
          <Icon className="size-4 text-muted-foreground" />
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="muted" className="ml-1">{count}</Badge>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function MomView({ mom }: { mom: Mom }) {
  return (
    <div className="rounded-lg border border-border bg-subtle/40 p-5 text-sm">
      <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">{mom.title}</h3>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {[mom.date, mom.participants.join(", ")].filter(Boolean).join(" · ")}
      </p>
      {mom.agenda.length > 0 && (
        <MomBlock title="Agenda">
          <ul className="list-disc pl-4">{mom.agenda.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </MomBlock>
      )}
      <MomBlock title="Discussion">
        <p className="text-muted-foreground">{mom.discussionSummary}</p>
      </MomBlock>
      {mom.decisions.length > 0 && (
        <MomBlock title="Decisions">
          <ul className="list-disc pl-4">{mom.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </MomBlock>
      )}
      {mom.actionItems.length > 0 && (
        <MomBlock title="Action Items">
          <ul className="list-disc pl-4">{mom.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </MomBlock>
      )}
      {mom.nextMeeting && (
        <MomBlock title="Next Meeting">
          <p className="text-muted-foreground">{mom.nextMeeting}</p>
        </MomBlock>
      )}
    </div>
  );
}

function MomBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "meeting";
}
