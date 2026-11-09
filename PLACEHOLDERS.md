# Placeholders from the Stitch redesign

These items came from the Stitch mockups and aren't real yet. They carry a pink **PLACEHOLDER** label and appear only in dev and on Netlify previews. Production builds leave them out (`showPlaceholders` in `src/site.config.ts`).

The Contribute page items are also switched off for now. Set `contributePlaceholders` to `true` in `src/site.config.ts` to show them again.

Before making one real: replace the content, then remove its `<Placeholder>` wrapper.

| Where | Placeholder | What it needs | File |
| --- | --- | --- | --- |
| Home | Reader rating (4.8★) | A real rating, or delete it | `src/components/home/Home.astro` |
| Home | Author photo and quote | Your photo and a real quote | `src/components/home/Home.astro` |
| Home | Two Rio photos | Your own photos | `src/components/home/Home.astro` |
| Chapters | Author note | Real quote | `src/components/pages/ChaptersPage.astro` |
| Chapters | Map of locations | A real image or embed | `src/components/pages/ChaptersPage.astro` |
| Chapter page | Scene photo | Photo per chapter | `src/components/pages/ChapterPage.astro` |
| Chapter page | Cultural note | Real note per chapter | `src/components/pages/ChapterPage.astro` |
| Contribute | Testimonials | Real quotes, used with permission | `src/components/pages/ContributePage.astro` |
| Contribute | Extra tier perks | Only keep perks you will really deliver | `src/components/Tiers.astro` |
| About | Whole page: bio and photo | Your bio in English and Portuguese. Then remove the `showPlaceholders` checks for the page, nav and footer, and add `/about/` to the sitemap | `src/pages/[...lang]/about.astro`, `src/layouts/Base.astro` |

Do not publish invented ratings, reader counts, testimonials or perks: people are paying based on this page.
