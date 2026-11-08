// POST /api/checkout: the contribute buttons (src/components/Tiers.astro) submit here. Creates a
// Stripe Checkout Session for the chosen tier and sends the reader to it.
import type Stripe from 'stripe';
import { buy } from '../../src/i18n/buy';
import { requireEnv, stripeClient } from '../lib/stripe';

export const config = { path: '/api/checkout' };

const PRICE_ENV = {
  name: 'STRIPE_PRICE_NAME',
  instagram: 'STRIPE_PRICE_INSTAGRAM',
  story: 'STRIPE_PRICE_STORY',
} as const;
type Tier = keyof typeof PRICE_ENV;
type Lang = keyof typeof buy;

const isTier = (v: unknown): v is Tier => typeof v === 'string' && Object.hasOwn(PRICE_ENV, v);
const isLang = (v: unknown): v is Lang => typeof v === 'string' && Object.hasOwn(buy, v);

// The URL comes from configuration, not the request's Host header, so a forged request can't send
// a buyer somewhere else after paying. `netlify dev` is the exception: it only runs on this machine.
function siteOrigin(req: Request, context: { site?: { url?: string } }): string {
  if (process.env.NETLIFY_DEV === 'true') return new URL(req.url).origin;
  const site = process.env.SITE_URL || context.site?.url;
  if (!site) throw new Error('Missing SITE_URL');
  return new URL(site).origin;
}

/** Same fields as the old Payment Links: name on every tier, contact details on the higher ones. */
function customFields(tier: Tier, lang: Lang): Stripe.Checkout.SessionCreateParams.CustomField[] {
  const text = buy[lang].checkout;
  const name: Stripe.Checkout.SessionCreateParams.CustomField = {
    key: 'acknowledgment_name',
    label: { type: 'custom', custom: text.nameLabel },
    type: 'text',
    optional: true,
  };
  if (tier === 'name') return [name];
  return [
    name,
    {
      key: 'contact_method',
      label: { type: 'custom', custom: text.contactMethodLabel },
      type: 'dropdown',
      dropdown: {
        options: [
          { label: 'WhatsApp', value: 'whatsapp' },
          { label: 'Instagram', value: 'instagram' },
          { label: 'Email', value: 'email' },
        ],
      },
    },
    { key: 'contact_handle', label: { type: 'custom', custom: text.contactHandleLabel }, type: 'text' },
  ];
}

export default async (req: Request, context: { site?: { url?: string } }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });

  const form = await req.formData().catch(() => null);
  const tier = form?.get('tier');
  const lang = form?.get('lang');
  if (!isTier(tier) || !isLang(lang)) return new Response('Invalid tier or language', { status: 400 });

  // Ad attribution, built in src/scripts/support.ts. Optional, and never worth failing a payment over.
  const rawRef = form?.get('ref');
  const ref = typeof rawRef === 'string' && /^[\w-]{1,200}$/.test(rawRef) ? rawRef : undefined;

  let buyUrl = '/buy/';
  try {
    const prefix = lang === 'en' ? '' : `/${lang}`;
    const origin = siteOrigin(req, context);
    buyUrl = `${origin}${prefix}/buy/`;

    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: requireEnv(PRICE_ENV[tier]), quantity: 1 }],
      custom_fields: customFields(tier, lang),
      client_reference_id: ref,
      locale: lang === 'pt' ? 'pt-BR' : 'en',
      metadata: { tier, lang },
      success_url: `${origin}${prefix}/thanks/?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${buyUrl}?checkout=canceled`,
    });
    if (!session.url) throw new Error(`Checkout session ${session.id} has no URL`);
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error('checkout failed:', err instanceof Error ? err.message : err);
    return new Response(null, { status: 303, headers: { Location: `${buyUrl}?checkout=error` } });
  }
};
