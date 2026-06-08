import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, name: true },
  });
  if (user?.onboardingCompleted) redirect("/dashboard");

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-subtle/40 px-4 py-10">
      {/* Textured background so the canvas reads as intentional, not empty. */}
      <div className="bg-grid absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember/[0.07] blur-3xl" />
      <OnboardingWizard firstName={user?.name?.split(" ")[0]} />
    </div>
  );
}
