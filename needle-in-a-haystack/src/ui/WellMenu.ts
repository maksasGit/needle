import type { MetaProgress } from '../systems/MetaProgress';
import type { MetaId } from '../config/meta';
import { t, toolName } from './i18n';
import { icon } from './icons';
import type { IconName } from './icons';
import parchmentUrl from '../assets/ui/shop-parchment.jpg?url';
export class WellMenu {
  private dialog=document.createElement('dialog');
  private controller=new AbortController();
  constructor(private meta:MetaProgress,private purchase:(id:MetaId)=>void) {
    this.dialog.id='well-dialog';this.dialog.setAttribute('aria-labelledby','well-title');
    this.dialog.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(b?.dataset.meta)this.purchase(b.dataset.meta as MetaId);if(b?.hasAttribute('data-well-close'))this.dialog.close();},{signal:this.controller.signal});document.querySelector('#app')!.append(this.dialog);
  }
  show(){this.dialog.style.setProperty('--shop-parchment',`url("${parchmentUrl}")`);this.render();if(!this.dialog.open)this.dialog.showModal();}
  render(){
    const focused=(document.activeElement as HTMLElement | null)?.closest<HTMLButtonElement>('[data-meta]')?.dataset.meta;
    const scrollTop=this.dialog.querySelector('.shop-body')?.scrollTop ?? 0;
    const ids:MetaId[]=['legs','luck','gold','tool','friends','memory'];
    this.dialog.innerHTML=`<div class="shop-heading"><h2 id="well-title">${t('well')}</h2><div class="shop-wallet well-wallet"><span aria-hidden="true">◆</span><strong>${this.meta.diamonds}</strong><span class="sr-only">${t('diamonds')}</span></div><button class="shop-close" data-well-close aria-label="${t('close')}">${icon('close')}</button></div><div class="shop-body"><p class="well-next-run">${t('metaNextRun')}</p><p data-well-feedback role="status"></p><div class="well-upgrades book-page"></div></div>`;
    const list=this.dialog.querySelector('.well-upgrades')!;
    const symbols:Record<MetaId,IconName>={legs:'arrow',luck:'coins',gold:'hay',tool:'fork',friends:'pig',memory:'book'};
    ids.forEach(id=>{
      const price=this.meta.price(id),row=document.createElement('article');
      row.className='upgrade well-upgrade';
      row.innerHTML=`<div class="upgrade-symbol" aria-hidden="true">${icon(symbols[id])}</div><div class="upgrade-detail"><h3></h3><p></p></div><button class="shop-buy" data-meta="${id}"></button>`;
      row.querySelector('h3')!.textContent=id==='tool'?t((['metaTool1','metaTool1','metaTool2','metaTool3','metaTool4'][Math.min(4,this.meta.profile.bought.tool+1)]) as 'metaTool1'):t((`meta${id}`) as 'metalegs');
      row.querySelector('p')!.textContent=id==='tool'?`${t('metaStart')} ${toolName(Math.min(4,this.meta.profile.bought.tool+1))}`:t((`meta${id}Effect`) as 'metalegsEffect');
      const button=row.querySelector('button')!;
      button.disabled=price===null;
      button.innerHTML=price===null?`${icon('check')}<span>${t('owned')}</span>`:`<span>${t('buy')}</span><span class="shop-price"><span class="well-diamond" aria-hidden="true">◆</span>${price}<span class="sr-only">${t('diamonds')}</span></span>`;
      button.setAttribute('aria-disabled',String(price===null||price>this.meta.diamonds));
      list.append(row);
    });
    if(focused){
      const button=this.dialog.querySelector<HTMLButtonElement>(`[data-meta="${focused}"]`);
      (button&&!button.disabled?button:this.dialog.querySelector<HTMLButtonElement>('[data-well-close]'))?.focus({preventScroll:true});
    }
    this.dialog.querySelector('.shop-body')!.scrollTop=scrollTop;
  }
  feedback(text:string){this.dialog.querySelector('[data-well-feedback]')!.textContent=text;}
  dispose(){this.controller.abort();this.dialog.close();this.dialog.remove();}
}
