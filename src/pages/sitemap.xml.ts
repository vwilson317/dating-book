// /sitemap.xml: every indexable page in every live language (one with published chapters), with
// hreflang links between translations so Google shows each reader the page in their language.
// Draft previews (/preview/) are never listed.
import type { APIRoute } from 'astro';
import { getJournal, getLiveLangs, getPublishedChapters, chapterUrl, postUrl, postImage } from '../lib/content';
import { DEFAULT_LANG, localePath, type Lang } from '../i18n/ui';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).toString();
  const LANG_CODES = await getLiveLangs();
  const byLang = Object.fromEntries(await Promise.all(LANG_CODES.map(async (l) => [l, await getPublishedChapters(l)] as const)));
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const newest = (l: Lang) =>
    byLang[l].reduce((m: Date | null, c) => {
      const d = c.data.versions[0]?.date ?? c.data.published;
      return !m || d > m ? d : m;
    }, null);

  type Video = { thumb: string; title: string; description: string; content: string; duration?: number; date: Date };
  type Entry = { loc: string; lastmod?: Date | null; alternates: Partial<Record<Lang, string>>; video?: Video };
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
  // Journal: the list page where a language has posts, then each post. Videos with a poster get a
  // video entry so they can appear in Google's video results.
  for (const l of LANG_CODES) {
    const posts = await getJournal(l);
    if (!posts.length) continue;
    entries.push({ loc: localePath(l, '/journal/'), lastmod: posts[0].data.published, alternates: {} });
    for (const p of posts) {
      const v = p.data.video;
      const thumb = postImage(p);
      entries.push({
        loc: postUrl(p),
        lastmod: p.data.published,
        alternates: {},
        video: v && thumb ? { thumb, title: p.data.title, description: p.data.excerpt, content: v.src, duration: v.duration, date: p.data.published } : undefined,
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
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
    const v = e.video;
    const video = v
      ? `    <video:video>\n      <video:thumbnail_loc>${esc(abs(v.thumb))}</video:thumbnail_loc>\n      <video:title>${esc(v.title)}</video:title>\n      <video:description>${esc(v.description)}</video:description>\n      <video:content_loc>${esc(abs(v.content))}</video:content_loc>\n${v.duration ? `      <video:duration>${Math.round(v.duration)}</video:duration>\n` : ''}      <video:publication_date>${day(v.date)}</video:publication_date>\n    </video:video>\n`
      : '';
    return `  <url>\n    <loc>${esc(abs(e.loc))}</loc>\n${e.lastmod ? `    <lastmod>${day(e.lastmod)}</lastmod>\n` : ''}${links}${video}  </url>`;
  })
  .join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
