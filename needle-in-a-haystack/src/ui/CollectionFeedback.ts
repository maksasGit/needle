import { t } from './i18n';

/** One small feedback widget; state changes are immediate, progress sampled at 20 Hz. */
export class CollectionFeedback {
  private node=document.createElement('div');
  private label=document.createElement('span');
  private progress=document.createElement('progress');
  private age=Infinity;
  private state='';
  private labelStamp='';
  constructor(){this.node.id='collection-feedback';this.label.className='sr-only';this.progress.max=1;this.node.append(this.label,this.progress);document.querySelector('#app')!.append(this.node);this.hide();}
  update(dt:number,busy:boolean,fraction:number,_ready:boolean){
    const state=busy?'busy':'hidden';this.age+=dt;
    if(state===this.state&&this.age<.05)return;this.age=0;this.state=state;
    const hidden=state==='hidden';if(this.node.hidden!==hidden)this.node.hidden=hidden;if(hidden)return;
    const text=t(busy?'collectionWorking':'collectionReady'),stamp=state+text;
    if(stamp!==this.labelStamp){this.labelStamp=stamp;this.node.dataset.state=state;this.label.textContent=text;this.progress.setAttribute('aria-label',text);}
    const value=busy?Math.max(0,Math.min(1,fraction)):1;if(this.progress.value!==value)this.progress.value=value;
  }
  hide(){this.node.hidden=true;this.state='';this.age=Infinity;}
  dispose(){this.node.remove();}
}
