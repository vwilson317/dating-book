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

The book exists in English and Portuguese. Each language has its own manuscript PDF, and that PDF is the source of truth for that language's chapters.

**1. Put the PDFs in the inbox folders** (PDFs here are not committed to git):

```
manuscript/
  en/  ← English manuscript PDF
  pt/  ← Portuguese manuscript PDF
```

You only need to drop in the language(s) you changed. If a folder has several PDFs, the newest one is used.

**2. Preview what changed**, without writing anything:

```bash
npm run release -- --dry-run
```

**3. Release:**

```bash
npm run release
```

Add `--notes "Rewrote the ending of chapter 4"` to show readers a note next to the new versions.

**4. Commit and push.** That deploys the site. The release writes the chapter text to `src/content/chapters/<lang>/` and the PDFs to `public/pdfs/<lang>/`. Those are the files that get committed.

You can also pass PDFs straight from anywhere: `npm run release -- ~/Downloads/book.pdf ~/Downloads/livro.pdf`. Each file's language is detected from its headings ("Chapter" vs "Capítulo") and wording. To skip detection for a single file, add `--lang pt`.

What a release does, per language:

| In the PDF… | On the site |
|---|---|
| A chapter that isn't on the site yet | New chapter page + its own PDF (`v1`) |
| A chapter whose text or title changed | Text replaced, next version added (`v2`, `v3`…) with its own PDF. Older PDFs stay downloadable |
| A chapter that's `coming-soon` | Published |
| A chapter that didn't change | Left alone |
| The whole file | New **Early Reader Edition** / **Edição Antecipada** on that language's Downloads page, featured on its home page |

Languages are versioned separately. Chapter 2 can be at `v3` in English and `v1` in Portuguese. When one language has chapters the other doesn't, the release tells you (for example, "Português is missing chapter(s) 5"). On the site, the EN/PT switcher on a chapter that isn't translated yet goes to the other language's chapter list.

The first release in each language deletes that language's placeholder sample chapters.

**What the PDF needs:** each chapter starts on a new page, with a heading near the top:

| | English | Portuguese |
|---|---|---|
| Chapters | `Chapter 3`, `CHAPTER THREE`, `Chapter 3: Title` | `Capítulo 3`, `CAPÍTULO TRÊS`, `Capítulo Vinte e Um` |
| Chapter 0 | `Prologue`, `Preface`, `Introduction` | `Prólogo`, `Prefácio`, `Introdução` |
| After the last chapter | `Epilogue`, `Afterword` | `Epílogo`, `Posfácio` |
| Back matter (left out) | `Acknowledgments`, `About the Author` | `Agradecimentos`, `Sobre o autor` |

If the title is on its own line, set it larger than the body text. The script skips the table of contents, running headers, and page numbers. It keeps italics, bold, and scene breaks (`* * *`). The words it looks for are in `scripts/release/languages.mjs`.

**Good to know**
- **The PDF is the source of truth.** A release replaces a changed chapter's web text with what's in the PDF, so make text edits in your manuscript, not in the `.md` files. Frontmatter you add by hand (`location`, a custom `excerpt`, `slug`) is kept.
- **Chapters are matched by number**, within each language. EN chapter 4 and PT chapter 4 are treated as the same chapter for the language switcher, so keep the numbering the same in both manuscripts. If you insert a chapter in the middle and renumber the rest, every chapter after it will look changed.
- **Re-exporting with a different layout is fine.** Changing fonts or margins doesn't create new versions; only changes to the words, italics, or paragraph breaks do.

## Languages on the site

- English lives at `/`, Portuguese at `/pt/`. Every page has an EN/PT switcher, and chapters link to the same chapter in the other language.
- A visitor whose phone is set to Portuguese and lands on an English page sees a small "Leia em português →" link, and the reverse for English speakers. It never redirects automatically, so a link you share always opens the page you shared. A reader's choice is remembered on their device.
- Each language gets its own share image (`og.png` and `og-pt.png`) and its own install manifest, so installing from a Portuguese page opens the Portuguese site.
- **All interface text** (buttons, headings, banners, and the edition names and notes the release writes) is in `src/i18n/ui.ts`. The Portuguese book subtitle there, *Desventuras de um Gringo Namorando no Exterior*, is a placeholder translation. Change it to your real Portuguese title, then run `npm run icons` to update the Portuguese share image.

## Adding content by hand

### A new chapter

Create `src/content/chapters/en/04-whatever.md` (or `pt/` for Portuguese):

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
    file: /pdfs/en/chapter-04-v1.pdf
---

