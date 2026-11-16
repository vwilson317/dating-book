#!/usr/bin/env node
// Turns raw video files into Journal posts. No editing needed: export from your phone or editor,
// drop the file in videos/<lang>/, run this, commit, push.
//
//   npm run video               # process new or changed files in videos/en/, videos/pt/, videos/es/
//   npm run video -- --dry-run  # show what would happen
//   npm run video -- --force    # re-encode everything
//
// File names: an optional chapter number first links the video to that chapter.
//   09-the-night-it-rained.mov    -> /journal/the-night-it-rained/, shown on chapter 9
//   01+09-rain-again.mp4          -> shown on chapters 1 and 9
//   carnival-recap.mp4            -> no chapter
// Optional files with the same name next to the video:
//   the-night-it-rained.jpg/.png  -> used as the poster instead of a frame picked from the video
//   the-night-it-rained.srt/.vtt  -> captions
//
// For each video it:
//   1. Converts it to an MP4 every phone and browser plays (H.264 + AAC, up to 1080p, starts playing
//      before it has fully downloaded), keeping sound in sync, turned the right way up, and small
//      enough for GitHub (each file under 100 MB).
//   2. Picks a poster frame, reads the length and whether it's landscape or portrait.
//   3. Writes public/video/<lang>/<slug>.mp4 (+ .jpg, .vtt) and creates the post in
//      src/content/journal/<lang>/<slug>.md, or updates the video details of an existing post
//      (your title, excerpt and text are kept).
//
// Where the MP4 goes:
//   - By default, in the site itself (public/video/), committed with everything else. GitHub caps files
//     at 100 MB, so longer videos get squeezed: fine up to ~10 min at 720p, soft beyond that.
//   - With Cloudflare R2 set up in .env (see README → Journal), full quality on R2 instead, any length.
//     The poster and captions stay in the site. Same command, nothing else changes.
// Needs ffmpeg installed: Mac `brew install ffmpeg`, Windows `winget install ffmpeg`.
import { readFile, writeFile, readdir, mkdir, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import YAML from 'yaml';
import { t, LANGS, DEFAULT_LANG } from '../src/i18n/ui.ts';
import { r2FromEnv, upload } from './video/r2.mjs';

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '.env'));
} catch {
  /* no .env: videos go in the site */
}
const r2 = r2FromEnv();

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const INBOX = path.join(ROOT, 'videos');
const OUT_ROOT = path.join(ROOT, 'public/video');
const POSTS_ROOT = path.join(ROOT, 'src/content/journal');
const CHAPTERS_ROOT = path.join(ROOT, 'src/content/chapters');
const LANG_CODES = Object.keys(LANGS);
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.avi'];
const MAX_BYTES = 95 * 1024 * 1024; // GitHub refuses files over 100 MB

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const clock = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(Math.round(s % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
const slugify = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- ffmpeg ----------
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
async function ffmpeg(argv) {
  try {
    return await run(FFMPEG, ['-hide_banner', ...argv], { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(c.red('ffmpeg is not installed.') + '\n  Mac: brew install ffmpeg\n  Windows: winget install ffmpeg\n  Linux: sudo apt install ffmpeg');
      process.exit(1);
    }
    throw err;
  }
}

/** Length, size (as displayed, after phone rotation) and whether there's sound */
async function probe(file) {
  // ffmpeg with no output prints the file's details and exits with an error; that's expected
  const { stderr } = await ffmpeg(['-i', file]).catch((e) => e);
  const dur = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const size = stderr.match(/Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/);
  const rotation = Number(stderr.match(/rotation of (-?[\d.]+) degrees/)?.[1] ?? stderr.match(/rotate\s*:\s*(-?\d+)/)?.[1] ?? 0);
  if (!dur || !size) throw new Error(`Couldn't read ${path.basename(file)} as a video.`);
  let [w, h] = [Number(size[1]), Number(size[2])];
  if (Math.abs(rotation) % 180 === 90) [w, h] = [h, w];
  return {
    duration: Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]),
    width: w,
    height: h,
    audio: /Stream #[^\n]*Audio:/.test(stderr),
  };
}

/** Bitrate cap (kbps) so the whole file fits under MAX_BYTES, and the resolution that suits it.
 * On R2 there's no size limit, so always 1080p at full quality. */
function budget(duration, audio) {
  const audioKbps = audio ? 128 : 0;
  if (r2) return { videoKbps: 6000, height: 1080, audioKbps };
  const totalKbps = (MAX_BYTES * 8) / 1000 / duration;
  const videoKbps = Math.floor((totalKbps - audioKbps) * 0.9); // margin for container overhead
  const height = videoKbps >= 2500 ? 1080 : 720;
  return { videoKbps: Math.min(videoKbps, height === 1080 ? 6000 : 3000), height, audioKbps };
}

async function encode(src, out, info, scale = 1) {
  const { videoKbps, height, audioKbps } = budget(info.duration, info.audio);
  const cap = Math.floor(videoKbps * scale);
  // Long side at most `height` (1080 or 720), never upscaled. ffmpeg has already turned phone video upright here.
  const vf = `scale=w='if(gte(iw,ih),-2,min(${height},iw))':h='if(gte(iw,ih),min(${height},ih),-2)'`;
  await ffmpeg([
    '-y', '-i', src,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-maxrate', `${cap}k`, '-bufsize', `${cap * 2}k`,
    '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    ...(info.audio
      ? ['-c:a', 'aac', '-b:a', `${audioKbps}k`, '-ac', '2', '-ar', '48000', '-af', 'aresample=async=1'] // keeps sound lined up with the picture
      : []),
    '-movflags', '+faststart', // the browser can start playing before the whole file arrives
    out,
  ]);
  return { cap, height };
}

