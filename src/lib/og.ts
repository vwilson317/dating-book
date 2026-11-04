// Share images (1200x630) for chapters, drawn as SVG and turned into PNGs at build time.
const ACCENT = '#c2532f';
const CREAM = '#faf5ec';
const INK = '#221c16';
const TEAL = '#1f6f6b';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap by character count (good enough for a big serif title) */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

export function chapterOgSvg(opts: { eyebrow: string; title: string; book: string; stamp: string }) {
  const long = opts.title.length > 34;
  const size = long ? 72 : 88;
  const lines = wrap(opts.title, long ? 26 : 22, 3);
  const top = 300 - ((lines.length - 1) * size * 1.1) / 2;
  const titleSvg = lines
    .map((l, i) => `<text x="90" y="${top + i * size * 1.1}" font-family="Georgia, 'DejaVu Serif', serif" font-size="${size}" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-dasharray="14 10"/>
  <text x="90" y="140" font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif" font-size="28" font-weight="700" letter-spacing="5" fill="${TEAL}">${esc(opts.eyebrow.toUpperCase())}</text>
  ${titleSvg}
  <text x="90" y="540" font-family="Georgia, 'DejaVu Serif', serif" font-style="italic" font-size="34" fill="${ACCENT}">${esc(opts.book)}</text>
  <g transform="rotate(14 1040 470)" opacity="0.8">
    <circle cx="1040" cy="470" r="70" fill="none" stroke="${ACCENT}" stroke-width="6"/>
    <circle cx="1040" cy="470" r="58" fill="none" stroke="${ACCENT}" stroke-width="2"/>
    <text x="1040" y="480" text-anchor="middle" font-family="Georgia, 'DejaVu Serif', serif" font-size="24" font-weight="700" fill="${ACCENT}">${esc(opts.stamp)}</text>
  </g>
</svg>`;
}
