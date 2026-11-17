import { buffBadge } from '../config/meta';
import type { MetaBuffs } from '../config/meta';
import { demoRecords } from '../config/records';
import { RunRecords, recordTime } from '../systems/RunRecords';
import { t } from './i18n';
import { icon } from './icons';
import parchmentUrl from '../assets/ui/shop-parchment.jpg?url';

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
  show() { this.dialog.style.setProperty('--shop-parchment',`url("${parchmentUrl}")`); this.tab='local'; this.render(); if (!this.dialog.open) this.dialog.showModal(); }
  render() {
    const global = this.tab === 'global';
    const rows = global ? demoRecords : this.records.list().map(row => ({...row,name:t('recordsYou')}));
    this.dialog.innerHTML=`<div class="shop-heading"><h2 id="records-title">${t('recordsTitle')}</h2><button class="shop-close" data-records-close aria-label="${t('close')}">${icon('close')}</button></div><div class="shop-body"><nav class="records-tabs" aria-label="${t('recordsTitle')}"><button data-records-tab="local" aria-pressed="${!global}">${icon('book')}${t('recordsLocal')}</button><button data-records-tab="global" aria-pressed="${global}">${icon('needle')}${t('recordsGlobal')}</button></nav><p class="records-hint">${t(global?'recordsDemo':'recordsRule')}</p><ol class="records-list" role="list"></ol><p data-records-note role="status"></p></div>`;
    const list=this.dialog.querySelector('ol')!;
    rows.forEach((row,index) => { const li=document.createElement('li'), rank=document.createElement('span'), name=document.createElement('span'), time=document.createElement('strong'); rank.className='record-rank';rank.textContent=String(index+1);name.className='record-name';const buffs=(row as {buffs?:MetaBuffs}).buffs;name.textContent=`${row.name}${buffs?' '+buffBadge(buffs):''}`;if(buffs){name.title=[buffs.legs?t('metalegs'):'',buffs.luck?t('metaluck'):'',buffs.gold?t('metagold'):'',buffs.friends?t('metafriends'):'',buffs.memory?t('metamemory'):'',buffs.tool?t((`metaTool${buffs.tool}`) as 'metaTool1'):''].filter(Boolean).join(', ');name.setAttribute('aria-label',`${row.name} ${name.title}`);} time.textContent=recordTime(row.activeMs); li.append(rank,name,time); list.append(li); });
    this.dialog.querySelector('[data-records-note]')!.textContent = !global && !this.records.available ? t('recordsUnsaved') : !rows.length ? t('recordsEmpty') : '';
  }
  dispose() { this.controller.abort(); this.dialog.close(); this.dialog.remove(); }
}
