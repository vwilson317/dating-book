#!/usr/bin/env node
// Creates the three contribution Products and Prices in Stripe and prints their env vars.
// Safe to re-run: each Price has a lookup key, so existing ones are reused.
//
//   npm run stripe:setup                            (test key)
//   STRIPE_ALLOW_LIVE=true npm run stripe:setup     (live key: creates real, chargeable Prices)
//
// Live mode was deliberately enabled on the site owner's instruction on 2026-11-08. See netlify/lib/stripe.ts.
//
// Amounts must match the prices shown on the site (SITE.support.tiers in src/site.config.ts).
import Stripe from 'stripe';

const TIERS = [
  { env: 'STRIPE_PRICE_NAME', lookup: 'contribution_name', cents: 399, product: 'Contribution to promote Read My Book: name in the book' },
  { env: 'STRIPE_PRICE_INSTAGRAM', lookup: 'contribution_instagram', cents: 599, product: 'Contribution to promote Read My Book: name and story on Instagram' },
  { env: 'STRIPE_PRICE_STORY', lookup: 'contribution_story', cents: 2000, product: 'Contribution to promote Read My Book: chance at a later edition' },
];

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set. Add your test key to .env first.');
  process.exit(1);
}
const isLive = /^(sk|rk)_live_/.test(key);
if (!/^(sk|rk)_test_/.test(key) && !(isLive && process.env.STRIPE_ALLOW_LIVE === 'true')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY must be a test key, or a live key with STRIPE_ALLOW_LIVE=true.');
  process.exit(1);
}
if (isLive) console.error('LIVE MODE: these Prices can take real money.');

const stripe = new Stripe(key);
for (const tier of TIERS) {
  const { data } = await stripe.prices.list({ lookup_keys: [tier.lookup], active: true, limit: 1 });
  const price =
    data[0] ??
    (await stripe.prices.create({
      currency: 'usd',
      unit_amount: tier.cents,
      lookup_key: tier.lookup,
      product_data: { name: tier.product },
    }));
  console.log(`${tier.env}=${price.id}`);
}
