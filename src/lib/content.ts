import { getCollection, type CollectionEntry } from 'astro:content';

export type Chapter = CollectionEntry<'chapters'>;

/** Every chapter that should appear on the site (published + coming soon), in book order. */
export async function getVisibleChapters(): Promise<Chapter[]> {
  const all = await getCollection('chapters', ({ data }) => data.status !== 'draft');
  return all.sort((a, b) => a.data.number - b.data.number);
}

export async function getPublishedChapters(): Promise<Chapter[]> {
  return (await getVisibleChapters()).filter((c) => c.data.status === 'published');
}

export async function getEditions() {
  const all = await getCollection('editions');
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function wordCount(body = ''): number {
  return body.replace(/[*_#>`\\]/g, ' ').trim().split(/\s+/).filter((w) => /\w/.test(w)).length;
}

export function readingMinutes(body = ''): number {
  return Math.max(1, Math.round(wordCount(body) / 230));
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const chapterUrl = (c: Chapter) => `/chapters/${c.id}/`;
