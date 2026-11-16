import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { LANG_CODES, type Lang } from './i18n/ui';

// A downloadable PDF. List newest first.
const pdfVersion = z.object({
  label: z.string(), // e.g. "v2" or "Second draft"
  date: z.coerce.date(),
  file: z.string(), // path under /public, e.g. "/pdfs/chapter-01-v2.pdf"
  notes: z.string().optional(), // what changed in this version
});

// One markdown file per chapter in src/content/chapters/<lang>/ (en, pt, es)
const chapters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/chapters' }),
  schema: z.object({
    number: z.number(),
    // shown instead of "Chapter N" for non-numbered sections, e.g. "Introduction", "Epilogue"
    label: z.string().optional(),
    title: z.string(),
    excerpt: z.string(),
    location: z.string().optional(), // where the misadventure happened
    published: z.coerce.date(),
    // "published" shows the full chapter, "coming-soon" shows a teaser card only,
    // "preview" builds a private page at /preview/<slug>/ (link only: not listed anywhere, not indexed),
    // "draft" hides it from the site entirely.
    status: z.enum(['published', 'coming-soon', 'preview', 'draft']).default('published'),
    versions: z.array(pdfVersion).default([]),
  }),
});

// Full-book PDFs (whole manuscript, early-reader editions, etc.)
const editions = defineCollection({
  loader: file('./src/content/editions.yaml'),
  schema: z.object({
    lang: z.enum(LANG_CODES as [Lang, ...Lang[]]).default('en'),
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    file: z.string(),
    featured: z.boolean().default(false),
  }),
});

// Journal: long-form videos and written posts, one markdown file per post in
// src/content/journal/<lang>/. Instagram Reels link straight to a post's page. See README "Journal".
const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(), // cards, link previews, search results
    published: z.coerce.date(),
    status: z.enum(['published', 'draft']).default('published'),
    // Chapter numbers this post belongs with. It's offered on those chapters' pages (same language).
    chapters: z.array(z.number()).default([]),
    location: z.string().optional(),
    // Image for cards and link previews (a path under /public or a full URL). Defaults to the video poster.
    cover: z.string().optional(),
    // Leave out for a written post.
    video: z
      .object({
        src: z.string(), // MP4 path under /public (e.g. /video/rio-night.mp4) or a full URL on a video host/CDN
        poster: z.string().optional(), // still shown before playing; strongly recommended
        duration: z.number().optional(), // seconds, shown on cards and sent to search engines
        orientation: z.enum(['landscape', 'portrait']).default('landscape'),
        captions: z.string().optional(), // WebVTT file (.vtt); many people watch with the sound off
      })
      .optional(),
  }),
});

export const collections = { chapters, editions, journal };
