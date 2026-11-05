#!/usr/bin/env node
// Connects the audiobook MP3s you put in the repo to their chapters.
//
//   npm run audio                # index public/audio/ (also runs before every build)
//   npm run audio -- --export    # write each chapter's narration text to narration/<lang>/, ready to
//                                # paste into ElevenLabs (no Markdown, title read out first)
//
// Put one MP3 per chapter in public/audio/en/ or public/audio/pt/, named starting with the chapter
// number: 01.mp3, 1.mp3, 01-how-i-met-my-wife.mp3 all work. The introduction is 00.mp3.
//
// Indexing writes src/content/audio.json, which the site reads: each file's duration and a content
// hash (so readers get the new file when you replace one). It also warns about chapters with no
// audio, files that don't match a chapter, and chapters whose text changed after their audio was added.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import YAML from 'yaml';
import { narrationScript } from './audio-text.mjs';
import { t, LANGS } from '../src/i18n/ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAPTERS_ROOT = path.join(ROOT, 'src/content/chapters');
const AUDIO_ROOT = path.join(ROOT, 'public/audio');
const MANIFEST = path.join(ROOT, 'src/content/audio.json');
const EXPORT_ROOT = path.join(ROOT, 'narration');
const LANG_CODES = Object.keys(LANGS);

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};
const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => `${Math.floor(s / 60)}:${pad(Math.round(s % 60))}`;

// ---------- chapters ----------
async function loadChapters() {
  const out = [];
  for (const lang of LANG_CODES) {
    const dir = path.join(CHAPTERS_ROOT, lang);
    if (!existsSync(dir)) continue;
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()) {
      const raw = await readFile(path.join(dir, file), 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!m) continue;
      const data = YAML.parse(m[1]);
      if ((data.status ?? 'published') !== 'published') continue;
      const label = data.label ?? t(lang).chapter(data.number);
      const script = narrationScript(label, data.title, m[2]);
      out.push({ lang, number: data.number, title: data.title, label, file, script, textHash: sha(script), key: `${lang}:${data.number}` });
    }
  }
  return out;
}

// ---------- MP3 duration (walks the frame headers; no dependencies) ----------
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG-2/2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function mp3Duration(buf) {
  let i = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') {
    i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  }
  let seconds = 0;
  let frames = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) {
      i++;
      continue;
    }
    const version = (buf[i + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    const layer = (buf[i + 1] >> 1) & 3; // 1 = Layer III
    const brIdx = buf[i + 2] >> 4;
    const srIdx = (buf[i + 2] >> 2) & 3;
    const padding = (buf[i + 2] >> 1) & 1;
    if (version === 1 || layer !== 1 || brIdx === 0 || brIdx === 15 || srIdx === 3) {
      i++;
      continue;
    }
    const bitrate = BITRATES[version === 3 ? 1 : 2][brIdx] * 1000;
    const rate = RATES[version][srIdx];
    const samples = version === 3 ? 1152 : 576;
    const length = Math.floor(((samples / 8) * bitrate) / rate) + padding;
    seconds += samples / rate;
    frames++;
    i += length;
  }
  return frames ? seconds : 0;
}

// ---------- export ----------
async function exportScripts(chapters) {
  for (const ch of chapters) {
    const dir = path.join(EXPORT_ROOT, ch.lang);
    await mkdir(dir, { recursive: true });
    const name = `${pad(ch.number)}-${ch.file.replace(/^\d+-/, '').replace(/\.md$/, '')}.txt`;
    await writeFile(path.join(dir, name), ch.script);
  }
  const chars = chapters.reduce((n, ch) => n + ch.script.length, 0);
  console.log(c.bold('audio: ') + `wrote ${chapters.length} narration scripts to narration/ (${chars.toLocaleString()} characters in total)`);
  console.log(c.dim('  Save each recording as public/audio/<lang>/<number>.mp3, then run `npm run audio`.'));
}

// ---------- index ----------
async function index(chapters) {
  const old = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
  const byKey = new Map(chapters.map((ch) => [ch.key, ch]));
  const manifest = {};
  const notes = [];

  for (const lang of LANG_CODES) {
    const dir = path.join(AUDIO_ROOT, lang);
    if (!existsSync(dir)) continue;
    for (const f of (await readdir(dir)).sort()) {
      if (f.startsWith('.')) continue;
      const num = f.match(/\d+/)?.[0];
      const ch = num !== undefined ? byKey.get(`${lang}:${Number(num)}`) : undefined;
      if (!/\.mp3$/i.test(f)) {
        notes.push(c.yellow(`  ${lang}/${f}: only MP3 files are used. In ElevenLabs, download as MP3.`));
        continue;
      }
      if (!ch) {
        notes.push(c.yellow(`  ${lang}/${f}: no published ${LANGS[lang].label} chapter ${num ?? '(no number in the name)'}. Name it after the chapter number, e.g. 03.mp3.`));
        continue;
      }
      if (manifest[ch.key]) {
        notes.push(c.yellow(`  ${lang}/${f}: chapter ${ch.number} already has ${manifest[ch.key].file.split('?')[0].split('/').pop()}; ignoring this one.`));
        continue;
      }
      const buf = await readFile(path.join(dir, f));
      const hash = sha(buf);
      const prev = old[ch.key];
      const sameFile = prev?.hash === hash;
      const duration = Math.round(mp3Duration(buf));
      if (!duration) {
        notes.push(c.yellow(`  ${lang}/${f}: couldn't read this as an MP3; skipped.`));
        continue;
      }
      manifest[ch.key] = {
        file: `/audio/${lang}/${encodeURIComponent(f)}?v=${hash}`,
        hash,
        duration,
        bytes: buf.length,
        // the chapter text this recording was made from, to spot chapters revised since
        textHash: sameFile ? prev.textHash : ch.textHash,
        added: sameFile ? prev.added : new Date().toISOString().slice(0, 10),
      };
      if (!sameFile) notes.push(`  ${c.green(prev ? '↻' : '+')} ${ch.key.padEnd(6)} ${clock(duration)}  ${ch.label}: ${ch.title}`);
      else if (prev.textHash !== ch.textHash) {
        notes.push(c.yellow(`  ! ${ch.key.padEnd(6)} ${ch.label}'s text changed after its audio was added. Re-record it (npm run audio -- --export has the new text).`));
      }
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => {
      const [la, na] = a.split(':');
      const [lb, nb] = b.split(':');
      return la.localeCompare(lb) || Number(na) - Number(nb);
    }),
  );
  const json = JSON.stringify(sorted, null, 2) + '\n';
  if (!existsSync(MANIFEST) || (await readFile(MANIFEST, 'utf8')) !== json) await writeFile(MANIFEST, json);

  const missing = chapters.filter((ch) => !manifest[ch.key]);
  const total = Object.values(manifest).reduce((n, e) => n + e.duration, 0);
  console.log(c.bold('audio: ') + `${Object.keys(manifest).length} of ${chapters.length} chapters have audio (${clock(total)} total)`);
  for (const n of notes) console.log(n);
  for (const lang of LANG_CODES) {
    const list = missing.filter((ch) => ch.lang === lang).map((ch) => ch.number);
    if (list.length) console.log(c.dim(`  ${LANGS[lang].label} without audio: ${list.join(', ')}`));
  }
}

const chapters = await loadChapters();
if (process.argv.includes('--export')) await exportScripts(chapters);
else await index(chapters);
