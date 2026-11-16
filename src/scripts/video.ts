// Journal video player (src/components/VideoPlayer.astro).
//
// On a phone, tapping play opens the video full screen and turns it sideways (landscape videos):
//   - Android / Chrome: Fullscreen API on the <video>, then screen.orientation.lock('landscape').
//   - iPhone: no Fullscreen API for pages, so the video plays in Safari's own full-screen player,
//     which rotates with the phone. (Websites can't force rotation on iOS.)
//   - Where neither works (some in-app browsers), it plays in the page and shows "turn your phone
//     sideways"; turning it fills the screen with the video (CSS in VideoPlayer.astro).
// Desktop plays in the page. Where you stopped is remembered on the device.
//
// Events (all include video, title, lang, duration, orientation, watch_id, phone):
//   video_play_clicked        – tapped the big play button; `resumed_at` (seconds) when picking up where they left off
//   video_started             – the first frame actually played; `startup_ms` (tap to first frame)
//   video_progress            – passed 25 / 50 / 75 / 90% of the video; `percent`
//   video_finished            – reached the end
//   video_watched             – summary when the page is hidden or closed: `seconds_watched`, `max_percent`,
//                               `finished`, `fullscreen_seconds`, `stalls` (times it stopped to buffer), `summary_number`
//   video_fullscreen_entered  – `method` (api/ios_native), `orientation_locked`, `trigger` (play/controls)
//   video_fullscreen_exited   – `seconds` spent full screen
//   video_rotate_hint_shown   – full screen wasn't possible, so we asked them to turn the phone
//   video_seeked              – `from`, `to` (seconds)
//   video_speed_changed       – `speed`
//   video_captions_toggled    – `enabled`
//   video_error               – the video failed to load; `code` (MediaError code), `host`
import { track } from './analytics';

type FsVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

