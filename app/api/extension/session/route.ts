import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Backs the Chrome extension's session handshake AND the web app's
// "Extension: connected" badge. The extension POSTs start/heartbeat/end as the
// user captures a call; the web topbar GETs status to reflect a live connection.
//
// A session counts as "connected" if it is active and was touched recently.
const FRESH_MS = 2 * 60 * 1000; // 2 minutes

const ALLOWED = [/^https:\/\/meet\.google\.com$/, /^https:\/\/[\w-]+\.zoom\.us$/];

function corsHeaders(origin: string | null) {
  const ok = origin && ALLOWED.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  } as Record<string, string>;
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ connected: false, authenticated: false }, { status: 200, headers });
  }

  const latest = await prisma.extensionSession.findFirst({
    where: { userId: session.user.id, status: "active" },
    orderBy: { startedAt: "desc" },
    select: { id: true, platform: true, tabUrl: true, startedAt: true, meetingId: true },
  });

  const connected = !!latest && Date.now() - latest.startedAt.getTime() < FRESH_MS;
  return NextResponse.json(
    { connected, authenticated: true, session: connected ? latest : null },
    { status: 200, headers },
  );
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to the web app first." }, { status: 401, headers });
  }
  const userId = session.user.id;

  let body: { action?: string; platform?: string; tabUrl?: string; meetingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers });
  }

  const action = body.action ?? "start";
  const platform = ["zoom", "meet", "teams"].includes(body.platform ?? "")
    ? body.platform!
    : "meet";

  if (action === "end") {
    await prisma.extensionSession.updateMany({
      where: { userId, status: "active" },
      data: { status: "ended", endedAt: new Date() },
    });
    return NextResponse.json({ ok: true, connected: false }, { status: 200, headers });
  }

  // start | heartbeat: keep a single active session per user fresh.
  const existing = await prisma.extensionSession.findFirst({
    where: { userId, status: "active" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await prisma.extensionSession.update({
      where: { id: existing.id },
      data: {
        platform,
        tabUrl: body.tabUrl ?? undefined,
        meetingId: body.meetingId ?? undefined,
        startedAt: new Date(), // bump freshness for heartbeat
      },
    });
  } else {
    await prisma.extensionSession.create({
      data: { userId, platform, tabUrl: body.tabUrl, meetingId: body.meetingId, status: "active" },
    });
  }

  return NextResponse.json({ ok: true, connected: true }, { status: 200, headers });
}
