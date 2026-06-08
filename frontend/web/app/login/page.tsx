import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { GoogleSignIn } from "./google-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* form */}
      <div className="flex flex-col px-6 py-8">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Welcome back</h1>
            <p className="mt-2.5 text-sm text-muted-foreground">
              Sign in to turn your meetings into execution.
            </p>
            <div className="mt-8">
              <GoogleSignIn />
            </div>
            <p className="mt-6 text-pretty text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link href="#" className="underline underline-offset-2">Terms</Link> and{" "}
              <Link href="#" className="underline underline-offset-2">Privacy Policy</Link>.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Aftermeet</p>
      </div>

      {/* aside */}
      <div className="relative hidden overflow-hidden border-l border-border bg-subtle/50 lg:block">
        <div className="bg-grid absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            The record of every decision
          </span>
          <figure className="max-w-md">
            <blockquote className="font-display text-[28px] font-medium leading-[1.18] tracking-[-0.015em] text-balance">
              “I stopped taking notes in meetings. The work just shows up afterward, already
              <span className="hl"> organized</span>.”
            </blockquote>
            <figcaption className="mt-7 text-sm text-muted-foreground">
              Priya Nair · Head of Operations, Lumen
            </figcaption>
          </figure>
          <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>Summaries</span>
            <span>Action items</span>
            <span>Minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
