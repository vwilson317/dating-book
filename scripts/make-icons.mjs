// Generates app icons and the social share image from SVG. Run: npm run icons
// Edit the SVGs below (or drop in your own PNGs in public/icons) to change the look.
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';

const ACCENT = '#c2532f';
const CREAM = '#faf5ec';
const INK = '#221c16';

const stamp = (size, pad = 0) => {
  const c = size / 2;
  const r = c - pad - size * 0.06;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="100%" height="100%" fill="${CREAM}"/>
    <g transform="rotate(-10 ${c} ${c})">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${ACCENT}" stroke-width="${size * 0.035}"/>
      <circle cx="${c}" cy="${c}" r="${r * 0.86}" fill="none" stroke="${ACCENT}" stroke-width="${size * 0.012}"/>
      <text x="${c}" y="${c + r * 0.18}" text-anchor="middle" font-family="Georgia, serif" font-weight="700"
        font-size="${r * 0.55}" fill="${ACCENT}" letter-spacing="${r * 0.02}">RMB</text>
    </g>
  </svg>`;
};

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="28" fill="${CREAM}" stroke="${ACCENT}" stroke-width="5"/>
  <text x="32" y="41" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="24" fill="${ACCENT}">R</text>
</svg>`;

const ogFor = ({ eyebrow, subtitle, stamp, title = 'Read My Book', subtitleSize = 50 }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-dasharray="14 10"/>
  <text x="90" y="200" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="5" fill="#1f6f6b">${eyebrow}</text>
  <text x="90" y="320" font-family="Georgia, serif" font-size="108" font-weight="700" fill="${INK}">${title}</text>
  <text x="90" y="400" font-family="Georgia, serif" font-style="italic" font-size="${subtitleSize}" fill="${ACCENT}">${subtitle}</text>
  <g transform="rotate(14 1010 500)">
    <circle cx="1010" cy="500" r="80" fill="none" stroke="${ACCENT}" stroke-width="6" opacity="0.8"/>
    <circle cx="1010" cy="500" r="68" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0.8"/>
    <text x="1010" y="512" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="${ACCENT}" opacity="0.8">${stamp}</text>
  </g>
</svg>`;
const og = ogFor({ eyebrow: 'FREE CHAPTERS · PDF DOWNLOADS', subtitle: 'Misadventures of a Gringo Dating Abroad', stamp: 'Abroad' });
const ogPt = ogFor({ eyebrow: 'CAPÍTULOS GRÁTIS · PDFS PARA BAIXAR', subtitle: 'Desventuras de um Gringo Namorando no Exterior', stamp: 'Exterior', title: 'Leia Meu Livro', subtitleSize: 40 });

// Podcast cover (Spotify / Apple Podcasts): square, 1400–3000 px
const coverFor = ({ title, subtitle, eyebrow, stamp, subtitleSize = 150 }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="3000" viewBox="0 0 3000 3000">
  <rect width="3000" height="3000" fill="${CREAM}"/>
  <rect x="90" y="90" width="2820" height="2820" fill="none" stroke="${ACCENT}" stroke-width="10" stroke-dasharray="44 30"/>
  <text x="1500" y="700" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" letter-spacing="18" fill="#1f6f6b">${eyebrow}</text>
  ${title.map((line, i) => `<text x="1500" y="${1180 + i * 330}" text-anchor="middle" font-family="Georgia, serif" font-size="340" font-weight="700" fill="${INK}">${line}</text>`).join('')}
  ${subtitle.map((line, i) => `<text x="1500" y="${1960 + i * subtitleSize * 1.25}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${subtitleSize}" fill="${ACCENT}">${line}</text>`).join('')}
  <g transform="rotate(-12 1500 2500)">
    <circle cx="1500" cy="2500" r="210" fill="none" stroke="${ACCENT}" stroke-width="16"/>
    <circle cx="1500" cy="2500" r="178" fill="none" stroke="${ACCENT}" stroke-width="6"/>
    <text x="1500" y="2526" text-anchor="middle" font-family="Georgia, serif" font-size="${stamp.length > 6 ? 62 : 78}" font-weight="700" fill="${ACCENT}">${stamp}</text>
  </g>
</svg>`;
const cover = coverFor({ eyebrow: 'THE AUDIOBOOK', title: ['Read', 'My Book'], subtitle: ['Misadventures of a Gringo', 'Dating Abroad'], stamp: 'Abroad' });
const coverPt = coverFor({ eyebrow: 'O AUDIOLIVRO', title: ['Leia', 'Meu Livro'], subtitle: ['Desventuras de um Gringo', 'Namorando no Exterior'], stamp: 'Exterior' });

await mkdir('public/icons', { recursive: true });
const png = (svg, out, size) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);

await png(stamp(512), 'public/icons/icon-512.png', 512);
await png(stamp(512), 'public/icons/icon-192.png', 192);
await png(stamp(512, 512 * 0.1), 'public/icons/maskable-512.png', 512); // extra safe-zone padding
await png(stamp(512), 'public/icons/apple-touch-icon.png', 180);
await writeFile('public/icons/favicon.svg', favicon);
await sharp(Buffer.from(og)).png().toFile('public/og.png');
await sharp(Buffer.from(ogPt)).png().toFile('public/og-pt.png');
await sharp(Buffer.from(cover)).jpeg({ quality: 88 }).toFile('public/podcast-cover.jpg');
await sharp(Buffer.from(coverPt)).jpeg({ quality: 88 }).toFile('public/podcast-cover-pt.jpg');

console.log('Icons, og.png and podcast covers written.');
