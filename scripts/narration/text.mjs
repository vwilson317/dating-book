// Turns a chapter's Markdown into the text the narrator reads, split into API-sized chunks.
import { MAX_CHUNK_CHARS, PAUSE } from './config.mjs';

const SCENE_BREAK = /^\s*(\*\s*){3,}$|^\s*-{3,}\s*$|^\s*_{3,}\s*$/;

/** Markdown paragraph -> plain spoken text */
export function speakable(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> their text
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1') // markdown escapes: \[T\] -> [T]
    .replace(/\[([^\]]+)\]/g, '$1') // [T] (a name the author redacted) -> T
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a chapter into chunks of at most MAX_CHUNK_CHARS, breaking only between paragraphs
 * (or between sentences, for a paragraph that's too long on its own).
 * Returns [{ text, pauseAfter }], where pauseAfter is seconds of silence to add after the chunk.
 */
export function chunkChapter(intro, body) {
  const chunks = [{ text: intro, pauseAfter: PAUSE.afterIntro }];
  let current = [];
  let size = 0;
  const flush = (pauseAfter) => {
    if (current.length) chunks.push({ text: current.join('\n\n'), pauseAfter });
    current = [];
    size = 0;
  };

  for (const block of body.split(/\n\s*\n/)) {
    if (SCENE_BREAK.test(block)) {
      flush(PAUSE.sceneBreak);
      continue;
    }
    const text = speakable(block);
    if (!text) continue;
    for (const piece of splitLong(text)) {
      if (size && size + piece.length + 2 > MAX_CHUNK_CHARS) flush(PAUSE.paragraph);
      current.push(piece);
      size += piece.length + 2;
    }
  }
  flush(0);
  chunks.at(-1).pauseAfter = 0.8; // a little air at the very end
  return chunks;
}

function splitLong(text) {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const sentences = text.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) ?? [text];
  const out = [''];
  for (const s of sentences) {
    if (out.at(-1).length + s.length > MAX_CHUNK_CHARS && out.at(-1)) out.push('');
    out[out.length - 1] += s;
  }
  return out.map((s) => s.trim()).filter(Boolean);
}
