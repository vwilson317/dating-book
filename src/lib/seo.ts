// SEO helpers: absolute URLs and schema.org structured data (JSON-LD) that search engines read.
import { SITE, instagramUrl } from '../site.config';
import { LANGS, LANG_CODES, localePath, t, type Lang } from '../i18n/ui';
import { chapterLabel, chapterLang, chapterUrl, wordCount, type Chapter } from './content';

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
    image: abs(lang === 'en' ? '/og.png' : `/og-${lang}.png`, site),
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
