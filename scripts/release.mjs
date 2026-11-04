#!/usr/bin/env node
// Release new versions of the book from full-manuscript PDFs (one per language).
//
//   npm run release                                   # newest PDF in manuscript/en/ and manuscript/pt/
//   npm run release -- --dry-run                      # just show what would change
//   npm run release -- ~/Downloads/book-en.pdf ~/Downloads/livro-pt.pdf
//   npm run release -- livro.pdf --lang pt            # skip language detection
//   npm run release -- --notes "Rewrote the ending of ch. 4"
//
// For each PDF:
//   1. Detects the language (from "Chapter"/"Capítulo" headings) unless it's in manuscript/<lang>/ or --lang is given.
//   2. Splits it into chapters and compares each one with that language's chapters on the site.
//   3. New chapters: Markdown file + chapter PDF (v1). Changed: text replaced, next version (v2, v3…) added.
//      Unchanged: left alone.
//   4. Adds the full PDF as that language's next Early Reader Edition.
import { readFile, writeFile, readdir, mkdir, unlink, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import YAML from 'yaml';
import { diffWords } from 'diff';
import { extractBook, plainText } from './release/extract.mjs';
import { LANGUAGES } from './release/languages.mjs';
import { t, LANGS } from '../src/i18n/ui.ts';
import { SITE } from '../src/site.config.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAPTERS_ROOT = path.join(ROOT, 'src/content/chapters');
const EDITIONS_FILE = path.join(ROOT, 'src/content/editions.yaml');
const PDF_ROOT = path.join(ROOT, 'public/pdfs');
const INBOX = path.join(ROOT, 'manuscript');
const LANG_CODES = Object.keys(LANGUAGES).filter((l) => l in LANGS);

// ---------- args ----------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const userNotes = valueOf('--notes');
const forcedLang = valueOf('--lang');
const flagValues = new Set([userNotes, forcedLang].filter(Boolean));
const pdfArgs = args.filter((a) => !a.startsWith('--') && !flagValues.has(a));

if (forcedLang && !LANG_CODES.includes(forcedLang)) fail(`--lang must be one of: ${LANG_CODES.join(', ')}`);
if (forcedLang && pdfArgs.length > 1) fail('--lang only works with a single PDF.');

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

function fail(msg) {
  console.error(c.red(msg));
  process.exit(1);
}

async function newestPdf(dir) {
  if (!existsSync(dir)) return null;
  const pdfs = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) return null;
  const withTimes = await Promise.all(pdfs.map(async (f) => ({ f, t: (await stat(path.join(dir, f))).mtimeMs })));
  return path.join(dir, withTimes.sort((a, b) => b.t - a.t)[0].f);
}

/** [{ file, lang? }] — lang is known when the PDF sits in manuscript/<lang>/ */
async function inputs() {
  if (pdfArgs.length) {
    return pdfArgs.map((file) => {
      if (!existsSync(file)) fail(`File not found: ${file}`);
      const folder = path.basename(path.dirname(path.resolve(file)));
      return { file, lang: forcedLang ?? (LANG_CODES.includes(folder) ? folder : undefined) };
    });
  }
  const found = [];
  for (const lang of LANG_CODES) {
    const file = await newestPdf(path.join(INBOX, lang));
    if (file) found.push({ file, lang });
  }
  const loose = await newestPdf(INBOX); // a PDF dropped straight into manuscript/
  if (loose) found.push({ file: loose, lang: forcedLang });
  if (!found.length) {
    fail(
      'No PDFs found. Put your manuscripts in manuscript/en/ and manuscript/pt/, or pass paths:\n' +
        '  npm run release -- book-en.pdf livro-pt.pdf [--dry-run] [--notes "what changed"]',
    );
  }
  return found;
}

// ---------- helpers ----------
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const pad = (n) => String(n).padStart(2, '0');
const slugify = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const ymd = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

function parseMd(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2].trim() };
}

