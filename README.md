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

## Audiobook (narrated chapters)

Each chapter can have an audio version in English and Portuguese. You record the MP3s (for example with ElevenLabs) and put them in the repo. Chapters with audio get a player at the top of the page and a 🎧 badge on their cards. Chapters without audio show no player.

**Add audio:**

1. `npm run audio -- --export` writes each chapter's narration text to `narration/en/` and `narration/pt/` (not committed). It's the chapter text with the Markdown cleaned up (`\[T\]` becomes `T`), the title read out first ("Chapter 3. Title."), and `…` at scene breaks. Paste it into ElevenLabs.
2. Download each recording as MP3 and save it as `public/audio/en/03.mp3` (or `pt/`). Any name that starts with the chapter number works: `3.mp3`, `03-how-long.mp3`. The introduction is `00.mp3`.
3. `npm run audio` checks them: it lists each new or replaced file with its length, the chapters still without audio, and any file it can't match to a chapter. It also runs before every build, so this step is optional.
4. Commit `public/audio/` and `src/content/audio.json`.

To replace a recording, overwrite the file and commit. Readers get the new one, because the site links each file with a hash of its contents.

**After a release:** if a chapter's text changes after you added its audio, `npm run audio` (and every build) warns: "Chapter 4's text changed after its audio was added." Export again, re-record that chapter, and replace the file. The old audio keeps playing until you do.

**Getting the sarcastic tone in ElevenLabs:**
- Use the **Eleven v3** model. It's the most expressive and understands audio tags in square brackets. Add a few where they help: `[sarcastic]`, `[deadpan]`, `[sighs]`, `[dramatic pause]`, `[mock serious]`, `[laughs]`. A tag at the start of a paragraph sets its tone. Don't tag every line.
- Lower **Stability** (Creative or Natural) gives more expressive, sarcastic delivery. High stability sounds flat.
- To design a voice: *"American man in his 30s telling his own dating disasters to friends at a bar. Dry, deadpan, sarcastic, self-deprecating. Unhurried, with small pauses before punchlines."* For Portuguese: *"Homem brasileiro de uns 30 anos, sotaque carioca, contando os próprios desastres amorosos para os amigos num bar. Seco, debochado, sarcástico, autodepreciativo. Sem pressa, com pausinhas antes da piada."*
- Long chapters work best in **Studio** (Projects), which handles the whole text in one go. With the regular text-to-speech page, paste a few paragraphs at a time and join the clips.
- Download as MP3. 128 kbps is fine (about 1 MB a minute); a lower bitrate keeps the repo smaller.

**The player:** play/pause, back 15 s / forward 30 s, a seek bar, speed (1× to 2×), and an MP3 download. It remembers where each reader stopped in each chapter and their speed. While audio plays and the reader scrolls past the player, a mini player follows at the bottom of the screen. Lock-screen and headphone controls work, including next/previous chapter. When a chapter ends it moves on to the next one (readers can turn that off), and this works with the screen off. Listening to the end marks the chapter ✓ Read.

| Event | When | Extra properties |
|---|---|---|
| `audio_started` | First play of a chapter in a visit | `resumed_at` (seconds, if it picked up where they left off), `speed` |
| `audio_progress` | Passes 25 / 50 / 75 / 90% | `percent` |
| `audio_finished` | Reaches the end | `speed` |
| `audio_listened` | Summary when the reader leaves or moves to the next chapter | `seconds_listened`, `max_percent`, `speed`, `summary_number` |
| `audio_next_chapter` | Plays into the next chapter automatically | `to` |
| `audio_speed_changed`, `audio_downloaded` | Speed button / MP3 download | `speed` |

All of them include `chapter`, `lang`, `title`, `version`, `duration` and `listen_id`.

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

### Reader preferences in PostHog

**Every event, including the first page view,** carries the reader's settings and what their device is set to:

| Property | Meaning |
|---|---|
| `theme` | What they picked: `auto`, `light`, `sepia`, `dark` |
| `theme_shown` | What they actually see. For `auto`, this resolves to `light` or `dark` from their phone |
| `text_size` | `0`–`4` (`1` is the default) |
| `font` | `serif` / `sans` |
| `spacing` | `normal` / `relaxed` |
| `keep_awake` | Keep-screen-on turned on |
| `customized` | `true` if they changed anything from the defaults |
| `os_dark_mode` | Phone/computer set to dark mode |
| `os_reduced_motion` | Reduce Motion turned on in accessibility settings |
| `browser_font_px` | Browser's base text size. Above `16` usually means they've enlarged text system-wide |
| `wake_lock_supported` | Whether keep-screen-on can work on this device |

