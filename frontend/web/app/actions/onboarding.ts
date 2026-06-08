"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations";

export async function completeOnboarding(input: OnboardingInput) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please complete all steps." };

  await prisma.$transaction([
    prisma.userPreference.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...parsed.data },
      update: parsed.data,
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingCompleted: true },
    }),
  ]);

  revalidatePath("/dashboard");
  return { ok: true as const };
}