function stringifyMd(data, body) {
  const order = ['number', 'title', 'slug', 'excerpt', 'location', 'published', 'status', 'versions'];
  const ordered = {};
  for (const k of order) if (data[k] !== undefined) ordered[k] = data[k];
  for (const k of Object.keys(data)) if (!(k in ordered)) ordered[k] = data[k];
  const fm = YAML.stringify(ordered, { lineWidth: 0 }).trim();
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}

function nextVersion(versions = []) {
  const nums = versions.map((v) => Number(String(v.label).match(/(\d+)/)?.[1] ?? 0));
  return `v${Math.max(0, ...nums, versions.length) + 1}`;
}

function makeExcerpt(md) {
  const text = plainText(md.split('\n\n').find((p) => p.length > 40 && p !== '***') ?? md);
  if (text.length <= 160) return text;
  const cut = text.slice(0, 160);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}

function diffSummary(oldMd, newMd) {
  const parts = diffWords(plainText(oldMd), plainText(newMd));
  let added = 0, removed = 0;
  const words = (v) => v.trim().split(/\s+/).filter(Boolean).length;
  const clip = (v, n) => (v.length > n ? v.slice(0, n) + '…' : v);
  // Group nearby edits into hunks with a little context on each side
  const hunks = [];
  let hunk = null;
  parts.forEach((p, i) => {
    if (p.added || p.removed) {
      if (p.added) added += words(p.value);
      else removed += words(p.value);
      if (!hunk) hunk = { before: (parts[i - 1]?.value ?? '').slice(-35), body: '', after: '' };
      hunk.body += p.added ? c.green(`[+${clip(p.value, 80)}]`) : c.red(`[-${clip(p.value, 80)}]`);
    } else if (hunk) {
      if (words(p.value) <= 3 && i < parts.length - 1) hunk.body += p.value;
      else {
        hunk.after = p.value.slice(0, 35);
        hunks.push(hunk);
        hunk = null;
      }
    }
  });
  if (hunk) hunks.push(hunk);
  const snippets = hunks.slice(0, 4).map((h) => c.dim('…' + h.before.trimStart()) + h.body + c.dim(h.after.trimEnd() + '…'));
  if (hunks.length > 4) snippets.push(c.dim(`…and ${hunks.length - 4} more edit(s)`));
  return { added, removed, snippets };
}

async function writeChapterPdf(src, start, end, file, title) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: end - start + 1 }, (_, i) => start + i));
  pages.forEach((p) => out.addPage(p));
  out.setTitle(title);
  out.setAuthor(SITE.author);
  await writeFile(file, await out.save());
}

async function loadChapters(dir) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  return Promise.all(
    files.map(async (file) => {
      const { data, body } = parseMd(await readFile(path.join(dir, file), 'utf8'));
      return { file, data, body };
    }),
  );
}

async function readEditions() {
  return existsSync(EDITIONS_FILE) ? (YAML.parse(await readFile(EDITIONS_FILE, 'utf8')) ?? []) : [];
}

async function writeEditions(list) {
  await writeFile(
    EDITIONS_FILE,
    `# Full-book PDF downloads, newest first. \`npm run release\` adds to this automatically.\n` +
      `# The entry with \`featured: true\` (per language) is promoted on that language's home page.\n` +
      YAML.stringify(list, { lineWidth: 0 }),
  );
}

