#!/usr/bin/env node
// Release a new version of the book from one full-manuscript PDF.
//
//   npm run release -- ~/Downloads/book.pdf            # apply
//   npm run release -- ~/Downloads/book.pdf --dry-run  # just show what would change
//   npm run release -- book.pdf --notes "Rewrote the ending of ch. 4"
//
// With no path, it uses the newest PDF in manuscript/.
//
// What it does:
//   1. Splits the PDF into chapters (by "Chapter N" headings).
//   2. Compares each chapter's text with what's on the site now.
//   3. New chapters: creates the Markdown file + chapter PDF (v1).
//      Changed chapters: replaces the text, adds the next version (v2, v3...) with its own PDF.
//      Unchanged chapters: left alone.
//   4. Adds the full PDF as a new Early Reader Edition on the downloads page.
import { readFile, writeFile, readdir, mkdir, unlink, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import YAML from 'yaml';
import { diffWords } from 'diff';
import { extractBook, plainText } from './release/extract.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAPTERS_DIR = path.join(ROOT, 'src/content/chapters');
const EDITIONS_FILE = path.join(ROOT, 'src/content/editions.yaml');
const PDF_DIR = path.join(ROOT, 'public/pdfs');
const INBOX = path.join(ROOT, 'manuscript');
const BOOK_TITLE = 'Read My Book: Misadventures of a Gringo Dating Abroad';

// ---------- args ----------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const notesIdx = args.indexOf('--notes');
const userNotes = notesIdx >= 0 ? args[notesIdx + 1] : undefined;
let pdfPath = args.find((a, i) => !a.startsWith('--') && (notesIdx < 0 || i !== notesIdx + 1));

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

async function newestInbox() {
  if (!existsSync(INBOX)) return null;
  const pdfs = (await readdir(INBOX)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) return null;
  const withTimes = await Promise.all(pdfs.map(async (f) => ({ f, t: (await stat(path.join(INBOX, f))).mtimeMs })));
  return path.join(INBOX, withTimes.sort((a, b) => b.t - a.t)[0].f);
}

if (!pdfPath) pdfPath = await newestInbox();
if (!pdfPath || !existsSync(pdfPath)) {
  console.error('Usage: npm run release -- path/to/full-book.pdf [--dry-run] [--notes "what changed"]');
  console.error('(or drop the PDF into the manuscript/ folder and run without a path)');
  process.exit(1);
}

// ---------- helpers ----------
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const pad = (n) => String(n).padStart(2, '0');
const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
  out.setAuthor('Vincent Wilson');
  await writeFile(path.join(PDF_DIR, file), await out.save());
}

// ---------- load current site content ----------
async function loadChapters() {
  const files = (await readdir(CHAPTERS_DIR)).filter((f) => f.endsWith('.md'));
  return Promise.all(
    files.map(async (file) => {
      const { data, body } = parseMd(await readFile(path.join(CHAPTERS_DIR, file), 'utf8'));
      return { file, data, body };
    }),
  );
}

// ---------- main ----------
console.log(c.bold(`\nReading ${path.basename(pdfPath)}…`));
const bytes = await readFile(pdfPath);
const book = await extractBook(bytes);

if (!book.chapters.length) {
  console.error(c.red('\nNo chapters found. Each chapter needs to start on a new page with a heading like "Chapter 1" or "Chapter One".'));
  process.exit(1);
}
console.log(c.dim(`${book.numPages} pages, ${book.chapters.length} chapters found\n`));

const existing = await loadChapters();
const samples = existing.filter((e) => e.data.sample);
const real = existing.filter((e) => !e.data.sample);

const plan = []; // { kind: 'new'|'updated'|'unchanged'|'published', ch, entry?, ... }
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

// ---------- report ----------
for (const p of plan) {
  const label = `Chapter ${p.ch.number}: ${p.ch.title}`;
  const pages = c.dim(`(pp. ${p.ch.startPage + 1}–${p.ch.endPage + 1})`);
  if (p.kind === 'new') console.log(`${c.green('NEW      ')} ${label} ${pages}`);
  else if (p.kind === 'unchanged') console.log(`${c.dim('unchanged')} ${c.dim(label)}`);
  else {
    const tag = p.kind === 'published' ? c.green('PUBLISH  ') : c.yellow('UPDATED  ');
    const bits = [];
    if (p.titleChanged) bits.push(`title was "${p.entry.data.title}"`);
    if (p.textChanged) bits.push(`${c.green('+' + p.diff.added)} / ${c.red('−' + p.diff.removed)} words`);
    console.log(`${tag} ${label} ${pages} ${bits.join(', ')}`);
    for (const s of p.diff?.snippets ?? []) console.log(`            ${s}`);
  }
}
for (const m of missing) console.log(`${c.yellow('NOT IN PDF')} Chapter ${m.data.number}: ${m.data.title} ${c.dim('(left as is)')}`);
if (samples.length) console.log(c.dim(`\nPlaceholder sample chapters will be removed (${samples.length}).`));

