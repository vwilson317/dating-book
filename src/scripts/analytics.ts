import posthog from 'posthog-js';

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

export function initAnalytics() {
  if (ready || !key) return;
  posthog.init(key, {
    api_host: host,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  });
  posthog.register({
    display_mode: isStandalone() ? 'standalone' : 'browser',
    in_app_browser: inAppBrowser() ?? 'none',
  });
  ready = true;
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (ready) {
    posthog.capture(event, props, { transport: 'sendBeacon' });
  } else if (import.meta.env.DEV) {
    console.debug('[track]', event, props);
  }
}
