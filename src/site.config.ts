// Central place for site-wide settings. Book title/subtitle per language live in src/i18n/ui.ts.
export const SITE = {
  author: 'Vincent Wilson',
  authorFirstName: 'Vincent', // used in feedback messages ("Hey Vincent!")
  // Your Instagram handle, without the @
  instagram: 'vincent_jevon',
  // WhatsApp number for reader feedback: country code + number, digits only (no +, spaces or dashes).
  // e.g. US (555) 123-4567 -> '15551234567', Brazil (11) 91234-5678 -> '5511912345678'.
  // Leave empty to hide the feedback features on the live site.
  whatsapp: '16789826137',
  themeColor: '#1c5e47',

  // Contribution tiers, lowest first (used by the contribute prompt, /buy/ and /thanks/).
  // Contributing stays hidden on the live site until PUBLIC_CHECKOUT_ENABLED=true (see README).
  // Tier text is in src/i18n/buy.ts. The real price is set in Stripe (STRIPE_PRICE_* env vars), so
  // change both together.
  support: {
    // Shown at the bottom of the Contribute page. Updated by hand.
    totalContributions: 347,
    tiers: [
      { id: 'name', price: { en: '$3.99', pt: 'US$ 3,99' } },
      { id: 'instagram', price: { en: '$5.99', pt: 'US$ 5,99' } },
      { id: 'story', price: { en: '$20', pt: 'US$ 20' } },
    ],
  },
};

export const instagramUrl = `https://instagram.com/${SITE.instagram}`;

export const checkoutEnabled = import.meta.env.PUBLIC_CHECKOUT_ENABLED === 'true';

/** Temporarily off. Set to true to show the testimonials and extra tier perks on the Contribute page again. */
export const contributePlaceholders = false;

/**
 * Mockup content from the Stitch redesign that isn't real yet (see PLACEHOLDERS.md).
 * Shown in dev and on Netlify previews only, so it can never reach the production site.
 */
export const showPlaceholders = import.meta.env.DEV || (!!process.env.CONTEXT && process.env.CONTEXT !== 'production');

/** Tiers readers can choose in this language. In dev all of them show, even with checkout off. */
export const supportTiers = (_lang: 'en' | 'pt') => (checkoutEnabled || import.meta.env.DEV ? SITE.support.tiers : []);
