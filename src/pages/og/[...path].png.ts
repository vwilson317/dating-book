// /og/<lang>/<chapter>.png: a share image per chapter (title + chapter label), built at deploy time.
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getPublishedChapters, getPreviewChapters, getJournal, chapterSlug, chapterLabel, postKind, postSlug } from '../../lib/content';
import { LANG_CODES, t } from '../../i18n/ui';
import { chapterOgSvg } from '../../lib/og';

export async function getStaticPaths() {
  const out = [];
  for (const lang of LANG_CODES) {
    // draft previews too, so a preview link sent on WhatsApp shows the chapter title
    for (const c of [...(await getPublishedChapters(lang)), ...(await getPreviewChapters(lang))]) {
      const s = t(lang);
      out.push({
        params: { path: `${lang}/${chapterSlug(c)}` },
        props: { eyebrow: chapterLabel(c), title: c.data.title, book: s.bookTitle, stamp: s.stampMid },
      });
    }
  }
  // journal posts without their own cover or poster
  for (const lang of LANG_CODES) {
    const s = t(lang);
    for (const p of await getJournal(lang)) {
      if (p.data.cover || p.data.video?.poster) continue;
      out.push({
        params: { path: `${lang}/journal/${postSlug(p)}` },
        props: { eyebrow: postKind(p) === 'video' ? s.kindVideo : s.journalTitle, title: p.data.title, book: s.bookTitle, stamp: s.stampMid },
      });
    }
  }
  return out;
}

export const GET: APIRoute = async ({ props }) => {
  const png = await sharp(Buffer.from(chapterOgSvg(props as Parameters<typeof chapterOgSvg>[0]))).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
