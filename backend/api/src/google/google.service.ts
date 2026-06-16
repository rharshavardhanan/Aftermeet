import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Mom } from '../ai/schema';
import { momToHtml } from './mom-html';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

type TokenResult =
  | { token: string }
  | { error: 'no-account' | 'no-scope' | 'refresh-failed' };

type CreateResult = { url: string } | { error: string; status: number };

@Injectable()
export class GoogleService {
  constructor(private readonly prisma: PrismaService) {}

  // Reads the user's Google access token from their NextAuth Account row,
  // refreshing via the stored refresh_token when expired. (Ported from monolith.)
  async getAccessToken(userId: string): Promise<TokenResult> {
    const account = await this.prisma.account.findFirst({
      where: { userId, provider: 'google' },
    });
    if (!account?.access_token) return { error: 'no-account' };
    if (!account.scope?.includes(DRIVE_SCOPE)) return { error: 'no-scope' };

    const now = Math.floor(Date.now() / 1000);
    if (account.expires_at && account.expires_at - 60 > now) {
      return { token: account.access_token };
    }
    if (!account.refresh_token) {
      return { token: account.access_token };
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
      }),
    });
    if (!res.ok) return { error: 'refresh-failed' };
    const data = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      scope?: string;
    };
    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: data.access_token,
        expires_at: now + (data.expires_in ?? 3600),
        scope: data.scope ?? account.scope,
      },
    });
    return { token: data.access_token };
  }

  private async createDocFromHtml(
    token: string,
    name: string,
    html: string,
  ): Promise<CreateResult> {
    const boundary = `m2t_${Math.random().toString(36).slice(2)}`;
    const metadata = { name, mimeType: 'application/vnd.google-apps.document' };
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
      `${html}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) return { error: await res.text(), status: res.status };
    const data = (await res.json()) as { id: string; webViewLink?: string };
    return {
      url: data.webViewLink ?? `https://docs.google.com/document/d/${data.id}/edit`,
    };
  }

  async exportDoc(userId: string, meetingId: string): Promise<{ url: string }> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      include: { aiOutput: true },
    });
    if (!meeting?.aiOutput?.mom) {
      throw new NotFoundException('No minutes found for this meeting.');
    }

    const tok = await this.getAccessToken(userId);
    if ('error' in tok) {
      throw new ForbiddenException(
        tok.error === 'no-scope'
          ? 'Reconnect Google to allow Docs export — sign out and sign back in.'
          : 'Could not access your Google account. Try signing in again.',
      );
    }

    const mom = meeting.aiOutput.mom as unknown as Mom;
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${momToHtml(mom)}</body></html>`;
    const title = `${mom.title || meeting.title || 'Meeting Minutes'} — Minutes`;

    const result = await this.createDocFromHtml(tok.token, title, html);
    if ('error' in result) {
      const reconnect = result.status === 401 || result.status === 403;
      throw new HttpException(
        reconnect
          ? 'Google rejected the request — reconnect your account (sign out and back in).'
          : 'Export failed. Make sure the Google Drive API is enabled in your Google Cloud project.',
        reconnect ? 403 : 502,
      );
    }

    await this.prisma.activityLog
      .create({ data: { userId, action: 'mom.export.gdoc', meta: { meetingId } } })
      .catch(() => {});

    return { url: result.url };
  }
}
