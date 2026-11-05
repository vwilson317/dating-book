// /podcast.xml and /pt/podcast.xml: the audiobook as a podcast, one show per language.
// Submit each URL once at creators.spotify.com (and podcastsconnect.apple.com). New chapters with
// audio show up as new episodes after the next deploy. Settings: SITE.podcast in src/site.config.ts.
import type { APIRoute } from 'astro';
import { getPublishedChapters, chapterUrl, chapterLabel, chapterAudio } from '../../lib/content';
import { SITE } from '../../site.config';
import { LANGS, DEFAULT_LANG, langPaths, localePath, t, type Lang } from '../../i18n/ui';

export const getStaticPaths = langPaths;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ props, site }) => {
  const lang = props.lang as Lang;
  const s = t(lang);
  const abs = (p: string) => new URL(p, site).toString();
  const { email, explicit, categories } = SITE.podcast;
  const showTitle = `${s.bookTitle}: ${s.bookSubtitle}`;
  const cover = abs(lang === DEFAULT_LANG ? '/podcast-cover.jpg' : `/podcast-cover-${lang}.jpg`);
  const homepage = abs(localePath(lang, '/'));

  const episodes = (await getPublishedChapters(lang)).flatMap((c) => {
    const audio = chapterAudio(c);
    if (!audio) return [];
    const url = abs(chapterUrl(c));
    const title = `${chapterLabel(c)}: ${c.data.title}`;
    const description = `${c.data.excerpt}\n\n${s.readAlong(url)}`;
    // Chapters released on the same day get a minute apart, so apps list them in book order.
    const pubDate = new Date(c.data.published.getTime() + c.data.number * 60_000).toUTCString();
    return [
      `    <item>
      <title>${esc(title)}</title>
      <itunes:title>${esc(title)}</itunes:title>
      <description>${esc(description)}</description>
      <link>${url}</link>
      <guid isPermaLink="false">${lang}-chapter-${c.data.number}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${esc(abs(audio.file))}" length="${audio.bytes}" type="audio/mpeg"/>
      <itunes:duration>${audio.duration}</itunes:duration>${c.data.number > 0 ? `\n      <itunes:episode>${c.data.number}</itunes:episode>` : ''}
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>${explicit}</itunes:explicit>
    </item>`,
    ];
  });

  const category = ([main, sub]: [string, string?]) =>
    sub
      ? `    <itunes:category text="${esc(main)}">\n      <itunes:category text="${esc(sub)}"/>\n    </itunes:category>`
      : `    <itunes:category text="${esc(main)}"/>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(showTitle)}</title>
    <link>${homepage}</link>
    <atom:link href="${abs(localePath(lang, '/podcast.xml'))}" rel="self" type="application/rss+xml"/>
    <language>${LANGS[lang].locale}</language>
    <copyright>© ${new Date().getFullYear()} ${esc(SITE.author)}</copyright>
    <description>${esc(s.podcastDescription)}</description>
    <itunes:summary>${esc(s.podcastDescription)}</itunes:summary>
    <itunes:author>${esc(SITE.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${esc(SITE.author)}</itunes:name>${email ? `\n      <itunes:email>${esc(email)}</itunes:email>` : ''}
    </itunes:owner>
    <itunes:image href="${cover}"/>
    <image>
      <url>${cover}</url>
      <title>${esc(showTitle)}</title>
      <link>${homepage}</link>
    </image>
${categories.map(category).join('\n')}
    <itunes:explicit>${explicit}</itunes:explicit>
    <itunes:type>serial</itunes:type>
${episodes.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
