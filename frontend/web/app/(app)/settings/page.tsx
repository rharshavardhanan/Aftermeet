import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { initials } from "@/lib/utils";

/** iOS-style grouped section: a small uppercase label above a rounded inset card. */
function Group({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h2>
      <div className={`overflow-hidden rounded-2xl border border-border bg-card ${className ?? ""}`}>
        {children}
      </div>
    </section>
  );
}

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  const [user, pref] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { name: true, email: true, image: true },
    }),
    prisma.userPreference.findUnique({ where: { userId: session!.user.id } }),
  ]);

  return (
    <div className="container max-w-2xl space-y-8 py-8">
      <PageHeader title="Settings" description="Manage your account and AI preferences." />

      <Group label="Profile">
        <div className="flex items-center gap-4 p-4">
          <Avatar className="size-14 border border-border">
            {user?.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
            <AvatarFallback className="text-base">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold tracking-tight">{user?.name}</p>
            <p className="truncate text-[15px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-[13px] text-muted-foreground">Synced from your Google account.</p>
        </div>
      </Group>

      <Group label="AI preferences" className="p-4 sm:p-5">
        <PreferencesForm
          initialPriority={pref?.priority ?? null}
          initialTone={pref?.emailTone ?? "professional"}
        />
      </Group>

      <Group label="Account" className="p-4">
        <SignOutButton />
      </Group>
    </div>
  );
}