const store = {
  get(k: string): { t: number } | null {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

export function initVideo(fig: HTMLElement) {
  const video = fig.querySelector('video') as FsVideo;
  const playBtn = fig.querySelector<HTMLButtonElement>('.vplayer-play')!;
  const resumeEl = fig.querySelector<HTMLElement>('.vplayer-resume');
  const errorEl = fig.querySelector<HTMLElement>('.vplayer-error');
  const hint = fig.querySelector<HTMLElement>('.vplayer-hint');
  const orientation = fig.dataset.orientation === 'portrait' ? 'portrait' : 'landscape';
  const lang = document.documentElement.lang;
  const posKey = `video:${lang}:${fig.dataset.video}`;
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;

  const watchId = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
  const duration = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Number(fig.dataset.duration) || 0);
  const base = () => ({
    video: fig.dataset.video,
    title: fig.dataset.title,
    lang,
    duration: Math.round(duration()) || null,
    orientation,
    watch_id: watchId,
    phone,
  });

  // ---- where they left off ----
  const saved = store.get(posKey);
  const savedAt = saved && saved.t > 10 && (!duration() || saved.t < duration() - 15) ? saved.t : 0;
  if (savedAt && resumeEl) {
    resumeEl.textContent = playBtn.dataset.resumeLabel!.replace('{time}', clock(savedAt));
    resumeEl.hidden = false;
  }
  let lastSave = 0;
  const savePos = (force = false) => {
    if (!started) return;
    const now = Date.now();
    if (!force && now - lastSave < 5000) return;
    lastSave = now;
    store.set(posKey, finished ? null : { t: Math.round(video.currentTime), updated: now });
  };

  // ---- state for the summary ----
  let started = false;
  let finished = false;
  let clickedAt = 0;
  let watched = 0; // seconds of video actually played (not skipped over)
  let lastPos: number | null = null;
  let maxPct = 0;
  let stalls = 0;
  let fsSince = 0;
  let fsTotal = 0;
  let sends = 0;
  let lastSent = '';
  const milestones = new Set<number>();

  // ---- full screen + sideways ----
  const lockable = screen.orientation as LockableOrientation | undefined;
  const fsActive = () => document.fullscreenElement === video || !!video.webkitDisplayingFullscreen;
  const onFsEnter = (method: 'api' | 'ios_native', locked: boolean, trigger: 'play' | 'controls') => {
    fsSince = Date.now();
    if (hint) hint.hidden = true;
    track('video_fullscreen_entered', { ...base(), method, orientation_locked: locked, trigger });
  };
  const onFsExit = () => {
    if (!fsSince) return;
    const secs = Math.round((Date.now() - fsSince) / 1000);
    fsTotal += secs;
    fsSince = 0;
    lockable?.unlock?.();
    track('video_fullscreen_exited', { ...base(), seconds: secs });
  };
  let requestedByUs = false;

  const showHint = () => {
    if (!hint || !phone || orientation !== 'landscape' || matchMedia('(orientation: landscape)').matches) return;
    hint.hidden = false;
    track('video_rotate_hint_shown', base());
  };

  /** Called inside the tap, so the browser allows it. Returns false when it isn't possible. */
  const enterFullscreen = (): boolean => {
    if (video.requestFullscreen && document.fullscreenEnabled) {
      requestedByUs = true;
      video
        .requestFullscreen({ navigationUI: 'hide' })
        .then(async () => {
          let locked = false;
          try {
            await lockable?.lock?.(orientation);
            locked = !!lockable?.lock;
          } catch {
            /* not allowed here (desktop, some browsers) */
          }
          onFsEnter('api', locked, 'play');
        })
        .catch(() => {
          requestedByUs = false;
          showHint();
        });
      return true;
    }
    return false;
  };

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === video) {
      if (!requestedByUs) onFsEnter('api', false, 'controls'); // the native full-screen button
      requestedByUs = false;
    } else onFsExit();
  });
  video.addEventListener('webkitbeginfullscreen', () => onFsEnter('ios_native', false, started ? 'controls' : 'play'));
  video.addEventListener('webkitendfullscreen', onFsExit);

  // Turned the phone sideways mid-video: bring the player into view and drop the hint.
  matchMedia('(orientation: landscape)').addEventListener('change', (e) => {
    if (!e.matches || video.paused) return;
    if (hint) hint.hidden = true;
    if (!fsActive()) fig.scrollIntoView({ block: 'center' });
  });

  // ---- play ----
  playBtn.addEventListener('click', () => {
    clickedAt = performance.now();
    if (savedAt) video.currentTime = savedAt;
    video.controls = true;
    playBtn.hidden = true;
    // iPhone: without playsinline, playing opens Safari's full-screen player, which rotates with the phone
    const iosNative = phone && orientation === 'landscape' && !(video.requestFullscreen && document.fullscreenEnabled) && !!video.webkitEnterFullscreen;
    if (iosNative) video.removeAttribute('playsinline');
    const playing = video.play();
    let fullscreen = iosNative;
    if (phone && !iosNative) fullscreen = enterFullscreen();
    if (phone && !fullscreen) showHint();
    track('video_play_clicked', { ...base(), resumed_at: savedAt || null, fullscreen_attempted: fullscreen });
    playing?.catch(() => {
      /* blocked or failed; the native controls are showing, and 'error' reports real failures */
    });
  });

  video.addEventListener('playing', () => {
    if (started) return;
    started = true;
    track('video_started', { ...base(), startup_ms: clickedAt ? Math.round(performance.now() - clickedAt) : null, resumed_at: savedAt || null });
  });
  video.addEventListener('waiting', () => {
    if (started && !video.seeking) stalls += 1;
  });

  // ---- progress ----
  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    if (lastPos !== null && !video.paused && !video.seeking) {
      const d = t - lastPos;
      if (d > 0 && d < 2) watched += d;
    }
    lastPos = t;
    const dur = duration();
    if (dur) {
      const pct = Math.min(100, Math.round((t / dur) * 100));
      maxPct = Math.max(maxPct, pct);
      for (const m of [25, 50, 75, 90]) {
        if (pct >= m && !milestones.has(m) && started) {
          milestones.add(m);
          track('video_progress', { ...base(), percent: m, seconds_watched: Math.round(watched) });
        }
      }
    }
    savePos();
  });

  let seekFrom: number | null = null;
  let seekTimer = 0;
  video.addEventListener('seeking', () => {
    if (seekFrom === null && lastPos !== null) seekFrom = lastPos;
    lastPos = null;
  });
  video.addEventListener('seeked', () => {
    // scrubbing fires many seeks; report one per gesture
    clearTimeout(seekTimer);
    seekTimer = window.setTimeout(() => {
      if (started && seekFrom !== null) track('video_seeked', { ...base(), from: Math.round(seekFrom), to: Math.round(video.currentTime) });
      seekFrom = null;
    }, 800);
  });

  video.addEventListener('ended', () => {
    finished = true;
    maxPct = 100;
    fig.classList.remove('is-active');
    store.set(posKey, null);
    track('video_finished', { ...base(), seconds_watched: Math.round(watched) });
    // come back to the page, where the post and "more from the journal" are
    if (document.fullscreenElement === video) document.exitFullscreen().catch(() => {});
  });
  video.addEventListener('pause', () => {
    savePos(true);
    fig.classList.remove('is-active');
  });
  video.addEventListener('play', () => fig.classList.add('is-active'));

  video.addEventListener('ratechange', () => {
    if (started) track('video_speed_changed', { ...base(), speed: video.playbackRate });
  });
  video.textTracks?.addEventListener?.('change', () => {
    const on = Array.from(video.textTracks).some((tt) => tt.mode === 'showing');
    if (started) track('video_captions_toggled', { ...base(), enabled: on });
  });

  video.addEventListener('error', () => {
    if (errorEl) errorEl.hidden = false;
    playBtn.hidden = true;
    let host = '';
    try {
      host = new URL(video.currentSrc || video.src, location.href).host;
    } catch {
      /* ignore */
    }
    track('video_error', { ...base(), code: video.error?.code ?? null, host });
  });

  // Lock screen / notification controls show the post title and poster
  if ('mediaSession' in navigator && fig.dataset.poster) {
    video.addEventListener(
      'play',
      () => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: fig.dataset.title,
          artist: document.querySelector('meta[name="author"]')?.getAttribute('content') ?? '',
          artwork: [{ src: new URL(fig.dataset.poster!, location.href).toString() }],
        });
      },
      { once: true },
    );
  }

  // ---- visit summary ----
  const send = () => {
    if (!started) return;
    savePos(true);
    const fsNow = fsSince ? Math.round((Date.now() - fsSince) / 1000) : 0;
    const summary = {
      ...base(),
      seconds_watched: Math.round(watched),
      max_percent: maxPct,
      finished,
      fullscreen_seconds: fsTotal + fsNow,
      stalls,
    };
    const key = `${summary.seconds_watched}|${summary.max_percent}|${finished}`;
    if (key === lastSent) return;
    lastSent = key;
    sends += 1;
    track('video_watched', { ...summary, summary_number: sends });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  window.addEventListener('pagehide', send);
}
