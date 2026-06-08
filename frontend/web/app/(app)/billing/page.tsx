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
    <div className="container max-w-4xl space-y-6 py-8">
      <PageHeader title="Billing" description="Manage your plan and usage." />

      {/* Current plan + usage */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Current plan <Badge variant={isPro ? "success" : "muted"}>{plan}</Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {isPro ? "Unlimited meetings included." : "Free plan — limited meetings each month."}
            </CardDescription>
          </div>
        </CardHeader>
        {!isPro && (
          <CardContent>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meetings this period</span>
              <span className="font-medium">
                {used} / {limit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-destructive" : "bg-foreground")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {!isStripeConfigured() && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          Billing keys aren't set. Add <code className="rounded bg-muted px-1 font-mono text-xs">STRIPE_SECRET_KEY</code>{" "}
          and a price ID to enable checkout.
        </div>
      )}

      {/* Plans */}
      <div className="grid gap-6 sm:grid-cols-2">
        {PLANS.map((p) => {
          const current = p.id === plan;
          return (
            <Card key={p.id} className={cn(p.highlighted && "border-foreground")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {current && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>{p.tagline}</CardDescription>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.cadence}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="size-4 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                {p.id === "PRO" ? (
                  isPro ? (
                    <Button variant="outline" className="w-full" disabled>
                      You're on Pro
                    </Button>
                  ) : (
                    <UpgradeButton disabled={!isStripeConfigured()} />
                  )
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    {current ? "Current plan" : "Included"}
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
