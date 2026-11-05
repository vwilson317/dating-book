#!/usr/bin/env node
// Records the audiobook: one MP3 per published chapter, per language, narrated by OpenAI's
// text-to-speech with the (sarcastic) direction in scripts/narration/config.mjs.
//
//   npm run narrate                    # record chapters that are new or changed
//   npm run narrate -- --dry-run       # show what would be recorded and roughly what it costs
//   npm run narrate -- --lang pt       # only Portuguese
//   npm run narrate -- --chapter 3     # only chapter 3 (in every language, unless --lang is given)
//   npm run narrate -- --force         # re-record even if nothing changed
//
// Also runs before every `npm run build` (the "prebuild" script). Without OPENAI_API_KEY it records
// nothing, lists what's missing, and lets the build carry on with the audio that's already committed.
// Set NARRATE=off to skip it entirely.
//
// Output: public/audio/<lang>/<NN>-<hash>.mp3 plus src/content/audio.json, which the site reads.
// A chapter is re-recorded only when its spoken text, the voice, or the direction changes.
import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import YAML from 'yaml';
import { MODEL, NARRATION, SAMPLE_RATE, BITRATE_KBPS } from './narration/config.mjs';
import { chunkChapter } from './narration/text.mjs';
import { t } from '../src/i18n/ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAPTERS_ROOT = path.join(ROOT, 'src/content/chapters');
const AUDIO_ROOT = path.join(ROOT, 'public/audio');
const MANIFEST = path.join(ROOT, 'src/content/audio.json');
const CONCURRENCY = 4;

if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

// ---------- args ----------
const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const onlyLang = valueOf('--lang');
const onlyChapter = valueOf('--chapter') !== undefined ? Number(valueOf('--chapter')) : undefined;
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

if (process.env.NARRATE === 'off') {
  console.log(c.dim('narrate: skipped (NARRATE=off)'));
  process.exit(0);
}
if (onlyLang && !(onlyLang in NARRATION)) fail(`--lang must be one of: ${Object.keys(NARRATION).join(', ')}`);

function fail(msg) {
  console.error(c.red(msg));
  process.exit(1);
}

// ---------- chapters ----------
async function loadChapters() {
  const out = [];
  for (const lang of Object.keys(NARRATION)) {
    const dir = path.join(CHAPTERS_ROOT, lang);
    if (!existsSync(dir)) continue;
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()) {
      const raw = await readFile(path.join(dir, file), 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!m) continue;
      const data = YAML.parse(m[1]);
      if ((data.status ?? 'published') !== 'published') continue;
      const label = data.label ?? t(lang).chapter(data.number);
      const cfg = NARRATION[lang];
      const intro = cfg.intro.replace('{label}', label).replace('{title}', data.title);
      const chunks = chunkChapter(intro, m[2]);
      const hash = createHash('sha256')
        .update(JSON.stringify({ MODEL, voice: cfg.voice, direction: cfg.direction, chunks, BITRATE_KBPS }))
        .digest('hex')
        .slice(0, 10);
      out.push({ lang, number: data.number, title: data.title, label, chunks, hash, key: `${lang}:${data.number}` });
    }
  }
  return out;
}

