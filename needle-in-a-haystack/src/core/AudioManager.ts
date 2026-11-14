import musicUrl from '../../public/audio/needlebackground_2.mp3?url';
import type { Settings } from '../systems/SaveSystem';

/** One media element for the app: no full-track Web Audio decode or restart copies. */
export class AudioManager {
  private audio = new Audio();
  private controller = new AbortController();
  private observer: MutationObserver;
  private unlocked = false;
  private background = document.hidden;
  private disposed = false;
  private failed = false;
  private starting = false;
  private retryRequested = false;

  constructor(private settings: Settings) {
    this.audio.loop = true; this.audio.preload = 'none';
    this.audio.setAttribute('playsinline', '');
    this.audio.volume = settings.musicVolume;
    const signal = this.controller.signal;
    const unlock = (event: Event) => {
      if (!event.isTrusted) return;
      this.unlocked = true; this.sync();
    };
    window.addEventListener('pointerdown', unlock, { capture: true, signal });
    window.addEventListener('keydown', unlock, { capture: true, signal });
    document.addEventListener('visibilitychange', () => { this.background = document.hidden; this.sync(); }, { signal });
    window.addEventListener('blur', () => { this.background = true; this.sync(); }, { signal });
    window.addEventListener('focus', () => { this.background = document.hidden; this.sync(); }, { signal });
    window.addEventListener('pagehide', () => this.audio.pause(), { signal });
    window.addEventListener('pageshow', () => { this.background = document.hidden; this.sync(); }, { signal });
    this.audio.addEventListener('error', () => { this.failed = true; this.audio.pause(); }, { signal });
    this.observer = new MutationObserver(() => this.sync());
    this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  private get allowed() {
    return this.unlocked && !this.disposed && !this.failed && this.settings.musicEnabled && this.settings.musicVolume > 0 && !this.background && !document.hidden && !document.querySelector('dialog[open]');
  }
  private sync() {
    this.audio.volume = this.settings.musicVolume;
    if (!this.allowed) { this.audio.pause(); return; }
    if (this.starting) { this.retryRequested = true; return; }
    if (!this.audio.paused) return;
    // Do not request the optional MP3 before a real user gesture.
    if (!this.audio.getAttribute('src')) this.audio.src = musicUrl;
    this.starting = true;
    try {
      void this.audio.play().then(() => {
        if (!this.allowed) this.audio.pause();
      }).catch(() => { /* Autoplay denial/interruption is retried on a later gesture. */ })
        .finally(() => {
          this.starting = false;
          const retry = this.retryRequested; this.retryRequested = false;
          if (retry && this.allowed && this.audio.paused) this.sync();
        });
    } catch { this.starting = false; }
  }
  setEnabled(enabled: boolean) {
    this.settings.musicEnabled = enabled;
    if (enabled && this.failed) { this.failed = false; this.audio.load(); }
    this.sync();
  }
  setVolume(volume: number) {
    this.settings.musicVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : .25));
    this.sync();
  }
  dispose() {
    this.disposed = true; this.controller.abort(); this.observer.disconnect();
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
  }
}
