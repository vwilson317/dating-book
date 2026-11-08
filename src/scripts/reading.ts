// Reading analytics for chapter pages and the landing page accordion.
//
// Events (all include chapter, lang, title, version, words_total, read_id, source):
//   chapter_started   – reader actually began reading (15s of active reading or 10% of the text)
//   chapter_progress  – passed 25 / 50 / 75 / 90% of the text
//   chapter_finished  – reached the end of the text
//   chapter_read      – summary of the visit: how far, how long, how many words.
//                       Sent whenever the page is hidden (app switch, tab close, navigation).
//                       If the reader comes back and keeps reading, it's sent again with updated
//                       totals and the same read_id. Use the latest one per read_id (see README).
import { track } from './analytics';
import { getProgress, saveProgress, fill } from './progress';

const IDLE_AFTER_MS = 60_000; // stop counting time after a minute with no scroll/touch/key
const SKIM_WPM = 700; // faster than this means they scrolled through without reading

export function initReading(
  article: HTMLElement,
  prose: HTMLElement,
  end: HTMLElement,
  bar?: HTMLElement,
  source: 'chapter_page' | 'landing' = 'chapter_page',
) {
  // On the landing page many chapters share one page, so only count the one being read,
  // and leave reading position alone (that belongs to the chapter pages).
  const inline = source === 'landing';
  const beingRead = () => {
    if (!inline) return true;
    if (!(article as HTMLDetailsElement).open) return false;
    const rect = prose.getBoundingClientRect();
    return rect.top < window.innerHeight / 2 && rect.bottom > 0;
  };
  const wordsTotal = Number(article.dataset.words) || 0;
  const readId = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
  const base = {
    chapter: Number(article.dataset.chapter),
    lang: document.documentElement.lang,
    title: article.dataset.title,
    version: article.dataset.version,
    words_total: wordsTotal,
    read_id: readId,
    source,
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
    if (document.visibilityState === 'visible' && now - lastInteraction < IDLE_AFTER_MS && beingRead()) {
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
    if (inline && !beingRead()) return;
    const rect = prose.getBoundingClientRect();
    const seen = window.innerHeight - rect.top; // px of text that has scrolled into view
    const pct = rect.height > 0 ? Math.min(100, Math.max(0, (seen / rect.height) * 100)) : 100;
    if (bar) bar.style.transform = `scaleX(${pct / 100})`;
    if (pct <= maxPct) return;
    maxPct = Math.round(pct);
    // Opening a chapter on the landing page already shows 10% of it, so require scrolling into the text
    if (!started && maxPct >= 10 && (!inline || rect.top < 0)) start();
    for (const m of [25, 50, 75, 90]) {
      if (maxPct >= m && !milestones.has(m)) {
        milestones.add(m);
        track('chapter_progress', { ...base, percent: m, active_seconds: activeSeconds() });
      }
    }
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  if (inline) article.addEventListener('toggle', onScroll);
  onScroll();

  // ---- finished ----
  new IntersectionObserver((entries, obs) => {
    if (!entries.some((e) => e.isIntersecting) || finished) return;
    finished = true;
    maxPct = 100;
    if (!started) start();
    const secs = activeSeconds();
    saveProgress(base.lang, { ...position(), pct: 100, finished: true });
    document.dispatchEvent(new CustomEvent('chapter:finished'));
    track('chapter_finished', {
      ...base,
      active_seconds: secs,
      skimmed: wordsTotal > 0 && secs < (wordsTotal / SKIM_WPM) * 60,
    });
    obs.disconnect();
  }).observe(end);

  // ---- resume where you left off ----
  // Position = where the top of the screen is in the chapter text, saved on the device.
  const saved = getProgress(base.lang, base.chapter);
  const topPct = () => {
    const rect = prose.getBoundingClientRect();
    return rect.height > 0 ? Math.min(100, Math.max(0, (-rect.top / rect.height) * 100)) : 0;
  };
  const position = () => ({
    number: base.chapter,
    label: article.dataset.label,
    url: article.dataset.url ?? location.pathname,
    pct: Math.round(topPct() * 10) / 10,
    finished: finished || !!saved?.finished,
    updated: Date.now(),
  });
  if (!inline) {
    let saveTimer = 0;
    document.addEventListener(
      'scroll',
      () => {
        clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveProgress(base.lang, position()), 400);
      },
      { passive: true },
    );
    window.addEventListener('pagehide', () => saveProgress(base.lang, position()));
  }

  const resumeBtn = document.getElementById('resume-btn') as HTMLButtonElement | null;
  if (resumeBtn && saved && !saved.finished && saved.pct >= 3 && saved.pct <= 95 && topPct() < 2) {
    resumeBtn.textContent = fill(resumeBtn.dataset.label!, { pct: Math.round(saved.pct) });
    resumeBtn.hidden = false;
    const hide = () => resumeBtn.classList.add('is-gone');
    resumeBtn.addEventListener('click', () => {
      const rect = prose.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top + (saved.pct / 100) * rect.height - 24, behavior: 'smooth' });
      track('reading_resumed', { ...base, percent: Math.round(saved.pct) });
      hide();
    });
    // get out of the way once they start reading from the top instead
    const onScrollAway = () => {
      if (topPct() > 5 && !resumeBtn.classList.contains('is-gone')) {
        hide();
        document.removeEventListener('scroll', onScrollAway);
      }
    };
    document.addEventListener('scroll', onScrollAway, { passive: true });
    track('resume_offered', { ...base, percent: Math.round(saved.pct) });
  }

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
    if (inline && maxPct === 0) return; // this chapter was never on screen
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
