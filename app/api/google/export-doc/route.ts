import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { momToHtml } from "@/lib/export";
import { getGoogleAccessToken, createGoogleDocFromHtml } from "@/lib/google";
import type { Mom } from "@/lib/ai/schema";

/**
 * Exports a meeting's Minutes (MoM) into a new, formatted Google Doc in the
 * signed-in user's Drive, and returns the doc URL. The minutes are read from
 * the DB by meetingId (ownership-checked) — never trusted from the client.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let meetingId: string | undefined;
  try {
    ({ meetingId } = await req.json());
  } catch {
    /* ignore */
  }
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId is required" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId: session.user.id },
    include: { aiOutput: true },
  });
  if (!meeting?.aiOutput?.mom) {
    return NextResponse.json({ error: "No minutes found for this meeting." }, { status: 404 });
  }

  const tok = await getGoogleAccessToken(session.user.id);
  if ("error" in tok) {
    const message =
      tok.error === "no-scope"
        ? "Reconnect Google to allow Docs export — sign out and sign back in."
        : "Could not access your Google account. Try signing in again.";
    return NextResponse.json({ error: tok.error, message }, { status: 403 });
  }

  const mom = meeting.aiOutput.mom as unknown as Mom;
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${momToHtml(mom)}</body></html>`;
  const title = `${mom.title || meeting.title || "Meeting Minutes"} — Minutes`;

  const result = await createGoogleDocFromHtml(tok.token, title, html);
  if ("error" in result) {
    // 401/403 from Google usually means the token/scope is stale; otherwise the
    // Drive API likely isn't enabled on the Cloud project.
    const reconnect = result.status === 401 || result.status === 403;
    return NextResponse.json(
      {
        error: "google",
        message: reconnect
          ? "Google rejected the request — reconnect your account (sign out and back in)."
          : "Export failed. Make sure the Google Drive API is enabled in your Google Cloud project.",
      },
      { status: reconnect ? 403 : 502 },
    );
  }

  await prisma.activityLog
    .create({ data: { userId: session.user.id, action: "mom.export.gdoc", meta: { meetingId } } })
    .catch(() => {});

  return NextResponse.json({ url: result.url });
}
