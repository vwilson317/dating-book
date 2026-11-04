import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

// A downloadable PDF. List newest first.
const pdfVersion = z.object({
  label: z.string(), // e.g. "v2" or "Second draft"
  date: z.coerce.date(),
  file: z.string(), // path under /public, e.g. "/pdfs/chapter-01-v2.pdf"
  notes: z.string().optional(), // what changed in this version
});

// One markdown file per chapter in src/content/chapters/<lang>/ (en, pt)
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
    // "draft" hides it from the site entirely.
    status: z.enum(['published', 'coming-soon', 'draft']).default('published'),
    versions: z.array(pdfVersion).default([]),
  }),
});

// Full-book PDFs (whole manuscript, early-reader editions, etc.)
const editions = defineCollection({
  loader: file('./src/content/editions.yaml'),
  schema: z.object({
    lang: z.enum(['en', 'pt']).default('en'),
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    file: z.string(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { chapters, editions };
