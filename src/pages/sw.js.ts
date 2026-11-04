// Generates /sw.js at build time. The build timestamp versions the caches, so each deploy
// cleans up after the previous one.
import type { APIRoute } from 'astro';
import { LANG_CODES, localePath } from '../i18n/ui';

const VERSION = Date.now().toString(36);

const PRECACHE = [
  ...LANG_CODES.flatMap((l) =>
    ['/', '/chapters/', '/downloads/', '/offline/', '/manifest.webmanifest'].map((p) => localePath(l, p)),
  ),
  '/icons/favicon.svg',
  '/icons/icon-192.png',
];
const LANG_PREFIXES = LANG_CODES.map((l) => localePath(l, '/')).filter((p) => p !== '/');

const sw = /* js */ `
const VERSION = '${VERSION}';
const PAGES = 'pages-' + VERSION;
const ASSETS = 'assets-v1';   // hashed files under /_astro/ never change, keep across deploys
const PDFS = 'pdfs-v1';
const PRECACHE = ${JSON.stringify(PRECACHE)};
const LANG_PREFIXES = ${JSON.stringify(LANG_PREFIXES)};
const offlineFor = (path) => (LANG_PREFIXES.find((p) => path.startsWith(p)) || '/') + 'offline/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pages-') && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/ingest')) return; // analytics proxy

  // Pages: network first so readers always get the latest text; fall back to cache, then offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(offlineFor(url.pathname))))
    );
    return;
  }

  // Fingerprinted build assets (CSS, JS, fonts): cache first.
  if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(ASSETS).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // PDFs: serve from cache if present (so downloaded chapters open offline), refresh in background.
  if (url.pathname.startsWith('/pdfs/')) {
    event.respondWith(
      caches.open(PDFS).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
        return hit || net;
      })
    );
    return;
  }

  // Everything else (icons, og image): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
`;

export const GET: APIRoute = () =>
  new Response(sw, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
