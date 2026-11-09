// Remembers where each reader is in each chapter (on their device only), so the site can offer
// "Continue where you left off", show ✓ Read on chapter cards, and a "Continue Chapter N" button.

export interface Progress {
  number: number;
  label?: string; // "Chapter 3" / "Introduction"
  url: string;
  pct: number; // 0..100, position of the top of the screen in the chapter text
  finished: boolean;
  updated: number;
}

const PREFIX = 'progress:';
const key = (lang: string, n: number) => `${PREFIX}${lang}:${n}`;

export function getProgress(lang: string, n: number): Progress | null {
  try {
    return JSON.parse(localStorage.getItem(key(lang, n)) || 'null');
  } catch {
    return null;
  }
}

export function saveProgress(lang: string, p: Progress) {
  try {
    localStorage.setItem(key(lang, p.number), JSON.stringify(p));
  } catch {
    /* storage full / private mode */
  }
}

export function allProgress(lang: string): Progress[] {
  const out: Progress[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(`${PREFIX}${lang}:`)) continue;
    try {
      out.push(JSON.parse(localStorage.getItem(k)!));
    } catch {
      /* ignore */
    }
  }
  return out.sort((a, b) => b.updated - a.updated);
}

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** Chapter cards and the home page "continue" button */
export function initProgressUI() {
  const lang = document.documentElement.lang;

  document.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => {
    const p = getProgress(lang, Number(el.dataset.progress));
    if (!p) return;
    if (p.finished) el.textContent = el.dataset.readLabel!;
    else if (p.pct >= 3) el.textContent = fill(el.dataset.pctLabel!, { pct: Math.round(p.pct) });
    else return;
    el.hidden = false;
    el.classList.toggle('is-read', p.finished);
  });

  // Mobile tab bar: "Read" goes to the chapter this reader is in the middle of
  const readerTab = document.querySelector<HTMLAnchorElement>('[data-tab-reader]');
  const reading = allProgress(lang).find((p) => !p.finished && p.pct >= 3);
  if (readerTab && reading) readerTab.href = reading.url;

  const cta = document.querySelector<HTMLAnchorElement>('[data-continue]');
  const current = allProgress(lang).find((p) => !p.finished && p.pct >= 3);
  if (cta && current) {
    cta.href = current.url;
    cta.textContent = fill(cta.dataset.continue!, { ch: current.label ?? String(current.number) });
    cta.dataset.propCta = 'continue_reading';
  }
}

export { fill };
