import { initAnalytics, track, isStandalone, inAppBrowser } from './analytics';
import { initSettings } from './settings';
import { initProgressUI } from './progress';
import { initFeedback } from './feedback';
import { initSupport } from './support';

initAnalytics();
initSettings();
initProgressUI();
initFeedback();
initSupport();

// ---- Click tracking -------------------------------------------------------
// Any element with data-track="event_name" sends that event when clicked.
// data-prop-foo="bar" attributes become event properties ({ foo: "bar" }).
document.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLElement>('[data-track]');
  if (!el) return;
  const props: Record<string, string> = {};
  for (const [k, v] of Object.entries(el.dataset)) {
    if (k.startsWith('prop') && v != null) {
      props[k.slice(4).replace(/^./, (c) => c.toLowerCase())] = v;
    }
  }
  track(el.dataset.track!, props);
});

// ---- Section views --------------------------------------------------------
// Any element with data-track-view="name" sends section_viewed once per page when it scrolls into
// view. These are the denominators: how many people saw the Contribute box, not just who clicked it.
const viewed = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      viewed.unobserve(entry.target);
      track('section_viewed', { section: (entry.target as HTMLElement).dataset.trackView });
    }
  },
  { rootMargin: '0px 0px -25% 0px' },
);
document.querySelectorAll('[data-track-view]').forEach((el) => viewed.observe(el));

// ---- Share buttons --------------------------------------------------------
// Clipboard access is unreliable in in-app browsers, so fall back to the older copy command.
async function copyText(text: string, near: Element): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    near.after(field); // beside the button, because the page behind an open dialog can't be selected
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const data = { title: btn.dataset.shareTitle || document.title, url: btn.dataset.share || location.href };
    // The native share sheet is missing or fails inside Instagram's browser, so copy the link there.
    const useSheet = !!navigator.share && !inAppBrowser();
    try {
      if (useSheet) {
        await navigator.share(data);
      } else {
        const copied = await copyText(data.url, btn);
        const old = btn.textContent;
        btn.textContent = copied ? btn.dataset.copied || 'Link copied' : data.url; // show it to copy by hand
        setTimeout(() => (btn.textContent = old), copied ? 2000 : 8000);
        if (!copied) return;
      }
      track('shared', { url: data.url, method: useSheet ? 'native' : 'clipboard', location: btn.dataset.shareLocation ?? 'page' });
    } catch {
      /* user cancelled */
    }
  });
});

// ---- Back to top ----------------------------------------------------------
const toTop = document.getElementById('to-top');
if (toTop) {
  const update = () => (toTop.hidden = window.scrollY < 600);
  document.addEventListener('scroll', update, { passive: true });
  update();
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ---- Dismissible banners --------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.dismiss!;
    document.getElementById(id)?.setAttribute('hidden', '');
    sessionStorage.setItem(`dismissed:${id}`, '1');
  });
});

// Instagram's in-app browser can't install PWAs and is clumsy with downloads,
// so nudge readers to open the page in their real browser.
const inApp = inAppBrowser();
if (inApp && !sessionStorage.getItem('dismissed:inapp-banner')) {
  document.getElementById('inapp-banner')?.removeAttribute('hidden');
  track('in_app_browser_seen', { app: inApp });
}

// ---- Language -----------------------------------------------------------
// Home pages follow the language the reader last picked, else their location (inline script in
// Base.astro). That's also what makes the installed app open in the language they switched to.
// Elsewhere we never redirect (shared links must open what was shared), but we offer the
// other language when the visitor's location or phone language points to it.
// Tapping a language, or dismissing the offer, is remembered and wins from then on.
const pageLang = document.documentElement.lang;
document.querySelectorAll<HTMLElement>('[data-lang-switch]').forEach((a) =>
  a.addEventListener('click', () => localStorage.setItem('lang-pref', a.dataset.langSwitch!)),
);
document.querySelectorAll<HTMLButtonElement>('[data-dismiss-lang]').forEach((btn) =>
  btn.addEventListener('click', () => {
    localStorage.setItem('lang-pref', pageLang);
    btn.parentElement?.setAttribute('hidden', '');
  }),
);
const auto = sessionStorage.getItem('lang-auto');
if (auto) {
  sessionStorage.removeItem('lang-auto');
  try {
    track('language_auto_selected', { reason: 'location', ...JSON.parse(auto) });
  } catch {
    /* ignore */
  }
}
const pref = localStorage.getItem('lang-pref');
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zones = JSON.parse(document.getElementById('lang-zones')?.textContent || '{}') as Record<string, string[]>;
const locationLang = Object.keys(zones).find((l) => zones[l].includes(tz));
const browserLang = (navigator.languages?.[0] || navigator.language || '').slice(0, 2).toLowerCase();
const wanted = pref || locationLang || browserLang;
if (wanted && wanted !== pageLang) {
  const banner = document.querySelector<HTMLElement>(`[data-suggest-lang="${wanted}"]`);
  if (banner) {
    banner.hidden = false;
    track('language_suggested', { to: wanted, from: pageLang, reason: pref ? 'preference' : locationLang ? 'location' : 'browser', tz });
  }
}

// ---- Install ("Get the app") ---------------------------------------------
const installBtn = document.getElementById('install-btn') as HTMLButtonElement | null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !inApp;
let deferredPrompt: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null =
  null;

if (installBtn && !isStandalone()) {
  // Chrome / Edge / Android
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as typeof deferredPrompt;
    installBtn.hidden = false;
  });
  // iOS Safari has no install prompt, so show instructions instead
  if (isIOS) installBtn.hidden = false;

  installBtn.addEventListener('click', async () => {
    track('install_clicked', { platform: isIOS ? 'ios' : 'other' });
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      track('install_prompt_result', { outcome });
      deferredPrompt = null;
      installBtn.hidden = true;
    } else if (isIOS) {
      (document.getElementById('ios-install') as HTMLDialogElement | null)?.showModal();
    }
  });
}

window.addEventListener('appinstalled', () => track('app_installed'));

// ---- Service worker -------------------------------------------------------
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
