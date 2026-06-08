import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    // Pin to the SDK's bundled API version to stay type-compatible.
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY);
}

export const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "";
