import posthog from 'posthog-js';
import { loadPrefs, prefsForAnalytics, environmentForAnalytics } from './prefs';

const key = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined;
// In production we go through the /ingest proxy defined in netlify.toml so ad blockers
// don't drop events. Override with PUBLIC_POSTHOG_HOST if you need to.
const host =
  (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) ||
  (import.meta.env.PROD ? '/ingest' : 'https://us.i.posthog.com');

let ready = false;

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function inAppBrowser(): string | null {
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'tiktok';
  return null;
}

/** Which kind of page this is, so events can be compared across the site without parsing URLs */
function pageType(): string {
  const path = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '').replace(/\/$/, '') || '/';
  if (path === '/') return 'home';
  if (path === '/chapters') return 'chapters';
  if (path.startsWith('/chapters/')) return 'chapter';
  return path.slice(1).split('/')[0] || 'other';
}

function isSupporter(): boolean {
  try {
    return !!localStorage.getItem('supporter');
  } catch {
    return false;
  }
}

export function initAnalytics() {
  if (ready || !key) return;
  posthog.init(key, {
    api_host: host,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    // We send the first pageview ourselves, after registering the properties below,
    // so it carries the reader's settings, language and device details too.
    capture_pageview: false,
    capture_pageleave: true,
  });
  // Sent with every event. PostHog adds device details itself: $device_type (Mobile/Tablet/Desktop),
  // $os, $browser, $screen_width, $viewport_width.
  posthog.register({
    display_mode: isStandalone() ? 'standalone' : 'browser',
    in_app_browser: inAppBrowser() ?? 'none',
    lang: document.documentElement.lang,
    page_type: pageType(),
    site_design: 'stitch', // compare against events from before the redesign, which don't have this
    is_supporter: isSupporter(),
    ...prefsForAnalytics(loadPrefs()),
    ...environmentForAnalytics(),
  });
  ready = true;
  posthog.capture('$pageview');
}

/** This browser's anonymous PostHog ID, or undefined when analytics isn't running */
export const distinctId = (): string | undefined => (ready ? posthog.get_distinct_id() : undefined);

/** Attach properties to every future event (e.g. the reader's display settings) */
export function setSuperProps(props: Record<string, unknown>) {
  if (ready) posthog.register(props);
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (ready) {
    posthog.capture(event, props, { transport: 'sendBeacon' });
  } else if (import.meta.env.DEV) {
    console.debug('[track]', event, props);
  }
}
