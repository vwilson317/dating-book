// Reading analytics for chapter pages.
//
// Events (all include chapter, title, version, words_total, read_id):
//   chapter_started   – reader actually began reading (15s of active reading or 10% of the text)
//   chapter_progress  – passed 25 / 50 / 75 / 90% of the text
//   chapter_finished  – reached the end of the text
//   chapter_read      – summary of the visit: how far, how long, how many words.
//                       Sent whenever the page is hidden (app switch, tab close, navigation).
//                       If the reader comes back and keeps reading, it's sent again with updated
//                       totals and the same read_id. Use the latest one per read_id (see README).
import { track } from './analytics';

const IDLE_AFTER_MS = 60_000; // stop counting time after a minute with no scroll/touch/key
const SKIM_WPM = 700; // faster than this means they scrolled through without reading

export function initReading(article: HTMLElement, prose: HTMLElement, end: HTMLElement, bar?: HTMLElement) {
  const wordsTotal = Number(article.dataset.words) || 0;
  const readId = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
  const base = {
    chapter: Number(article.dataset.chapter),
    title: article.dataset.title,
    version: article.dataset.version,
    words_total: wordsTotal,
    read_id: readId,
  };

  let maxPct = 0; // 0..100, how much of the text has been on screen
  let activeMs = 0;
  let lastInteraction = Date.now();
  let lastTick = Date.now();
  let started = false;
  let finished = false;
  let sends = 0;
  let lastSent = '';
  const milestones = new Set<number>();

  // bring the timer up to date first: intervals get throttled, so don't rely on the last tick
  const activeSeconds = () => {
    tick();
    return Math.round(activeMs / 1000);
  };

  // ---- active time ----
  const tick = () => {
    const now = Date.now();
    if (document.visibilityState === 'visible' && now - lastInteraction < IDLE_AFTER_MS) {
      activeMs += now - lastTick;
    }
    lastTick = now;
    if (!started && activeMs >= 15_000) start();
  };
  setInterval(tick, 1000);
  for (const ev of ['scroll', 'touchstart', 'pointerdown', 'keydown', 'mousemove']) {
    window.addEventListener(ev, () => (lastInteraction = Date.now()), { passive: true });
  }

  const start = () => {
    started = true;
    track('chapter_started', { ...base, active_seconds: activeSeconds(), percent: maxPct });
  };

  // ---- depth ----
  const onScroll = () => {
    const rect = prose.getBoundingClientRect();
    const seen = window.innerHeight - rect.top; // px of text that has scrolled into view
    const pct = rect.height > 0 ? Math.min(100, Math.max(0, (seen / rect.height) * 100)) : 100;
    if (bar) bar.style.transform = `scaleX(${pct / 100})`;
    if (pct <= maxPct) return;
    maxPct = Math.round(pct);
    if (!started && maxPct >= 10) start();
    for (const m of [25, 50, 75, 90]) {
      if (maxPct >= m && !milestones.has(m)) {
        milestones.add(m);
        track('chapter_progress', { ...base, percent: m, active_seconds: activeSeconds() });
      }
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // ---- finished ----
  new IntersectionObserver((entries, obs) => {
    if (!entries.some((e) => e.isIntersecting) || finished) return;
    finished = true;
    maxPct = 100;
    if (!started) start();
    const secs = activeSeconds();
    track('chapter_finished', {
      ...base,
      active_seconds: secs,
      skimmed: wordsTotal > 0 && secs < (wordsTotal / SKIM_WPM) * 60,
    });
    obs.disconnect();
  }).observe(end);

  // ---- visit summary ----
  const summary = () => {
    tick();
    const secs = activeSeconds();
    const wordsRead = Math.round((wordsTotal * maxPct) / 100);
    return {
      ...base,
      percent_read: maxPct,
      words_read: wordsRead,
      active_seconds: secs,
      words_per_minute: secs >= 10 ? Math.round(wordsRead / (secs / 60)) : null,
      started,
      finished,
      bounced: !started,
    };
  };
  const send = () => {
    const s = summary();
    const key = `${s.percent_read}|${s.active_seconds}|${s.finished}`;
    if (key === lastSent) return; // nothing new since the last summary
    lastSent = key;
    sends += 1;
    track('chapter_read', { ...s, summary_number: sends });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  window.addEventListener('pagehide', send);
}