PostHog adds the device details itself: **`$device_type`** (Mobile / Tablet / Desktop), `$os` (iOS, Android…), `$browser`, `$screen_width`, `$viewport_width`. Combined with `in_app_browser` (instagram / none) and `display_mode` (browser / installed app), that covers "on what device".

| Event | Properties |
|---|---|
| `reading_settings_opened` | — |
| `reading_settings_changed` | `setting` (theme, size, font, spacing, awake), `from`, `value`, `page_type` (chapter / other) |
| `resume_offered`, `reading_resumed` | `chapter`, `percent` and the usual reading properties |

**Insights to set up**

- **Theme by device.** Trends → `$pageview`, count *Unique users*. Break down by `theme_shown`. Then add a second breakdown, `$device_type` (or `$os`).
- **How many readers customize at all.** Trends → `$pageview`, *Unique users*, broken down by `customized`.
- **What people change.** Trends → `reading_settings_changed`, broken down by `setting`, then by `value`.
- **Do settings help people finish?** Funnel `chapter_started` → `chapter_finished`, broken down by `text_size`, `theme_shown`, or `spacing`.

**Current preferences per reader, by device (SQL insight).** This counts each reader once, using their most recent settings:

```sql
SELECT
  device,
  os,
  theme_shown,
  text_size,
  font,
  spacing,
  count() AS readers
FROM (
  SELECT
    distinct_id,
    argMax(properties.$device_type, timestamp) AS device,
    argMax(properties.$os, timestamp) AS os,
    argMax(properties.theme_shown, timestamp) AS theme_shown,
    argMax(properties.text_size, timestamp) AS text_size,
    argMax(properties.font, timestamp) AS font,
    argMax(properties.spacing, timestamp) AS spacing
  FROM events
  WHERE event = '$pageview' AND timestamp > now() - INTERVAL 30 DAY
  GROUP BY distinct_id
)
GROUP BY device, os, theme_shown, text_size, font, spacing
ORDER BY readers DESC
```

> A "reader" in PostHog is one browser on one device. Settings are saved per browser too, so the same person reading in Instagram's in-app browser and then in Safari counts twice and can have different settings in each. Your `in_app_browser` breakdowns will show how much of that happens.

## Reader feedback (WhatsApp)

Readers can reach you on WhatsApp in three ways, each with a message already written for them to edit:

1. **Chapter reactions.** At the end of every chapter: 😂 Dying · 🚩 Red flag · 🙈 Been there · 🥲 Poor guy · 🔥 Need more. Tapping one is recorded in PostHog right away, whether or not they send anything. A WhatsApp-style message then appears, e.g. *"Hey Vincent! I just read Chapter 3, "Salsa, Badly": 🚩 Red flag."* They can add their own words and tap **Send on WhatsApp**.
2. **Send a line.** Highlighting a passage in a chapter shows a **💬 Send this line to Vincent** button, which opens WhatsApp with the quote.
3. **Footer link.** "💬 Send me feedback on WhatsApp" on every page.

All of it works in Portuguese too ("O que achou deste capítulo?", 😂 Morri, 🙈 Já passei por isso…). Edit the wording and reactions in `src/i18n/ui.ts`.

**Your number** is set in `src/site.config.ts` (`whatsapp`), as country code + number, digits only. If you clear it, feedback is hidden on the live site. It still shows in `npm run dev`, with a yellow note.

> Your number will be public. Anyone, including bots that scrape sites, can see it in the page and in the `wa.me` links. A WhatsApp Business account or a second number lets you use labels, quick replies, and an away message, and keeps your personal number private.

**PostHog events:**

| Event | Properties |
|---|---|
| `feedback_reaction` | `chapter`, `reaction` (lol, red_flag, been_there, poor_guy, more), `changed` (switched from another reaction) |
| `feedback_whatsapp_opened` | `source` (reaction, quote, footer), `chapter`, `reaction`, `edited`, `added_chars` |
| `quote_shared` | `chapter`, `quote` (first 140 characters of the passage), `quote_length` |

The reader's own message is never sent to PostHog, only whether they edited it and how much they added.

**Insights to set up**

- **Reactions per chapter:** Trends → `feedback_reaction`, broken down by `chapter`, then by `reaction`.
- **Most-quoted lines:** Trends → `quote_shared`, broken down by `quote`, shown as a table.
- **From reaction to message:** Funnel `feedback_reaction` → `feedback_whatsapp_opened`.

`feedback_whatsapp_opened` counts taps on the button. WhatsApp doesn't report whether the message was actually sent.

## Quiz: "So you want to date the gringo?"