Chapter text in Markdown...
```

Put the PDF at `public/pdfs/en/chapter-04-v1.pdf` (or `pdfs/pt/`).

- `coming-soon` shows a teaser card, with no page yet. Good for building hype on Instagram.
- `draft` hides the chapter completely.

### A new version of a chapter

Add the PDF with a **new file name** (for example `chapter-01-v3.pdf`) and put the new entry at the **top** of `versions`. The top entry is the main download button. Older versions stay available under "Earlier versions" and on `/downloads/`. If the text changed too, update the Markdown body (the site always shows the latest text).

> Always use a new file name for a new PDF. Readers' phones cache PDFs for offline reading, so reusing a name can serve them the old file.

### Full-book PDFs

Edit `src/content/editions.yaml`. Each entry has a `lang`. The entry marked `featured: true` gets a download button on that language's home page.

### Site settings

Change the author and Instagram handle in `src/site.config.ts`, and the book title, subtitle, and interface text in `src/i18n/ui.ts`. To change the app icon and share image, edit the SVGs in `scripts/make-icons.mjs` and run `npm run icons`.

## Analytics (PostHog)

1. Copy your Project API key from PostHog (Project settings → *Project API key*, starts with `phc_`).
2. In Netlify: **Site configuration → Environment variables**, add `PUBLIC_POSTHOG_KEY`. For local testing, copy `.env.example` to `.env`.
3. Redeploy.

Events go through a `/ingest` proxy on your own domain (set up in `netlify.toml`) so ad blockers don't drop them. **If your PostHog project is on EU cloud**, change `us` to `eu` in the two proxy URLs in `netlify.toml` and in `ui_host` in `src/scripts/analytics.ts`.

### Reading events (chapter pages)

Every reading event includes `chapter`, `lang`, `title`, `version` (the chapter's latest version, e.g. `v2`), `words_total`, and `read_id` (one ID per visit to a chapter page).

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
| `language_suggested`, `language_switched` | "read in the other language" link shown / EN-PT switch used; props: `from`, `to`, `via` |
| `install_clicked`, `install_prompt_result`, `app_installed` | PWA install funnel |

### Insights to set up in PostHog

**Completion rate per chapter (funnel).** New insight → Funnel: `chapter_started` → `chapter_finished`. Under "Breakdown", choose the event property `chapter`. This counts people: of the readers who started a chapter, the share who finished it on any visit. For per-visit completion, use `pct_finished` from the SQL below.

**Where readers drop off.** Funnel: `chapter_started` → `chapter_progress` (percent = 25) → (50) → (75) → `chapter_finished`, filtered to one chapter.

**Did Instagram readers finish?** Add a breakdown by `in_app_browser` or `$initial_utm_source` to either funnel. Break down by `lang` to compare English and Portuguese readers.

**How much people read per visit (SQL insight).** New insight → SQL:

```sql
SELECT
  lang,
  chapter,
  count() AS visits,
  round(avg(percent_read)) AS avg_percent_read,
  round(avg(words_read)) AS avg_words_read,
  round(median(active_seconds) / 60, 1) AS median_minutes,
  round(100 * countIf(finished) / count()) AS pct_finished
FROM (
  SELECT
    properties.read_id AS read_id,
    any(properties.chapter) AS chapter,
    any(properties.lang) AS lang,
    argMax(toFloat(properties.percent_read), timestamp) AS percent_read,
    argMax(toFloat(properties.words_read), timestamp) AS words_read,
    argMax(toFloat(properties.active_seconds), timestamp) AS active_seconds,
    max(toString(properties.finished) = 'true') AS finished
  FROM events
  WHERE event = 'chapter_read' AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY read_id
)
GROUP BY lang, chapter
ORDER BY lang, toInt(chapter)
```

**Quick version without SQL.** Trends → `chapter_read` → "Property value: average" of `percent_read` or `words_read`, broken down by `chapter`. Add a filter `summary_number = 1` to count each visit once. This slightly undercounts readers who came back to the same tab.

Every event also carries `lang` (`en`/`pt`), `display_mode` (browser vs. installed app), and `in_app_browser`.

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

## Reading comfort

The **Aa** button in the header opens reading settings. Everything is saved on the reader's device and applies to every page:

- **Theme:** Auto (follows the phone), Light, Sepia, Dark. Settings are applied before the page draws, so there's no white flash in dark mode. The browser's toolbar color matches the theme.
- **Text size:** five steps.
- **Font:** Serif (Literata, made for long reading on screens) or Sans.
- **Spacing:** Normal, or Relaxed (more room between lines, letters, and words), which helps many readers, including people with dyslexia.
- **Keep screen on while reading:** stops the phone from dimming mid-chapter. It's only active on chapter pages, and only shown on browsers that support it.

Other things that help people keep reading:

- **Continue where you left off:** each reader's place in a chapter is saved on their phone. Coming back to a chapter shows a "Continue where you left off · 40%" button, and the home page's main button becomes "Continue Chapter N".
- **Progress on chapter cards:** "✓ Read" or "40% read".
- **Typesetting:** hyphenation in the page's language, no lonely one-word last lines, and balanced headings.

These events show whether the settings help:

| Event | Properties |
|---|---|
| `reading_settings_opened` | — |
| `reading_settings_changed` | `setting` (theme, size, font, spacing, awake), `value` |
| `resume_offered`, `reading_resumed` | `chapter`, `percent` and the usual reading properties |

Every event also carries the reader's current `theme`, `text_size`, `font`, `spacing`, and `keep_awake`. You can break the completion funnel down by `text_size` to see whether readers who enlarge the text finish more chapters.

## How the PWA works

- `public/manifest.webmanifest` holds the app name, icons, and colors.
- `src/pages/sw.js.ts` builds `/sw.js` on each deploy. Pages load network-first, so readers always get the newest text, with cached copies used when offline. Build assets are cache-first. PDFs are cached after the first open so they work offline.
- "Get the app" shows the native install prompt on Android/Chrome and step-by-step instructions on iPhone Safari.
