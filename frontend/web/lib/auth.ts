import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 32) || "workspace"
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          // drive.file = only files this app creates (narrow, no Google
          // verification needed). Powers "Export Minutes to Google Docs".
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.file",
        },
      },
    }),
  ],
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const pref = await prisma.userPreference.findUnique({
          where: { userId: user.id },
          select: { useCase: true },
        });
        // Surface onboarding status for client-side gating.
        (session.user as { onboardingCompleted?: boolean }).onboardingCompleted =
          (user as { onboardingCompleted?: boolean }).onboardingCompleted ?? !!pref?.useCase;
      }
      return session;
    },
  },
  events: {
    // Provision eagerly on first login, but never let it block sign-in: a throw
    // here fails the OAuth callback and bounces the user back to /login with no
    // way to recover, on every subsequent attempt too. getCurrentWorkspace
    // provisions lazily, so a failure costs one slow first page load.
    async createUser({ user }) {
      try {
        await provisionWorkspace(user.id, user.name ?? null, user.email ?? null);
      } catch (err) {
        console.error("workspace provisioning failed; will retry on first use", err);
      }
    },
  },
};

async function provisionWorkspace(
  userId: string,
  name: string | null,
  email: string | null,
) {
  const base = slugify(name ?? email?.split("@")[0] ?? "workspace");
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: name ? `${name}'s workspace` : "My workspace",
        // The id suffix keeps the slug unique per user without a lookup.
        slug: `${base}-${userId.slice(0, 6)}`,
        memberships: { create: { userId, role: "OWNER" } },
        billing: { create: { plan: "FREE", meetingsLimit: 10 } },
      },
    });
    await tx.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    await tx.activityLog.create({
      data: {
        userId,
        action: "workspace.created",
        meta: { workspaceId: workspace.id },
      },
    });
    return workspace;
  });
}

export function auth() {
  return getServerSession(authOptions);
}

/**
 * The signed-in user's personal workspace, provisioning it if the first-login
 * event did not manage to. Returns null only when provisioning itself fails,
 * which callers already handle.
 */
export async function getCurrentWorkspace(userId: string) {
  const find = () =>
    prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { workspace: { include: { billing: true } } },
    });

  const existing = await find();
  if (existing) return existing.workspace;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return null;

  try {
    await provisionWorkspace(userId, user.name, user.email);
  } catch (err) {
    // Most likely a concurrent request won the race; re-read before giving up.
    console.error("lazy workspace provisioning failed", err);
  }
  return (await find())?.workspace ?? null;
}