// ---------- release one language ----------
async function release({ file, lang: knownLang, bytes, book }) {
  const lang = book.lang;
  const s = t(lang);
  const tag = c.bold(`[${lang.toUpperCase()}]`);
  const chaptersDir = path.join(CHAPTERS_ROOT, lang);
  const pdfDir = path.join(PDF_ROOT, lang);

  console.log(`\n${tag} ${c.bold(path.basename(file))}`);
  console.log(
    c.dim(
      `${book.numPages} pages, ${book.chapters.length} chapters, language: ${LANGS[lang].label}` +
        (knownLang ? '' : ' (detected — use manuscript/<lang>/ or --lang to set it)'),
    ),
  );
  if (!book.chapters.length) {
    const word = lang === 'pt' ? '"Capítulo 1" or "Capítulo Um"' : '"Chapter 1" or "Chapter One"';
    console.error(c.red(`No chapters found. Each chapter needs to start on a new page with a heading like ${word}.`));
    return { lang, changes: [], chapters: [] };
  }

  const existing = await loadChapters(chaptersDir);
  const samples = existing.filter((e) => e.data.sample);
  const real = existing.filter((e) => !e.data.sample);

  const plan = [];
  for (const ch of book.chapters) {
    const entry = real.find((e) => e.data.number === ch.number);
    if (!entry) {
      plan.push({ kind: 'new', ch });
      continue;
    }
    const textChanged = normalize(entry.body) !== normalize(ch.body);
    const titleChanged = entry.data.title !== ch.title;
    const wasHidden = entry.data.status !== 'published';
    if (!textChanged && !titleChanged && !wasHidden && entry.data.versions?.length) {
      plan.push({ kind: 'unchanged', ch, entry });
    } else {
      plan.push({ kind: wasHidden ? 'published' : 'updated', ch, entry, textChanged, titleChanged, diff: diffSummary(entry.body, ch.body) });
    }
  }
  const missing = real.filter(
    (e) => e.data.status === 'published' && !book.chapters.some((ch) => ch.number === e.data.number),
  );

  for (const p of plan) {
    const label = `${s.chapter(p.ch.number)}: ${p.ch.title}`;
    const pages = c.dim(`(pp. ${p.ch.startPage + 1}–${p.ch.endPage + 1})`);
    if (p.kind === 'new') console.log(`  ${c.green('NEW      ')} ${label} ${pages}`);
    else if (p.kind === 'unchanged') console.log(`  ${c.dim('unchanged')} ${c.dim(label)}`);
    else {
      const kind = p.kind === 'published' ? c.green('PUBLISH  ') : c.yellow('UPDATED  ');
      const bits = [];
      if (p.titleChanged) bits.push(`title was "${p.entry.data.title}"`);
      if (p.textChanged) bits.push(`${c.green('+' + p.diff.added)} / ${c.red('−' + p.diff.removed)} words`);
      console.log(`  ${kind} ${label} ${pages} ${bits.join(', ')}`);
      for (const snip of p.diff?.snippets ?? []) console.log(`              ${snip}`);
    }
  }
  for (const m of missing) console.log(`  ${c.yellow('NOT IN PDF')} ${s.chapter(m.data.number)}: ${m.data.title} ${c.dim('(left as is)')}`);
  if (samples.length) console.log(c.dim(`  Placeholder sample chapters will be removed (${samples.length}).`));

  const changes = plan.filter((p) => p.kind !== 'unchanged');
  const result = { lang, changes, chapters: book.chapters };
  if (!changes.length && !samples.length) {
    console.log(c.dim('  No changes.'));
    return result;
  }
  if (dryRun) return result;

  // ---- apply ----
  await mkdir(chaptersDir, { recursive: true });
  await mkdir(pdfDir, { recursive: true });

  // Remove placeholder samples first (their PDF names can clash with the first real release)
  const allEditions = await readEditions();
  for (const smp of samples) {
    await unlink(path.join(chaptersDir, smp.file));
    for (const v of smp.data.versions ?? []) await unlink(path.join(ROOT, 'public', v.file)).catch(() => {});
  }
  for (const e of allEditions.filter((e) => e.sample && (e.lang ?? 'en') === lang)) {
    await unlink(path.join(ROOT, 'public', e.file)).catch(() => {});
  }

  const src = await PDFDocument.load(bytes);
  const written = [];
  for (const p of changes) {
    const { ch } = p;
    const data = p.entry ? { ...p.entry.data } : { number: ch.number };
    const versions = data.versions ?? [];
    const label = nextVersion(versions);
    const pdfFile = `chapter-${pad(ch.number)}-${label}.pdf`;
    await writeChapterPdf(src, ch.startPage, ch.endPage, path.join(pdfDir, pdfFile), `${ch.title} · ${s.bookTitle}`);

    const notes = userNotes ?? (p.kind === 'new' || !p.textChanged ? undefined : s.revised(p.diff.added, p.diff.removed));
    data.title = ch.title;
    // Keep a hand-written excerpt; refresh one that was auto-generated from the old text
    if (!data.excerpt || (p.entry && data.excerpt === makeExcerpt(p.entry.body))) data.excerpt = makeExcerpt(ch.body);
    data.status = 'published';
    data.published = p.kind === 'updated' ? ymd(data.published) : today;
    data.versions = [
      { label, date: today, file: `/pdfs/${lang}/${pdfFile}`, ...(notes ? { notes } : {}) },
      ...versions.map((v) => ({ ...v, date: ymd(v.date) })),
    ];

    const mdFile = p.entry?.file ?? `${pad(ch.number)}-${slugify(ch.title) || 'chapter'}.md`;
    await writeFile(path.join(chaptersDir, mdFile), stringifyMd(data, ch.body));
    written.push(`src/content/chapters/${lang}/${mdFile}`, `public/pdfs/${lang}/${pdfFile}`);
  }

  // Full-book edition for this language
  const others = allEditions.filter((e) => !e.sample && (e.lang ?? 'en') !== lang);
  const mine = allEditions.filter((e) => !e.sample && (e.lang ?? 'en') === lang);
  const n = mine.length + 1;
  const editionFile = `read-my-book-early-reader-v${n}.pdf`;
  await copyFile(file, path.join(pdfDir, editionFile));
  const numbers = book.chapters.map((ch) => ch.number);
  const changedList = changes.map((p) => p.ch.number).join(', ');
  const edition = {
    id: `${lang}-early-reader-v${n}`,
    lang,
    title: s.editionTitle(n),
    description: s.editionDescription(Math.min(...numbers), Math.max(...numbers)) + (n > 1 && changedList ? s.editionChanged(changedList) : ''),
    date: today,
    file: `/pdfs/${lang}/${editionFile}`,
    featured: true,
  };
  await writeEditions([
    edition,
    ...mine.map((e) => ({ ...e, lang, date: ymd(e.date), featured: false })),
    ...others.map((e) => ({ ...e, date: ymd(e.date) })),
  ]);
  written.push('src/content/editions.yaml', `public/pdfs/${lang}/${editionFile}`);

  console.log(c.green(`  Released ${changes.length} chapter change(s) + ${edition.title}.`));
  console.log(c.dim(written.map((w) => '    ' + w).join('\n')));
  return result;
}

