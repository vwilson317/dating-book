// Audio narration player for chapter pages.
//
// - Remembers where you stopped in each chapter, and your playback speed (on the device).
// - Lock-screen / headphone controls through the Media Session API.
// - When a chapter ends, keeps going with the next one in the same <audio> element, so it works
//   with the screen off. Finishing a chapter by ear marks it ✓ Read, same as reading it.
//
// Events (all include chapter, lang, title, version, duration, listen_id):
//   audio_started    – first play of a chapter in this visit; `resumed_at` (seconds) if it picked up where they left off
//   audio_progress   – passed 25 / 50 / 75 / 90% of the chapter; `percent`
//   audio_finished   – reached the end
//   audio_listened   – summary when the page is hidden: `seconds_listened`, `max_percent`, `speed`
//   audio_speed_changed, audio_next_chapter (autoplay into the next chapter)
import { track } from './analytics';
import { saveProgress, getProgress } from './progress';

interface Track {
  number: number;
  label: string;
  title: string;
  url: string;
  src: string;
  duration: number;
  version: string;
}
interface Data {
  meta: { lang: string; current: number; artist: string; album: string; artwork: string };
  tracks: Track[];
}

const posKey = (lang: string, n: number) => `listen:${lang}:${n}`;
const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode / full */
    }
  },
};
const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function initListen(root: HTMLElement, mini: HTMLElement) {
  const { meta, tracks }: Data = JSON.parse(document.getElementById('listen-data')!.textContent!);
  const audio = root.querySelector('audio')!;
  const $ = <T extends Element = HTMLElement>(sel: string, el: Element = root) => el.querySelector<T>(sel)!;
  const seek = $<HTMLInputElement>('[data-seek]');
  const speedBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-speed]')];
  const autoNext = $<HTMLInputElement>('[data-autonext]');
  const sub = $('[data-sub]');
  const now = $('[data-now]');
  const nowLink = $<HTMLAnchorElement>('[data-now-link]');
  const title = $('[data-listen-title]');
  const listenTitle = title.textContent!;
  const playButtons = document.querySelectorAll<HTMLButtonElement>('[data-play]');
  const { labelPlay = 'Play', labelPause = 'Pause' } = $('[data-play]').dataset;

  let index = Math.max(0, tracks.findIndex((t) => t.number === meta.current));
  let current = tracks[index];
  let seeking = false;
  let pendingSeek: number | null = null;

  // ---- per-track analytics state ----
  let stats = newStats();
  function newStats() {
    return { listenId: crypto.randomUUID?.() ?? String(Math.random()).slice(2), started: false, milestones: new Set<number>(), maxPct: 0, ms: 0, lastTick: 0, sends: 0 };
  }
  const base = () => ({
    chapter: current.number,
    lang: meta.lang,
    title: current.title,
    version: current.version,
    duration: current.duration,
    listen_id: stats.listenId,
  });
  const summary = () => {
    if (!stats.started) return;
    accumulate();
    stats.sends += 1;
    track('audio_listened', { ...base(), seconds_listened: Math.round(stats.ms / 1000), max_percent: stats.maxPct, speed: audio.playbackRate, summary_number: stats.sends });
  };
  const accumulate = () => {
    if (stats.lastTick) {
      stats.ms += Date.now() - stats.lastTick;
      stats.lastTick = audio.paused ? 0 : Date.now();
    }
  };

  // ---- settings ----
  const setSpeed = (rate: number) => {
    audio.playbackRate = rate;
    audio.defaultPlaybackRate = rate;
    speedBtns.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === rate)));
  };
  const savedSpeed = store.get('listen:speed', 1);
  // A saved speed that's no longer offered would leave no button highlighted.
  setSpeed(speedBtns.some((b) => Number(b.dataset.speed) === savedSpeed) ? savedSpeed : 1);
  speedBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const rate = Number(b.dataset.speed);
      setSpeed(rate);
      store.set('listen:speed', rate);
      track('audio_speed_changed', { ...base(), speed: rate });
    }),
  );
  autoNext.checked = store.get('listen:autonext', true);
  autoNext.addEventListener('change', () => store.set('listen:autonext', autoNext.checked));

  // ---- loading a track ----
  const savedPos = (t: Track) => {
    const p = store.get<{ t: number; finished?: boolean } | null>(posKey(meta.lang, t.number), null);
    return p && !p.finished && p.t > 5 && p.t < t.duration - 10 ? p.t : 0;
  };
  const savePos = (finished = false) =>
    store.set(posKey(meta.lang, current.number), { t: Math.round(audio.currentTime), finished, updated: Date.now() });

  function load(t: Track) {
    current = t;
    seek.max = String(t.duration);
    const resumeAt = savedPos(t);
    pendingSeek = resumeAt || null;
    if (audio.getAttribute('src') !== t.src) audio.src = t.src;
    paintTime(resumeAt);
    sub.textContent = resumeAt ? sub.dataset.resume!.replace('{time}', clock(resumeAt)) : sub.dataset.default!;
    const elsewhere = t.number !== meta.current;
    now.hidden = !elsewhere;
    title.textContent = elsewhere ? `${t.label}: ${t.title}` : listenTitle;
    if (elsewhere) nowLink.href = t.url;
    $('[data-mini-title]', mini).textContent = `${t.label} · ${t.title}`;
    setMediaSession();
  }
  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null) {
      audio.currentTime = pendingSeek;
      pendingSeek = null;
    }
  });

  // ---- play / pause ----
  const play = () => {
    audio.play().catch(() => {
      /* autoplay blocked or network error: the button stays on "play" */
    });
  };
  const toggle = () => (audio.paused ? play() : audio.pause());
  playButtons.forEach((b) => b.addEventListener('click', toggle));

  const paintPlaying = () => {
    const playing = !audio.paused;
    playButtons.forEach((b) => {
      b.classList.toggle('is-playing', playing);
      b.setAttribute('aria-label', playing ? labelPause : labelPlay);
    });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    updateMini();
  };
  audio.addEventListener('play', () => {
    if (pendingSeek !== null && audio.readyState >= 1) {
      audio.currentTime = pendingSeek;
      pendingSeek = null;
    }
    if (!stats.started) {
      stats.started = true;
      track('audio_started', { ...base(), resumed_at: savedPos(current) || null, speed: audio.playbackRate });
    }
    stats.lastTick = Date.now();
    sub.textContent = sub.dataset.default!;
    paintPlaying();
  });
  audio.addEventListener('pause', () => {
    accumulate();
    stats.lastTick = 0;
    savePos();
    paintPlaying();
  });

  // ---- time + seeking ----
  function paintTime(t: number) {
    const d = current.duration || audio.duration || 0;
    if (!seeking) seek.value = String(t);
    seek.style.setProperty('--pct', `${d ? (t / d) * 100 : 0}%`);
    $('[data-cur]').textContent = clock(t);
    $('[data-left]').textContent = `-${clock(d - t)}`;
    $('[data-mini-time]', mini).textContent = `${clock(t)} / ${clock(d)}`;
    $('[data-mini-bar]', mini).style.transform = `scaleX(${d ? t / d : 0})`;
  }
  let lastSave = 0;
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime;
    paintTime(t);
    if (Date.now() - lastSave > 5000) {
      lastSave = Date.now();
      savePos();
    }
    const pct = current.duration ? Math.round((t / current.duration) * 100) : 0;
    if (pct > stats.maxPct) stats.maxPct = pct;
    for (const m of [25, 50, 75, 90]) {
      if (pct >= m && !stats.milestones.has(m)) {
        stats.milestones.add(m);
        track('audio_progress', { ...base(), percent: m });
      }
    }
  });
  seek.addEventListener('input', () => {
    seeking = true;
    paintTime(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    seeking = false;
    jumpTo(Number(seek.value));
  });
  const jumpTo = (t: number) => {
    const clamped = Math.min(Math.max(0, t), current.duration);
    if (audio.readyState >= 1) audio.currentTime = clamped;
    else pendingSeek = clamped;
    paintTime(clamped);
    savePos();
  };
  document.querySelectorAll<HTMLButtonElement>('[data-skip]').forEach((b) =>
    b.addEventListener('click', () => jumpTo((pendingSeek ?? audio.currentTime) + Number(b.dataset.skip))),
  );

  // ---- end of chapter -> next chapter ----
  audio.addEventListener('ended', () => {
    savePos(true);
    store.set(posKey(meta.lang, current.number), { t: 0, finished: true, updated: Date.now() });
    stats.maxPct = 100;
    track('audio_finished', { ...base(), speed: audio.playbackRate });
    // listening to the end counts as reading it (✓ Read on the chapter cards)
    const prev = getProgress(meta.lang, current.number);
    saveProgress(meta.lang, { number: current.number, label: current.label, url: current.url, pct: prev?.pct ?? 100, finished: true, updated: Date.now() });
    const next = tracks[index + 1];
    if (next && autoNext.checked) {
      track('audio_next_chapter', { ...base(), to: next.number });
      goTo(index + 1, true);
    }
  });
  function goTo(i: number, autoplay: boolean) {
    if (!tracks[i]) return;
    if (stats.started) summary();
    index = i;
    stats = newStats();
    load(tracks[i]);
    if (autoplay) play();
  }

  // ---- lock screen / headphones ----
  function setMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const art = new URL(meta.artwork, location.href).toString();
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${current.label}: ${current.title}`,
      artist: meta.artist,
      album: meta.album,
      artwork: [{ src: art, sizes: '512x512', type: 'image/png' }],
    });
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const on = (action: MediaSessionAction, fn: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* not supported here */
      }
    };
    on('play', play);
    on('pause', () => audio.pause());
    on('seekbackward', (d) => jumpTo(audio.currentTime - (d.seekOffset ?? 15)));
    on('seekforward', (d) => jumpTo(audio.currentTime + (d.seekOffset ?? 30)));
    on('seekto', (d) => d.seekTime !== undefined && jumpTo(d.seekTime));
    on('previoustrack', () => (audio.currentTime > 5 || index === 0 ? jumpTo(0) : goTo(index - 1, !audio.paused)));
    on('nexttrack', () => goTo(index + 1, !audio.paused));
  }

  // ---- mini player: shows once playback has started and the main player is off screen ----
  let mainVisible = true;
  new IntersectionObserver(([e]) => {
    mainVisible = e.isIntersecting;
    updateMini();
  }).observe(root);
  function updateMini() {
    const show = stats.started && !mainVisible && (!audio.paused || audio.currentTime > 0);
    mini.hidden = !show;
    document.body.classList.toggle('has-mini-player', show);
  }
  $('[data-mini-show]', mini).addEventListener('click', () => root.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  // ---- visit summary ----
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && audio.paused) summary();
  });
  window.addEventListener('pagehide', () => {
    if (!audio.paused) savePos();
    summary();
  });

  load(current);
}
