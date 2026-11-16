// Journal post pages: the video player plus a reading summary for the written part.
//
//   journal_read – sent when the page is hidden or closed: `post`, `kind` (video/post), `percent_read`
//                  (how much of the text has been on screen), `active_seconds`, `finished`, `summary_number`.
//                  Sent again with updated totals if they come back to the tab; use the latest per `read_id`.
import { track } from './analytics';
import { initVideo } from './video';

const IDLE_AFTER_MS = 60_000;

export function initJournal() {
  document.querySelectorAll<HTMLElement>('[data-video]').forEach(initVideo);

  const article = document.querySelector<HTMLElement>('[data-journal-post]');
  const prose = article?.querySelector<HTMLElement>('.prose');
  if (!article || !prose || !prose.textContent?.trim()) return;

  const base = {
    post: article.dataset.journalPost,
    kind: article.dataset.kind,
    lang: document.documentElement.lang,
    words_total: Number(article.dataset.words) || 0,
    read_id: crypto.randomUUID?.() ?? String(Math.random()).slice(2),
  };
  let maxPct = 0;
  let activeMs = 0;
  let lastInteraction = Date.now();
  let lastTick = Date.now();
  let sends = 0;
  let lastSent = '';

  const tick = () => {
    const now = Date.now();
    if (document.visibilityState === 'visible' && now - lastInteraction < IDLE_AFTER_MS) activeMs += now - lastTick;
    lastTick = now;
  };
  const measure = () => {
    const r = prose.getBoundingClientRect();
    if (r.height <= 0) return;
    const seen = Math.min(r.height, Math.max(0, window.innerHeight - r.top));
    maxPct = Math.max(maxPct, Math.round((seen / r.height) * 100));
  };
  for (const ev of ['scroll', 'touchstart', 'keydown', 'pointerdown']) {
    document.addEventListener(ev, () => {
      tick();
      lastInteraction = Date.now();
      measure();
    }, { passive: true });
  }
  setInterval(tick, 5000);
  measure();

  const send = () => {
    tick();
    const summary = { ...base, percent_read: maxPct, active_seconds: Math.round(activeMs / 1000), finished: maxPct >= 95 };
    const key = `${summary.percent_read}|${summary.active_seconds}`;
    if (key === lastSent || summary.active_seconds === 0) return;
    lastSent = key;
    sends += 1;
    track('journal_read', { ...summary, summary_number: sends });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
    else lastTick = Date.now();
  });
  window.addEventListener('pagehide', send);
}
