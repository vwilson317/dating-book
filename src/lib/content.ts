import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LANG, LANGS, isLang, localePath, t, type Lang } from '../i18n/ui';

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

/** "Chapter 3", or the section's own label ("Introduction", "Introdução") */
export const chapterLabel = (c: Chapter) => c.data.label ?? t(chapterLang(c)).chapter(c.data.number);

export const chapterUrl = (c: Chapter) => localePath(chapterLang(c), `/chapters/${chapterSlug(c)}/`);

// Narrated audio: MP3s in public/audio/<lang>/, indexed by `npm run audio` (scripts/audio.mjs). Keyed "<lang>:<number>".
import audioManifest from '../content/audio.json';

export interface ChapterAudio {
  file: string;
  duration: number; // seconds
  bytes: number;
}

export function chapterAudio(c: Chapter): ChapterAudio | undefined {
  return (audioManifest as Record<string, ChapterAudio>)[`${chapterLang(c)}:${c.data.number}`];
}

/** 754 -> "12:34" */
export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