async function makePoster(video, custom, out, duration) {
  const vf = `scale=w='if(gte(iw,ih),min(1280,iw),-2)':h='if(gte(iw,ih),-2,min(1280,ih))'`;
  if (custom) {
    await ffmpeg(['-y', '-i', custom, '-vf', vf, '-q:v', '3', out]);
    return;
  }
  // Look a little way in (past fades and intros) and let ffmpeg pick the most typical frame nearby
  const at = Math.min(Math.max(duration * 0.15, 1), Math.max(duration - 2, 0));
  await ffmpeg(['-y', '-ss', at.toFixed(2), '-i', video, '-vf', `thumbnail=90,${vf}`, '-frames:v', '1', '-q:v', '3', out]);
}

// ---------- posts ----------
function parseMd(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { data: YAML.parse(m[1]) ?? {}, body: m[2].trim() } : { data: {}, body: src.trim() };
}
function stringifyMd(data, body) {
  const order = ['title', 'excerpt', 'published', 'status', 'chapters', 'location', 'cover', 'video'];
  const ordered = {};
  for (const k of order) if (data[k] !== undefined) ordered[k] = data[k];
  for (const k of Object.keys(data)) if (!(k in ordered)) ordered[k] = data[k];
  return `---\n${YAML.stringify(ordered, { lineWidth: 0 }).trim()}\n---\n\n${body.trim()}\n`;
}
async function chapterNumbers(lang) {
  const dir = path.join(CHAPTERS_ROOT, lang);
  if (!existsSync(dir)) return new Set();
  const nums = new Set();
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.md')) continue;
    const n = Number((await readFile(path.join(dir, f), 'utf8')).match(/^number:\s*(\d+)/m)?.[1]);
    if (!Number.isNaN(n)) nums.add(n);
  }
  return nums;
}

/** "09-the-night-it-rained" -> { chapters: [9], slug: "the-night-it-rained", title: "The night it rained" } */
function parseName(base) {
  const m = base.match(/^(\d{1,2}(?:\+\d{1,2})*)[-_ ]+(.+)$/);
  const rest = m ? m[2] : base;
  const words = rest.replace(/[-_]+/g, ' ').trim();
  return {
    chapters: m ? m[1].split('+').map(Number) : [],
    slug: slugify(rest),
    title: words.charAt(0).toUpperCase() + words.slice(1),
  };
}

