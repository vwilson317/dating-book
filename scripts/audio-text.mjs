// Turns a chapter's Markdown into the plain text a narrator reads: no Markdown escapes,
// no asterisks, the title read out first, and scene breaks ("* * *") as a pause.

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

/** The whole chapter as narration text: "Chapter 3. Title." then the paragraphs. */
export function narrationScript(label, title, body) {
  const paragraphs = [`${label}. ${title}.`];
  for (const block of body.split(/\n\s*\n/)) {
    if (SCENE_BREAK.test(block)) {
      if (paragraphs.at(-1) !== '…') paragraphs.push('…');
      continue;
    }
    const text = speakable(block);
    if (text) paragraphs.push(text);
  }
  return paragraphs.join('\n\n') + '\n';
}
