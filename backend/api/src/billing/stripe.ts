import Stripe from 'stripe';

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
  return client;
}

export const PRO_PRICE_ID =
  process.env.STRIPE_PRICE_PRO_MONTHLY ??
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ??
  '';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && PRO_PRICE_ID);
}
