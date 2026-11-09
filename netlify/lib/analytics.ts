// Server-side PostHog events for the Netlify functions. Analytics must never affect a payment,
// so this never throws and gives up quickly.
import type Stripe from 'stripe';

const CAPTURE_URL = `${process.env.POSTHOG_HOST || 'https://us.i.posthog.com'}/i/v0/e/`;
const TIMEOUT_MS = 3000;

/**
 * Records a paid contribution. Sent from the Stripe webhook, so it counts even if the buyer never
 * reaches the thank-you page. Contains no name, email or contact details.
 */
export async function captureContribution(session: Stripe.Checkout.Session): Promise<void> {
  const key = process.env.PUBLIC_POSTHOG_KEY;
  if (!key) {
    console.log('analytics skipped: PUBLIC_POSTHOG_KEY is not set');
    return;
  }
  const { tier, lang, ph_id: visitor } = session.metadata ?? {};
  try {
    const res = await fetch(CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        api_key: key,
        event: 'contribution_recorded',
        // The reader's anonymous PostHog ID, so this joins their reading history. Falls back to the
        // session for buyers whose browser blocked analytics.
        distinct_id: visitor || session.id,
        timestamp: new Date(session.created * 1000).toISOString(),
        properties: {
          tier,
          lang,
          value: (session.amount_total ?? 0) / 100,
          currency: session.currency?.toUpperCase(),
          session_id: session.id,
          ref: session.client_reference_id,
          linked_to_visitor: !!visitor,
          $process_person_profile: false, // keep this anonymous, like the rest of the site's events
        },
      }),
    });
    if (!res.ok) console.warn(`analytics rejected for ${session.id}: ${res.status}`);
  } catch (err) {
    console.warn(`analytics failed for ${session.id}:`, err instanceof Error ? err.message : err);
  }
}
