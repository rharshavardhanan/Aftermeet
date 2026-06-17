import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Chrome,
  ListChecks,
  Mail,
  Mic,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Upload,
  Check,
} from "lucide-react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ProductMockup } from "@/components/marketing/product-mockup";
import { Reveal } from "@/components/marketing/reveal";
import { HeroCanvas } from "@/components/marketing/hero-canvas";
import { Parallax } from "@/components/marketing/parallax";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const features = [
  { icon: ListChecks, title: "Action items, not notes", body: "Every commitment becomes a task with an owner, a due date, and the exact quote it came from." },
  { icon: ScrollText, title: "Minutes in seconds", body: "Professional meeting minutes, agenda to next steps, formatted and ready to send." },
  { icon: Mail, title: "Follow-ups that write themselves", body: "A warm, accurate recap email drafted from what was actually decided. Edit and send." },
  { icon: Mic, title: "Speaker-aware transcripts", body: "Automatic speaker separation with timestamps. Rename Speaker 1 to a real name once." },
  { icon: ShieldCheck, title: "Honest about uncertainty", body: "Confidence scores on every item. The engine flags what it is unsure of instead of guessing." },
  { icon: Sparkles, title: "Embedded, never a chatbot", body: "Intelligence woven into the workflow. No prompt box, no chat, just structured output." },
];

const steps = [
  { n: "01", title: "Bring the meeting", body: "Paste notes, upload a transcript, record live, or capture a call with the extension." },
  { n: "02", title: "It structures the record", body: "Summary, decisions, action items, risks, deadlines, and minutes, extracted and validated." },
  { n: "03", title: "Execute", body: "Assign, edit, export to PDF or Markdown, send the follow-up. Nothing falls through." },
];

