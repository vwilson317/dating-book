// Turns a full-book PDF into chapters: page ranges, titles, and Markdown text.
// Works with PDFs exported from Word, Google Docs, Pages, Scrivener, Vellum, etc.
// Assumes each chapter starts on a new page with a heading like "Chapter 3", "CHAPTER THREE",
// or "Chapter 3: Title". "Prologue" becomes chapter 0, "Epilogue" comes after the last chapter.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const CHAPTER_RE = /^\s*chapter\s+([0-9]+|[a-z][a-z\- ]*?)\s*(?:[:.\-–—]\s*(.*))?$/i;
const PROLOGUE_RE = /^\s*(prologue|preface|introduction)\s*(?:[:.\-–—]\s*(.*))?$/i;
const EPILOGUE_RE = /^\s*(epilogue|afterword)\s*(?:[:.\-–—]\s*(.*))?$/i;
// Back matter: everything from here on is left out of the last chapter.
const STOP_RE = /^\s*(acknowledge?ments?|about the author|also by|notes|bibliography)\s*$/i;
const SCENE_BREAK_RE = /^[\s*#~•·✦◆\-_=]+$/;

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function parseNumber(s) {
  s = s.trim().toLowerCase();
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(/[\s-]+/);
  let n = 0;
  for (const p of parts) {
    if (ONES.includes(p)) n += ONES.indexOf(p);
    else if (TENS.includes(p) && p) n += TENS.indexOf(p) * 10;
    else return null;
  }
  return parts.length ? n : null;
}

/** Returns { kind: 'chapter'|'prologue'|'epilogue', number, inlineTitle } or null */
function matchHeading(text) {
  let m = text.match(CHAPTER_RE);
  if (m) {
    const n = parseNumber(m[1]);
    if (n != null) return { kind: 'chapter', number: n, inlineTitle: (m[2] || '').trim() };
  }
  if ((m = text.match(PROLOGUE_RE))) return { kind: 'prologue', number: 0, inlineTitle: (m[2] || '').trim(), label: cap(m[1]) };
  if ((m = text.match(EPILOGUE_RE))) return { kind: 'epilogue', number: null, inlineTitle: (m[2] || '').trim(), label: cap(m[1]) };
  return null;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();

const isItalic = (font) => /italic|oblique|-it\b|ital/i.test(font);
const isBold = (font) => /bold|black|heavy|semibold|demi/i.test(font);

// ---------------------------------------------------------------------------

async function readPages(data) {
  const doc = await getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    await page.getOperatorList(); // loads fonts, so we can read real font names (for italics)
    const tc = await page.getTextContent();
    const fontStyle = (id) => {
      let f;
      try {
        f = page.commonObjs.get(id);
      } catch {
        return { italic: false, bold: false };
      }
      const name = [f?.name, f?.fallbackName, f?.loadedName].filter(Boolean).join(' ');
      return { italic: !!f?.italic || isItalic(name), bold: !!f?.bold || !!f?.black || isBold(name) };
    };
    const items = tc.items
      .filter((it) => 'str' in it && it.str.length)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        size: Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10 || it.height,
        width: it.width,
        ...fontStyle(it.fontName),
      }));
    pages.push({ index: i - 1, width: page.view[2], height: page.view[3], lines: groupLines(items) });
  }
  return pages;
}

function groupLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(2, it.size * 0.3));
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    const segs = [];
    let prevEnd = null;
    for (const it of l.items) {
      let str = it.str;
      // Insert a space when there's a visible gap between items that don't already have one
      if (prevEnd != null && it.x - prevEnd > it.size * 0.15 && !/\s$/.test(segs.at(-1)?.text ?? '') && !/^\s/.test(str)) {
        str = ' ' + str;
      }
      if (str.trim() === '' && !segs.length) continue;
      segs.push({ text: str, italic: it.italic, bold: it.bold });
      prevEnd = it.x + it.width;
    }
    const text = segs.map((s) => s.text).join('').replace(/\s+/g, ' ').trim();
    const x = l.items[0].x;
    const last = l.items.at(-1);
    return { y: l.y, x, xEnd: last.x + last.width, size: Math.max(...l.items.map((i) => i.size)), segs, text };
  }).filter((l) => l.text);
}

