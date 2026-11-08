// Floating "Contribute" button and the full-screen prompt (src/components/Support.astro).
//
// The prompt opens once after 3 finished chapters and once after every published chapter, counted
// per language on this device. Readers who already paid never see the button or the prompts.
import { track } from './analytics';
import { allProgress } from './progress';

const PROMPT_AFTER = 3;
// Leaves time to read the last lines. If they move on sooner, the next page shows the prompt.
const DELAY_AFTER_FINISH_MS = 10_000;
const DELAY_ON_LOAD_MS = 800;
const COLLAPSED_KEY = 'support-fab-collapsed';
const SOURCE_KEY = 'support-source';

type Kind = 'three' | 'finished' | 'manual';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
};

// Tag each checkout with where the buyer came from (e.g. the Instagram ad campaign), so it shows up
// in Stripe as the payment's client_reference_id, and open checkout in the page's language. The
// source is remembered because readers reach checkout several pages after landing.
function tagCheckoutLinks() {
  const params = new URLSearchParams(location.search);
  const landed = [params.get('utm_source'), params.get('utm_campaign') || params.get('utm_content')]
    .filter(Boolean)
    .join('_');
  if (landed) write(SOURCE_KEY, landed);
  const source = landed || read(SOURCE_KEY) || 'direct';
  const ref = `${document.documentElement.lang}_${source}`.replace(/[^\w-]/g, '-').slice(0, 200);
  document.querySelectorAll<HTMLAnchorElement>('a[data-stripe]').forEach((a) => {
    if (!a.dataset.stripe) return;
    const url = new URL(a.dataset.stripe);
    url.searchParams.set('client_reference_id', ref);
    url.searchParams.set('locale', a.dataset.locale === 'pt-BR' ? 'pt-BR' : 'en');
    a.href = url.toString();
    a.dataset.propRef = ref;
  });
}

export function initSupport() {
  tagCheckoutLinks();

  const modal = document.getElementById('support-modal') as HTMLDialogElement | null;
  const fab = document.getElementById('support-fab');
  if (!modal || !fab || read('supporter')) return;

  const lang = document.documentElement.lang;
  const total = Number(modal.dataset.total) || 0;
  const seenKey = (kind: Kind) => `support-prompt:${lang}:${kind}`;
  const chaptersRead = () => allProgress(lang).filter((p) => p.finished).length;
  let openKind: Kind | null = null;

  const open = (kind: Kind) => {
    openKind = kind;
    modal.querySelectorAll<HTMLElement>('[data-variant]').forEach((el) => (el.hidden = el.dataset.variant !== kind));
    modal.setAttribute('aria-labelledby', `support-title-${kind}`);
    modal.querySelector<HTMLElement>('[data-track="buy_clicked"]')!.dataset.propPrompt = kind;
    modal.showModal();
    modal.scrollTop = 0;
    track('support_prompt_shown', { kind, chapters_read: chaptersRead() });
  };

  modal.querySelectorAll('[data-support-close]').forEach((b) => b.addEventListener('click', () => modal.close()));
  modal.addEventListener('close', () => track('support_prompt_closed', { kind: openKind }));

  // ---- floating button ----
  const setCollapsed = (collapsed: boolean) => fab.classList.toggle('is-collapsed', collapsed);
  setCollapsed(read(COLLAPSED_KEY) === '1');
  fab.hidden = false;
  fab.querySelector('[data-support-open]')!.addEventListener('click', () => open('manual'));
  fab.querySelector('[data-support-hide]')!.addEventListener('click', () => {
    setCollapsed(true);
    write(COLLAPSED_KEY, '1');
    track('support_fab_hidden');
  });
  fab.querySelector('[data-support-show]')!.addEventListener('click', () => {
    setCollapsed(false);
    write(COLLAPSED_KEY, '');
    track('support_fab_restored');
  });

  // ---- prompts ----
  const due = (): Kind | null => {
    const done = chaptersRead();
    if (total > 0 && done >= total) return read(seenKey('finished')) ? null : 'finished';
    return done >= PROMPT_AFTER && !read(seenKey('three')) ? 'three' : null;
  };
  const busy = () =>
    !!document.querySelector('dialog[open]') || document.activeElement?.tagName === 'TEXTAREA';

  let timer = 0;
  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const kind = due();
      if (!kind) return;
      if (busy()) return schedule(DELAY_AFTER_FINISH_MS); // don't interrupt a message being written
      write(seenKey(kind), '1');
      open(kind);
    }, delay);
  };

  document.addEventListener('chapter:finished', () => schedule(DELAY_AFTER_FINISH_MS));
  if (due()) schedule(DELAY_ON_LOAD_MS);
}
