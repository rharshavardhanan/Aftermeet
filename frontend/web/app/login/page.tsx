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
    <div className="relative flex min-h-dvh flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
          Sign in
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center py-10">
        <div className="liquid-glass animate-rise w-full max-w-md rounded-3xl p-8 sm:p-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            The record of every decision
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-[34px]">
            Welcome back
          </h1>
          <p className="mt-2.5 text-pretty text-sm text-muted-foreground">
            Sign in to turn your meetings into{" "}
            <span className="hl">execution</span> — tasks, decisions, and minutes,
            handled.
          </p>

          <div className="mt-8">
            <GoogleSignIn />
          </div>

          <figure className="mt-9 border-t border-border/70 pt-6">
            <blockquote className="font-display text-[17px] font-medium leading-[1.4] tracking-[-0.01em] text-balance">
              “I stopped taking notes in meetings. The work just shows up afterward,
              already organized.”
            </blockquote>
            <figcaption className="mt-3 text-xs text-muted-foreground">
              Priya Nair · Head of Operations, Lumen
            </figcaption>
          </figure>

          <p className="mt-8 text-pretty text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="#" className="text-foreground underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>© {new Date().getFullYear()} Aftermeet</span>
        <span className="hidden gap-5 sm:flex">
          <span>Summaries</span>
          <span>Action items</span>
          <span>Minutes</span>
        </span>
      </footer>
    </div>
  );
}
