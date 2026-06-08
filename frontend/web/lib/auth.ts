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
    // On first login: provision a personal workspace, membership, billing, prefs.
    async createUser({ user }) {
      const base = slugify(user.name ?? user.email?.split("@")[0] ?? "workspace");
      const slug = `${base}-${user.id.slice(0, 6)}`;
      await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name: user.name ? `${user.name}'s workspace` : "My workspace",
            slug,
            memberships: { create: { userId: user.id, role: "OWNER" } },
            billing: { create: { plan: "FREE", meetingsLimit: 10 } },
          },
        });
        await tx.userPreference.create({ data: { userId: user.id } });
        await tx.activityLog.create({
          data: { userId: user.id, action: "workspace.created", meta: { workspaceId: workspace.id } },
        });
      });
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

/** Returns the signed-in user's first workspace (personal). */
export async function getCurrentWorkspace(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { workspace: { include: { billing: true } } },
  });
  return membership?.workspace ?? null;
}
