/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const userSelector='[data-message-author-role="user"],[data-chatgpt-search-unit-key$=":user"],[data-user-message-bubble],.rich-text-user-turn,[data-markdown-text-tone="user-message"],[data-turn="user"]';
  const assistantBody='[data-markdown-text-style="assistant-message"]';
  const assistantAuthor='[data-message-author-role="assistant"]';
  const assistantOwner=assistantAuthor+',[data-turn="assistant"]';
  const assistantSelector=assistantOwner+','+assistantBody;
  const legacyAssistantBody='.markdown,[data-message-content]';
  const selectors=userSelector+','+assistantSelector+',[data-chatgpt-selection-message-id]';
  const turnSelector='[data-turn-key],[data-content-search-turn-key],[data-testid^="conversation-turn-"]';
  const mainSelector='main,[role="main"]';
  const transcriptSelector='.thread-scroll-container,#thread,[data-conversation-id]';
  const excluded='[data-cfb-ui],nav,aside,dialog,[role="dialog"],[role="complementary"],[role="search"],[contenteditable="true"],[hidden],[inert],[aria-hidden="true"],[data-message-author-role]:not([data-message-author-role="user"],[data-message-author-role="assistant"])';
  const scopeError='无法确定当前会话的消息范围，请关闭会话预览或搜索结果，刷新当前会话后重试。';
  const unloadedHistory='页面上还有历史消息未显示，请手动滚过空白区域，等消息显示后重试。';
  const ownerOf=node=>node.closest(transcriptSelector)||node.closest(mainSelector);
  const roleOf=node=>node.matches(userSelector)||node.matches('[data-chatgpt-selection-message-id]')&&node.querySelector(userSelector)&&!node.querySelector(assistantSelector)?'user':'assistant';
  function visible(node){
    if(node.closest(excluded))return false;
    const style=getComputedStyle(node);
    return style.display!=='none'&&style.visibility==='visible'&&(style.display==='contents'||!node.checkVisibility||node.checkVisibility());
  }
  const hasContent=node=>Boolean(node.textContent.trim()||node.querySelector('img,canvas,svg'));
  const isAssistantBody=node=>visible(node)&&hasContent(node)&&!node.closest('button,[role="button"],summary,[role="status"],[data-markdown-copy="exclude"]');
  function assistantParts(node,turn){
    if(node.matches(assistantBody))return isAssistantBody(node)?[node]:[];
    const bodies=[...node.querySelectorAll(assistantBody)].filter(isAssistantBody);
    // Older ChatGPT messages mark the reply itself with an author role.
    if(!bodies.length&&node.matches(assistantAuthor)&&isAssistantBody(node)){
      const hasMarkedReply=turn&&[...turn.querySelectorAll(assistantBody)].some(isAssistantBody);
      if(!hasMarkedReply)return [node];
    }
    // A selection ID can also identify a status panel. Require an assistant
    // owner when taking Markdown that lacks the modern reply marker.
    if(!bodies.length&&node.matches(assistantOwner)){
      const legacy=node.matches(legacyAssistantBody)?[node]:[...node.querySelectorAll(legacyAssistantBody)];
      bodies.push(...legacy.filter(body=>body.closest(assistantOwner)===node&&isAssistantBody(body)));
    }
    const media=[...node.querySelectorAll('img,canvas'),...(globalThis.CFBCharts?.chartRoots(node)||[])]
      .filter(part=>visible(part)&&!bodies.some(body=>part.contains(body))&&
        !part.closest('[data-d-component="favicon"],[data-markdown-copy="exclude"],.sr-only,[role="status"],summary'));
    const parts=[...new Set([...bodies,...media])];
    return parts.filter(part=>!parts.some(parent=>parent!==part&&parent.contains(part)))
      .sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
  }
  function messages(root,belongs){
    const candidates=new Map();
    for(const node of root.querySelectorAll(selectors)){
      if(!visible(node))continue;
      const role=roleOf(node);
      const keyed=node.closest('[data-turn-key]');
      const turn=keyed&&root.contains(keyed)?keyed:node.closest(turnSelector);
      if(belongs&&(!turn||!belongs(turn)||!belongs(node)))continue;
      // Some site wrappers hold both the prompt and reply; use their children.
      if(node.matches('[data-turn],[data-chatgpt-selection-message-id]')&&[...node.querySelectorAll(selectors)].some(child=>roleOf(child)!==role))continue;
      const parts=role==='assistant'?assistantParts(node,turn):hasContent(node)?[node]:[];
      if(belongs&&parts.some(part=>!belongs(part)||[...part.querySelectorAll(transcriptSelector)].some(child=>!belongs(child)&&child.querySelector(selectors))))throw new Error(scopeError);
      if(parts.length)candidates.set(node,{node,role,parts,turn});
    }
    const distinct=[...candidates.values()].filter(({node,role,parts})=>{
      for(let parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement){
        const ancestor=candidates.get(parent);
        if(ancestor?.role===role&&(role==='user'||parts.every(part=>ancestor.parts.some(outer=>outer.contains(part)))))return false;
      }
      return true;
    });
    // A retained child reply owns its parts, even if a parent also found its media.
    for(const {node,role,parts} of distinct){
      if(role!=='assistant')continue;
      for(let parent=node.parentElement;parent&&parent!==root;parent=parent.parentElement){
        const ancestor=candidates.get(parent);
        if(ancestor?.role===role)ancestor.parts=ancestor.parts.filter(part=>!parts.some(child=>child.contains(part)));
      }
    }
    const messages=distinct.filter(message=>message.parts.length).sort((a,b)=>{
      const first=a.parts[0],second=b.parts[0];
      if(first===second)return 0;
      return first.compareDocumentPosition(second)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1;
    });
    return messages.map(({node,role,parts,turn})=>{
      const owner=node.closest('[data-message-id],[data-chatgpt-selection-message-id]');
      const stable=owner?.getAttribute('data-message-id')||owner?.getAttribute('data-chatgpt-selection-message-id')||node.getAttribute('data-message-id');
      const turnKey=turn?.getAttribute('data-turn-key')||turn?.getAttribute('data-content-search-turn-key')||turn?.getAttribute('data-testid');
      const siblings=turn?messages.filter(item=>item.role===role&&turn.contains(item.node)).map(item=>item.node):[];
      if(!stable&&!turnKey)throw new Error('无法识别消息的稳定编号，请刷新 ChatGPT 页面后重试。');
      return {key:role+':'+(stable||turnKey+':'+Math.max(0,siblings.indexOf(node))),role,node,parts};
    });
  }
  function scrollContainer(page,turns){
    const containers=[];
    for(let node=turns[0].parentElement;node&&node!==page.body;node=node.parentElement){
      if(node.clientHeight>0&&/^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)&&turns.every(turn=>node.contains(turn)))containers.push(node);
    }
    const overflowing=node=>node&&node.scrollHeight>node.clientHeight+2;
    return containers.find(overflowing)||(overflowing(page.scrollingElement)?page.scrollingElement:containers[0]||page.scrollingElement);
  }
  function mountedHistoryCoversViewport(root,scroller,inScope){
    const row=[...root.querySelectorAll('[data-rail-chat-transcript] [data-virtualized-turn]')].find(inScope);
    const track=row?.parentElement;
    const layout=track?.parentElement;
    if(!layout?.style.height||getComputedStyle(layout).position!=='relative')return true;
    // The layout reserves space for the full history. The inner track holds
    // only the mounted turns and offsets them by the unmounted leading space.
    const full=layout.getBoundingClientRect(),mounted=track.getBoundingClientRect();
    const viewportTop=scroller===document.scrollingElement?0:scroller.getBoundingClientRect().top+scroller.clientTop;
    const top=scroller.scrollTop<2?full.top:Math.max(full.top,viewportTop);
    const bottom=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-3?
      full.bottom:Math.min(full.bottom,viewportTop+scroller.clientHeight);
    return bottom<=top||mounted.top<=top+2&&mounted.bottom>=bottom-2;
  }
  function resolveContext(page=document){
    const conversationId=page.location.pathname.match(/\/c\/([^/]+)\/?$/)?.[1];
    const conversationIdOf=node=>node.closest('[data-conversation-id]')?.getAttribute('data-conversation-id');
    const transcripts=new Map();
    for(const turn of page.querySelectorAll(turnSelector)){
      if(!turn.closest(mainSelector)||!visible(turn)||!turn.matches(selectors)&&!turn.querySelector(selectors))continue;
      const root=ownerOf(turn);
      const outerTurn=turn.parentElement?.closest(turnSelector);
      if(outerTurn&&ownerOf(outerTurn)===root)continue;
      const id=conversationIdOf(root);
      if(id&&conversationId&&id!==conversationId)continue;
      if(!transcripts.has(root))transcripts.set(root,{root,id,turns:[]});
      transcripts.get(root).turns.push(turn);
    }
    const groups=[...transcripts.values()];
    const matching=groups.filter(group=>conversationId&&group.id===conversationId);
    const marked=groups.filter(group=>group.root.matches(transcriptSelector));
    const candidates=matching.length?matching:marked.length?marked:groups;
    if(candidates.length!==1)throw new Error(scopeError);
    const {root,id,turns}=candidates[0];
    const turnList=root.matches(transcriptSelector)?null:turns[0].parentElement;
    if(turnList&&turns.some(turn=>turn.parentElement!==turnList))throw new Error(scopeError);
    const scroller=scrollContainer(page,turns);
    const belongs=node=>root.contains(node)&&ownerOf(node)===root&&conversationIdOf(root)===id&&(!turnList||root.contains(turnList)&&(node===root||turnList.contains(node)));
    const view=turns[0].closest(mainSelector);
    const isStreaming=()=>streaming(view,node=>belongs(node)||node.closest(mainSelector)===view&&!node.closest(transcriptSelector));
    return {root,scroller,belongs,isStreaming};
  }
  function pause(ms,signal){return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return;}
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
  });}
  function fingerprint(node){
    // Ignore reveal-animation styles and injected controls, but notice lazy
    // text/images/graphics becoming available as a long answer scrolls into view.
    let graphics=[...(node.matches('svg')?[node]:[]),...node.querySelectorAll('svg')].map(svg=>svg.outerHTML).join('|');
    for(const canvas of [...(node.matches('canvas')?[node]:[]),...node.querySelectorAll('canvas')]){
      try{const sample=document.createElement('canvas');sample.width=sample.height=8;const ctx=sample.getContext('2d');ctx.drawImage(canvas,0,0,8,8);graphics+='|'+String.fromCharCode(...ctx.getImageData(0,0,8,8).data);}catch{graphics+='|unreadable-canvas';}
    }
    const value=node.textContent+'|'+[...(node.matches('img')?[node]:[]),...node.querySelectorAll('img')].map(img=>img.currentSrc||img.getAttribute('src')).join('|')+'|'+node.querySelectorAll('[data-d-component="box"],[data-d-component="grid"]').length+'|'+graphics;
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
  function streaming(root,accept=()=>true){return [...root.querySelectorAll('[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="停止生成"],.result-streaming,[data-is-streaming="true"]')].some(node=>visible(node)&&accept(node));}
  async function collect({scope,root,scroller,convert,signal,onProgress=()=>{},waitForManualTop=false,delay=350,maxSteps=4000,maxBytes=128*1024*1024}={}){
    if(typeof convert!=='function')throw new Error('会话转换服务未连接。');
    const context=scope||(root?{root,scroller:scroller||root,isStreaming:()=>streaming(root)}:resolveContext());
    ({root,scroller}=context);
    if(context.isStreaming())throw new Error('ChatGPT 正在生成回复，请等待完成后重试。');
    const url=location.href.split('#')[0],originalTop=scroller.scrollTop,records=new Map(),order=[];
    const inScope=node=>!context.belongs||context.belongs(node);
    const check=()=>{signal?.throwIfAborted();if(location.href.split('#')[0]!==url||!root.isConnected||!scroller.isConnected||!inScope(root))throw new Error('当前会话或滚动区域已切换，请重试。');};
    const anchor=[...root.querySelectorAll('[data-turn-key]')].find(e=>{const r=e.getBoundingClientRect(),s=scroller.getBoundingClientRect();return inScope(e)&&r.bottom>s.top&&r.top<s.bottom;});
    const originalAnchor=anchor?{key:anchor.getAttribute('data-turn-key'),offset:anchor.getBoundingClientRect().top-scroller.getBoundingClientRect().top}:null;
    let total=0,completed=false,capture;
    const move=top=>scroller.scrollTo({top,behavior:'instant'});
    const scrollStep=()=>Math.max(1,Math.floor(scroller.clientHeight*0.75));
    const historyMounted=()=>mountedHistoryCoversViewport(root,scroller,inScope);
    const report=phase=>onProgress({phase,messages:records.size,users:[...records.values()].filter(r=>r.role==='user').length,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,viewport:scroller.clientHeight});
    async function sample(){
      check();if(context.isStreaming())throw new Error('对话正在生成新内容，请等待完成后重试。');
      for(let attempt=0;!historyMounted();attempt++){
        if(attempt===19)throw new Error(unloadedHistory);
        report('history');await pause(delay*2,signal);check();
        if(context.isStreaming())throw new Error('对话正在生成新内容，请等待完成后重试。');
      }
      const batch=messages(root,context.belongs);
      if(!batch.length)throw new Error('当前会话的消息未加载，请刷新会话后重试。');
      mergeOrder(order,batch.map(item=>item.key));
      for(const item of batch){
        check();const mark=item.parts.map(fingerprint).join('|'),old=records.get(item.key);
        if(old?.fingerprint===mark)continue;
        report('convert');const result=await convert(item);
        check();
        if(!item.node.isConnected||!inScope(item.node)||item.parts.some(part=>!part.isConnected||!inScope(part)))throw new Error('消息在转换时移出当前会话，请保持页面在前台后重试。');
        total+=(result.html.length+(result.text?.length||0))*2-(old?.size||0);
        if(total>maxBytes)throw new Error('当前会话超过 128 MB 导出上限，请分段复制或导出较短分支。');
        records.set(item.key,{...result,key:item.key,role:item.role,fingerprint:mark,size:(result.html.length+(result.text?.length||0))*2});
        if(records.size>2000)throw new Error('当前会话超过 2000 条消息，请分段导出。');
      }
    }
    try{
      // A virtual list can restore the previous position after a jump. Walk
      // up in overlapping steps if that happens, then wait for lazy history.
      const topPositions=new Set();
      const autoUntil=performance.now()+20000;
      let topSignature='',topStable=0,topStalls=0,stepUp=false,topUnloaded=false;
      const confirmTop=()=>{
        topUnloaded=!historyMounted();
        const batch=scroller.scrollTop<2&&!topUnloaded?messages(root,context.belongs):[];
        const signature=batch.length?batch.slice(0,3).map(r=>r.key).join('|')+':'+scroller.scrollHeight:'';
        topStable=signature&&signature===topSignature?topStable+1:0;
        topSignature=signature;
      };
      for(let i=0;i<Math.max(20,maxSteps)&&topStalls<20&&performance.now()<autoUntil;i++){
        check();report('history');
        const before=scroller.scrollTop;
        const target=stepUp?Math.max(0,before-scrollStep()):0;
        if(before>=2)move(target);
        await pause(target>=2?delay:delay*2,signal);check();
        const after=scroller.scrollTop;
        if(after>=2){
          stepUp=true;topSignature='';topStable=0;
          const bucket=Math.max(1,scrollStep()/2);
          const position=Math.round(after/bucket)+':'+Math.round(scroller.scrollHeight/bucket);
          topStalls=after<before-1&&!topPositions.has(position)?0:topStalls+1;
          topPositions.add(position);
          continue;
        }
        confirmTop();
        if(topStable>=2)break;
        topStalls++;
      }
      if(topStable<2&&waitForManualTop){
        // Release the scroll position so the page can react to real input.
        report('manual-top');topSignature='';topStable=0;
        const manualUntil=performance.now()+120000;
        while(topStable<2&&performance.now()<manualUntil){
          await pause(delay,signal);check();confirmTop();
        }
      }
      if(topStable<2)throw new Error(topUnloaded?unloadedHistory:'暂时无法确认会话开头，请手动滚到顶部，等历史消息加载完成后重试。');
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
          bottomStable=0;move(scroller.scrollTop+scrollStep());await pause(delay,signal);
        }
      }
      if(!completed)throw new Error('历史消息扫描未完成，未生成可能缺页的文件。');
      if(!records.size)throw new Error('没有找到当前会话内容，请先打开已有 ChatGPT 对话。');
      const result=order.filter(k=>records.has(k)).map(k=>records.get(k));
      capture={messages:result,url,title:document.title.replace(/\s*[-–|]\s*ChatGPT\s*$/i,'').trim()||'ChatGPT 会话',createdAt:new Date().toISOString()};
    }finally{
      if(location.href.split('#')[0]===url&&root.isConnected&&scroller.isConnected){
        move(originalTop);await new Promise(resolve=>setTimeout(resolve,100));
        if(originalAnchor&&location.href.split('#')[0]===url&&scroller.isConnected){const restored=[...root.querySelectorAll('[data-turn-key="'+CSS.escape(originalAnchor.key)+'"]')].find(inScope);if(restored)move(scroller.scrollTop+restored.getBoundingClientRect().top-scroller.getBoundingClientRect().top-originalAnchor.offset);}
      }
    }
    check();return capture;
  }
  globalThis.CFBConversation=Object.freeze({messages,resolveContext,fingerprint,mergeOrder,collect});
})();
