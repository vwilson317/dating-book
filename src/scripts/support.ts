// Floating "Contribute" button and the full-screen prompt (src/components/Support.astro).
//
// The prompt opens once after 3 finished chapters and once after every published chapter, counted
// per language on this device. Readers who already paid never see the button or the prompts.
import { distinctId, track } from './analytics';
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
// in Stripe as the payment's client_reference_id. The source is remembered because readers reach
// checkout several pages after landing.
function tagCheckoutForms() {
  const params = new URLSearchParams(location.search);
  const landed = [params.get('utm_source'), params.get('utm_campaign') || params.get('utm_content')]
    .filter(Boolean)
    .join('_');
  if (landed) write(SOURCE_KEY, landed);
  const source = landed || read(SOURCE_KEY) || 'direct';
  const ref = `${document.documentElement.lang}_${source}`.replace(/[^\w-]/g, '-').slice(0, 200);
  document.querySelectorAll<HTMLFormElement>('form[data-checkout]').forEach((form) => {
    form.querySelector<HTMLInputElement>('input[name="ref"]')!.value = ref;
    form.querySelector<HTMLElement>('[data-track]')!.dataset.propRef = ref;
    // Lets the Stripe webhook attach the purchase to this reader's anonymous analytics history
    const visitor = distinctId();
    if (visitor) {
      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = 'ph_id';
      field.value = visitor;
      form.append(field);
    }
  });
}

export function initSupport() {
  tagCheckoutForms();

  if (read('supporter')) {
    document.querySelectorAll<HTMLElement>('[data-support-cta]').forEach((el) => (el.hidden = true));
  }

  const modal = document.getElementById('support-modal') as HTMLDialogElement | null;
  const fab = document.getElementById('support-fab');
  if (!modal || !fab || read('supporter')) return;

  const lang = document.documentElement.lang;
  const total = Number(modal.dataset.total) || 0;
  const seenKey = (kind: Kind) => `support-prompt:${lang}:${kind}`;
  const chaptersRead = () => allProgress(lang).filter((p) => p.finished).length;
  let openKind: Kind | null = null;

  const open = (kind: Kind, from?: string) => {
    openKind = kind;
    modal.querySelectorAll<HTMLElement>('[data-variant]').forEach((el) => (el.hidden = el.dataset.variant !== kind));
    modal.setAttribute('aria-labelledby', `support-title-${kind}`);
    modal.querySelectorAll<HTMLElement>('[data-track="buy_clicked"]').forEach((a) => (a.dataset.propPrompt = kind));
    modal.showModal();
    modal.scrollTop = 0;
    track('support_prompt_shown', { kind, from: from ?? 'automatic', chapters_read: chaptersRead() });
  };

  modal.querySelectorAll('[data-support-close]').forEach((b) => b.addEventListener('click', () => modal.close()));
  modal.addEventListener('close', () => track('support_prompt_closed', { kind: openKind }));

  // ---- floating button ----
  const setCollapsed = (collapsed: boolean) => fab.classList.toggle('is-collapsed', collapsed);
  setCollapsed(read(COLLAPSED_KEY) === '1');
  fab.hidden = false;
  document.querySelectorAll<HTMLElement>('[data-support-open]').forEach((b) =>
    b.addEventListener('click', () => open('manual', b.dataset.supportOpen)),
  );
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
