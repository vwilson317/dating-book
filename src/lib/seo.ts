// SEO helpers: absolute URLs and schema.org structured data (JSON-LD) that search engines read.
import { SITE, instagramUrl } from '../site.config';
import { DEFAULT_LANG, LANGS, LANG_CODES, localePath, t, type Lang } from '../i18n/ui';
import { chapterLabel, chapterLang, chapterUrl, postLang, postUrl, wordCount, type Chapter, type JournalPost } from './content';

export const abs = (path: string, site: URL | undefined) => new URL(path, site).toString();

const author = (site: URL | undefined) => ({
  '@type': 'Person',
  '@id': abs('/#author', site),
  name: SITE.author,
  url: abs('/', site),
  sameAs: [instagramUrl],
});

/** The book itself, one per language, linked to its translation */
export function bookSchema(lang: Lang, site: URL | undefined) {
  const s = t(lang);
  return {
    '@type': 'Book',
    '@id': abs(localePath(lang, '/#book'), site),
    name: `${s.bookTitle}: ${s.bookSubtitle}`,
    alternateName: s.bookTitle,
    inLanguage: LANGS[lang].locale,
    url: abs(localePath(lang, '/'), site),
    image: abs(lang === DEFAULT_LANG ? '/og.png' : `/og-${lang}.png`, site),
    description: s.description,
    genre: ['Memoir', 'Humor', 'Dating', 'Travel'],
    bookFormat: 'https://schema.org/EBook',
    isAccessibleForFree: true,
    author: { '@id': abs('/#author', site) },
    workTranslation: LANG_CODES.filter((l) => l !== lang).map((l) => ({ '@id': abs(localePath(l, '/#book'), site) })),
  };
}

export function homeSchema(lang: Lang, site: URL | undefined) {
  const s = t(lang);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': abs(localePath(lang, '/#website'), site),
        url: abs(localePath(lang, '/'), site),
        name: s.bookTitle,
        inLanguage: LANGS[lang].locale,
        publisher: { '@id': abs('/#author', site) },
      },
      bookSchema(lang, site),
      author(site),
    ],
  };
}

export function chapterSchema(c: Chapter, site: URL | undefined, image: string) {
  const lang = chapterLang(c);
  const s = t(lang);
  const url = abs(chapterUrl(c), site);
  const modified = c.data.versions[0]?.date ?? c.data.published;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Chapter',
        '@id': `${url}#chapter`,
        url,
        name: c.data.title,
        headline: `${chapterLabel(c)}: ${c.data.title}`,
        position: c.data.number,
        description: c.data.excerpt,
        inLanguage: LANGS[lang].locale,
        image,
        wordCount: wordCount(c.body),
        datePublished: c.data.published.toISOString(),
        dateModified: modified.toISOString(),
        isAccessibleForFree: true,
        isPartOf: { '@id': abs(localePath(lang, '/#book'), site) },
        author: { '@id': abs('/#author', site) },
        ...(c.data.versions[0] ? { encoding: { '@type': 'MediaObject', contentUrl: abs(c.data.versions[0].file, site), encodingFormat: 'application/pdf' } } : {}),
      },
      bookSchema(lang, site),
      author(site),
      breadcrumbs(
        [
          [s.bookTitle, localePath(lang, '/')],
          [s.chaptersTitle, localePath(lang, '/chapters/')],
          [c.data.title, chapterUrl(c)],
        ],
        site,
      ),
    ],
  };
}

export function breadcrumbs(items: [string, string][], site: URL | undefined) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path, site) })),
  };
}

/** For simple pages (chapter list, downloads, quiz) */
export function pageSchema(lang: Lang, site: URL | undefined, name: string, path: string, type = 'WebPage') {
  const s = t(lang);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': type, '@id': abs(path, site), url: abs(path, site), name, inLanguage: LANGS[lang].locale, isPartOf: { '@id': abs(localePath(lang, '/#website'), site) } },
      breadcrumbs(
        [
          [s.bookTitle, localePath(lang, '/')],
          [name, path],
        ],
        site,
      ),
    ],
  };
}

/** "PT12M34S" for schema.org durations */
const isoDuration = (sec: number) => `PT${Math.floor(sec / 60)}M${Math.round(sec % 60)}S`;

/** A journal post: a VideoObject (so it can show up in Google's video results) or a BlogPosting */
export function journalSchema(p: JournalPost, site: URL | undefined, image: string) {
  const lang = postLang(p);
  const s = t(lang);
  const url = abs(postUrl(p), site);
  const v = p.data.video;
  const common = {
    '@id': `${url}#post`,
    url,
    name: p.data.title,
    headline: p.data.title,
    description: p.data.excerpt,
    inLanguage: LANGS[lang].locale,
    datePublished: p.data.published.toISOString(),
    author: { '@id': abs('/#author', site) },
    isAccessibleForFree: true,
  };
  const main = v
    ? {
        '@type': 'VideoObject',
        ...common,
        uploadDate: p.data.published.toISOString(),
        thumbnailUrl: abs(v.poster ?? image, site),
        contentUrl: abs(v.src, site),
        ...(v.duration ? { duration: isoDuration(v.duration) } : {}),
      }
    : { '@type': 'BlogPosting', ...common, image, wordCount: wordCount(p.body) };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      main,
      author(site),
      breadcrumbs(
        [
          [s.bookTitle, localePath(lang, '/')],
          [s.journalTitle, localePath(lang, '/journal/')],
          [p.data.title, postUrl(p)],
        ],
        site,
      ),
    ],
  };
}
