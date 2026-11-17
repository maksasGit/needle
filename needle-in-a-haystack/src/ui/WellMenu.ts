import type { MetaProgress } from '../systems/MetaProgress';
import type { MetaId } from '../config/meta';
import { t, toolName } from './i18n';
export class WellMenu {
  private dialog=document.createElement('dialog');
  private controller=new AbortController();
  constructor(private meta:MetaProgress,private purchase:(id:MetaId)=>void) {
    this.dialog.id='well-dialog';this.dialog.setAttribute('aria-labelledby','well-title');
    this.dialog.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(b?.dataset.meta)this.purchase(b.dataset.meta as MetaId);if(b?.hasAttribute('data-well-close'))this.dialog.close();},{signal:this.controller.signal});document.querySelector('#app')!.append(this.dialog);
  }
  show(){this.render();if(!this.dialog.open)this.dialog.showModal();}
  render(){
    const ids:MetaId[]=['legs','luck','gold','tool','friends','memory'];
    this.dialog.innerHTML=`<h2 id="well-title">${t('well')}</h2><p class="diamond-wallet">◆ ${this.meta.diamonds}</p><p>${t('metaNextRun')}</p><div class="well-upgrades"></div><p data-well-feedback role="status"></p><button data-well-close>${t('close')}</button>`;
    const list=this.dialog.querySelector('.well-upgrades')!;
    ids.forEach(id=>{const price=this.meta.price(id),row=document.createElement('div'),name=document.createElement('strong'),effect=document.createElement('span'),button=document.createElement('button');row.className='well-upgrade';name.textContent=id==='tool'?t((['metaTool1','metaTool1','metaTool2','metaTool3','metaTool4'][Math.min(4,this.meta.profile.bought.tool+1)]) as 'metaTool1'):t((`meta${id}`) as 'metalegs');effect.textContent=id==='tool'?`${t('metaStart')} ${toolName(Math.min(4,this.meta.profile.bought.tool+1))}`:t((`meta${id}Effect`) as 'metalegsEffect');button.dataset.meta=id;button.disabled=price===null;button.textContent=price===null?t('owned'):`◆ ${price}`;button.setAttribute('aria-disabled',String(price===null||price>this.meta.diamonds));row.append(name,effect,button);list.append(row);});
  }
  feedback(text:string){this.dialog.querySelector('[data-well-feedback]')!.textContent=text;}
  dispose(){this.controller.abort();this.dialog.close();this.dialog.remove();}
}
