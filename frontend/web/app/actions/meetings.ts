"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth, getCurrentWorkspace } from "@/lib/auth";
import { extractMeeting } from "@/lib/ai/extract";
import { mockExtract } from "@/lib/ai/mock";
import { isAiConfigured } from "@/lib/openai";
import { processMeetingSchema, type ProcessMeetingInput } from "@/lib/validations";
import type { Extraction } from "@/lib/ai/schema";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * The core flow: take a transcript → run the AI engine → persist meeting,
 * transcript, AI output, and tasks atomically. Enforces plan limits.
 */
export async function processMeeting(
  input: ProcessMeetingInput,
): Promise<ActionResult<{ meetingId: string }>> {
  // Outer guard: any unhandled throw (DB cold-start, auth, network) returns a
  // structured error instead of triggering the global error boundary.
  try {
    return await _processMeeting(input);
  } catch (err) {
    console.error("processMeeting unhandled error", err);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

async function _processMeeting(
  input: ProcessMeetingInput,
): Promise<ActionResult<{ meetingId: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You need to sign in." };

  const parsed = processMeetingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const workspace = await getCurrentWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "No workspace found." };

  // Plan limit (free tier).
  const billing = workspace.billing;
  if (billing && billing.plan === "FREE" && billing.meetingsUsed >= billing.meetingsLimit) {
    return {
      ok: false,
      error: "You've reached your free plan limit. Upgrade to Pro for unlimited meetings.",
    };
  }

  const { transcript, source, participants } = parsed.data;
  const meetingDate = new Date();
  const pref = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
    select: { priority: true },
  });

  // Run extraction (real or demo).
  let extraction: Extraction;
  let model = "demo";
  let tokensUsed = 0;
  try {
    if (isAiConfigured()) {
      const res = await extractMeeting({
        transcript,
        meetingDate: meetingDate.toISOString().slice(0, 10),
        knownParticipants: participants,
        priority: pref?.priority,
      });
      extraction = res.data;
      model = res.model;
      tokensUsed = res.tokensUsed;
    } else {
      extraction = mockExtract(transcript, meetingDate);
    }
  } catch (err) {
    console.error("extraction failed", err);
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED|exhausted/i.test(msg)) {
      return {
        ok: false,
        error:
          "AI quota exceeded — your Gemini key has no free-tier quota. Enable billing on its Google Cloud project, or make sure GROQ_API_KEY is also set as a fallback.",
      };
    }
    if (/PERMISSION_DENIED|location is not supported|not available in your (country|region)|SERVICE_DISABLED/i.test(msg)) {
      return {
        ok: false,
        error:
          "Gemini is not available in your region. The app will use Groq — make sure GROQ_API_KEY is set in your environment.",
      };
    }
    if (/API.?key.*(not valid|invalid)|invalid.?API.?key/i.test(msg)) {
      return {
        ok: false,
        error: "Your Gemini API key is invalid. Check GEMINI_API_KEY in your environment settings.",
      };
    }
    return {
      ok: false,
      error: "AI analysis failed. Please try again in a moment.",
    };
  }

  const title = parsed.data.title?.trim() || extraction.title || "Untitled meeting";

  try {
    const meeting = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.create({
        data: {
          workspaceId: workspace.id,
          userId: session.user.id,
          title,
          source,
          status: "COMPLETED",
          meetingDate,
          participants: extraction.participants,
          transcript: {
            create: {
              rawText: transcript,
              wordCount: transcript.split(/\s+/).filter(Boolean).length,
            },
          },
          aiOutput: {
            create: {
              model,
              summary: extraction.summary,
              decisions: extraction.decisions,
              risks: extraction.risks,
              deadlines: extraction.deadlines,
              followupEmail: extraction.followupEmail,
              mom: extraction.mom,
              tokensUsed,
            },
          },
        },
      });

      if (extraction.actionItems.length) {
        await tx.task.createMany({
          data: extraction.actionItems.map((t) => ({
            meetingId: m.id,
            userId: session.user.id,
            title: t.title,
            assignee: t.assignee,
            dueDate: t.dueDate ? safeDate(t.dueDate) : null,
            urgency: t.urgency,
            confidence: t.confidence,
            sourceQuote: t.sourceQuote,
          })),
        });
      }

      if (billing) {
        await tx.billing.update({
          where: { id: billing.id },
          data: { meetingsUsed: { increment: 1 } },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: "meeting.processed",
          meta: { meetingId: m.id, tasks: extraction.actionItems.length, model },
        },
      });

      return m;
    });

    revalidatePath("/dashboard");
    revalidatePath("/history");
    return { ok: true, data: { meetingId: meeting.id } };
  } catch (err) {
    console.error("persist failed", err);
    return { ok: false, error: "Saved analysis failed. Please retry." };
  }
}

export async function deleteMeeting(meetingId: string): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { userId: true } });
  if (!meeting || meeting.userId !== session.user.id) return { ok: false, error: "Not found" };
  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
