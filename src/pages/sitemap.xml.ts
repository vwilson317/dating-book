// /sitemap.xml: every indexable page in both languages, with hreflang links between translations
// so Google shows English readers the English page and Portuguese readers the Portuguese one.
import type { APIRoute } from 'astro';
import { getPublishedChapters, chapterUrl } from '../lib/content';
import { LANG_CODES, DEFAULT_LANG, localePath, type Lang } from '../i18n/ui';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).toString();
  const byLang = Object.fromEntries(await Promise.all(LANG_CODES.map(async (l) => [l, await getPublishedChapters(l)] as const)));
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const newest = (l: Lang) =>
    byLang[l].reduce((m: Date | null, c) => {
      const d = c.data.versions[0]?.date ?? c.data.published;
      return !m || d > m ? d : m;
    }, null);

  type Entry = { loc: string; lastmod?: Date | null; alternates: Partial<Record<Lang, string>> };
  const entries: Entry[] = [];

  for (const p of ['/', '/chapters/', '/downloads/', '/buy/', '/contact/', '/quiz/']) {
    const alternates = Object.fromEntries(LANG_CODES.map((l) => [l, localePath(l, p)]));
    for (const l of LANG_CODES) entries.push({ loc: localePath(l, p), lastmod: ['/quiz/', '/contact/', '/buy/'].includes(p) ? null : newest(l), alternates });
  }
  for (const l of LANG_CODES) {
    for (const c of byLang[l]) {
      const alternates: Partial<Record<Lang, string>> = {};
      for (const o of LANG_CODES) {
        const twin = byLang[o].find((x) => x.data.number === c.data.number);
        if (twin) alternates[o] = chapterUrl(twin);
      }
      entries.push({ loc: chapterUrl(c), lastmod: c.data.versions[0]?.date ?? c.data.published, alternates });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map((e) => {
    const alts = Object.entries(e.alternates);
    const links =
      alts.length > 1
        ? alts
            .map(([l, u]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(abs(u!))}"/>`)
            .concat(e.alternates[DEFAULT_LANG] ? [`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(abs(e.alternates[DEFAULT_LANG]!))}"/>`] : [])
            .join('\n') + '\n'
        : '';
    return `  <url>\n    <loc>${esc(abs(e.loc))}</loc>\n${e.lastmod ? `    <lastmod>${day(e.lastmod)}</lastmod>\n` : ''}${links}  </url>`;
  })
  .join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
