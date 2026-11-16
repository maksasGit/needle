import { demoRecords } from '../config/records';
import { RunRecords, recordTime } from '../systems/RunRecords';
import { t } from './i18n';

export class Leaderboard {
  private dialog = document.createElement('dialog');
  private controller = new AbortController();
  private tab: 'local' | 'global' = 'local';
  constructor(private records: RunRecords) {
    this.dialog.id='records-dialog'; this.dialog.setAttribute('aria-labelledby','records-title');
    this.dialog.addEventListener('click', event => {
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (button?.dataset.recordsTab) { this.tab=button.dataset.recordsTab as 'local' | 'global'; this.render(); this.dialog.querySelector<HTMLButtonElement>(`[data-records-tab="${this.tab}"]`)?.focus(); }
      if (button?.hasAttribute('data-records-close')) this.dialog.close();
    },{signal:this.controller.signal});
    document.querySelector('#app')!.append(this.dialog);
  }
  show() { this.tab='local'; this.render(); if (!this.dialog.open) this.dialog.showModal(); }
  render() {
    const global = this.tab === 'global';
    const rows = global ? demoRecords : this.records.list().map(row => ({...row,name:t('recordsYou')}));
    this.dialog.innerHTML=`<h2 id="records-title">${t('recordsTitle')}</h2><nav class="records-tabs" aria-label="${t('recordsTitle')}"><button data-records-tab="local" aria-pressed="${!global}">${t('recordsLocal')}</button><button data-records-tab="global" aria-pressed="${global}">${t('recordsGlobal')}</button></nav><p class="records-hint">${t(global?'recordsDemo':'recordsRule')}</p><ol class="records-list"></ol><p data-records-note></p><button data-records-close>${t('close')}</button>`;
    const list=this.dialog.querySelector('ol')!;
    rows.forEach((row,index) => { const li=document.createElement('li'), name=document.createElement('span'), time=document.createElement('strong'); name.textContent=`${index+1}. ${row.name}`; time.textContent=recordTime(row.activeMs); li.append(name,time); list.append(li); });
    this.dialog.querySelector('[data-records-note]')!.textContent = !global && !this.records.available ? t('recordsUnsaved') : !rows.length ? t('recordsEmpty') : '';
  }
  dispose() { this.controller.abort(); this.dialog.close(); this.dialog.remove(); }
}