function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

// Lines that repeat at the top/bottom of many pages (book title, chapter running heads), and page numbers.
function findRunningLines(pages) {
  const norm = (t) => t.replace(/\d+/g, '#').toLowerCase();
  const counts = new Map();
  for (const p of pages) {
    const edge = [...p.lines.slice(0, 2), ...p.lines.slice(-2)];
    for (const l of new Set(edge.map((l) => norm(l.text)))) counts.set(l, (counts.get(l) || 0) + 1);
  }
  const threshold = Math.max(2, Math.floor(pages.length * 0.1));
  return new Set([...counts.entries()].filter(([, n]) => n >= threshold).map(([t]) => t));
}

function stripRunning(page, running, bodySize) {
  const norm = (t) => t.replace(/\d+/g, '#').toLowerCase();
  const n = page.lines.length;
  return page.lines.filter((l, i) => {
    const atEdge = i < 2 || i >= n - 2;
    if (!atEdge) return true;
    const inMargin = l.y > page.height * 0.9 || l.y < page.height * 0.1;
    if (/^(page\s*)?\d+$|^[ivxlc]+$/i.test(l.text)) return false; // page numbers
    if (running.has(norm(l.text)) && !matchHeading(l.text)) return false;
    // small text in the top/bottom margin = running head or footer
    if (inMargin && l.size < bodySize * 0.92) return false;
    // running heads that repeat the chapter heading ("Chapter 3 · Title") on every page
    if (inMargin && matchHeading(l.text)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------

function escapeMd(s) {
  return s.replace(/([\\`*_[\]])/g, '\\$1');
}

function renderSegs(segs) {
  // merge adjacent segments with the same style
  const merged = [];
  for (const s of segs) {
    const prev = merged.at(-1);
    if (prev && prev.italic === s.italic && prev.bold === s.bold) prev.text += s.text;
    else merged.push({ ...s });
  }
  let out = merged
    .map((s) => {
      const m = s.text.match(/^(\s*)(.*?)(\s*)$/s);
      const [, lead, core, trail] = m;
      if (!core) return s.text;
      let t = escapeMd(core);
      if (s.bold && s.italic) t = `***${t}***`;
      else if (s.bold) t = `**${t}**`;
      else if (s.italic) t = `*${t}*`;
      return lead + t + trail;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  // escape things that would turn a paragraph into a heading / quote / list
  out = out.replace(/^([#>+-]|\d+\.)(\s)/, '\\$1$2');
  return out;
}

function buildBody(lines, bodySize) {
  const blocks = [];
  let cur = null; // { segs, lastLine }

  const flush = () => {
    if (cur) blocks.push({ type: 'p', segs: cur.segs });
    cur = null;
  };

  const xs = lines.filter((l) => Math.abs(l.size - bodySize) < 0.6).map((l) => Math.round(l.x));
  const left = mode(xs) ?? 0;
  const ends = lines.filter((l) => Math.abs(l.size - bodySize) < 0.6).map((l) => l.xEnd);
  const right = ends.length ? Math.max(...ends) : 0;
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (lines[i].page === lines[i - 1].page && g > 0) gaps.push(Math.round(g));
  }
  const lead = mode(gaps) ?? bodySize * 1.3;
  // Does this manuscript mark paragraphs with a first-line indent, or with space between them?
  const isIndented = (l) => l.x > left + bodySize * 0.8 && l.x < left + bodySize * 4;
  const indentStyle = lines.filter(isIndented).length > lines.length * 0.02;

  let prev = null;
  for (const l of lines) {
    if (SCENE_BREAK_RE.test(l.text) && l.text.replace(/\s/g, '').length <= 12) {
      flush();
      blocks.push({ type: 'break' });
      prev = null;
      continue;
    }
    if (l.size > bodySize * 1.15 && l.text.length < 120) {
      flush();
      blocks.push({ type: 'h2', text: l.text });
      prev = null;
      continue;
    }

    let newPara = !cur;
    if (cur && prev) {
      const samePage = prev.page === l.page;
      const bigGap = samePage && prev.y - l.y > lead * 1.45;
      if (bigGap) newPara = true;
      else if (indentStyle) newPara = isIndented(l);
      // block style with no extra spacing: a line ending well short of the margin ends a paragraph
      else newPara = prev.xEnd < left + (right - left) * 0.6;
    }
    if (newPara) {
      flush();
      cur = { segs: [] };
    } else {
      // join with previous line, undoing end-of-line hyphenation ("some-\nthing")
      const last = cur.segs.at(-1);
      if (last && /[a-z]-$/.test(last.text) && /^[a-z]/.test(l.text)) last.text = last.text.slice(0, -1);
      else cur.segs.push({ text: ' ', italic: false, bold: false });
    }
    cur.segs.push(...l.segs);
    prev = l;
  }
  flush();

  return blocks
    .map((b) => (b.type === 'break' ? '***' : b.type === 'h2' ? `## ${b.text}` : renderSegs(b.segs)))
    .filter(Boolean)
    .join('\n\n');
}

export function plainText(md) {
  return md
    .replace(/\\([\\`*_[\]#>+-])/g, '$1')
    .replace(/\*+/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------

export async function extractBook(data) {
  const pages = await readPages(data);
  const allLines = pages.flatMap((p) => p.lines);
  const bodySize = mode(allLines.filter((l) => l.text.length > 30).map((l) => l.size)) ?? 11;
  const running = findRunningLines(pages);

  // Find the page where each chapter starts
  const starts = [];
  let stopPage = pages.length;
  for (const p of pages) {
    const headings = p.lines.map((l) => matchHeading(l.text)).filter(Boolean);
    if (headings.length >= 2) continue; // table of contents
    const top = p.lines.slice(0, 4);
    const idx = top.findIndex((l) => matchHeading(l.text) && !(l.y > p.height * 0.88));
    if (idx >= 0) {
      const h = matchHeading(top[idx].text);
      if (h.kind === 'epilogue' && starts.some((s) => s.kind === 'epilogue')) continue;
      if (h.kind !== 'epilogue' && starts.some((s) => s.number === h.number && s.kind === h.kind)) continue;
      starts.push({ ...h, page: p.index, line: top[idx], lineIdx: p.lines.indexOf(top[idx]) });
      continue;
    }
    if (starts.length && top.some((l) => STOP_RE.test(l.text))) {
      stopPage = p.index;
      break;
    }
  }

  const lastNumber = Math.max(0, ...starts.filter((s) => s.kind === 'chapter').map((s) => s.number));
  for (const s of starts) if (s.kind === 'epilogue') s.number = lastNumber + 1;

  const chapters = starts.map((s, i) => {
    const endPage = (starts[i + 1]?.page ?? stopPage) - 1;
    const startPage = pages[s.page];
    // Title: inline ("Chapter 3: Title") or the next larger-than-body line(s)
    let after = startPage.lines.slice(s.lineIdx + 1);
    let title = s.inlineTitle;
    if (!title) {
      const titleLines = [];
      for (const l of after) {
        if (l.size > bodySize * 1.15 && !matchHeading(l.text)) titleLines.push(l);
        else break;
      }
      title = titleLines.map((l) => l.text).join(' ');
      after = after.slice(titleLines.length);
    }
    if (!title) title = s.kind === 'chapter' ? `Chapter ${s.number}` : s.label;

    const bodyLines = [];
    for (let pi = s.page; pi <= endPage; pi++) {
      const p = pages[pi];
      const kept = new Set(stripRunning(p, running, bodySize));
      const lines = (pi === s.page ? after : p.lines).filter((l) => kept.has(l));
      for (const l of lines) bodyLines.push({ ...l, page: pi });
    }

    const body = buildBody(bodyLines, bodySize);
    return {
      number: s.number,
      kind: s.kind,
      title: title.replace(/\s+/g, ' ').trim(),
      startPage: s.page,
      endPage,
      body,
    };
  });

  return { numPages: pages.length, chapters };
}
