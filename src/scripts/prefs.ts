// Reader display preferences, saved on the reader's device.
// The tiny inline script in Base.astro applies them before the page paints (no flash of the wrong theme);
// keep the two in sync if you add a setting.

export type Theme = 'auto' | 'light' | 'sepia' | 'dark';
export interface Prefs {
  theme: Theme;
  size: number; // 0..4, 1 = default
  font: 'serif' | 'sans';
  spacing: 'normal' | 'relaxed';
  awake: boolean; // keep the screen on while reading a chapter
}

const KEY = 'reading-prefs';
export const DEFAULTS: Prefs = { theme: 'auto', size: 1, font: 'serif', spacing: 'normal', awake: false };
export const MAX_SIZE = 4;

// Browser toolbar color per theme (matches --bg in global.css)
const BAR = { light: '#faf5ec', sepia: '#f4ecd8', dark: '#17130f' } as const;

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export function applyPrefs(p: Prefs) {
  const d = document.documentElement;
  const set = (attr: string, value: string | null) => (value == null ? d.removeAttribute(attr) : d.setAttribute(attr, value));
  set('data-theme', p.theme === 'auto' ? null : p.theme);
  set('data-size', p.size === 1 ? null : String(p.size));
  set('data-font', p.font === 'sans' ? 'sans' : null);
  set('data-spacing', p.spacing === 'relaxed' ? 'relaxed' : null);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = p.theme === 'auto' ? BAR[m.dataset.scheme === 'dark' ? 'dark' : 'light'] : BAR[p.theme];
  });
}

/** Properties attached to every analytics event, so you can see e.g. whether bigger text means more finished chapters */
export const prefsForAnalytics = (p: Prefs) => ({
  theme: p.theme,
  text_size: p.size,
  font: p.font,
  spacing: p.spacing,
  keep_awake: p.awake,
});
