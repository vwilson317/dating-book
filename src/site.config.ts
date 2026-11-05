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
  themeColor: '#c2532f',

  // The audiobook as a podcast, one show per language: /podcast.xml and /pt/podcast.xml.
  // Submit those URLs once at creators.spotify.com (and Apple Podcasts Connect if you like). See README.
  podcast: {
    // Spotify and Apple email a code here to confirm the show is yours. It's public in the feed,
    // so use an address you don't mind showing. Required before you submit.
    email: '',
    // The chapters have swearing, so the shows must be marked explicit.
    explicit: true,
    // Apple Podcasts categories (Spotify reads them too): [category, optional subcategory]
    categories: [['Comedy'], ['Society & Culture', 'Relationships']] as [string, string?][],
    // Once each show is live, paste its Spotify link here to show "Listen on Spotify" in the player.
    spotify: { en: '', pt: '' },
  },
};

export const instagramUrl = `https://instagram.com/${SITE.instagram}`;
