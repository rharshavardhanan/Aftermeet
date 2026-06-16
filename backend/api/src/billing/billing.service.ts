import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { stripe, isStripeConfigured, PRO_PRICE_ID } from './stripe';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private async workspace(userId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { workspace: { include: { billing: true } } },
    });
    return m?.workspace ?? null;
  }

  async checkout(userId: string, email?: string) {
    if (!isStripeConfigured()) {
      throw new ServiceUnavailableException('Billing is not configured yet.');
    }
    const ws = await this.workspace(userId);
    if (!ws) throw new BadRequestException('No workspace');

    let customerId = ws.billing?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email,
        metadata: { workspaceId: ws.id, userId },
      });
      customerId = customer.id;
      await this.prisma.billing.update({
        where: { workspaceId: ws.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = process.env.WEB_APP_URL ?? 'http://localhost:4000';
    const checkout = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/billing?status=success`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
      metadata: { workspaceId: ws.id },
      allow_promotion_codes: true,
    });
    return { url: checkout.url };
  }

  async handleWebhook(rawBody: Buffer, sig: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('Webhook not configured');

    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(rawBody, sig, secret);
    } catch {
      throw new BadRequestException('Invalid signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const workspaceId = s.metadata?.workspaceId;
        if (workspaceId && s.subscription) {
          await this.prisma.billing.update({
            where: { workspaceId },
            data: {
              plan: 'PRO',
              stripeSubscriptionId: String(s.subscription),
              meetingsLimit: 1_000_000,
            },
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const billing = await this.prisma.billing.findFirst({
          where: { stripeCustomerId: String(sub.customer) },
        });
        if (billing) {
          const active = sub.status === 'active' || sub.status === 'trialing';
          await this.prisma.billing.update({
            where: { id: billing.id },
            data: {
              plan: active ? 'PRO' : 'FREE',
              stripePriceId: sub.items.data[0]?.price.id,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              meetingsLimit: active ? 1_000_000 : 10,
            },
          });
        }
        break;
      }
    }
    return { received: true };
  }
}
