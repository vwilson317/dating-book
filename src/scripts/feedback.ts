// Reader feedback that lands in the author's WhatsApp:
//   - end-of-chapter reactions (recorded in PostHog even if they never send)
//   - highlight a line in a chapter -> "Send this line to Vincent"
//   - footer link for general feedback
// The message a reader writes is never sent to PostHog, only whether they edited it and how long it was.
import { track } from './analytics';
import { fill } from './progress';

const WA = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

export function initFeedback() {
  const cfg = document.getElementById('wa-config');
  if (!cfg) return;
  const number = cfg.dataset.number || '';
  const name = cfg.dataset.name || '';
  const base = { lang: document.documentElement.lang };

  // When no number is configured (dev only), links go nowhere but everything else works
  const open = (text: string) => (number ? WA(number, text) : '#whatsapp-number-not-set');

  // ---- footer / general ----
  document.querySelectorAll<HTMLAnchorElement>('[data-wa-general]').forEach((a) => {
    a.href = open(fill(a.dataset.waGeneral!, { name }));
    a.addEventListener('click', () => track('feedback_whatsapp_opened', { ...base, source: a.dataset.source || 'general' }));
  });

  initReactions(open, name, base);
  initQuotes(open, name, base);
}

function initReactions(open: (t: string) => string, name: string, base: Record<string, unknown>) {
  const box = document.getElementById('feedback');
  if (!box) return;
  const chat = document.getElementById('feedback-chat')!;
  const text = document.getElementById('feedback-text') as HTMLTextAreaElement;
  const send = document.getElementById('feedback-send') as HTMLAnchorElement;
  const chapter = Number(box.dataset.chapter);
  const ch = box.dataset.label!;
  const title = box.dataset.title!;
  let reaction = '';
  let prefilled = '';

  const sync = () => (send.href = open(text.value));

  box.querySelectorAll<HTMLButtonElement>('.reaction').forEach((btn) => {
    btn.addEventListener('click', () => {
      const first = !reaction;
      box.querySelectorAll('.reaction').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      reaction = btn.dataset.reaction!;
      // Replace the pre-written part, keep anything the reader already added
      const extra = text.value.startsWith(prefilled) ? text.value.slice(prefilled.length) : '';
      prefilled = fill(box.dataset.msg!, { name, ch, title, emoji: btn.dataset.emoji!, label: btn.dataset.label! });
      text.value = prefilled + extra;
      sync();
      chat.hidden = false;
      track('feedback_reaction', { ...base, chapter, reaction, changed: !first });
      if (first) {
        chat.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  text.addEventListener('input', sync);
  send.addEventListener('click', () => {
    track('feedback_whatsapp_opened', {
      ...base,
      source: 'reaction',
      chapter,
      reaction,
      edited: text.value !== prefilled,
      added_chars: Math.max(0, text.value.length - prefilled.length),
    });
  });
}

function initQuotes(open: (t: string) => string, name: string, base: Record<string, unknown>) {
  const prose = document.querySelector<HTMLElement>('.prose');
  const article = document.querySelector<HTMLElement>('.chapter');
  const btn = document.getElementById('quote-btn') as HTMLAnchorElement | null;
  if (!prose || !article || !btn) return;
  const chapter = Number(article.dataset.chapter);
  const ch = article.dataset.label!;
  const title = article.dataset.title!;
  let quote = '';

  const hide = () => {
    btn.hidden = true;
    quote = '';
  };

  const place = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return hide();
    const range = sel.getRangeAt(0);
    if (!prose.contains(range.commonAncestorContainer)) return hide();
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 12 || text.length > 600) return hide();
    quote = text;
    btn.href = open(fill(btn.dataset.msg!, { name, ch, title, quote }));
    // Below the selection: phones put their own copy/paste menu above it
    const rect = range.getBoundingClientRect();
    const top = window.scrollY + rect.bottom + 12;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2), document.documentElement.clientWidth - 12);
    btn.style.top = `${top}px`;
    btn.style.left = `${left}px`;
    btn.hidden = false;
  };

  let t = 0;
  document.addEventListener('selectionchange', () => {
    clearTimeout(t);
    t = window.setTimeout(place, 250); // wait for the reader to finish dragging the handles
  });
  // Keep the selection alive when the button is pressed (mobile collapses it otherwise)
  btn.addEventListener('pointerdown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    // The quote is book text, not personal data, so we keep a snippet to see which lines resonate
    track('quote_shared', { ...base, chapter, quote: quote.slice(0, 140), quote_length: quote.length });
    track('feedback_whatsapp_opened', { ...base, source: 'quote', chapter });
    setTimeout(() => {
      window.getSelection()?.removeAllRanges();
      hide();
    }, 300);
  });
}
