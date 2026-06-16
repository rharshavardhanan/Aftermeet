import { Mom } from '../ai/schema';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render Meeting Minutes to HTML for the Google Doc conversion. */
export function momToHtml(mom: Mom): string {
  const ul = (items: string[]) =>
    items.length
      ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
      : '<p>—</p>';
  return `
    <h1>${escapeHtml(mom.title || 'Meeting Minutes')}</h1>
    <div class="meta">${[mom.date, mom.participants.join(', ')]
      .filter((v): v is string => Boolean(v))
      .map(escapeHtml)
      .join(' · ')}</div>
    ${mom.agenda.length ? `<h2>Agenda</h2>${ul(mom.agenda)}` : ''}
    <h2>Discussion</h2><p>${escapeHtml(mom.discussionSummary)}</p>
    ${mom.decisions.length ? `<h2>Decisions</h2>${ul(mom.decisions)}` : ''}
    ${mom.actionItems.length ? `<h2>Action Items</h2>${ul(mom.actionItems)}` : ''}
    ${mom.nextMeeting ? `<h2>Next Meeting</h2><p>${escapeHtml(mom.nextMeeting)}</p>` : ''}
    ${mom.notes ? `<h2>Notes</h2><p>${escapeHtml(mom.notes)}</p>` : ''}
  `;
}
