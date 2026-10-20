/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  globalThis.__CFBContent?.abort();
  const controller=new AbortController();globalThis.__CFBContent=controller;
  const defaults={enabled:true,embedImages:true,markdownCode:true};
  const turnSelector='[data-content-search-turn-key],[data-turn-key],[data-testid^="conversation-turn-"],article';
  let settings={...defaults},busy=false;
  chrome.storage.local.get(defaults).then(value=>settings=value);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local')for(const key of Object.keys(defaults))if(changes[key])settings[key]=changes[key].newValue;});
  function toast(message,warning=false){
    let host=document.getElementById('cfb-toast');
    if(!host){host=document.createElement('div');host.id='cfb-toast';host.setAttribute('data-cfb-ui','true');host.style.cssText='position:fixed;right:24px;bottom:24px;z-index:2147483647';host.attachShadow({mode:'open'});document.documentElement.append(host);}
    host.shadowRoot.innerHTML='<style>div{font:14px/1.7 system-ui,sans-serif;white-space:pre-wrap;max-width:430px;padding:14px 18px;border-radius:12px;color:#fff;background:'+(warning?'#8a4b08':'#164f40')+';box-shadow:0 6px 30px #0003}button{border:0;border-radius:4px;margin-top:8px;padding:4px 8px;cursor:pointer}</style><div role="status"></div>';
    host.shadowRoot.querySelector('div').textContent=message;
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>host.remove(),warning?16000:5500);
  }
  function assistantFor(button){
    const direct=button.closest('[data-message-author-role="assistant"]');if(direct)return direct;
    const turn=button.closest(turnSelector);
    const modern=turn?.querySelectorAll('[data-markdown-text-style="assistant-message"]');
    if(modern?.length)return modern[modern.length-1];
    const messages=turn?.querySelectorAll('[data-message-author-role="assistant"]');
    if(messages?.length)return messages[messages.length-1];
    if(turn?.matches('[data-turn="assistant"],[data-message-author-role="assistant"]'))return turn;
    if(turn&&!turn.querySelector('[data-message-author-role="user"],[data-turn="user"],[class*="group/user-message"],.rich-text-user-turn')&&turn.querySelector('.markdown,.prose,[data-message-content],[class*="MarkdownRoot-"],[class*="DilResponseRoot-"],[data-talvt-turn-state]'))return turn;
    return null;
  }
  function findSource(button){
    const block=button.closest(CFB.codeBlockSelector);
    if(block){
      const language=CFB.codeLanguage(block),code=CFB.codeText(block);
      if(settings.markdownCode&&language==='markdown')return {markdown:code};
      return {code,language};
    }
    const message=assistantFor(button);if(!message)return null;
    const table=button.closest('[class*="tableContainer"],[class*="TableContainer"],[class*="table-container"]')?.querySelector('table');
    if(table)return {element:table};
    // Keep generated image cards outside .markdown, while removing toolbars in the clone.
    const turn=button.closest(turnSelector);
    const containsExternalChart=turn&&!turn.querySelector('.rich-text-user-turn,[data-message-author-role="user"]')&&[...turn.querySelectorAll('svg,canvas,iframe')].some(n=>!message.contains(n)&&!n.closest('button,.katex,[data-cfb-ui]')&&(n.getBoundingClientRect().width>100));
    return {element:containsExternalChart?turn:message};
  }
  function isCopy(button){
    if(button.matches('[data-testid="copy-turn-action-button"]'))return true;
    const labels=[button.getAttribute('aria-label'),button.getAttribute('title'),button.textContent].filter(Boolean);
    return labels.some(label=>/^(copy|复制|複製)( response| answer| message| code| table|代码|表格|回复|回答|内容|\s)*$/i.test(label.trim()))||button.querySelector('svg use[href*="copy"],svg[data-icon*="Copy"]');
  }
  async function dataFromURL(src){
    if(src.startsWith('data:'))return src;
    const url=new URL(src,location.href);
    if(!['blob:','https:'].includes(url.protocol))throw new Error('不支持的图片协议');
    const response=await fetch(url.href,{credentials:url.origin===location.origin?'include':'omit',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('图片需要后台下载');
    if(Number(response.headers.get('content-length'))>16*1024*1024)throw new Error('图片过大');
    const blob=await response.blob();if(blob.size>16*1024*1024)throw new Error('图片过大');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  }
  async function media(payload){
    if(!payload.svg&&!payload.formula&&!payload.diagram){try{payload={...payload,src:await dataFromURL(payload.src)};}catch{
      // Same-origin cookie-authenticated and CDN images can be fetched by the worker.
      if(payload.src.startsWith('blob:'))throw new Error('临时图片无法读取，请等待图片加载后重试。');
    }}
    const response=await chrome.runtime.sendMessage({target:'background',type:'MEDIA',payload});
    if(!response?.ok)throw new Error(response?.error||'扩展后台未响应，请刷新页面。');
    return response.result;
  }
  async function convertSource(source,{embedImages=settings.embedImages}={}){
      let snapshots=new Map(),chartWarnings=[];
      if(source.element&&globalThis.CFBCharts){const captured=await CFBCharts.snapshot(source.element,{media});snapshots=captured.snapshots;chartWarnings=captured.warnings;}
      const root=source.code!==undefined?CFB.codeBlock(source.code,source.language):source.markdown!==undefined?CFB.parseMarkdown(source.markdown):CFB.cloneAnswer(source.element,{snapshots});
      if(source.element?.querySelector('iframe'))chartWarnings.push('检测到内嵌页面：如果图表在 iframe 内，请先打开图表，再使用图表下载功能插入原图。');
      const result=await CFB.prepare(root,{media,embedImages});
      result.warnings.push(...chartWarnings);result.stats.charts=[...snapshots.values()].filter(shot=>shot.kind!=='diagram').length;result.stats.diagrams=[...snapshots.values()].filter(shot=>shot.kind==='diagram').length;
      if(!result.text&&!result.stats.images&&!result.stats.icons)throw new Error('没有找到可复制的内容。');
      if(source.code!==undefined)result.text=source.code;
      return result;
  }
  async function copy(source){
    if(busy){toast('上一份内容仍在转换或导出，请稍候。',true);return;}
    busy=true;toast('正在转换为飞书格式…');
    try{
      const result=await convertSource(source);
      await CFB.writeClipboard(result);
      const summary=`已复制飞书格式：${result.stats.formulas} 个公式、${result.stats.images} 张图片、${result.stats.icons} 个图标。`+(result.stats.charts?`\n包含 ${result.stats.charts} 张交互图表截图。`:'')+(result.stats.diagrams?`\n保留 ${result.stats.diagrams} 张完整流程或卡片布局。`:'')+(result.stats.tableFormulas?`\n其中 ${result.stats.tableFormulas} 个表格公式以高清图片保留。`:'');
      toast(summary+(result.warnings.length?'\n部分内容需要处理：\n'+result.warnings.join('\n'):'\n现在可在飞书文档中按 Ctrl+V 粘贴。'),result.warnings.length>0);
      await chrome.storage.local.set({lastResult:{time:Date.now(),stats:result.stats,warnings:result.warnings}});
    }catch(error){toast('复制失败：'+error.message+'\n可按住 Alt 再点击原复制按钮，使用原始复制。',true);}
    finally{busy=false;}
  }
  let exportTask;
  function exportPanel(){
    document.getElementById('cfb-export-progress')?.remove();
    const host=document.createElement('div');host.id='cfb-export-progress';host.dataset.cfbUi='true';host.style.cssText='position:fixed;right:24px;bottom:24px;z-index:2147483647';
    const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<style>section{box-sizing:border-box;width:330px;background:#fff;color:#1f2329;border:1px solid #d0d5dd;border-radius:12px;box-shadow:0 8px 32px #0002;padding:18px;font:14px/1.6 system-ui,sans-serif}h2{font-size:15px;margin:0 0 8px}p{margin:8px 0;color:#667085;font-size:12px}button{font:inherit;color:#344054;background:white;border:1px solid #d0d5dd;border-radius:7px;padding:4px 12px;cursor:pointer}progress{width:100%;height:5px;accent-color:#215df1}#state{margin:10px 0;white-space:pre-wrap}</style><section role="status"><h2>导出当前会话</h2><progress></progress><div id="state">正在加载历史消息…</div><p>会自动滚动加载当前分支。请保持页面在前台，暂勿切换分支或操作对话。</p><button type="button">取消导出</button></section>';
    shadow.querySelector('button').addEventListener('click',()=>{exportTask?.abort();shadow.querySelector('#state').textContent='正在停止，将在当前图片处理后退出…';});
    document.documentElement.append(host);return {host,update:info=>{shadow.querySelector('#state').textContent=(info.phase==='convert'?'正在转换文字、公式与图片…':'正在加载历史消息…')+'\n已收集 '+info.messages+' 条消息';}};
  }
  async function exportConversation(){
    if(busy)return {ok:false,error:'上一份内容仍在转换或导出，请稍候。'};
    if(!globalThis.CFBConversation||!globalThis.CFBArchive)return {ok:false,error:'导出模块未连接，请刷新 ChatGPT 页面后重试。'};
    if(CFBConversation.streaming(document))return {ok:false,error:'ChatGPT 正在生成回复，请完成后再导出。'};
    busy=true;exportTask=new AbortController();const task=exportTask,panel=exportPanel();
    const interrupted=event=>{if(event.target instanceof Element&&!event.target.closest('[data-cfb-ui]'))task.abort(new Error('检测到页面操作，已停止导出。请保持会话不变后重试。'));};
    window.addEventListener('pointerdown',interrupted,{capture:true});
    const abort=()=>task.abort();controller.signal.addEventListener('abort',abort,{once:true});
    (async()=>{
      try{
        const archive=await CFBConversation.collect({signal:task.signal,onProgress:panel.update,convert:async message=>{
          const result=await convertSource({element:message.node},{embedImages:true});
          if(message.role==='user')result.html='<div style="white-space:pre-wrap">'+result.html+'</div>';
          const attachments=[...message.node.querySelectorAll('button,[role="button"],a[download]')].filter(e=>/\.(?:pdf|docx?|xlsx?|pptx?|zip|csv|json|txt)\b/i.test(e.textContent)&&!e.querySelector('img'));
          for(const label of [...new Set(attachments.map(e=>e.textContent.trim()))]){result.html+='<p>附件：'+CFB.esc(label)+'（仅保存名称，原文件未打包）</p>';result.warnings.push('附件“'+label+'”仅保存名称，原文件未打包。');}
          return result;
        }});
        task.signal.throwIfAborted();panel.update({phase:'convert',messages:archive.messages.length});
        const response=await chrome.runtime.sendMessage({target:'background',type:'ARCHIVE_ASSETS'});
        if(!response?.ok)throw new Error(response?.error||'离线资源读取失败');
        task.signal.throwIfAborted();
        const result=CFBArchive.build(archive,response.result);CFBArchive.download(result);
        await chrome.storage.local.set({lastExport:{time:Date.now(),stats:result.stats,warnings:result.warnings}});
        toast(`已生成本地 HTML：${result.stats.messages} 条消息（用户 ${result.stats.users} / ChatGPT ${result.stats.assistants}）。\n包含 ${result.stats.formulas} 个公式、${result.stats.images} 张图片、${result.stats.icons} 个图标。\n在浏览器中打开下载的文件，可复制全部或分条复制到飞书。`+(result.warnings.length?'\n有 '+result.warnings.length+' 项内容需要检查，详见文件内提示。':''),result.warnings.length>0);
      }catch(error){toast((task.signal.aborted?'导出已取消':'导出失败')+'：'+(task.signal.reason?.message||error.message),true);}
      finally{panel.host.remove();window.removeEventListener('pointerdown',interrupted,true);controller.signal.removeEventListener('abort',abort);if(exportTask===task)exportTask=null;busy=false;}
    })();
    return {ok:true};
  }
  window.addEventListener('click',event=>{
    if(!settings.enabled||event.altKey)return;
    const button=event.target instanceof Element?event.target.closest('button,[role="button"]'):null;
    if(!button||button.closest('[data-cfb-ui]')||!isCopy(button))return;
    const source=findSource(button);if(!source)return;
    event.preventDefault();event.stopImmediatePropagation();copy(source);
  },{capture:true,signal:controller.signal});
  // Inherit the native toolbar's sizing, colors, hover and dark-mode styles.
  function mountActions(){
    for(const native of document.querySelectorAll('button[data-testid="copy-turn-action-button"],article button[aria-label],article button[title],[data-content-search-turn-key] button[aria-label],[data-turn-key] button[aria-label]')){
      if(native.closest('[data-cfb-ui]')||!isCopy(native)||native.nextElementSibling?.hasAttribute('data-cfb-ui'))continue;
      if(!assistantFor(native))continue;
      const own=document.createElement('button');own.type='button';own.className=native.className;own.title='复制到飞书 · 含公式和图表';own.setAttribute('aria-label','复制到飞书');own.setAttribute('data-cfb-ui','true');
      if(native.closest(CFB.codeBlockSelector)){own.title='复制代码到飞书';own.setAttribute('aria-label','复制代码到飞书');}
      own.style.cssText='display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer';
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
      for(const [key,value] of Object.entries({width:'20',height:'20',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))icon.setAttribute(key,value);
      const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M8 9h3M8 13h3M8 17h8M14 10l7-7M15 3h6v6');icon.append(path);own.append(icon);
      own.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const source=findSource(native);if(source)copy(source);else toast('找不到这条回复，请刷新页面。',true);},{signal:controller.signal});
      native.after(own);
    }
  }
  let timer;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mountActions,600);});
  const start=()=>{mountActions();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true,signal:controller.signal});
  controller.signal.addEventListener('abort',()=>{observer.disconnect();clearTimeout(timer);document.querySelectorAll('button[data-cfb-ui]').forEach(n=>n.remove());});
  const onMessage=(msg,_sender,reply)=>{if(msg?.type==='CFB_PING')reply({version:chrome.runtime.getManifest().version,enabled:settings.enabled,answers:document.querySelectorAll('[data-message-author-role="assistant"],article[data-turn="assistant"],[data-markdown-text-style="assistant-message"]').length});if(msg?.type==='CFB_EXPORT'){exportConversation().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;}};
  chrome.runtime.onMessage.addListener(onMessage);controller.signal.addEventListener('abort',()=>chrome.runtime.onMessage.removeListener(onMessage));
})();
