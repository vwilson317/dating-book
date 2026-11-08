// Chapters read in the landing page accordion count as read, the same as on a chapter page, so the
// contribute prompts and the "✓ Read" badges work for readers who never leave the home page.
import { track } from './analytics';
import { getProgress, saveProgress } from './progress';

export function initLanding() {
  const lang = document.documentElement.lang;

  document.querySelectorAll<HTMLDetailsElement>('[data-acc]').forEach((acc) => {
    const number = Number(acc.dataset.chapter);
    const base = { chapter: number, lang, title: acc.dataset.title, words_total: Number(acc.dataset.words) || 0, source: 'landing' };

    let opened = false;
    acc.addEventListener('toggle', () => {
      if (!acc.open || opened) return;
      opened = true;
      track('landing_chapter_opened', base);
    });

    // A closed section takes no space on screen, so the end only becomes visible after real scrolling.
    const end = acc.querySelector('[data-acc-end]');
    if (!end) return;
    new IntersectionObserver((entries, obs) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      if (getProgress(lang, number)?.finished) return;
      saveProgress(lang, {
        number,
        label: acc.dataset.label,
        url: acc.dataset.url!,
        pct: 100,
        finished: true,
        updated: Date.now(),
      });
      const badge = acc.querySelector<HTMLElement>('[data-progress]');
      if (badge) {
        badge.textContent = badge.dataset.readLabel!;
        badge.classList.add('is-read');
        badge.hidden = false;
      }
      track('chapter_finished', base);
      document.dispatchEvent(new CustomEvent('chapter:finished'));
    }).observe(end);
  });
}
