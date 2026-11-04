// /robots.txt: let search engines in, point them at the sitemap.
// Non-production Netlify builds (deploy previews, branch deploys) ask not to be indexed at all.
import type { APIRoute } from 'astro';

const production = !process.env.CONTEXT || process.env.CONTEXT === 'production';

export const GET: APIRoute = ({ site }) => {
  const body = production
    ? `User-agent: *\nAllow: /\nDisallow: /offline/\nDisallow: /pt/offline/\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
