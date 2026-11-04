// One web-app manifest per language, so installing from a Portuguese page opens the Portuguese site.
import type { APIRoute } from 'astro';
import { SITE } from '../../site.config';
import { langPaths, localePath, t, type Lang } from '../../i18n/ui';

export const getStaticPaths = langPaths;

export const GET: APIRoute = ({ props }) => {
  const lang = props.lang as Lang;
  const s = t(lang);
  const start = localePath(lang, '/');
  const manifest = {
    name: `${s.bookTitle}: ${s.bookSubtitle}`,
    short_name: s.bookTitle,
    description: s.description,
    lang,
    id: start,
    start_url: `${start}?utm_source=pwa&utm_medium=homescreen`,
    scope: '/',
    display: 'standalone',
    background_color: '#faf5ec',
    theme_color: SITE.themeColor,
    categories: ['books', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: s.navChapters, url: localePath(lang, '/chapters/') },
      { name: s.navDownloads, url: localePath(lang, '/downloads/') },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
};
