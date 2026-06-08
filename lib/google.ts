import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Google Drive / Docs integration for exporting Meeting Minutes.
 *
 * We use the user's own Google account (the same one they log in with) via the
 * narrow `drive.file` scope — the app can only touch files it creates, so there
 * is no broad-Drive access and no Google verification requirement.
 *
 * Access tokens last ~1h; we refresh with the stored refresh_token when needed
 * and persist the new token back to the Account row.
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type TokenResult = { token: string } | { error: "no-account" | "no-scope" | "refresh-failed" };

export async function getGoogleAccessToken(userId: string): Promise<TokenResult> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) return { error: "no-account" };
  if (!account.scope?.includes(DRIVE_SCOPE)) return { error: "no-scope" };

  const now = Math.floor(Date.now() / 1000);
  // Token still valid for >60s → use it.
  if (account.expires_at && account.expires_at - 60 > now) {
    return { token: account.access_token };
  }
  // Expired (or unknown expiry) → refresh if we can.
  if (!account.refresh_token) {
    return { token: account.access_token }; // best effort; may 401 → caller handles
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  if (!res.ok) return { error: "refresh-failed" };
  const data = (await res.json()) as { access_token: string; expires_in?: number; scope?: string };
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: now + (data.expires_in ?? 3600),
      scope: data.scope ?? account.scope,
    },
  });
  return { token: data.access_token };
}

type CreateResult = { url: string } | { error: string; status: number };

/**
 * Create a native Google Doc from HTML. Drive converts the uploaded HTML into a
 * real, formatted Google Doc (headings, bullet lists) when the target mimeType
 * is application/vnd.google-apps.document.
 */
export async function createGoogleDocFromHtml(
  token: string,
  name: string,
  html: string,
): Promise<CreateResult> {
  const boundary = `m2t_${Math.random().toString(36).slice(2)}`;
  const metadata = { name, mimeType: "application/vnd.google-apps.document" };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    `${html}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    return { error: await res.text(), status: res.status };
  }
  const data = (await res.json()) as { id: string; webViewLink?: string };
  return { url: data.webViewLink ?? `https://docs.google.com/document/d/${data.id}/edit` };
}
