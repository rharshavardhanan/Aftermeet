import type { Mom } from "@/lib/ai/schema";

/** Render Meeting Minutes to clean Markdown (copy / .md export). */
export function momToMarkdown(mom: Mom): string {
  const lines: string[] = [];
  lines.push(`# ${mom.title || "Meeting Minutes"}`);
  lines.push("");
  if (mom.date) lines.push(`**Date:** ${mom.date}`);
  if (mom.participants.length) lines.push(`**Participants:** ${mom.participants.join(", ")}`);
  lines.push("");
  if (mom.agenda.length) {
    lines.push("## Agenda");
    mom.agenda.forEach((a) => lines.push(`- ${a}`));
    lines.push("");
  }
  lines.push("## Discussion");
  lines.push(mom.discussionSummary || "—");
  lines.push("");
  if (mom.decisions.length) {
    lines.push("## Decisions");
    mom.decisions.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
  }
  if (mom.actionItems.length) {
    lines.push("## Action Items");
    mom.actionItems.forEach((a) => lines.push(`- [ ] ${a}`));
    lines.push("");
  }
  if (mom.nextMeeting) {
    lines.push("## Next Meeting");
    lines.push(mom.nextMeeting);
    lines.push("");
  }
  if (mom.notes) {
    lines.push("## Notes");
    lines.push(mom.notes);
  }
  return lines.join("\n").trim() + "\n";
}

/** Trigger a client-side file download. */
export function downloadText(filename: string, content: string, type = "text/markdown") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Print-to-PDF via the browser. We open a styled, self-contained document and
 * call print() — no heavy PDF dependency, and the output respects the user's
 * paper size. Good enough for clean MoM exports.
 */
export function printToPdf(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @page { margin: 24mm 20mm; }
    body { font: 14px/1.65 -apple-system, Inter, system-ui, sans-serif; color: #16181d; }
    h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.02em; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 26px 0 8px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 18px; }
    hr { border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0; }
  </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

export function momToHtml(mom: Mom): string {
  const ul = (items: string[]) =>
    items.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "<p>—</p>";
  return `
    <h1>${escapeHtml(mom.title || "Meeting Minutes")}</h1>
    <div class="meta">${[mom.date, mom.participants.join(", ")].filter((v): v is string => Boolean(v)).map(escapeHtml).join(" · ")}</div>
    ${mom.agenda.length ? `<h2>Agenda</h2>${ul(mom.agenda)}` : ""}
    <h2>Discussion</h2><p>${escapeHtml(mom.discussionSummary)}</p>
    ${mom.decisions.length ? `<h2>Decisions</h2>${ul(mom.decisions)}` : ""}
    ${mom.actionItems.length ? `<h2>Action Items</h2>${ul(mom.actionItems)}` : ""}
    ${mom.nextMeeting ? `<h2>Next Meeting</h2><p>${escapeHtml(mom.nextMeeting)}</p>` : ""}
    ${mom.notes ? `<h2>Notes</h2><p>${escapeHtml(mom.notes)}</p>` : ""}
  `;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
