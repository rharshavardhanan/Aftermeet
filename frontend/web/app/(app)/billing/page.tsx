import type { Metadata } from "next";
import { Check } from "lucide-react";
import { auth, getCurrentWorkspace } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await auth();
  const workspace = await getCurrentWorkspace(session!.user.id);
  const billing = workspace?.billing;
  const plan = billing?.plan ?? "FREE";
  const used = billing?.meetingsUsed ?? 0;
  const limit = billing?.meetingsLimit ?? 10;
  const isPro = plan === "PRO";
  const pct = isPro ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  return (
    <div className="container max-w-4xl space-y-7 py-8">
      <PageHeader title="Billing" description="Your plan, your usage, no surprises." />

      {/* Current plan + usage */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              Current plan <Badge variant={isPro ? "ember" : "muted"}>{plan}</Badge>
            </CardTitle>
            <CardDescription className="mt-1.5">
              {isPro
                ? "Unlimited meetings, every export, priority processing."
                : `${limit} meetings a month, with summaries, tasks, and minutes.`}
            </CardDescription>
          </div>
        </CardHeader>
        {!isPro && (
          <CardContent>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Meetings this period</span>
              <span className="font-mono tnum font-medium">
                {used} / {limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-ios",
                  pct >= 100 ? "bg-destructive" : "bg-ember",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {pct >= 100 ? (
              <p className="mt-2.5 text-xs text-destructive">
                You&apos;ve used every meeting this period. Upgrade to keep going.
              </p>
            ) : (
              <p className="mt-2.5 text-xs text-muted-foreground">
                Resets at the start of your next billing period.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {!isStripeConfigured() && (
        <Card className="border-l-2 border-l-warning/50">
          <CardContent className="py-5 text-sm">
            <span className="font-medium">Checkout isn&apos;t live yet.</span>{" "}
            <span className="text-muted-foreground">
              Add <code className="rounded bg-foreground/[0.06] px-1 font-mono text-xs">STRIPE_SECRET_KEY</code> and a price ID
              to enable upgrades.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid gap-6 sm:grid-cols-2">
        {PLANS.map((p) => {
          const current = p.id === plan;
          return (
            <Card
              key={p.id}
              className={cn(
                "hover-lift relative",
                p.highlighted && "ring-1 ring-ember/40 shadow-glass",
              )}
            >
              {p.highlighted && (
                <Badge variant="ember" className="absolute right-5 top-5">
                  Recommended
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  {p.name}
                  {current && <Badge variant="muted">Current</Badge>}
                </CardTitle>
                <CardDescription>{p.tagline}</CardDescription>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "font-display text-4xl font-semibold tracking-[-0.03em] tnum",
                      p.highlighted && "text-ember",
                    )}
                  >
                    {p.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{p.cadence}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        className={cn("mt-0.5 size-4 shrink-0", p.highlighted ? "text-ember" : "text-success")}
                        strokeWidth={2.25}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.id === "PRO" ? (
                  isPro ? (
                    <Button variant="outline" className="w-full" disabled>
                      You&apos;re on Pro
                    </Button>
                  ) : (
                    <UpgradeButton disabled={!isStripeConfigured()} />
                  )
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    {current ? "Your current plan" : "Included"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
