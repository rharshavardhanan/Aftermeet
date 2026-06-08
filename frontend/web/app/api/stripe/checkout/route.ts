import { NextResponse } from "next/server";
import { auth, getCurrentWorkspace } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, isStripeConfigured, PRO_PRICE_ID } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000";

/** Creates a Stripe Checkout session for the Pro plan and returns the URL. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const workspace = await getCurrentWorkspace(session.user.id);
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  let customerId = workspace.billing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { workspaceId: workspace.id, userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.billing.update({
      where: { workspaceId: workspace.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkout = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    success_url: `${APP_URL}/billing?status=success`,
    cancel_url: `${APP_URL}/billing?status=cancelled`,
    metadata: { workspaceId: workspace.id },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkout.url });
}