const sibling = (dir, base, exts) => exts.map((e) => path.join(dir, base + e)).find((f) => existsSync(f));

// ---------- main ----------
async function sources() {
  const found = [];
  const scan = async (dir, lang) => {
    if (!existsSync(dir)) return;
    for (const f of (await readdir(dir)).sort()) {
      if (VIDEO_EXT.includes(path.extname(f).toLowerCase())) found.push({ file: path.join(dir, f), dir, lang });
    }
  };
  for (const lang of LANG_CODES) await scan(path.join(INBOX, lang), lang);
  await scan(INBOX, DEFAULT_LANG); // a video dropped straight into videos/ is English
  return found;
}

const list = await sources();
if (!list.length) {
  console.log(`No videos found. Put them in videos/<lang>/ (${LANG_CODES.join(', ')}), then run npm run video.`);
  process.exit(0);
}

const UPLOADED = path.join(INBOX, '.out', 'uploaded.json');
const uploaded = existsSync(UPLOADED) ? JSON.parse(await readFile(UPLOADED, 'utf8')) : {};
console.log(c.dim(r2 ? `Videos go to R2 (${r2.publicUrl}).` : 'Videos go in the site (public/video/). Set up R2 in .env for long videos.'));

const chapterSets = Object.fromEntries(await Promise.all(LANG_CODES.map(async (l) => [l, await chapterNumbers(l)])));
let changed = 0;

