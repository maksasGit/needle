import musicUrl from '../../public/audio/needlebackground_2.mp3?url';
import collectUrl from '../../public/audio/collect_hay.mp3?url';
import denyUrl from '../../public/audio/inventory_is_full.mp3?url';
import sellUrl from '../../public/audio/sell_sound.mp3?url';
import stepsUrl from '../../public/audio/steps_loop.mp3?url';
import type { Settings } from '../systems/SaveSystem';

type Effect = 'collect' | 'sell' | 'deny';
const effectUrls = { collect: collectUrl, sell: sellUrl, deny: denyUrl };
const cooldowns = { collect: 90, sell: 140, deny: 450 };

/** Bounded media elements: music, footsteps and four reusable effect voices. */
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
  private menusOpen = false;
  private voices = Array.from({ length: 4 }, () => ({ audio: new Audio(), kind: undefined as Effect | undefined, token: 0 }));
  private voiceIndex = 0;
  private lastEffect: Record<Effect, number> = { collect: -Infinity, sell: -Infinity, deny: -Infinity };
  private steps = new Audio();
  private walking = false;
  private stepStarting = false;
  private stepAttempted = false;

  constructor(private settings: Settings) {
    this.audio.loop = true; this.audio.preload = 'none';
    this.audio.setAttribute('playsinline', '');
    this.audio.volume = settings.musicVolume;
    this.steps.loop = true; this.steps.preload = 'none';
    for (const voice of this.voices) voice.audio.preload = 'none';
    const signal = this.controller.signal;
    const unlock = (event: Event) => {
      if (!event.isTrusted) return;
      this.unlocked = true; this.stepAttempted = false; this.sync();
    };
    window.addEventListener('pointerdown', unlock, { capture: true, signal });
    window.addEventListener('keydown', unlock, { capture: true, signal });
    document.addEventListener('visibilitychange', () => { this.background = document.hidden; this.sync(); }, { signal });
    window.addEventListener('blur', () => { this.background = true; this.sync(); }, { signal });
    window.addEventListener('focus', () => { this.background = document.hidden; this.sync(); }, { signal });
    window.addEventListener('pagehide', () => { this.audio.pause(); this.stopEffects(); }, { signal });
    window.addEventListener('pageshow', () => { this.background = document.hidden; this.sync(); }, { signal });
    this.audio.addEventListener('error', () => { this.failed = true; this.audio.pause(); }, { signal });
    this.observer = new MutationObserver(() => this.sync());
    this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  private get allowed() {
    return this.foreground && !this.failed && this.settings.musicEnabled && this.settings.musicVolume > 0 && !this.menusOpen;
  }
  private get foreground() { return this.unlocked && !this.disposed && !this.background && !document.hidden; }
  private get effectsAllowed() { return this.foreground && this.settings.effectsEnabled && this.settings.effectsVolume > 0; }
  private syncEffects() {
    if (!this.effectsAllowed) { this.stopEffects(); return; }
    for (const voice of this.voices) voice.audio.volume = this.settings.effectsVolume;
    this.steps.volume = this.settings.effectsVolume * .45;
    if (this.menusOpen) this.setWalking(false);
    else this.syncSteps();
  }
  effect(kind: Effect) {
    if (!this.effectsAllowed) return;
    const now = performance.now();
    if (now - this.lastEffect[kind] < cooldowns[kind]) return;
    this.lastEffect[kind] = now;
    const voice = this.voices.find(item => item.audio.paused) ?? this.voices[this.voiceIndex++ % this.voices.length];
    const token = ++voice.token;
    voice.audio.pause();
    if (voice.kind !== kind) { voice.kind = kind; voice.audio.src = effectUrls[kind]; }
    voice.audio.volume = this.settings.effectsVolume;
    try {
      voice.audio.currentTime = 0;
      void voice.audio.play().then(() => { if (voice.token === token && !this.effectsAllowed) voice.audio.pause(); }).catch(() => {});
    } catch { /* A missing sound must never interrupt gameplay. */ }
  }
  setWalking(walking: boolean, speed = 1) {
    if (this.walking !== walking) this.stepAttempted = false;
    this.walking = walking;
    const rate = Math.max(.65, Math.min(1.6, speed));
    if (Math.abs(this.steps.playbackRate - rate) > .025) this.steps.playbackRate = rate;
    this.syncSteps();
  }
  private syncSteps() {
    if (!this.walking || !this.effectsAllowed || this.menusOpen) { this.steps.pause(); return; }
    if (!this.steps.paused || this.stepStarting || this.stepAttempted) return;
    if (!this.steps.getAttribute('src')) this.steps.src = stepsUrl;
    this.steps.volume = this.settings.effectsVolume * .45;
    this.stepStarting = this.stepAttempted = true;
    try {
      void this.steps.play().then(() => {
        if (!this.walking || !this.effectsAllowed || this.menusOpen) this.steps.pause();
      }).catch(() => {}).finally(() => { this.stepStarting = false; });
    } catch { this.stepStarting = false; }
  }
  stopEffects() {
    this.walking = false; this.stepAttempted = false; this.steps.pause();
    for (const voice of this.voices) { voice.token++; voice.audio.pause(); }
  }
  setEffectsEnabled(enabled: boolean) { this.settings.effectsEnabled = enabled; this.stepAttempted = false; this.sync(); }
  setEffectsVolume(volume: number) {
    this.settings.effectsVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : .6)); this.sync();
  }
  private sync() {
    this.menusOpen = !!document.querySelector('dialog[open]');
    this.syncEffects();
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
    this.stopEffects(); this.steps.removeAttribute('src'); this.steps.load();
    for (const voice of this.voices) { voice.audio.removeAttribute('src'); voice.audio.load(); }
  }
}
