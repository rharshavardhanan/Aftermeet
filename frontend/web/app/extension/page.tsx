import type { Metadata } from "next";
import Link from "next/link";
import { Chrome, Download, Puzzle, MousePointerClick, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Chrome Extension" };

const steps = [
  {
    icon: Download,
    title: "Download the extension",
    body: "Grab the latest build, or load the unpacked /extension folder from the repo during development.",
  },
  {
    icon: Puzzle,
    title: "Load it in Chrome",
    body: "Go to chrome://extensions, enable Developer mode, choose Load unpacked, and select the extension folder.",
  },
  {
    icon: MousePointerClick,
    title: "Join a meeting",
    body: "Open Zoom or Google Meet. A quiet floating panel appears — hit Start AI Notes and it begins transcribing.",
  },
];

export default function ExtensionPage() {
  return (
    <div className="min-h-dvh">
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
        <header className="liquid-glass flex h-14 w-full max-w-3xl items-center justify-between rounded-full px-2 py-2 pl-4">
          <Link href="/"><Logo /></Link>
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href="/dashboard"><ArrowLeft className="size-4" /> Back to app</Link>
          </Button>
        </header>
      </div>

      <section className="container max-w-3xl pb-12 pt-32 text-center">
        <Badge variant="ember" className="mb-5 rounded-full">
          <Chrome className="size-3.5" /> Manifest V3 · Chrome
        </Badge>
        <h1 className="font-display text-balance text-[clamp(2.4rem,6vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
          Live AI notes, inside every <span className="hl">call</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground text-pretty">
          The Aftermeet extension detects Zoom and Google Meet, captures the audio, transcribes
          live, and builds your tasks and minutes while you stay in the conversation.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="#install">
              <Chrome className="size-4" /> Get the extension
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#install">
              <Download className="size-4" /> Load unpacked
            </Link>
          </Button>
        </div>
      </section>

      <section id="install" className="container max-w-4xl scroll-mt-24 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title} className="hover-lift">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="glass-pill flex size-9 items-center justify-center rounded-lg text-ember">
                    <s.icon className="size-[18px]" strokeWidth={1.75} />
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-[16px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container max-w-3xl pb-24">
        <Card>
          <CardContent className="p-7">
            <p className="mb-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-px w-8 bg-ember" /> Inside the panel
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">What it captures</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "Tab audio from Zoom & Google Meet",
                "Optional microphone capture",
                "Live transcript with speaker labels",
                "Progressive task extraction",
                "Final meeting minutes on end",
                "Secure sync to your workspace",
              ].map((i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 shrink-0 text-success" strokeWidth={2.25} /> {i}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