const faqs = [
  ["Is this just ChatGPT with a wrapper?", "No. There is no chat box. Aftermeet is a structured workspace: transcripts go in, validated tasks, decisions, and minutes come out, every item grounded in a source quote with a confidence score."],
  ["How does the Chrome extension work?", "Once installed, it detects Zoom and Google Meet tabs and offers a floating panel. Start AI Notes to capture tab audio, transcribe live, and watch tasks appear as the meeting happens."],
  ["What about my privacy?", "Transcripts are stored sanitized and scoped to your workspace. You can delete any meeting permanently at any time. We never train on your data."],
  ["Can I export the minutes?", "Yes. Copy formatted text, download Markdown, or print a clean PDF. Follow-up emails are email-ready out of the box."],
  ["Do I need a credit card to start?", "No. The free plan covers 10 meetings a month with no card required. Upgrade to Pro only when you need unlimited meetings and the extension."],
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <SiteNav />

      {/* ── Hero — asymmetric, masthead-style ─────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container pt-32 pb-20 lg:pt-40">
          {/* Apple-style bento hero */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {/* Hero tile — ambient three.js visual behind the headline */}
            <div className="liquid-glass relative flex flex-col justify-between overflow-hidden rounded-3xl p-8 sm:col-span-2 sm:p-10 lg:col-span-4 lg:row-span-2 lg:min-h-[440px]">
              <HeroCanvas className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(80%_80%_at_72%_42%,#000_38%,transparent_100%)]" />
              <div className="relative z-10">
                <div className="mb-6 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="inline-block h-px w-8 bg-ember" />
                  The record of every decision
                </div>
                <h1 className="font-display text-[clamp(2.6rem,6vw,4.8rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-balance">
                  Turn meetings into <span className="hl">execution</span>.
                </h1>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground text-pretty">
                  Aftermeet reads your transcripts and hands back what matters — action items,
                  decisions, and minutes — so nothing slips between the call and the work.
                </p>
              </div>
              <div className="relative z-10 mt-9">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/login">Start free <ArrowRight className="size-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/extension"><Chrome className="size-4" /> Install extension</Link>
                  </Button>
                </div>
                <p className="mt-4 font-mono text-xs text-muted-foreground">
                  No credit card · 10 free meetings / month
                </p>
              </div>
            </div>

            {/* What lands in your workspace */}
            <div className="liquid-glass rounded-3xl p-6 lg:col-span-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                What lands in your workspace
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  ["Summary", "Outcomes over chronology"],
                  ["Action items", "Owner · due · source quote"],
                  ["Decisions", "Committed, not discussed"],
                  ["Minutes", "Formatted, ready to send"],
                ].map(([h, d]) => (
                  <li
                    key={h}
                    className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="shrink-0 text-sm font-medium">{h}</span>
                    <span className="min-w-0 text-right text-xs text-muted-foreground">{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Live, in-call preview */}
            <div className="liquid-glass rounded-3xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="size-2 animate-pulse-ember rounded-full bg-ember motion-reduce:animate-none" />
                  Live
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">12:04</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/85">
                &ldquo;Sarah will send the revised deck by Friday.&rdquo;
              </p>
              <div className="glass-pill mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                <ListChecks className="size-3.5 shrink-0 text-ember" /> Send revised deck
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">Sarah · Fri</span>
              </div>
            </div>

            {/* Metric strip */}
            {[
              ["45", "languages, incl. Tamil"],
              ["Seconds", "to formatted minutes"],
              ["1 click", "live notes inside the call"],
            ].map(([k, v]) => (
              <div key={v} className="liquid-glass rounded-3xl px-6 py-5 sm:col-span-2 lg:col-span-2">
                <p className="font-display text-2xl font-semibold tracking-tight text-ember">{k}</p>
                <p className="mt-1 text-sm text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>

          <Reveal delay={120} className="mt-16">
            <Parallax speed={0.1}>
              <ProductMockup />
            </Parallax>
          </Reveal>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-24 py-24 lg:py-32">
        <div className="container">
          <Reveal className="max-w-2xl">
            <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-px w-8 bg-ember" /> What it does
            </p>
            <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
              A workspace, not a transcript dump.
            </h2>
            <p className="mt-5 max-w-xl text-muted-foreground text-pretty">
              Most tools hand you a wall of text and call it done. Aftermeet does the reading, the
              deciding, and the writing up — the way a great chief of staff would.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <article className="liquid-glass hover-lift group relative h-full overflow-hidden rounded-2xl p-6">
                  {/* faint ember wash on hover */}
                  <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-ember/0 blur-2xl transition-colors duration-500 group-hover:bg-ember/12" />
                  <div className="glass-pill flex size-11 items-center justify-center rounded-xl text-ember/70 transition-colors duration-300 ease-ios group-hover:text-ember">
                    <f.icon className="size-[22px]" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-display text-[17px] font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120} className="mt-10">
            <Link
              href="/login"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              See it on your next meeting
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Extension ─────────────────────────────────────────────── */}
      <section id="extension" className="scroll-mt-24 py-24 lg:py-32">
        <div className="liquid-glass container grid items-center gap-14 rounded-3xl px-6 py-14 sm:px-10 lg:grid-cols-2 lg:py-16">
          <Reveal>
            <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-px w-8 bg-ember" /> Chrome extension
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
              Live notes, right inside the call.
            </h2>
            <p className="mt-5 max-w-md text-muted-foreground text-pretty">
              A quiet floating panel appears on Zoom and Google Meet. Hit{" "}
              <span className="font-medium text-foreground">Start AI Notes</span> and the transcript,
              speakers, and tasks build themselves while you stay in the conversation.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Detects Zoom & Google Meet automatically",
                "Captures tab audio with one click",
                "Live transcript with speaker labels",
                "Tasks and minutes ready the moment it ends",
              ].map((i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 text-success" strokeWidth={2.25} /> {i}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-9">
              <Link href="/extension">
                <Chrome className="size-4" /> Get the extension
              </Link>
            </Button>
          </Reveal>

          {/* extension panel mock (dark, warm) */}
          <Reveal delay={120} className="relative">
            <div className="ml-auto w-full max-w-sm rounded-2xl border border-[oklch(0.3_0.008_75)] bg-[oklch(0.205_0.009_75)] p-4 text-[oklch(0.92_0.005_85)] shadow-float">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 animate-pulse-ember rounded-full bg-ember motion-reduce:animate-none" />
                  <span className="font-mono text-xs tabular-nums">REC · 12:04</span>
                </div>
                <span className="text-xs text-white/60">Google Meet</span>
              </div>
              <div className="mt-3 space-y-2 rounded-lg bg-white/[0.04] p-3 text-[12px] leading-relaxed">
                <p><span className="font-medium">Sarah:</span> I&apos;ll send the revised deck by Friday.</p>
                <p className="text-white/55"><span className="font-medium text-white/75">Marco:</span> Great, I&apos;ll review over the weekend.</p>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Live tasks</p>
                <div className="space-y-1.5">
                  <PanelTask label="Send revised deck" meta="Sarah · Fri" />
                  <PanelTask label="Review deck" meta="Marco" />
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-ember/8 blur-2xl" />
          </Reveal>
        </div>
      </section>

      {/* ── Workflow ──────────────────────────────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="container">
          <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="inline-block h-px w-8 bg-ember" /> How it works
          </p>
          <h2 className="max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
            Three steps. Zero busywork.
          </h2>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="liquid-glass hover-lift group h-full rounded-2xl p-8">
                  <span className="font-mono text-sm tabular-nums text-ember transition-transform duration-300 ease-ios group-hover:translate-x-0.5">
                    {s.n}
                  </span>
                  <h3 className="mt-6 font-display text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-24 py-24 lg:py-32">
        <div className="container">
          <div className="max-w-2xl">
            <p className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-px w-8 bg-ember" /> Pricing
            </p>
            <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
              Simple, honest pricing.
            </h2>
            <p className="mt-4 text-muted-foreground">Start free. Upgrade when meetings run your day.</p>
          </div>
          <div className="mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
            {PLANS.map((plan, i) => (
              <Reveal
                key={plan.id}
                delay={i * 90}
                className={cn(
                  "liquid-glass hover-lift relative rounded-2xl p-8",
                  plan.highlighted && "ring-1 ring-ember/40",
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute right-8 top-8" variant="ember">Most popular</Badge>
                )}
                <h3 className="font-display text-[17px] font-semibold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-semibold tracking-[-0.03em] tnum">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                </div>
                <Button
                  asChild
                  className="mt-7 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link href="/login">{plan.cta}</Link>
                </Button>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="size-4 text-success" strokeWidth={2.25} /> {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-24 border-t border-border py-24 lg:py-32">
        <div className="container grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-5xl">
              Questions, answered.
            </h2>
          </div>
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="border-t border-border">
              {faqs.map(([q, a]) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-[15px]">{q}</AccordionTrigger>
                  <AccordionContent className="max-w-2xl leading-relaxed text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="pb-24">
        <div className="container">
          <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-foreground px-8 py-20 text-center text-background shadow-float">
            {/* ember halo — the one signature flourish */}
            <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-ember/20 blur-3xl" />
            <p className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-background/55">
              The record, sealed
            </p>
            <h2 className="relative mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
              Your next meeting could run itself.
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-background/80 text-pretty">
              Bring one transcript. See your tasks, decisions, and minutes in seconds.
            </p>
            <Button asChild size="lg" variant="secondary" className="relative mt-9">
              <Link href="/login">
                Start free <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function PanelTask({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-2 text-[12px]">
      <span className="size-3.5 shrink-0 rounded-full border border-white/25" />
      <span className="flex-1">{label}</span>
      <span className="text-white/60">{meta}</span>
    </div>
  );
}
