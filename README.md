# Read My Book: Misadventures of a Gringo Dating Abroad

The home for the book: chapters you can read in the browser, PDF downloads for every version, and an installable app (PWA). It's built with [Astro](https://astro.build) as a static site, uses PostHog for analytics, and deploys on Netlify. There's no database. All content lives in Markdown files.

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs to dist/
npm run preview    # serve the production build (service worker on)
```

## Adding content

### A new chapter

Create `src/content/chapters/04-whatever.md`:

```md
---
number: 4
title: "The Chapter Title"
excerpt: "One or two sentences for cards and link previews."
location: "Medellín, Colombia"   # optional
published: 2026-12-15
status: published                # published | coming-soon | draft
slug: the-chapter-title          # optional, sets the URL; defaults to the file name
versions:
  - label: "v1"
    date: 2026-12-15
    file: /pdfs/chapter-04-v1.pdf
---

Chapter text in Markdown...
```

Put the PDF at `public/pdfs/chapter-04-v1.pdf`.

- `coming-soon` shows a teaser card, with no page yet. Good for building hype on Instagram.
- `draft` hides the chapter completely.

### A new version of a chapter

Add the PDF with a **new file name** (for example `chapter-01-v3.pdf`) and put the new entry at the **top** of `versions`. The top entry is the main download button. Older versions stay available under "Earlier versions" and on `/downloads/`. If the text changed too, update the Markdown body (the site always shows the latest text).

> Always use a new file name for a new PDF. Readers' phones cache PDFs for offline reading, so reusing a name can serve them the old file.

### Full-book PDFs

Edit `src/content/editions.yaml`. The entry marked `featured: true` gets a download button on the home page.

### Site settings

Change the title, author, and Instagram handle in `src/site.config.ts`. To change the app icon and share image, edit the SVGs in `scripts/make-icons.mjs` and run `npm run icons`.

## Analytics (PostHog)

1. Copy your Project API key from PostHog (Project settings → *Project API key*, starts with `phc_`).
2. In Netlify: **Site configuration → Environment variables**, add `PUBLIC_POSTHOG_KEY`. For local testing, copy `.env.example` to `.env`.
3. Redeploy.

Events go through a `/ingest` proxy on your own domain (set up in `netlify.toml`) so ad blockers don't drop them. **If your PostHog project is on EU cloud**, change `us` to `eu` in the two proxy URLs in `netlify.toml` and in `ui_host` in `src/scripts/analytics.ts`.

| Event | When |
|---|---|
| `$pageview` / `$pageleave` | automatic |
| `pdf_downloaded` | any PDF click; props: `kind` (chapter/edition), `chapter`, `version`, `file` |
| `chapter_progress` | reader scrolls 25 / 50 / 75% through a chapter |
| `chapter_finished` | reader reaches the end of a chapter; includes `seconds_on_page` |
| `next_chapter_clicked` | reader taps "Next →" |
| `cta_clicked`, `instagram_clicked`, `shared` | buttons |
| `in_app_browser_seen` | page opened inside the Instagram/Facebook/TikTok browser |
| `install_clicked`, `install_prompt_result`, `app_installed` | PWA install funnel |

Every event also carries `display_mode` (browser vs. installed app) and `in_app_browser`.

To track new buttons without writing code, add `data-track="event_name"` and `data-prop-anything="value"` to any element.

### Instagram links

Add UTM tags so PostHog can show which posts drive traffic:

- Bio: `https://YOURSITE/?utm_source=instagram&utm_medium=bio`
- Story link sticker: `https://YOURSITE/chapters/the-slug/?utm_source=instagram&utm_medium=story&utm_campaign=ch4-launch`

Instagram opens links in its own in-app browser. That browser can't install the app and handles downloads poorly, so the site shows those visitors a small banner telling them to "Open in browser."

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify, choose **Add new site → Import from Git** and pick the repo. Build settings come from `netlify.toml` (`npm run build` → `dist`).
3. Add `PUBLIC_POSTHOG_KEY` (see above).
4. Optional: add a custom domain. Netlify's `URL` variable sets canonical and share-image URLs automatically.

After that, every push to the production branch deploys.

## How the PWA works

- `public/manifest.webmanifest` holds the app name, icons, and colors.
- `src/pages/sw.js.ts` builds `/sw.js` on each deploy. Pages load network-first, so readers always get the newest text, with cached copies used when offline. Build assets are cache-first. PDFs are cached after the first open so they work offline.
- "Get the app" shows the native install prompt on Android/Chrome and step-by-step instructions on iPhone Safari.
