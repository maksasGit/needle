import { Game } from './core/Game';
import { SaveSystem } from './systems/SaveSystem';
import { t, setLanguage } from './ui/i18n';
import type { Language } from './ui/i18n';
import { config } from './config/balance';
import { AudioManager } from './core/AudioManager';
import { icon as uiIcon } from './ui/icons';
import { presentation } from './config/presentation';

document.documentElement.style.setProperty('--ui-panel-ms', `${presentation.cardMs}ms`);
document.documentElement.style.setProperty('--ui-press-ms', `${presentation.pressMs}ms`);
document.documentElement.style.setProperty('--ui-guide-ms', `${presentation.tutorialPulseMs}ms`);
document.documentElement.style.setProperty('--ui-ease', presentation.easing);
const saves = new SaveSystem();
const settings = saves.readSettings();
setLanguage(settings.language);
document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
const text = (key: Parameters<typeof t>[0], tag = 'span', attrs = '') => `<${tag} data-text="${key}" ${attrs}>${t(key)}</${tag}>`;
// Original inline icons: no font, texture or network request required.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main id="game"></main><div id="loading-farm" role="status">${text('loadingFarm')}</div><div class="crosshair" aria-hidden="true">+</div><div id="aim-label"></div>
<div id="joystick" role="group" data-label="joystick"><span class="joystick-guide" aria-hidden="true">✥</span><span class="joystick-knob" aria-hidden="true"></span></div>
${text('action', 'button', 'id="interact" aria-describedby="aim-label"')}
<button id="jump" data-label="jump"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V4M5 11l7-7 7 7M5 21h14"/></svg></button>
<section class="hud"><div>${uiIcon('coins', 'counter-icon')}${text('coins')}<strong id="coins">0</strong></div><div><span class="diamond-icon" aria-hidden="true">?</span>${text('diamonds')}<strong id="diamonds">0</strong></div><div>${uiIcon('backpack', 'counter-icon')}${text('inventory')}<strong id="inventory">0 / ${config.capacity}</strong></div><button id="shop" data-label="shop">${uiIcon('book', 'counter-icon')}${text('shop')}</button></section>
<div class="hay-progress"><progress id="hay-progress" max="${config.totalHay}" value="${config.totalHay}" aria-labelledby="hay-progress-label"></progress><div class="hay-progress-caption">${text('remaining', 'span', 'id="hay-progress-label" class="sr-only"')}${uiIcon('hay', 'counter-icon')}<strong id="remaining">${config.totalHay}</strong></div></div>
<div id="action-feedback" aria-hidden="true"></div><div id="sale-event" role="status" hidden></div><div id="tutorial" role="status" hidden></div><div id="tutorial-pointer" aria-hidden="true" hidden>${uiIcon('arrow')}</div>
<div class="utility-controls"><button id="help" data-label="help">${uiIcon('help')}</button><button id="settings" data-label="settings">${uiIcon('settings', 'counter-icon')}</button></div><div id="status" class="sr-only" role="status" aria-live="polite"></div>
<div id="save-notice" role="status"></div>
<dialog id="help-dialog" aria-labelledby="help-title">${text('helpTitle', 'h2', 'id="help-title"')}${['help1','help2','help3','help4'].map(key => text(key as 'help1', 'p')).join('')}${text('replayGuide', 'button', 'id="replay-guide"')}${text('close', 'button', 'data-close')}</dialog>
<dialog id="shop-dialog" aria-labelledby="shop-title"><div class="shop-heading">${text('shopTitle', 'h2', 'id="shop-title"')}<div class="shop-wallet">${uiIcon('coins')}<p data-wallet></p></div><button class="shop-close" data-close data-label="close">${uiIcon('close')}</button></div><div class="shop-body"><nav class="book-tabs" data-book-tabs role="tablist" data-label="shop"></nav><p data-book-feedback role="status"></p><div class="book-page" data-upgrades></div></div></dialog>
<dialog id="barn-dialog" aria-labelledby="barn-name"><div class="barn-card-heading"><span data-barn-icon></span><h2 id="barn-name" data-barn-name></h2></div><p data-barn-detail></p><strong class="barn-card-price" data-barn-price></strong><p class="barn-wallet" data-barn-wallet></p><p data-barn-feedback role="status"></p><button data-barn-confirm></button>${text('close', 'button', 'data-close')}</dialog>
<dialog id="settings-dialog" aria-labelledby="settings-title">${text('settings', 'h2', 'id="settings-title"')}<label class="setting-row">${text('language')}<select id="language"><option value="ru">Русский</option><option value="en">English</option></select></label><label class="setting-row"><input type="checkbox" id="reduced-motion">${text('reduced')}</label><label class="setting-row"><input type="checkbox" id="music-enabled">${text('music')}</label><label class="setting-row">${text('musicVolume')}<input id="music-volume" class="music-range" type="range" min="0" max="100" step="1" data-label="musicVolume"></label><label class="setting-row"><input type="checkbox" id="effects-enabled">${text('effects')}</label><label class="setting-row">${text('effectsVolume')}<input id="effects-volume" class="music-range" type="range" min="0" max="100" step="1" data-label="effectsVolume"></label><label class="setting-row"><input type="checkbox" id="economy-telemetry">${text('economyTelemetry')}</label>${text('economyTelemetryHint', 'p')}${text('exportEconomyMetrics', 'button', 'id="export-economy-metrics"')}${text('resetEconomyMetrics', 'button', 'id="reset-economy-metrics"')}${text('newGame', 'button', 'id="new-game"')}${text('close', 'button', 'data-close')}</dialog>
<dialog id="economy-metrics-dialog" aria-labelledby="economy-metrics-title">${text('economyTelemetry', 'h2', 'id="economy-metrics-title"')}${text('metricsCopyHint', 'p')}<textarea id="economy-metrics-text" readonly rows="12" data-label="economyTelemetry" style="width:100%;box-sizing:border-box"></textarea>${text('close', 'button', 'data-close')}</dialog>
<dialog id="reset-dialog" aria-labelledby="reset-title">${text('newGame', 'h2', 'id="reset-title"')}${text('confirmReset', 'p')}${text('yes', 'button', 'id="confirm-reset"')}${text('cancel', 'button', 'data-close')}</dialog>
<dialog id="win-dialog" aria-labelledby="win-title">${text('wonTitle', 'h2', 'id="win-title"')}${text('wonBody', 'p')}${text('recordsTitle', 'button', 'id="win-records"')}${text('newGame', 'button', 'id="win-new-game"')}${text('close', 'button', 'data-close')}</dialog>
<dialog id="error-dialog" aria-labelledby="error-title">${text('error', 'h2', 'id="error-title"')}<p id="error-message"></p>${text('retry', 'button', 'id="retry"')}</dialog>`;
const music = new AudioManager(settings);
let game: Game | undefined;
const dialog = (id: string) => document.querySelector<HTMLDialogElement>(id)!;
function show(id: string) { const element = dialog(id); if (!element.open) element.showModal(); }
function fail(message: string) { document.querySelector<HTMLElement>('#loading-farm')!.hidden = true; document.querySelector('#error-message')!.textContent = message; show('#error-dialog'); }
function translate() {
  for (const node of document.querySelectorAll<HTMLElement>('[data-text]')) node.textContent = t(node.dataset.text as Parameters<typeof t>[0]);
  for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) node.setAttribute('aria-label', t(node.dataset.label as Parameters<typeof t>[0]));
  const list = document.querySelector('[data-upgrades]'); if (list) list.innerHTML = '';
  game?.refreshLanguage();
}
function start(reset = false) {
  document.querySelector<HTMLElement>('#loading-farm')!.hidden = false;
  for (const element of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) element.close();
  const retainedMeta=reset?game?.metaSnapshot():undefined;
  game?.dispose(!reset); game = undefined;
  try { game = new Game(document.querySelector('#game')!, document.querySelector('#status')!, { newGame:reset,retainedMeta,settings, audio: music, onReady: () => { document.querySelector<HTMLElement>('#loading-farm')!.hidden = true; }, onWin: () => show('#win-dialog'), onError: fail }); }
  catch (error) { console.error(error); fail(t('webgl')); }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('dialog [data-close]')) button.onclick = () => button.closest('dialog')!.close();
document.querySelector<HTMLButtonElement>('#win-records')!.onclick = () => { dialog('#win-dialog').close(); game?.showRecords(); };
document.querySelector<HTMLButtonElement>('#help')!.onclick = () => show('#help-dialog');
document.querySelector<HTMLButtonElement>('#replay-guide')!.onclick = () => { dialog('#help-dialog').close(); game?.replayGuide(); };
document.querySelector<HTMLButtonElement>('#settings')!.onclick = () => show('#settings-dialog');
document.querySelector<HTMLButtonElement>('#new-game')!.onclick = () => show('#reset-dialog');
document.querySelector<HTMLButtonElement>('#confirm-reset')!.onclick = () => start(true);
document.querySelector<HTMLButtonElement>('#win-new-game')!.onclick = () => start(true);
document.querySelector<HTMLButtonElement>('#retry')!.onclick = () => start();
const language = document.querySelector<HTMLSelectElement>('#language')!;
language.value = settings.language;
language.onchange = () => { settings.language = language.value as Language; setLanguage(settings.language); saves.writeSettings(settings); translate(); };
const reduced = document.querySelector<HTMLInputElement>('#reduced-motion')!;
reduced.checked = settings.reducedMotion;
reduced.onchange = () => { document.documentElement.dataset.reducedMotion = String(reduced.checked); settings.reducedMotion = reduced.checked; saves.writeSettings(settings); game?.setReducedMotion(reduced.checked); };
const musicEnabled = document.querySelector<HTMLInputElement>('#music-enabled')!;
musicEnabled.checked = settings.musicEnabled;
musicEnabled.onchange = () => { music.setEnabled(musicEnabled.checked); saves.writeSettings(settings); };
const musicVolume = document.querySelector<HTMLInputElement>('#music-volume')!;
musicVolume.value = String(Math.round(settings.musicVolume * 100));
musicVolume.oninput = () => music.setVolume(Number(musicVolume.value) / 100);
musicVolume.onchange = () => saves.writeSettings(settings);
const effectsEnabled = document.querySelector<HTMLInputElement>('#effects-enabled')!;
effectsEnabled.checked = settings.effectsEnabled;
effectsEnabled.onchange = () => { music.setEffectsEnabled(effectsEnabled.checked); saves.writeSettings(settings); };
const effectsVolume = document.querySelector<HTMLInputElement>('#effects-volume')!;
effectsVolume.value = String(Math.round(settings.effectsVolume * 100));
effectsVolume.oninput = () => music.setEffectsVolume(Number(effectsVolume.value) / 100);
effectsVolume.onchange = () => saves.writeSettings(settings);
const economyTelemetry = document.querySelector<HTMLInputElement>('#economy-telemetry')!;
economyTelemetry.checked = !!settings.economyTelemetry;
const exportMetrics = document.querySelector<HTMLButtonElement>('#export-economy-metrics')!;
exportMetrics.disabled = !economyTelemetry.checked;
economyTelemetry.onchange = () => { settings.economyTelemetry = economyTelemetry.checked; game?.setEconomyTelemetry(economyTelemetry.checked); exportMetrics.disabled = !economyTelemetry.checked; saves.writeSettings(settings); };
exportMetrics.onclick = () => { const json = game?.downloadEconomyMetrics(); if (json) { document.querySelector<HTMLTextAreaElement>('#economy-metrics-text')!.value = json; show('#economy-metrics-dialog'); } };
document.querySelector<HTMLButtonElement>('#reset-economy-metrics')!.onclick = () => game?.resetEconomyMetrics();
translate(); start();
// Opt-in read-only diagnostics. No test commands or cheat hooks in production.
if (new URLSearchParams(location.search).has('diagnostics')) Object.defineProperty(window, 'needleDiagnostics', { value: () => game?.diagnostics(), configurable: true });
if (import.meta.hot) import.meta.hot.dispose(() => { game?.dispose(); music.dispose(); });

