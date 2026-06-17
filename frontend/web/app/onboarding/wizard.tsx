"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/app/actions/onboarding";
import type { OnboardingInput } from "@/lib/validations";

const STEPS = [
  {
    key: "useCase" as const,
    title: "What do you use meetings for?",
    subtitle: "We'll tune the AI to your world.",
    multi: false,
    options: [
      ["freelance", "Freelance"],
      ["agency", "Agency"],
      ["startup", "Startup"],
      ["student", "Student"],
      ["sales", "Sales"],
      ["consulting", "Consulting"],
    ],
  },
  {
    key: "platforms" as const,
    title: "How do you meet?",
    subtitle: "Pick all that apply.",
    multi: true,
    options: [
      ["zoom", "Zoom"],
      ["meet", "Google Meet"],
      ["teams", "Microsoft Teams"],
      ["offline", "Offline notes"],
    ],
  },
  {
    key: "priority" as const,
    title: "What should AI prioritize?",
    subtitle: "You can change this anytime.",
    multi: false,
    options: [
      ["tasks", "Action items"],
      ["summaries", "Summaries"],
      ["followups", "Follow-up emails"],
      ["mom", "Meeting minutes"],
    ],
  },
];

export function OnboardingWizard({ firstName }: { firstName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<{
    useCase?: string;
    platforms: string[];
    priority?: string;
  }>({ platforms: [] });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function selected(value: string) {
    if (current.multi) return data.platforms.includes(value);
    return data[current.key as "useCase" | "priority"] === value;
  }

  function choose(value: string) {
    setData((d) => {
      if (current.multi) {
        const has = d.platforms.includes(value);
        return { ...d, platforms: has ? d.platforms.filter((p) => p !== value) : [...d.platforms, value] };
      }
      return { ...d, [current.key]: value };
    });
  }

  const canAdvance = current.multi
    ? data.platforms.length > 0
    : Boolean(data[current.key as "useCase" | "priority"]);

  function next() {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    startTransition(async () => {
      const res = await completeOnboarding(data as OnboardingInput);
      if (res.ok) {
        toast.success("You're all set.");
        router.replace("/dashboard");
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Card className="animate-rise w-full max-w-xl rounded-3xl p-7 sm:p-9">
      <div className="flex items-center justify-between">
        <span className="glass-pill inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3">
          <LogoMark className="size-5" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </span>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "ease-ios h-1.5 rounded-full transition-all duration-500",
                i === step ? "w-7 bg-ember" : i < step ? "w-1.5 bg-ember/50" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-8">
        {step === 0 && firstName && (
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ember">
            Welcome, {firstName}
          </p>
        )}
        <h1 className="font-display text-[26px] font-semibold leading-[1.12] tracking-[-0.02em] text-balance">
          {current.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{current.subtitle}</p>

        <div className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {current.options.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={selected(value)}
              onClick={() => choose(value)}
              className={cn(
                "ease-ios flex items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-300 active:scale-[0.98]",
                selected(value)
                  ? "glass-pill border-ember/60 font-medium text-foreground"
                  : "hover-lift border-border hover:border-foreground/25 hover:bg-accent/60",
              )}
            >
              {label}
              {selected(value) && (
                <Check className="size-4 shrink-0 text-ember" strokeWidth={2.5} />
              )}
            </button>
          ))}
        </div>
        {current.multi && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {data.platforms.length} selected
          </p>
        )}
      </div>

      <div className="mt-9 flex items-center justify-between border-t border-border/70 pt-6">
        <Button
          variant="ghost"
          size="sm"
          disabled={step === 0 || pending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button
          size="sm"
          disabled={!canAdvance || pending}
          onClick={next}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isLast ? (pending ? "Setting up…" : "Finish setup") : "Continue"}
          {!isLast && !pending && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </Card>
  );
}
