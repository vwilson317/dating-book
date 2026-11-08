// POST /api/stripe-webhook: Stripe calls this after a payment, even if the reader closed the tab.
// Fulfillment here means recording the contribution: the downloads are free, and the name, story
// and edition perks are handled by hand from this record (Netlify Blobs store "contributions").
import { getStore } from '@netlify/blobs';
import type Stripe from 'stripe';
import { requireEnv, stripeClient } from '../lib/stripe';

export const config = { path: '/api/stripe-webhook' };

const customField = (session: Stripe.Checkout.Session, key: string) => {
  const field = session.custom_fields.find((f) => f.key === key);
  return field?.text?.value ?? field?.dropdown?.value ?? null;
};

/**
 * Webhooks retry and can arrive twice at once. The session ID is the key and `onlyIfNew` makes the
 * write atomic, so only one delivery can create the record. Any future side effect, such as an
 * email, belongs inside the `modified` branch so it also runs once.
 */
async function recordContribution(session: Stripe.Checkout.Session) {
  const { tier, lang } = session.metadata ?? {};
  // Other payments on the same Stripe account, including `stripe trigger` fixtures, aren't ours.
  if (!tier || !lang) {
    console.log(`ignored session ${session.id}: not a contribution checkout`);
    return;
  }

  const store = getStore({ name: 'contributions', consistency: 'strong' });
  const { modified } = await store.setJSON(
    session.id,
    {
      sessionId: session.id,
      paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      tier,
      lang,
      amountTotal: session.amount_total,
      currency: session.currency,
      email: session.customer_details?.email ?? null,
      acknowledgmentName: customField(session, 'acknowledgment_name'),
      contactMethod: customField(session, 'contact_method'),
      contactHandle: customField(session, 'contact_handle'),
      ref: session.client_reference_id,
      createdAt: new Date(session.created * 1000).toISOString(),
      recordedAt: new Date().toISOString(),
    },
    { onlyIfNew: true },
  );
  console.log(`${modified ? 'recorded' : 'duplicate delivery for'} contribution ${session.id} (${tier})`);
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      // Delayed methods such as boleto complete unpaid, then send async_payment_succeeded.
      if (event.data.object.payment_status === 'unpaid') {
        console.log(`session ${event.data.object.id} completed, awaiting payment`);
        return;
      }
      return recordContribution(event.data.object);
    case 'checkout.session.async_payment_succeeded':
      return recordContribution(event.data.object);
    case 'checkout.session.async_payment_failed':
      console.warn(`delayed payment failed for session ${event.data.object.id}`);
      return;
    case 'payment_intent.payment_failed': {
      // Nothing to undo: nothing is recorded until payment succeeds, and Checkout lets the buyer retry.
      const intent = event.data.object;
      console.warn(`payment failed for ${intent.id}: ${intent.last_payment_error?.code ?? 'unknown'}`);
      return;
    }
    default:
      console.log(`unhandled event type ${event.type}`);
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });

  let stripe: Stripe;
  let secret: string;
  try {
    stripe = stripeClient();
    secret = requireEnv('STRIPE_WEBHOOK_SECRET');
  } catch (err) {
    console.error('webhook misconfigured:', err instanceof Error ? err.message : err);
    return new Response('Webhook not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    // The signature covers the exact bytes Stripe sent, so this must be the unparsed body.
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // A 500 makes Stripe retry, which is safe because recording is idempotent.
    console.error(`webhook ${event.id} failed:`, err instanceof Error ? err.message : err);
    return new Response('Handler failed', { status: 500 });
  }
  return new Response('ok');
};
