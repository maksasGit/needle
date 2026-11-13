import { Game } from './core/Game';
import { SaveSystem, SAVE_KEY } from './systems/SaveSystem';
import { t, setLanguage } from './ui/i18n';
import type { Language } from './ui/i18n';
import { config } from './config/balance';

const saves = new SaveSystem();
const settings = saves.readSettings();
setLanguage(settings.language);
const text = (key: Parameters<typeof t>[0], tag = 'span', attrs = '') => `<${tag} data-text="${key}" ${attrs}>${t(key)}</${tag}>`;
// Original inline icons: no font, texture or network request required.
const icon = (path: string) => `<svg class="counter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><div>${text('tagline', 'span', 'class="eyebrow"')}<h1>Needle in a Haystack${text('subtitle')}</h1></div>${text('stage', 'span', 'class="stage"')}</header>
<main id="game"></main><div class="crosshair" aria-hidden="true">+</div><div id="aim-label"></div>
<div id="joystick" role="group" data-label="joystick"><span class="joystick-guide" aria-hidden="true">✥</span><span class="joystick-knob" aria-hidden="true"></span></div>
${text('action', 'button', 'id="interact" aria-describedby="aim-label"')}
<section class="hud"><div>${icon('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M14.5 8H11a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9.5 M12 6v12')}${text('coins')}<strong id="coins">0</strong></div><div>${icon('M5 9h14l2 12H3L5 9 M8 9V6a4 4 0 0 1 8 0v3')}${text('inventory')}<strong id="inventory">0 / 5</strong></div><div>${icon('M3 21 12 3l9 18H3 M7 20l5-13 5 13 M9 17h6 M10 13h4')}${text('remaining')}<strong id="remaining">${config.totalHay}</strong></div><div>${icon('M12 21V9 M6 3v6h12V3 M12 3v6')}${text('tool')}<strong id="tool"></strong></div></section>
<footer><span class="dot"></span><span id="status" role="status" aria-live="polite"></span>${text('shop', 'button', 'id="shop"')}<button id="help" data-label="help">?</button><button id="settings" data-label="settings">⚙</button></footer>
<div id="save-notice" role="status"></div>
<dialog id="help-dialog" aria-labelledby="help-title">${text('helpTitle', 'h2', 'id="help-title"')}${['help1','help2','help3','help4'].map(key => text(key as 'help1', 'p')).join('')}${text('close', 'button', 'data-close')}</dialog>
<dialog id="shop-dialog" aria-labelledby="shop-title">${text('shopTitle', 'h2', 'id="shop-title"')}<p data-wallet></p>${text('shopHint', 'p')}<div data-upgrades></div>${text('close', 'button', 'data-close')}</dialog>
<dialog id="settings-dialog" aria-labelledby="settings-title">${text('settings', 'h2', 'id="settings-title"')}<label class="setting-row">${text('language')}<select id="language"><option value="ru">Русский</option><option value="en">English</option></select></label><label class="setting-row"><input type="checkbox" id="reduced-motion">${text('reduced')}</label>${text('newGame', 'button', 'id="new-game"')}${text('close', 'button', 'data-close')}</dialog>
<dialog id="reset-dialog" aria-labelledby="reset-title">${text('newGame', 'h2', 'id="reset-title"')}${text('confirmReset', 'p')}${text('yes', 'button', 'id="confirm-reset"')}${text('cancel', 'button', 'data-close')}</dialog>
<dialog id="win-dialog" aria-labelledby="win-title">${text('wonTitle', 'h2', 'id="win-title"')}${text('wonBody', 'p')}${text('newGame', 'button', 'id="win-new-game"')}${text('close', 'button', 'data-close')}</dialog>
<dialog id="error-dialog" aria-labelledby="error-title">${text('error', 'h2', 'id="error-title"')}<p id="error-message"></p>${text('retry', 'button', 'id="retry"')}</dialog>`;
let game: Game | undefined;
const dialog = (id: string) => document.querySelector<HTMLDialogElement>(id)!;
function show(id: string) { const element = dialog(id); if (!element.open) element.showModal(); }
function fail(message: string) { document.querySelector('#error-message')!.textContent = message; show('#error-dialog'); }
function translate() {
  for (const node of document.querySelectorAll<HTMLElement>('[data-text]')) node.textContent = t(node.dataset.text as Parameters<typeof t>[0]);
  for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) node.setAttribute('aria-label', t(node.dataset.label as Parameters<typeof t>[0]));
  const list = document.querySelector('[data-upgrades]'); if (list) list.innerHTML = '';
  game?.refreshLanguage();
}
function start(reset = false) {
  for (const element of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) element.close();
  game?.dispose(!reset); game = undefined;
  if (reset) { try { localStorage.removeItem(SAVE_KEY); } catch { /* Memory-only session still restarts. */ } }
  try { game = new Game(document.querySelector('#game')!, document.querySelector('#status')!, { settings, onWin: () => show('#win-dialog'), onError: fail }); }
  catch (error) { console.error(error); fail(t('webgl')); }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('dialog [data-close]')) button.onclick = () => button.closest('dialog')!.close();
document.querySelector<HTMLButtonElement>('#help')!.onclick = () => show('#help-dialog');
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
reduced.onchange = () => { settings.reducedMotion = reduced.checked; saves.writeSettings(settings); game?.setReducedMotion(reduced.checked); };
translate(); start();
// Opt-in read-only diagnostics. No test commands or cheat hooks in production.
if (new URLSearchParams(location.search).has('diagnostics')) Object.defineProperty(window, 'needleDiagnostics', { value: () => game?.diagnostics(), configurable: true });
if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());