// ---------- main ----------
// Read every PDF first, so a mistake (two English PDFs) stops before anything is written
const prepared = [];
for (const input of await inputs()) {
  const bytes = await readFile(input.file);
  const book = await extractBook(bytes, { lang: input.lang });
  const dup = prepared.find((x) => x.book.lang === book.lang);
  if (dup) {
    fail(
      `${path.basename(dup.file)} and ${path.basename(input.file)} both look like ${LANGS[book.lang].label}.\n` +
        'Pass one PDF per language, put them in manuscript/en/ and manuscript/pt/, or set --lang.',
    );
  }
  prepared.push({ ...input, bytes, book });
}
const results = [];
for (const input of prepared) results.push(await release(input));

// Which chapters exist in one language but not another (based on what's now on the site)
const onSite = {};
for (const lang of LANG_CODES) {
  const chs = (await loadChapters(path.join(CHAPTERS_ROOT, lang))).filter((e) => !e.data.sample && e.data.status === 'published');
  // in a dry run, count what this release would add
  const r = results.find((x) => x.lang === lang);
  const nums = new Set([...chs.map((e) => e.data.number), ...(dryRun && r ? r.chapters.map((ch) => ch.number) : [])]);
  onSite[lang] = nums;
}
const all = [...new Set(Object.values(onSite).flatMap((s) => [...s]))].sort((a, b) => a - b);
for (const lang of LANG_CODES) {
  const behind = all.filter((n) => !onSite[lang].has(n));
  if (onSite[lang].size && behind.length) {
    console.log(c.yellow(`\n${LANGS[lang].label} is missing chapter(s) ${behind.join(', ')} that exist in another language.`));
  }
}

console.log(
  dryRun
    ? c.bold('\nDry run. Nothing was written.\n')
    : `\nNext: preview with ${c.bold('npm run dev')}, then commit and push to deploy.\n`,
);
