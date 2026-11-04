# Read My Book: Misadventures of a Gringo Dating Abroad

The home for the book: chapters you can read in the browser, PDF downloads for every version, and an installable app (PWA). It's built with [Astro](https://astro.build) as a static site, uses PostHog for analytics, and deploys on Netlify. There's no database. All content lives in Markdown files.

## Quick start

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs to dist/
npm run preview    # serve the production build (service worker on)
```

## Releasing a new version of the book (the easy way)

Export the whole book as one PDF, then run:

```bash
npm run release -- ~/Downloads/read-my-book.pdf --dry-run
```

The dry run shows what changed in each chapter, including the edited passages, and writes nothing. When it looks right, run it again without `--dry-run`. You can add a note readers will see next to the new versions:

```bash
npm run release -- ~/Downloads/read-my-book.pdf --notes "Rewrote the ending of chapter 4"
```

You can also drop the PDF into `manuscript/` and run `npm run release` with no path. It picks the newest PDF there.

What it does:

| In the PDF… | On the site |
|---|---|
| A chapter that isn't on the site yet | New chapter page + its own PDF (`v1`) |
| A chapter whose text or title changed | Text replaced, next version added (`v2`, `v3`…) with its own PDF. Older PDFs stay downloadable |
| A chapter that's `coming-soon` | Published |
| A chapter that didn't change | Left alone |
| The whole file | New **Early Reader Edition** on Downloads, featured on the home page |

The first real release also deletes the placeholder sample chapters. After any release, preview with `npm run dev`, then commit and push to deploy.

**What the PDF needs:** each chapter starts on a new page, with a heading near the top like `Chapter 3`, `CHAPTER THREE`, or `Chapter 3: Title`. If the title is on its own line, set it larger than the body text. `Prologue` becomes chapter 0 and `Epilogue` comes after the last chapter. The script skips the table of contents, running headers, page numbers, and back matter (Acknowledgments, About the Author). It keeps italics, bold, and scene breaks (`* * *`).

**Good to know**
- **The PDF is the source of truth.** A release replaces a changed chapter's web text with what's in the PDF, so make text edits in your manuscript, not in the `.md` files. Frontmatter you add by hand (`location`, a custom `excerpt`, `slug`) is kept.
- **Chapters are matched by number.** If you insert a new chapter in the middle and renumber the rest, every chapter after it will look changed.
- **Re-exporting with a different layout is fine.** Changing fonts or margins doesn't create new versions; only changes to the words, italics, or paragraph breaks do.

## Adding content by hand

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

### Reading events (chapter pages)

Every reading event includes `chapter`, `title`, `version` (the chapter's latest version, e.g. `v2`), `words_total`, and `read_id` (one ID per visit to a chapter page).

| Event | When | Extra properties |
|---|---|---|
| `chapter_started` | The reader actually begins: 15 seconds of active reading, or 10% of the text scrolled | `active_seconds`, `percent` |
| `chapter_progress` | Passes 25 / 50 / 75 / 90% of the chapter text | `percent`, `active_seconds` |
| `chapter_finished` | Reaches the end of the text | `active_seconds`, `skimmed` (true if they scrolled faster than ~700 words/min) |
| `chapter_read` | **Visit summary**, sent when the reader leaves, switches apps, or closes the tab | `percent_read`, `words_read`, `active_seconds`, `words_per_minute`, `started`, `finished`, `bounced`, `summary_number` |

"Active" time only counts while the page is on screen and the reader has scrolled or touched it in the last 60 seconds. Time with the phone in a pocket doesn't inflate the numbers.

If a reader switches away and comes back to the same tab, `chapter_read` is sent again with updated totals and the same `read_id`, and `summary_number` goes up by one. For exact per-visit numbers, use the latest summary for each `read_id` (the SQL below does this).

### Other events

| Event | When |
|---|---|
| `$pageview` / `$pageleave` | automatic |
| `pdf_downloaded` | any PDF click; props: `kind` (chapter/edition), `chapter`, `version`, `file` |
| `next_chapter_clicked` | reader taps "Next →" |
| `cta_clicked`, `instagram_clicked`, `shared` | buttons |
| `in_app_browser_seen` | page opened inside the Instagram/Facebook/TikTok browser |
| `install_clicked`, `install_prompt_result`, `app_installed` | PWA install funnel |

### Insights to set up in PostHog

**Completion rate per chapter (funnel).** New insight → Funnel: `chapter_started` → `chapter_finished`. Under "Breakdown", choose the event property `chapter`. This counts people: of the readers who started a chapter, the share who finished it on any visit. For per-visit completion, use `pct_finished` from the SQL below.

**Where readers drop off.** Funnel: `chapter_started` → `chapter_progress` (percent = 25) → (50) → (75) → `chapter_finished`, filtered to one chapter.

**Did Instagram readers finish?** Add a breakdown by `in_app_browser` or `$initial_utm_source` to either funnel.

**How much people read per visit (SQL insight).** New insight → SQL:

```sql
SELECT
  properties.chapter AS chapter,
  count() AS visits,
  round(avg(percent_read)) AS avg_percent_read,
  round(avg(words_read)) AS avg_words_read,
  round(median(active_seconds) / 60, 1) AS median_minutes,
  round(100 * countIf(finished) / count()) AS pct_finished
FROM (
  SELECT
    properties.read_id AS read_id,
    any(properties.chapter) AS chapter,
    argMax(toFloat(properties.percent_read), timestamp) AS percent_read,
    argMax(toFloat(properties.words_read), timestamp) AS words_read,
    argMax(toFloat(properties.active_seconds), timestamp) AS active_seconds,
    max(properties.finished = 'true' OR properties.finished = true) AS finished
  FROM events
  WHERE event = 'chapter_read' AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY read_id
)
GROUP BY chapter
ORDER BY toInt(chapter)
```

**Quick version without SQL.** Trends → `chapter_read` → "Property value: average" of `percent_read` or `words_read`, broken down by `chapter`. Add a filter `summary_number = 1` to count each visit once. This slightly undercounts readers who came back to the same tab.

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
