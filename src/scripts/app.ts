import { initAnalytics, track, isStandalone, inAppBrowser } from './analytics';

initAnalytics();

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

// ---- Share buttons --------------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const data = { title: btn.dataset.shareTitle || document.title, url: btn.dataset.share || location.href };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(data.url);
        const old = btn.textContent;
        btn.textContent = 'Link copied';
        setTimeout(() => (btn.textContent = old), 2000);
      }
      track('shared', { url: data.url, method: navigator.share ? 'native' : 'clipboard' });
    } catch {
      /* user cancelled */
    }
  });
});

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
