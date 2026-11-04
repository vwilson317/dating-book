// /rss.xml and /pt/rss.xml: a feed of chapters, newest first. Feed readers, aggregators and
// search engines use it to discover new chapters as soon as they're released.
import type { APIRoute } from 'astro';
import { getPublishedChapters, chapterUrl, chapterLabel } from '../../lib/content';
import { LANGS, langPaths, localePath, t, type Lang } from '../../i18n/ui';

export const getStaticPaths = langPaths;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ props, site }) => {
  const lang = props.lang as Lang;
  const s = t(lang);
  const abs = (p: string) => new URL(p, site).toString();
  const chapters = (await getPublishedChapters(lang)).sort(
    (a, b) => (b.data.versions[0]?.date ?? b.data.published).getTime() - (a.data.versions[0]?.date ?? a.data.published).getTime() || b.data.number - a.data.number,
  );
  const items = chapters
    .map((c) => {
      const url = abs(chapterUrl(c));
      const pdf = c.data.versions[0];
      return `    <item>
      <title>${esc(`${chapterLabel(c)}: ${c.data.title}`)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${c.data.published.toUTCString()}</pubDate>
      <description>${esc(c.data.excerpt)}</description>${pdf ? `\n      <enclosure url="${esc(abs(pdf.file))}" type="application/pdf" length="0"/>` : ''}
    </item>`;
    })
    .join('\n');
  const feedUrl = abs(localePath(lang, '/rss.xml'));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`${s.bookTitle}: ${s.bookSubtitle}`)}</title>
    <link>${abs(localePath(lang, '/'))}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <description>${esc(s.description)}</description>
    <language>${LANGS[lang].locale}</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
