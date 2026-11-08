// Shared by the Stripe functions in netlify/functions/.
import Stripe from 'stripe';

/** Throws if an env var the functions need is missing. Callers answer with a 500. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

// LIVE MODE IS A DELIBERATE OPT-IN. The site owner explicitly instructed that live mode be enabled
// on 2026-11-08. A live key only works alongside STRIPE_ALLOW_LIVE=true, so real charges always
// need both. Unset that variable to go back to refusing live keys. Live keys, live price IDs and
// the live webhook secret must be set together.
export function stripeClient(): Stripe {
  const key = requireEnv('STRIPE_SECRET_KEY');
  const isTest = /^(sk|rk)_test_/.test(key);
  const liveAllowed = /^(sk|rk)_live_/.test(key) && process.env.STRIPE_ALLOW_LIVE === 'true';
  if (!isTest && !liveAllowed) {
    throw new Error('STRIPE_SECRET_KEY must be a test key, or a live key with STRIPE_ALLOW_LIVE=true');
  }
  return new Stripe(key);
}
