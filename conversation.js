/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const userSelector='[data-message-author-role="user"],[data-chatgpt-search-unit-key$=":user"],[data-user-message-bubble],.rich-text-user-turn,[data-markdown-text-tone="user-message"],[data-turn="user"]';
  const assistantSelector='[data-message-author-role="assistant"],[data-markdown-text-style="assistant-message"],[data-turn="assistant"]';
  const selectors=userSelector+','+assistantSelector+',[data-chatgpt-selection-message-id]';
  const turnSelector='[data-turn-key],[data-content-search-turn-key],[data-testid^="conversation-turn-"]';
  const roleOf=node=>node.matches(userSelector)||node.matches('[data-chatgpt-selection-message-id]')&&node.querySelector(userSelector)&&!node.querySelector(assistantSelector)?'user':'assistant';
  function messages(root=document){
    return [...root.querySelectorAll(selectors)].filter(node=>{
      if(node.closest('[data-cfb-ui],nav,aside,[contenteditable="true"]'))return false;
      const parent=node.parentElement?.closest(selectors);
      if(parent&&roleOf(parent)===roleOf(node))return false;
      // Some site wrappers hold both the prompt and reply; use their children.
      if(node.matches('[data-turn],[data-chatgpt-selection-message-id]')&&[...node.querySelectorAll(selectors)].some(child=>roleOf(child)!==roleOf(node)))return false;
      return (node.textContent.trim()||node.querySelector('img,canvas,svg'))&&getComputedStyle(node).display!=='none';
    }).map(node=>{
      const role=roleOf(node);
      const owner=node.closest('[data-message-id],[data-chatgpt-selection-message-id]');
      const turn=node.closest('[data-turn-key]')||node.closest(turnSelector);
      const stable=owner?.getAttribute('data-message-id')||owner?.getAttribute('data-chatgpt-selection-message-id')||node.getAttribute('data-message-id');
      const turnKey=turn?.getAttribute('data-turn-key')||turn?.getAttribute('data-content-search-turn-key')||turn?.getAttribute('data-testid');
      const siblings=turn?[...turn.querySelectorAll(selectors)].filter(e=>roleOf(e)===role&&!(e.parentElement?.closest(selectors)&&roleOf(e.parentElement.closest(selectors))===role)):[];
      if(!stable&&!turnKey)throw new Error('无法识别消息的稳定编号，请刷新 ChatGPT 页面后重试。');
      return {key:role+':'+(stable||turnKey+':'+Math.max(0,siblings.indexOf(node))),role,node};
    });
  }
  function scrollContainer(root=document){
    const preferred=root.querySelector('.thread-scroll-container');if(preferred)return preferred;
    const containers=[...root.querySelectorAll('main,main div,[role="main"]')].filter(e=>e.clientHeight>250&&e.scrollHeight>e.clientHeight+50&&/auto|scroll/.test(getComputedStyle(e).overflowY)&&!e.closest('pre,code,textarea'));
    return containers.sort((a,b)=>b.scrollHeight-a.scrollHeight)[0]||document.scrollingElement;
  }
  function check(signal,url){signal?.throwIfAborted();if(location.href.split('#')[0]!==url)throw new Error('会话已切换，已停止导出。');}
  function pause(ms,signal){return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return;}
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
  });}
  function fingerprint(node){
    // Ignore reveal-animation styles and injected controls, but notice lazy
    // text/images/graphics becoming available as a long answer scrolls into view.
    let graphics=[...node.querySelectorAll('svg')].map(svg=>svg.outerHTML).join('|');
    for(const canvas of node.querySelectorAll('canvas')){
      try{const sample=document.createElement('canvas');sample.width=sample.height=8;const ctx=sample.getContext('2d');ctx.drawImage(canvas,0,0,8,8);graphics+='|'+String.fromCharCode(...ctx.getImageData(0,0,8,8).data);}catch{graphics+='|unreadable-canvas';}
    }
    const value=node.textContent+'|'+[...node.querySelectorAll('img')].map(img=>img.currentSrc||img.getAttribute('src')).join('|')+'|'+node.querySelectorAll('[data-d-component="box"],[data-d-component="grid"]').length+'|'+graphics;
    let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
    return (hash>>>0)+':'+value.length;
  }
  function mergeOrder(order,keys){
    let previous=-1;
    for(let i=0;i<keys.length;i++){
      const key=keys[i];let index=order.indexOf(key);
      if(index<0){const next=keys.slice(i+1).map(k=>order.indexOf(k)).find(n=>n>=0);index=next??(previous>=0?previous+1:order.length);order.splice(index,0,key);}
      if(index<previous)throw new Error('消息顺序发生变化，请保持当前分支不变后重新导出。');
      previous=index;
    }
  }
  function streaming(root){return Boolean(root.querySelector('[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="停止生成"],.result-streaming,[data-is-streaming="true"]'));}
  async function collect({root=document,scroller=scrollContainer(root),convert,signal,onProgress=()=>{},delay=350,maxSteps=4000,maxBytes=128*1024*1024}={}){
    if(typeof convert!=='function')throw new Error('会话转换服务未连接。');
    if(streaming(root))throw new Error('ChatGPT 正在生成回复，请等待完成后再导出。');
    const url=location.href.split('#')[0],originalTop=scroller.scrollTop,records=new Map(),order=[];
    const anchor=[...root.querySelectorAll('[data-turn-key]')].find(e=>{const r=e.getBoundingClientRect(),s=scroller.getBoundingClientRect();return r.bottom>s.top&&r.top<s.bottom;});
    const originalAnchor=anchor?{key:anchor.getAttribute('data-turn-key'),offset:anchor.getBoundingClientRect().top-scroller.getBoundingClientRect().top}:null;
    let total=0,completed=false;
    const move=top=>scroller.scrollTo({top,behavior:'instant'});
    const report=phase=>onProgress({phase,messages:records.size,users:[...records.values()].filter(r=>r.role==='user').length,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,viewport:scroller.clientHeight});
    async function sample(){
      check(signal,url);if(streaming(root))throw new Error('对话正在变化，已停止导出。');
      const batch=messages(root);mergeOrder(order,batch.map(item=>item.key));
      for(const item of batch){
        check(signal,url);const mark=fingerprint(item.node),old=records.get(item.key);
        if(old?.fingerprint===mark)continue;
        report('convert');const result=await convert(item);
        check(signal,url);
        if(!item.node.isConnected)throw new Error('消息在转换时被卸载，请保持页面在前台后重试。');
        total+=(result.html.length+(result.text?.length||0))*2-(old?.size||0);
        if(total>maxBytes)throw new Error('当前会话超过 128 MB 导出上限，请分段复制或导出较短分支。');
        records.set(item.key,{...result,key:item.key,role:item.role,fingerprint:mark,size:(result.html.length+(result.text?.length||0))*2});
        if(records.size>2000)throw new Error('当前会话超过 2000 条消息，请分段导出。');
      }
    }
    try{
      // Reach the actual top repeatedly: lazy history prepends can move the
      // scrollbar even after the first scrollTo(0).
      let topSignature='',topStable=0;
      for(let i=0;i<20;i++){
        check(signal,url);report('history');move(0);await pause(delay*2,signal);
        const batch=messages(root),signature=batch.slice(0,3).map(r=>r.key).join('|')+':'+scroller.scrollHeight;
        if(signature===topSignature&&scroller.scrollTop<2)topStable++;else topStable=0;
        topSignature=signature;if(topStable>=2)break;
        if(i===19)throw new Error('历史消息持续加载，暂时无法确定会话开头，请稍后重试。');
      }
      let bottomSignature='',bottomStable=0;
      for(let step=0;step<maxSteps;step++){
        await sample();report('history');
        const bottom=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-3;
        if(bottom){
          const signature=order.join('|')+':'+scroller.scrollHeight+':'+records.size;
          bottomStable=signature===bottomSignature?bottomStable+1:0;bottomSignature=signature;
          if(bottomStable>=2){completed=true;break;}
          move(scroller.scrollHeight);await pause(delay*2,signal);
        }else{
          bottomStable=0;move(scroller.scrollTop+Math.max(200,scroller.clientHeight*0.8));await pause(delay,signal);
        }
      }
      if(!completed)throw new Error('历史消息扫描未完成，未生成可能缺页的文件。');
      if(!records.size)throw new Error('没有找到当前会话内容，请先打开已有 ChatGPT 对话。');
      const result=order.filter(k=>records.has(k)).map(k=>records.get(k));
      return {messages:result,url,title:document.title.replace(/\s*[-–|]\s*ChatGPT\s*$/i,'').trim()||'ChatGPT 会话',createdAt:new Date().toISOString()};
    }finally{
      if(location.href.split('#')[0]===url){
        move(originalTop);await new Promise(resolve=>setTimeout(resolve,100));
        if(originalAnchor){const restored=root.querySelector('[data-turn-key="'+CSS.escape(originalAnchor.key)+'"]');if(restored)move(scroller.scrollTop+restored.getBoundingClientRect().top-scroller.getBoundingClientRect().top-originalAnchor.offset);}
      }
    }
  }
  globalThis.CFBConversation=Object.freeze({messages,scrollContainer,fingerprint,mergeOrder,collect,streaming});
})();
