"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const prefsSchema = z.object({
  priority: z.enum(["tasks", "summaries", "followups", "mom"]).optional(),
  emailTone: z.enum(["professional", "friendly", "concise"]).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
});

export async function updatePreferences(input: z.infer<typeof prefsSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid settings." };

  await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/settings");
  return { ok: true as const };
}
