import type { Extraction } from "./schema";

/**
 * Deterministic demo extraction used when OPENAI_API_KEY is absent.
 * Lets the whole product be explored end-to-end without credentials.
 * It does light real parsing so the output tracks the pasted transcript.
 */
export function mockExtract(transcript: string, meetingDate = new Date()): Extraction {
  const sentences = transcript
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)
    .filter((s) => s.trim().length > 0);

  const names = Array.from(
    new Set((transcript.match(/\b([A-Z][a-z]{2,})\b/g) ?? []).filter((n) => n.length < 14)),
  ).slice(0, 4);

  const actionLines = sentences.filter((s) =>
    /\b(will|need to|should|let's|action|follow up|send|prepare|review|ship|by (monday|tuesday|wednesday|thursday|friday|next week|eod|friday))\b/i.test(
      s,
    ),
  );

  const fmtDate = meetingDate.toISOString().slice(0, 10);

  return {
    title: sentences[0]?.slice(0, 60).replace(/[.?!]$/, "") || "Team sync",
    participants: names.length ? names : ["Speaker 1", "Speaker 2"],
    summary:
      sentences.slice(0, 3).join(" ").slice(0, 420) ||
      "Short discussion captured. Add a fuller transcript for a richer summary.",
    decisions: actionLines.slice(0, 2).map((s) => ({
      decision: s.slice(0, 120),
      rationale: null,
      confidence: 0.55,
    })),
    actionItems: (actionLines.length ? actionLines : sentences.slice(0, 3))
      .slice(0, 5)
      .map((s, i) => ({
        title: s.replace(/^(we|i|they|let's)\s+/i, "").slice(0, 90),
        assignee: names[i % Math.max(names.length, 1)] ?? null,
        dueDate: /next week|friday|eod|monday/i.test(s) ? fmtDate : null,
        urgency: /asap|urgent|critical|today/i.test(s) ? "HIGH" : "MEDIUM",
        confidence: 0.5 + ((i % 3) * 0.12),
        sourceQuote: s.slice(0, 120),
      })),
    deadlines: actionLines
      .filter((s) => /friday|monday|next week|eod/i.test(s))
      .slice(0, 3)
      .map((s) => ({ what: s.slice(0, 80), date: fmtDate, owner: names[0] ?? null })),
    risks: [],
    followupEmail: `Hi team,\n\nThanks for the time today. Quick recap and next steps:\n\n${actionLines
      .slice(0, 4)
      .map((s) => `• ${s.slice(0, 90)}`)
      .join("\n")}\n\nShout if I missed anything.\n\nBest,\n`,
    mom: {
      title: sentences[0]?.slice(0, 60) || "Team sync",
      participants: names.length ? names : ["Speaker 1", "Speaker 2"],
      date: fmtDate,
      agenda: sentences.slice(0, 3).map((s) => s.slice(0, 70)),
      discussionSummary: sentences.slice(0, 4).join(" ").slice(0, 500),
      decisions: actionLines.slice(0, 2).map((s) => s.slice(0, 100)),
      actionItems: actionLines.slice(0, 5).map((s) => s.slice(0, 90)),
      nextMeeting: null,
      notes: "Generated in demo mode (no OpenAI key). Add OPENAI_API_KEY for full quality.",
    },
    overallConfidence: 0.5,
  };
}
