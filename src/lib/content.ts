import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LANG, LANGS, isLang, localePath, type Lang } from '../i18n/ui';

export type Chapter = CollectionEntry<'chapters'>;

/** Language comes from the folder: src/content/chapters/<lang>/... */
export function chapterLang(c: Chapter): Lang {
  const folder = c.filePath?.split('/').at(-2);
  return isLang(folder) ? folder : DEFAULT_LANG;
}

/** URL slug: the file name (or `slug` frontmatter) without the language folder */
export const chapterSlug = (c: Chapter) => c.id.replace(/^[a-z]{2}\//, '');

/** Every chapter that should appear on the site (published + coming soon), in book order. */
export async function getVisibleChapters(lang: Lang): Promise<Chapter[]> {
  const all = await getCollection('chapters', (c) => c.data.status !== 'draft' && chapterLang(c) === lang);
  return all.sort((a, b) => a.data.number - b.data.number);
}

export async function getPublishedChapters(lang: Lang): Promise<Chapter[]> {
  return (await getVisibleChapters(lang)).filter((c) => c.data.status === 'published');
}

export async function getEditions(lang: Lang) {
  const all = await getCollection('editions', (e) => e.data.lang === lang);
  const versionOf = (id: string) => Number(id.match(/(\d+)\D*$/)?.[1] ?? 0);
  // newest first; same-day releases fall back to the version number in the id
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || versionOf(b.id) - versionOf(a.id));
}

export function wordCount(body = ''): number {
  return body.replace(/[*_#>`\\]/g, ' ').trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function readingMinutes(body = ''): number {
  return Math.max(1, Math.round(wordCount(body) / 230));
}

export function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(LANGS[lang].locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const chapterUrl = (c: Chapter) => localePath(chapterLang(c), `/chapters/${chapterSlug(c)}/`);