for (const { file, dir, lang } of list) {
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const { chapters, slug, title } = parseName(base);
  const outDir = path.join(OUT_ROOT, lang);
  // On R2 the MP4 is built in videos/.out/ (not committed) and uploaded; posters and captions stay in the site
  const mp4 = r2 ? path.join(INBOX, '.out', lang, `${slug}.mp4`) : path.join(outDir, `${slug}.mp4`);
  const jpg = path.join(outDir, `${slug}.jpg`);
  const vtt = path.join(outDir, `${slug}.vtt`);
  const postFile = path.join(POSTS_ROOT, lang, `${slug}.md`);
  const posterSrc = sibling(dir, base, ['.jpg', '.jpeg', '.png', '.webp']);
  const captionSrc = sibling(dir, base, ['.vtt', '.srt']);
  const webPath = (f) => `/video/${lang}/${path.basename(f)}`;

  console.log(`\n${c.bold(`[${lang.toUpperCase()}]`)} ${c.bold(path.basename(file))} ${c.dim(`→ /journal/${slug}/`)}`);
  const unknown = chapters.filter((n) => !chapterSets[lang].has(n));
  if (unknown.length) console.log(c.yellow(`  No ${LANGS[lang].label} chapter ${unknown.join(', ')}: it'll link once that chapter exists.`));

  const srcTime = (await stat(file)).mtimeMs;
  const fresh = existsSync(mp4) && (await stat(mp4)).mtimeMs >= srcTime && !force;
  const info = await probe(file);
  const orientation = info.height > info.width ? 'portrait' : 'landscape';

  if (dryRun) {
    const { videoKbps, height } = budget(info.duration, info.audio);
    console.log(`  ${fresh ? 'unchanged' : 'would encode'} · ${clock(info.duration)} · ${orientation} · ${height}p up to ${videoKbps} kbps${info.audio ? '' : ' · no sound'}`);
    continue;
  }
  await mkdir(outDir, { recursive: true });
  await mkdir(path.dirname(mp4), { recursive: true });

  if (!fresh) {
    process.stdout.write(c.dim(`  Converting (${clock(info.duration)} of video, this can take a while)… `));
    let { cap, height } = await encode(file, mp4, info);
    // CRF can still overshoot on very busy footage; squeeze once more if it did
    if ((await stat(mp4)).size > MAX_BYTES) ({ cap, height } = await encode(file, mp4, info, 0.75));
    console.log(c.dim(`done, ${height}p`));
    if (cap < 900) console.log(c.yellow(`  Long video: squeezed to ${cap} kbps to stay under GitHub's 100 MB limit, so the picture may look soft. See README → Journal for hosting long videos elsewhere.`));
    changed++;
  }
  const size = (await stat(mp4)).size;
  if (!r2 && size > 100 * 1024 * 1024) console.log(c.red(`  ${mb(size)} is over GitHub's 100 MB limit and can't be pushed.`));

  let src = webPath(mp4);
  if (r2) {
    const key = `${lang}/${slug}.mp4`;
    const record = uploaded[key];
    const mtime = (await stat(mp4)).mtimeMs;
    if (!record || record.mtime !== mtime || record.size !== size) {
      process.stdout.write(c.dim(`  Uploading ${mb(size)} to R2… `));
      await upload(r2, mp4, key, 'video/mp4');
      uploaded[key] = { mtime, size };
      await writeFile(UPLOADED, JSON.stringify(uploaded, null, 2));
      console.log(c.dim('done'));
      changed++;
    }
    src = `${r2.publicUrl}/${key}`;
    const old = path.join(outDir, `${slug}.mp4`);
    if (existsSync(old)) console.log(c.yellow(`  Now served from R2: you can delete ${path.relative(ROOT, old)}.`));
  }

  if (!fresh || !existsSync(jpg) || (posterSrc && (await stat(posterSrc)).mtimeMs > (await stat(jpg)).mtimeMs)) {
    await makePoster(mp4, posterSrc, jpg, info.duration);
  }
  if (captionSrc && (!existsSync(vtt) || (await stat(captionSrc)).mtimeMs > (await stat(vtt)).mtimeMs)) {
    if (captionSrc.endsWith('.vtt')) await copyFile(captionSrc, vtt);
    else await ffmpeg(['-y', '-i', captionSrc, vtt]);
  }

  const out = await probe(mp4);
  const video = {
    src,
    poster: webPath(jpg),
    duration: Math.round(out.duration),
    orientation: out.height > out.width ? 'portrait' : 'landscape',
    ...(existsSync(vtt) ? { captions: webPath(vtt) } : {}),
  };

  // Create the post, or bring an existing one's video details up to date (keeping everything you wrote)
  let data, body, verb;
  if (existsSync(postFile)) {
    ({ data, body } = parseMd(await readFile(postFile, 'utf8')));
    data.video = { ...(data.video ?? {}), ...video };
    data.chapters = [...new Set([...(data.chapters ?? []), ...chapters])].sort((a, b) => a - b);
    verb = 'updated';
  } else {
    data = { title, excerpt: t(lang).videoExcerpt, published: today(), status: 'published', chapters: [...chapters].sort((a, b) => a - b), video };
    body = '';
    verb = 'created';
  }
  if (!data.chapters?.length) delete data.chapters;
  const next = stringifyMd(data, body);
  const prev = existsSync(postFile) ? await readFile(postFile, 'utf8') : '';
  if (next !== prev) {
    await mkdir(path.dirname(postFile), { recursive: true });
    await writeFile(postFile, next);
    changed++;
  } else verb = 'unchanged';

  console.log(
    `  ${verb === 'unchanged' ? c.dim('unchanged') : c.green(verb)} ${path.relative(ROOT, postFile)} · ${clock(video.duration)} · ${video.orientation} · ${mb(size)}` +
      (data.chapters?.length ? ` · chapter ${data.chapters.join(', ')}` : '') +
      (video.captions ? ' · captions' : ''),
  );
  if (verb === 'created') console.log(c.dim(`  Optional: change the title or excerpt, or add text under the video, in that file.`));
}

console.log(
  dryRun
    ? c.bold('\nDry run. Nothing was written.')
    : changed
      ? `\nNext: preview with ${c.bold('npm run dev')} (open /journal/), then commit and push to deploy.`
      : '\nEverything is up to date.',
);