The quiz lives at `/quiz/` and `/pt/quiz/`. It's promoted with a card on the home page and on the Contact page (`/contact/`, `/pt/contact/`). It has three questions, and each one calls back to a moment in the book, with a link to that chapter:

1. **Introduction:** the jacket over the puddle. Best answer: the shirt-as-umbrella date from Chapter 9.
2. **Chapter 4:** "Make sure you choose the right one." → "Are you toxic?"
3. **Chapter 3:** the fortune cookie, and "How long have you been dating your boyfriend?"

Each answer is worth 0–3 points and gets a joke reaction. Scores up to 9 map to a tier:

| Score | Tier |
|---|---|
| 9 | 🧩 Puzzle partner |
| 7–8 | 🚲 Tandem-bike getaway partner |
| 4–6 | 😏 Situationship material |
| 0–3 | 🏖️ Zand erover (sand over it) |

At the end, the reader is reminded of the "Front or back?" moment from Chapter 7 and asked to write their own opening line. Their WhatsApp message to you is pre-filled with their score and tier, and **Send** stays blocked until they've written a line. They can also share their score through their phone's share sheet.

**Edit everything in `src/i18n/quiz.ts`:** questions, answers, points, joke reactions, tiers, and the English and Portuguese text. The maximum score is calculated automatically, so adding a question just works.

**PostHog events:**

| Event | Properties |
|---|---|
| `quiz_promo_clicked` | `place` (home, contact) |
| `quiz_started` | — |
| `quiz_answered` | `question`, `question_number`, `answer`, `points`, `changed` |
| `quiz_completed` | `score`, `max`, `tier`, `seconds`, `answers` (one per question) |
| `quiz_whatsapp_blocked` | They tapped Send before writing a line |
| `feedback_whatsapp_opened` | `source: quiz`, `score`, `tier`, `line_chars` (the line itself is never sent) |
| `quiz_shared`, `quiz_restarted` | `score` / `previous_score` |

Useful insights:
- **Funnel:** `quiz_promo_clicked` → `quiz_started` → `quiz_completed` → `feedback_whatsapp_opened` (source = quiz).
- **Score distribution:** `quiz_completed`, broken down by `tier`.
- **Most popular answers:** `quiz_answered`, broken down by `question`, then by `answer`.

## SEO

What's built in:

- **Sitemap** at `/sitemap.xml`, covering every page in both languages. Each page is linked to its translation (hreflang), so Google shows English searchers the English page and Portuguese searchers the Portuguese one.
- **robots.txt**, pointing search engines to the sitemap.
- **RSS feeds** at `/rss.xml` and `/pt/rss.xml`, so feed readers and search engines pick up new chapters quickly.
- **Structured data (schema.org):**
  - The home page describes the book, with its Portuguese translation and you as the author (linked to your Instagram).
  - Each chapter is described as a chapter of that book, with its publish and update dates, word count, PDF, and breadcrumbs.
- **A share image for every chapter** (`/og/<lang>/<chapter>.png`), showing that chapter's title. These are built on each deploy, so links shared in WhatsApp, Instagram DMs, and iMessage show the chapter.
- **Titles, descriptions, canonical URLs, and per-language link previews** on every page. A chapter's description is its excerpt.
- **Kept out of search results:**
  - The offline and 404 pages.
  - Raw PDFs, so searchers land on the chapter pages, which are mobile-friendly and tracked.
  - Netlify deploy previews and branch deploys, so test copies don't compete with the real site.

**After the first deploy:**

1. **Google Search Console:** add your site, verify it (on Netlify, the DNS or HTML-file method is easiest), then go to *Sitemaps* and submit `sitemap.xml`. This is the biggest single step for getting indexed quickly.
2. **Bing Webmaster Tools:** you can import your site straight from Search Console. Bing also powers DuckDuckGo and ChatGPT search.
3. **Custom domain:** if you add one in Netlify, it's used automatically for canonical URLs, the sitemap, and share images, because Netlify sets the `URL` variable. To force a different address, set `SITE_URL` in Netlify's environment variables.
4. **Instagram bio:** link to the site from your Instagram bio and posts. Links from a real profile help search engines trust a new site.

New chapters are added to the sitemap and RSS feeds automatically on each release.

## How the PWA works

- `public/manifest.webmanifest` holds the app name, icons, and colors.
- `src/pages/sw.js.ts` builds `/sw.js` on each deploy. Pages load network-first, so readers always get the newest text, with cached copies used when offline. Build assets are cache-first. PDFs are cached after the first open so they work offline.
- "Get the app" shows the native install prompt on Android/Chrome and step-by-step instructions on iPhone Safari.
