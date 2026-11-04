// "So you want to date the gringo?" quiz: one question at a time, score, then a WhatsApp
// message with the score where the reader has to write their own opening line.
// Their line is never sent to PostHog, only its length.
import { track } from './analytics';
import { fill } from './progress';

interface Tier {
  min: number;
  emoji: string;
  title: string;
  body: string;
}
interface QuizData {
  max: number;
  tiers: Tier[];
  waMsg: string;
  name: string;
  number: string;
  shareText: string;
  needLine: string;
  scoreLabel: string;
}

export function initQuiz() {
  const root = document.getElementById('quiz');
  const raw = document.getElementById('quiz-data');
  if (!root || !raw) return;
  const data: QuizData = JSON.parse(raw.textContent || '{}');
  const lang = document.documentElement.lang;
  const steps = [...root.querySelectorAll<HTMLElement>('.quiz-step')];
  const questions = steps.filter((s) => s.dataset.question);
  const picks = new Map<string, { answer: string; points: number }>();
  let startedAt = 0;

  const show = (name: string) => {
    steps.forEach((s) => (s.hidden = s.dataset.step !== name));
    window.scrollTo({ top: 0, behavior: 'smooth' }); // the quiz starts at the top of the page
    const first = root.querySelector<HTMLElement>(`[data-step="${name}"] h1, [data-step="${name}"] h2`);
    first?.setAttribute('tabindex', '-1');
    first?.focus({ preventScroll: true });
  };

  root.querySelector('[data-quiz-start]')?.addEventListener('click', () => {
    startedAt = Date.now();
    track('quiz_started', { lang });
    show('q0');
  });

  questions.forEach((step, i) => {
    const id = step.dataset.question!;
    const quip = step.querySelector<HTMLElement>('.quiz-quip')!;
    const next = step.querySelector<HTMLButtonElement>('[data-quiz-next]')!;
    step.querySelectorAll<HTMLButtonElement>('.quiz-answer').forEach((btn) => {
      btn.addEventListener('click', () => {
        const changed = picks.has(id);
        step.querySelectorAll('.quiz-answer').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        const points = Number(btn.dataset.points);
        picks.set(id, { answer: btn.dataset.answer!, points });
        quip.textContent = btn.dataset.quip!;
        quip.hidden = false;
        next.hidden = false;
        track('quiz_answered', { lang, question: id, question_number: i + 1, answer: btn.dataset.answer, points, changed });
      });
    });
    next.addEventListener('click', () => (i < questions.length - 1 ? show(`q${i + 1}`) : finish()));
  });

  // ---- result ----
  const text = document.getElementById('quiz-text') as HTMLTextAreaElement;
  const send = document.getElementById('quiz-send') as HTMLAnchorElement;
  const need = document.getElementById('quiz-need')!;
  let prefilled = '';
  let score = 0;
  let tier: Tier = data.tiers[data.tiers.length - 1];

  const lineLength = () => (text.value.startsWith(prefilled) ? text.value.slice(prefilled.length) : text.value).trim().length;
  const sync = () => {
    const ok = lineLength() >= 3;
    send.setAttribute('aria-disabled', String(!ok));
    send.href = data.number ? `https://wa.me/${data.number}?text=${encodeURIComponent(text.value.trim())}` : '#whatsapp-number-not-set';
    if (ok) need.hidden = true;
  };

  function finish() {
    score = [...picks.values()].reduce((sum, p) => sum + p.points, 0);
    tier = data.tiers.find((t) => score >= t.min) ?? tier;
    root!.querySelector('[data-score]')!.textContent = fill(data.scoreLabel, { score, max: data.max });
    root!.querySelector('[data-tier-emoji]')!.textContent = tier.emoji;
    root!.querySelector('[data-tier-title]')!.textContent = tier.title;
    root!.querySelector('[data-tier-body]')!.textContent = tier.body;
    prefilled = fill(data.waMsg, { name: data.name, score, max: data.max, emoji: tier.emoji, tier: tier.title });
    text.value = prefilled;
    sync();
    show('result');
    track('quiz_completed', {
      lang,
      score,
      max: data.max,
      tier: tier.title,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      answers: Object.fromEntries([...picks].map(([q, p]) => [q, p.answer])),
    });
  }

  text.addEventListener('input', sync);
  // put the cursor at the end, right after "My opening line:"
  text.addEventListener('focus', () => {
    if (text.value === prefilled) requestAnimationFrame(() => text.setSelectionRange(text.value.length, text.value.length));
  });

  send.addEventListener('click', (e) => {
    if (send.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      need.hidden = false;
      text.focus();
      text.setSelectionRange(text.value.length, text.value.length);
      track('quiz_whatsapp_blocked', { lang, score });
      return;
    }
    track('feedback_whatsapp_opened', { lang, source: 'quiz', score, tier: tier.title, line_chars: lineLength() });
  });

  root.querySelector('[data-quiz-share]')?.addEventListener('click', async () => {
    const shareText = fill(data.shareText, { score, max: data.max, tier: `${tier.emoji} ${tier.title}` });
    const url = location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ text: shareText, url });
      else await navigator.clipboard.writeText(`${shareText} ${url}`);
      track('quiz_shared', { lang, score, method: navigator.share ? 'native' : 'clipboard' });
    } catch {
      /* cancelled */
    }
  });

  root.querySelector('[data-quiz-restart]')?.addEventListener('click', () => {
    picks.clear();
    root.querySelectorAll('.quiz-answer').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    root.querySelectorAll<HTMLElement>('.quiz-quip, [data-quiz-next]').forEach((el) => (el.hidden = true));
    track('quiz_restarted', { lang, previous_score: score });
    startedAt = Date.now();
    show('q0');
  });
}
