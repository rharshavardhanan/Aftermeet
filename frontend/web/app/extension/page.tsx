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
    body: "Open Zoom or Google Meet. A quiet floating panel appears — hit Start AI Notes and you're capturing.",
  },
];

export default function ExtensionPage() {
  return (
    <div className="min-h-dvh">
      <header className="container flex items-center justify-between py-5">
        <Link href="/"><Logo /></Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard"><ArrowLeft className="size-4" /> Back to app</Link>
        </Button>
      </header>

      <section className="container max-w-3xl py-12 text-center">
        <Badge variant="outline" className="mb-5 rounded-full">
          <Chrome className="size-3.5" /> Manifest V3 · Chrome
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          Live AI notes, inside every call.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
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

      <section id="install" className="container max-w-4xl pb-12 scroll-mt-20">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Card key={s.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-subtle">
                    <s.icon className="size-[18px]" />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container max-w-3xl pb-24">
        <Card>
          <CardContent className="p-7">
            <h2 className="text-lg font-semibold tracking-tight">What it captures</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Tab audio from Zoom & Google Meet",
                "Optional microphone capture",
                "Live transcript with speaker labels",
                "Progressive task extraction",
                "Final Meeting Minutes on end",
                "Secure sync to your workspace",
              ].map((i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 text-success" /> {i}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
