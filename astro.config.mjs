// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Netlify sets URL at build time. Set SITE_URL to override (e.g. a custom domain).
  site: process.env.SITE_URL || process.env.URL || 'http://localhost:4321',
  trailingSlash: 'ignore',
  vite: { plugins: [tailwindcss()] },
});
