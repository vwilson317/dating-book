// The landing page accordion. Chapters read here count as read, the same as on a chapter page, so
// the contribute prompts and the "✓ Read" badges work for readers who never leave the home page.
import { track } from './analytics';
import { getProgress } from './progress';
import { initReading } from './reading';

/** Runs once, the first time the element is on screen. Animations start here so none play out of view. */
function whenSeen(el: Element, fn: () => void) {
  new IntersectionObserver((entries, obs) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    obs.disconnect();
    fn();
  }).observe(el);
}

export function initLanding() {
  const lang = document.documentElement.lang;
  const accs = [...document.querySelectorAll<HTMLDetailsElement>('[data-acc]')];
  const header = document.getElementById('site-header');

  // Tapping a chapter closes the others, which shifts the page,
  // so jump to the new chapter's heading, just below the sticky header.
  const show = (acc: HTMLDetailsElement) => {
    accs.forEach((a) => (a.open = a === acc));
    const top = acc.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0);
    window.scrollTo({ top, behavior: 'instant' });
  };
  // Links like /#chapter-5 open that chapter
  const showFromHash = () => {
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target instanceof HTMLDetailsElement && accs.includes(target)) show(target);
  };

  accs.forEach((acc, i) => {
    acc.querySelector('summary')!.addEventListener('click', (e) => {
      e.preventDefault();
      show(acc);
      history.replaceState(null, '', `#${acc.id}`);
    });

    const number = Number(acc.dataset.chapter);
    const base = { chapter: number, lang, title: acc.dataset.title, words_total: Number(acc.dataset.words) || 0, source: 'landing' };
    const body = acc.querySelector<HTMLElement>('.acc-body')!;

    // The chapter that starts expanded isn't a reader's choice: no animation and not counted
    let startedOpen = acc.open;
    let tracked = acc.open;
    acc.addEventListener('toggle', () => {
      if (!acc.open) {
        startedOpen = false;
        body.classList.remove('is-revealed');
        return;
      }
      if (startedOpen) {
        startedOpen = false;
        return;
      }
      whenSeen(acc.querySelector('.acc-page')!, () => body.classList.add('is-revealed'));
      if (acc.dataset.autoOpened) {
        delete acc.dataset.autoOpened; // counted as landing_next_auto_opened, not a tap
      } else if (!tracked) {
        tracked = true;
        track('landing_chapter_opened', base);
      }
    });

    // Same events and saved progress as a chapter page
    const end = acc.querySelector<HTMLElement>('[data-acc-end]')!;
    const alreadyRead = !!getProgress(lang, number)?.finished;
    initReading(acc, acc.querySelector<HTMLElement>('.prose')!, end, undefined, 'landing');

    const showReadBadge = () => {
      const badge = acc.querySelector<HTMLElement>('[data-progress]');
      if (!badge || alreadyRead) return;
      badge.textContent = badge.dataset.readLabel!;
      badge.classList.add('is-read', 'just-read');
      badge.hidden = false;
    };

    // The next chapter opens below this one, so the text being read doesn't move.
    const openNext = () => {
      const next = accs[i + 1];
      if (!next || next.open) return;
      next.dataset.autoOpened = '1';
      next.open = true;
      track('landing_next_auto_opened', base);
      const done = acc.querySelector<HTMLElement>('[data-acc-done]')!;
      done.hidden = false;
      whenSeen(done, () => done.classList.add('is-in'));
      const row = next.querySelector('summary')!;
      whenSeen(row, () => row.classList.add('is-up-next'));
    };

    // A closed section takes no space on screen, so the end only becomes visible after real scrolling.
    whenSeen(end, () => {
      showReadBadge();
      openNext();
    });
  });

  showFromHash();
  document.fonts?.ready.then(showFromHash); // web fonts change the height of the rows above
  window.addEventListener('hashchange', showFromHash);
}
