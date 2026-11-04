// The "Aa" reading-settings panel: theme, text size, font, spacing, keep screen on.
import { loadPrefs, savePrefs, applyPrefs, prefsForAnalytics, MAX_SIZE, type Prefs } from './prefs';
import { track, setSuperProps } from './analytics';

let wakeLock: { release: () => Promise<void> } | null = null;

/** Keep the screen from dimming, but only on chapter pages and only while the page is visible. */
async function syncWakeLock(enabled: boolean) {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof wakeLock> } };
  if (!nav.wakeLock) return;
  const wanted = enabled && !!document.querySelector('.chapter') && document.visibilityState === 'visible';
  if (wanted && !wakeLock) {
    try {
      wakeLock = await nav.wakeLock.request('screen');
      (wakeLock as unknown as EventTarget)?.addEventListener?.('release', () => (wakeLock = null));
    } catch {
      wakeLock = null; // low battery mode, etc.
    }
  } else if (!wanted && wakeLock) {
    await wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

export function initSettings() {
  let prefs = loadPrefs();
  applyPrefs(prefs);
  setSuperProps(prefsForAnalytics(prefs));
  syncWakeLock(prefs.awake);
  document.addEventListener('visibilitychange', () => syncWakeLock(prefs.awake));

  const panel = document.getElementById('reading-settings') as HTMLDialogElement | null;
  const openBtn = document.getElementById('settings-btn');
  if (!panel || !openBtn) return;

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    if (prefs[key] === value) return;
    prefs = { ...prefs, [key]: value };
    applyPrefs(prefs);
    savePrefs(prefs);
    setSuperProps(prefsForAnalytics(prefs));
    syncWakeLock(prefs.awake);
    render();
    track('reading_settings_changed', { setting: key, value });
  };

  const sizeDown = panel.querySelector<HTMLButtonElement>('[data-size="down"]')!;
  const sizeUp = panel.querySelector<HTMLButtonElement>('[data-size="up"]')!;
  const dots = panel.querySelectorAll<HTMLElement>('.size-dots span');
  const awake = panel.querySelector<HTMLInputElement>('input[name="awake"]');

  const render = () => {
    for (const name of ['theme', 'font', 'spacing'] as const) {
      panel.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((r) => (r.checked = r.value === prefs[name]));
    }
    sizeDown.disabled = prefs.size <= 0;
    sizeUp.disabled = prefs.size >= MAX_SIZE;
    dots.forEach((d, i) => d.classList.toggle('on', i <= prefs.size));
    if (awake) awake.checked = prefs.awake;
  };

  panel.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'awake') update('awake', input.checked);
    else if (input.name === 'theme' || input.name === 'font' || input.name === 'spacing') {
      update(input.name, input.value as never);
    }
  });
  sizeDown.addEventListener('click', () => update('size', Math.max(0, prefs.size - 1)));
  sizeUp.addEventListener('click', () => update('size', Math.min(MAX_SIZE, prefs.size + 1)));

  // Wake Lock isn't available everywhere (e.g. older iPhones); hide the option there
  if (!('wakeLock' in navigator)) panel.querySelector('.awake-row')?.setAttribute('hidden', '');

  // Non-modal so the page stays visible and readers see changes as they make them
  const close = () => {
    panel.close();
    openBtn.setAttribute('aria-expanded', 'false');
  };
  openBtn.addEventListener('click', () => {
    if (panel.open) return close();
    render();
    panel.show();
    openBtn.setAttribute('aria-expanded', 'true');
    track('reading_settings_opened');
  });
  panel.querySelector('[data-close]')?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && panel.open && close());
  document.addEventListener('click', (e) => {
    if (panel.open && !panel.contains(e.target as Node) && !openBtn.contains(e.target as Node)) close();
  });
}
