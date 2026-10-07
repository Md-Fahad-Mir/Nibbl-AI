import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Publishable key for the Stripe account the backend is configured with.
// Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local (pk_test_… / pk_live_…).
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = (): Promise<Stripe | null> => {
  if (!publishableKey) {
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export const stripeConfigured = Boolean(publishableKey);
