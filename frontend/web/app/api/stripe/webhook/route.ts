import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** Stripe webhook — keeps Billing in sync with subscription lifecycle. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("webhook signature failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const workspaceId = s.metadata?.workspaceId;
        if (workspaceId && s.subscription) {
          await prisma.billing.update({
            where: { workspaceId },
            data: {
              plan: "PRO",
              stripeSubscriptionId: String(s.subscription),
              meetingsLimit: 1_000_000,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const billing = await prisma.billing.findFirst({
          where: { stripeCustomerId: String(sub.customer) },
        });
        if (billing) {
          const active = sub.status === "active" || sub.status === "trialing";
          await prisma.billing.update({
            where: { id: billing.id },
            data: {
              plan: active ? "PRO" : "FREE",
              stripePriceId: sub.items.data[0]?.price.id,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              meetingsLimit: active ? 1_000_000 : 10,
            },
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error("webhook handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