// ---------- OpenAI ----------
async function speak(text, cfg) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, voice: cfg.voice, input: text, instructions: cfg.direction, response_format: 'pcm' }),
    }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }));
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
    }
    const detail = (await res.text()).slice(0, 300);
    const retryable = res.status === 0 || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 5) throw new Error(`OpenAI ${res.status}: ${detail}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
  }
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

async function encodeMp3(parts) {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(1, SAMPLE_RATE, BITRATE_KBPS);
  const out = [];
  const BLOCK = 1152 * 20;
  for (const pcm of parts) {
    for (let i = 0; i < pcm.length; i += BLOCK) {
      const buf = enc.encodeBuffer(pcm.subarray(i, i + BLOCK));
      if (buf.length) out.push(Buffer.from(buf));
    }
  }
  out.push(Buffer.from(enc.flush()));
  return Buffer.concat(out);
}

async function record(ch) {
  const cfg = NARRATION[ch.lang];
  let done = 0;
  const pcms = await pool(ch.chunks, CONCURRENCY, async (chunk) => {
    const pcm = await speak(chunk.text, cfg);
    process.stdout.write(`\r  ${ch.key} ${c.dim(`${++done}/${ch.chunks.length} parts`)}   `);
    return pcm;
  });
  const parts = pcms.flatMap((pcm, i) => [pcm, new Int16Array(Math.round(ch.chunks[i].pauseAfter * SAMPLE_RATE))]);
  const samples = parts.reduce((n, p) => n + p.length, 0);
  const mp3 = await encodeMp3(parts);
  return { mp3, duration: Math.round(samples / SAMPLE_RATE) };
}

// ---------- main ----------
const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
const chapters = await loadChapters();
const wanted = chapters.filter(
  (ch) => (!onlyLang || ch.lang === onlyLang) && (onlyChapter === undefined || ch.number === onlyChapter),
);
const todo = wanted.filter((ch) => force || manifest[ch.key]?.hash !== ch.hash || !existsSync(path.join(ROOT, 'public', manifest[ch.key].file)));

const chars = todo.reduce((n, ch) => n + ch.chunks.reduce((m, k) => m + k.text.length, 0), 0);
const minutes = chars / 900; // ~150 words a minute, ~6 characters a word
console.log(
  c.bold('narrate: ') +
    (todo.length
      ? `${todo.length} chapter(s) to record, about ${Math.round(minutes)} min of audio (~$${(minutes * 0.015).toFixed(2)})`
      : `all ${wanted.length} chapter(s) up to date`),
);
for (const ch of todo) {
  const why = manifest[ch.key] ? 'changed' : 'new';
  console.log(`  ${ch.key.padEnd(6)} ${ch.label}: ${ch.title} ${c.dim(`(${why}, ${ch.chunks.length} parts)`)}`);
}

if (!todo.length || dryRun) await prune();
else if (!apiKey) {
  console.log(c.yellow('  OPENAI_API_KEY is not set, so nothing was recorded. Chapters without audio just show no player.'));
  console.log(c.dim('  Put the key in .env and run `npm run narrate`, then commit public/audio and src/content/audio.json.'));
  await prune();
} else {
  let failed = 0;
  for (const ch of todo) {
    try {
      const { mp3, duration } = await record(ch);
      const file = `/audio/${ch.lang}/${String(ch.number).padStart(2, '0')}-${ch.hash}.mp3`;
      await mkdir(path.join(AUDIO_ROOT, ch.lang), { recursive: true });
      await writeFile(path.join(ROOT, 'public', file), mp3);
      manifest[ch.key] = { file, hash: ch.hash, duration, bytes: mp3.length, voice: NARRATION[ch.lang].voice, model: MODEL, recorded: new Date().toISOString().slice(0, 10) };
      await saveManifest(); // after every chapter, so an interrupted run keeps what it finished
      const mmss = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
      console.log(`\r  ${c.green('✓')} ${ch.key.padEnd(6)} ${mmss}  ${(mp3.length / 1e6).toFixed(1)} MB  ${c.dim(file)}`);
    } catch (err) {
      failed++;
      console.log(`\r  ${c.red('✗')} ${ch.key.padEnd(6)} ${err.message}`);
    }
  }
  await prune();
  if (failed) fail(`narrate: ${failed} chapter(s) failed. Run it again to retry just those.`);
}

/** Drop audio for chapters that no longer exist, and MP3s nothing points to anymore. */
async function prune() {
  if (dryRun) return;
  const live = new Set(chapters.map((ch) => ch.key));
  for (const key of Object.keys(manifest)) if (!live.has(key)) delete manifest[key];
  await saveManifest();
  const keep = new Set(Object.values(manifest).map((e) => path.join(ROOT, 'public', e.file)));
  for (const lang of existsSync(AUDIO_ROOT) ? await readdir(AUDIO_ROOT) : []) {
    for (const f of await readdir(path.join(AUDIO_ROOT, lang))) {
      const p = path.join(AUDIO_ROOT, lang, f);
      if (f.endsWith('.mp3') && !keep.has(p)) await unlink(p);
    }
  }
}

async function saveManifest() {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => {
      const [la, na] = a.split(':');
      const [lb, nb] = b.split(':');
      return la.localeCompare(lb) || Number(na) - Number(nb);
    }),
  );
  const json = JSON.stringify(sorted, null, 2) + '\n';
  if (!existsSync(MANIFEST) || (await readFile(MANIFEST, 'utf8')) !== json) await writeFile(MANIFEST, json);
}
