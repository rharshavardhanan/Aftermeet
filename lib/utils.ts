import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
) {
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(date));
}

export function formatRelative(date: Date | string | number) {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Clamp a 0..1 confidence into a label + tone. */
export function confidenceMeta(score: number) {
  if (score >= 0.8) return { label: "High", tone: "success" as const };
  if (score >= 0.5) return { label: "Medium", tone: "warning" as const };
  return { label: "Low", tone: "muted" as const };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 600 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
