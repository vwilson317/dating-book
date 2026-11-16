// /robots.txt: let search engines in, point them at the sitemap.
// Non-production Netlify builds (deploy previews, branch deploys) ask not to be indexed at all.
import type { APIRoute } from 'astro';
import { LANG_CODES, localePath } from '../i18n/ui';

const production = !process.env.CONTEXT || process.env.CONTEXT === 'production';
// Draft previews aren't listed here on purpose: robots.txt is public, and naming /preview/ would point
// people at it. Those pages carry noindex instead (meta tag and X-Robots-Tag in netlify.toml).
const disallow = LANG_CODES.map((l) => `Disallow: ${localePath(l, '/offline/')}\n`).join('');

export const GET: APIRoute = ({ site }) => {
  const body = production
    ? `User-agent: *\nAllow: /\n${disallow}\nSitemap: ${new URL('/sitemap.xml', site)}\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