const changes = plan.filter((p) => p.kind !== 'unchanged');
if (!changes.length && !samples.length) {
  console.log(c.bold('\nNo changes. Nothing to release.\n'));
  process.exit(0);
}
if (dryRun) {
  console.log(c.bold('\nDry run. Nothing was written.\n'));
  process.exit(0);
}

// ---------- apply ----------
// Remove placeholder samples (and their PDFs) on the first real release
const sampleEditions = (YAML.parse(existsSync(EDITIONS_FILE) ? await readFile(EDITIONS_FILE, 'utf8') : '') ?? []).filter((e) => e.sample);
for (const s of samples) {
  await unlink(path.join(CHAPTERS_DIR, s.file));
  for (const v of s.data.versions ?? []) await unlink(path.join(ROOT, 'public', v.file)).catch(() => {});
}
for (const e of sampleEditions) await unlink(path.join(ROOT, 'public', e.file)).catch(() => {});

await mkdir(PDF_DIR, { recursive: true });
const src = await PDFDocument.load(bytes);
const written = [];

for (const p of changes) {
  const { ch } = p;
  const data = p.entry ? { ...p.entry.data } : { number: ch.number };
  const versions = data.versions ?? [];
  const label = nextVersion(versions);
  const pdfFile = `chapter-${pad(ch.number)}-${label}.pdf`;
  await writeChapterPdf(src, ch.startPage, ch.endPage, pdfFile, `${ch.title} · ${BOOK_TITLE}`);

  const notes =
    userNotes ??
    (p.kind === 'new' || !p.textChanged
      ? undefined
      : `Revised: +${p.diff.added} / −${p.diff.removed} words`);

  data.title = ch.title;
  // Keep a hand-written excerpt; refresh one that was auto-generated from the old text
  if (!data.excerpt || (p.entry && data.excerpt === makeExcerpt(p.entry.body))) data.excerpt = makeExcerpt(ch.body);
  data.status = 'published';
  if (p.kind !== 'updated') data.published = today;
  else data.published = ymd(data.published);
  data.versions = [
    { label, date: today, file: `/pdfs/${pdfFile}`, ...(notes ? { notes } : {}) },
    ...versions.map((v) => ({ ...v, date: ymd(v.date) })),
  ];

  const file = p.entry?.file ?? `${pad(ch.number)}-${slugify(ch.title) || 'chapter'}.md`;
  await writeFile(path.join(CHAPTERS_DIR, file), stringifyMd(data, ch.body));
  written.push(`src/content/chapters/${file}`, `public/pdfs/${pdfFile}`);
}

// Full-book edition
const editionsSrc = existsSync(EDITIONS_FILE) ? await readFile(EDITIONS_FILE, 'utf8') : '';
let editions = (YAML.parse(editionsSrc) ?? []).filter((e) => !e.sample);
const editionNum = editions.length + 1;
let editionFile = `read-my-book-early-reader-v${editionNum}.pdf`;
await copyFile(pdfPath, path.join(PDF_DIR, editionFile));
const numbers = book.chapters.map((ch) => ch.number);
const changedList = changes.map((p) => p.ch.number).join(', ');
editions = [
  {
    id: `early-reader-v${editionNum}`,
    title: `Early Reader Edition (v${editionNum})`,
    description:
      `Chapters ${Math.min(...numbers)}–${Math.max(...numbers)} in one PDF.` +
      (editionNum > 1 && changedList ? ` New or revised: ${changedList}.` : ''),
    date: today,
    file: `/pdfs/${editionFile}`,
    featured: true,
  },
  ...editions.map((e) => ({ ...e, date: ymd(e.date), featured: false })),
];
await writeFile(
  EDITIONS_FILE,
  `# Full-book PDF downloads, newest first. \`npm run release\` adds to this automatically.\n` +
    `# The entry with \`featured: true\` is promoted on the home page.\n` +
    YAML.stringify(editions, { lineWidth: 0 }),
);
written.push('src/content/editions.yaml', `public/pdfs/${editionFile}`);

console.log(c.bold(`\nReleased ${changes.length} chapter change(s) + Early Reader Edition v${editionNum}.`));
console.log(c.dim(written.map((w) => '  ' + w).join('\n')));
console.log(`\nNext: preview with ${c.bold('npm run dev')}, then commit and push to deploy.\n`);
