import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processMeeting } from "@/app/actions/meetings";

const ALLOWED = [/^https:\/\/meet\.google\.com$/, /^https:\/\/[\w-]+\.zoom\.us$/];

function corsHeaders(origin: string | null) {
  const ok = origin && ALLOWED.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  } as Record<string, string>;
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to the web app first." }, { status: 401, headers });
  }

  let body: { transcript?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers });
  }

  const result = await processMeeting({
    transcript: body.transcript ?? "",
    title: body.platform ? `${body.platform} call` : undefined,
    source: "EXTENSION",
    participants: [],
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers });
  }

  const tasks = await prisma.task.findMany({
    where: { meetingId: result.data.meetingId },
    select: { title: true, assignee: true, dueDate: true, urgency: true },
    orderBy: { urgency: "desc" },
  });

  return NextResponse.json(
    {
      meetingId: result.data.meetingId,
      tasks: tasks.map((t) => ({
        title: t.title,
        assignee: t.assignee,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        urgency: t.urgency,
      })),
    },
    { headers },
  );
}
