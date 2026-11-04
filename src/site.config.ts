// Central place for site-wide settings. Book title/subtitle per language live in src/i18n/ui.ts.
export const SITE = {
  author: 'Vincent Wilson',
  authorFirstName: 'Vincent', // used in feedback messages ("Hey Vincent!")
  // Your Instagram handle, without the @
  instagram: 'your_instagram_handle',
  // WhatsApp number for reader feedback: country code + number, digits only (no +, spaces or dashes).
  // e.g. US (555) 123-4567 -> '15551234567', Brazil (11) 91234-5678 -> '5511912345678'.
  // Leave empty to hide the feedback features on the live site.
  whatsapp: '',
  themeColor: '#c2532f',
};

export const instagramUrl = `https://instagram.com/${SITE.instagram}`;
