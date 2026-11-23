/* SPDX-License-Identifier: MIT */
(async()=>{
  const results=[],assert=(condition,message)=>{if(!condition)throw new Error(message);};
  async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
  function fixture(count=12,tag='main'){
    const root=document.createElement(tag);root.style.cssText='height:220px;width:600px;overflow-y:auto;position:relative';
    const area=document.createElement('div');area.style.cssText=`height:${count*160}px;position:relative`;root.append(area);document.body.append(root);
    const render=()=>{
      const start=Math.max(0,Math.floor(root.scrollTop/160)-1),end=Math.min(count,start+5);
      area.innerHTML=Array.from({length:end-start},(_,n)=>{
        const index=start+n,role=index%2?'assistant':'user';
        return `<article data-turn-key="turn-${index}" style="position:absolute;top:${index*160}px;height:150px;width:500px"><div data-message-author-role="${role}"><p>${index===2||index===4?'重复问题':'消息 '+index}</p></div></article>`;
      }).join('');
    };
    root.addEventListener('scroll',render);render();
    return {root,render,remove:()=>root.remove()};
  }
  const convert=async item=>({html:'<p>'+CFB.esc(item.node.textContent)+'</p>',text:item.node.textContent,stats:{formulas:0,images:0},warnings:[]});
  await test('新版同一轮中双方消息各识别一次，重复提问不合并',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-turn-key="one"><div data-chatgpt-search-unit-key="one:0:user"><div data-user-message-bubble><div class="rich-text-user-turn">同一提问</div></div><button>编辑消息</button></div><div data-chatgpt-selection-message-id="a1"><div data-markdown-text-style="assistant-message">回答一</div></div></div><div data-turn-key="two"><div data-message-author-role="user">同一提问</div><div data-message-author-role="assistant"><div data-markdown-text-style="assistant-message">回答二</div></div></div>';document.body.append(root);
    try{const found=CFBConversation.messages(root);assert(found.length===4,'Nested messages duplicated');assert(found.map(m=>m.role).join(',')==='user,assistant,user,assistant','Role or order incorrect');assert(new Set(found.map(m=>m.key)).size===4,'Repeated prompt lost its distinct id');}finally{root.remove();}
  });
  await test('虚拟滚动加载全部消息，顺序无缺失并恢复原位置',async()=>{
    const f=fixture(16);f.root.scrollTop=700;f.render();const top=f.root.scrollTop;
    try{const result=await CFBConversation.collect({root:f.root,scroller:f.root,convert,delay:30});assert(result.messages.length===16,'Missed virtualized messages');assert(result.messages.map(m=>m.key).every((key,index)=>key.endsWith('turn-'+index+':0')),'Messages out of order');assert(result.messages.filter(m=>m.text==='重复问题').length===2,'Repeated prompt deduplicated by text');assert(Math.abs(f.root.scrollTop-top)<3,'Scroll position not restored');}finally{f.remove();}
  });
  await test('整页采集只滚动主会话，读完虚拟列表并排除旁栏会话',async()=>{
    const f=fixture(16,'div');
    const page=document.createElement('div');page.innerHTML='<div role="complementary" class="thread-scroll-container"><article data-turn-key="other"><div data-message-author-role="user">旁栏里的另一段会话</div></article></div><main class="thread-scroll-container"></main>';
    document.body.append(page);page.querySelector('main').append(f.root);f.root.scrollTop=700;f.render();
    try{
      const result=await CFBConversation.collect({convert,delay:30});
      assert(result.messages.length===16&&result.messages.every((m,index)=>m.key.endsWith('turn-'+index+':0')),`Got ${result.messages.length} messages; foreign content: ${result.messages.some(m=>m.text.includes('旁栏'))}`);
      assert(Math.abs(f.root.scrollTop-700)<3,'The active transcript scroll position was not restored');
    }finally{page.remove();}
  });
  await test('两个可见会话无法确定归属时，读取正文前停止',async()=>{
    const page=document.createElement('main');page.innerHTML='<div class="thread-scroll-container"><article data-turn-key="one"><div data-message-author-role="user">第一段会话</div></article></div><div class="thread-scroll-container"><article data-turn-key="two"><div data-message-author-role="user">第二段会话</div></article></div>';
    document.body.append(page);let calls=0,error;
    try{await CFBConversation.collect({convert:async item=>{calls++;return convert(item);},delay:10});}catch(e){error=e;}finally{page.remove();}
    assert(calls===0&&error?.message.includes('无法确定当前会话'),`Ambiguous transcripts converted ${calls} messages`);
  });
  await test('主视图内彼此独立的无标识会话不会合并为一份',()=>{
    const page=document.createElement('main');page.innerHTML='<section><article data-turn-key="one"><div data-message-author-role="user">第一段会话</div></article></section><section><article data-turn-key="two"><div data-message-author-role="user">第二段会话</div></article></section>';
    document.body.append(page);let error;
    try{CFBConversation.resolveContext();}catch(e){error=e;}finally{page.remove();}
    assert(error?.message.includes('无法确定当前会话'),'Unmarked sibling transcripts were accepted as one transcript');
  });
  await test('会话标识和当前 URL 一致时只采集匹配的会话',async()=>{
    const original=location.href;
    const page=document.createElement('main');page.innerHTML='<div data-conversation-id="foreign"><article data-turn-key="foreign"><div data-message-author-role="user">另一个会话</div></article></div><div data-conversation-id="current"><article data-turn-key="current"><div data-message-author-role="user">当前会话</div></article></div>';
    document.body.append(page);history.replaceState(null,'','/c/current');
    try{
      const result=await CFBConversation.collect({convert,delay:10});
      assert(result.messages.length===1&&result.messages[0].text==='当前会话','A different conversation ID reached the output');
      page.querySelector('[data-conversation-id="current"]').remove();
      let error;try{CFBConversation.resolveContext();}catch(e){error=e;}
      assert(error?.message.includes('无法确定当前会话'),'An explicitly mismatched transcript was accepted');
    }finally{history.replaceState(null,'',original);page.remove();}
  });
  await test('图片生成回复和正文外的图片一起纳入消息',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-turn-key="images"><div data-chatgpt-search-unit-key="images:0:user"><div data-user-message-bubble>请看图片</div><img alt="用户图片" src="data:image/png;base64,AA=="></div><div data-chatgpt-selection-message-id="image-response"><div data-markdown-text-style="assistant-message">生成结果</div><button><img alt="生成图片" src="data:image/png;base64,AA=="></button></div></div><div data-turn-key="only-image"><div data-chatgpt-selection-message-id="image-only"><button><img alt="仅图片回复" src="data:image/png;base64,AA=="></button></div></div>';document.body.append(root);
    try{const found=CFBConversation.messages(root);assert(found.length===3,'Image-only answer omitted or messages duplicated');assert(found[0].role==='user'&&found[0].parts[0].querySelector('img'),'User image omitted');assert(found[1].parts[1]?.alt==='生成图片'&&found[2].parts[0]?.alt==='仅图片回复','Generated images outside Markdown omitted');}finally{root.remove();}
  });
  await test('仅导出提问和正式回复，跳过独立思考摘要及回复外的进度文字',async()=>{
    const root=document.createElement('div');
    root.innerHTML='<article data-turn-key="sample"><div data-turn="user"><div class="rich-text-user-turn" style="white-space:pre-wrap">第一行\n<strong>第二行</strong>\n\n末段</div></div><div data-chatgpt-selection-message-id="status">正在核对资料</div><div data-turn="assistant" data-chatgpt-selection-message-id="reply"><div>梳理了功能差异</div><div data-markdown-text-style="assistant-message"><h2>功能差异</h2><p>已梳理了功能差异，以下为正式回复。</p></div><div data-markdown-text-style="assistant-message"><h3>检索</h3><p>正式回复的第二部分。</p></div></div><div data-chatgpt-selection-message-id="ignored"><button><svg width="12" height="12"></svg>思考详情</button></div></article><article data-turn-key="legacy"><div data-message-author-role="assistant"><p>旧版正文</p></div></article>';
    root.querySelector('[data-turn="assistant"]').insertAdjacentHTML('beforebegin','<div data-message-author-role="assistant" data-message-id="preamble">正在整理回复</div><div role="status"><div data-markdown-text-style="assistant-message">生成进度</div></div>');
    document.body.append(root);
    try{
      const found=CFBConversation.messages(root);
      assert(found.map(m=>m.role).join(',')==='user,assistant,assistant','Export included a standalone status or lost a legacy reply');
      assert(found[1].key==='assistant:reply'&&found[1].parts.length===2,'Final reply parts lost their message identity');
      assert(found[1].parts.map(n=>n.textContent).join('|')==='功能差异已梳理了功能差异，以下为正式回复。|检索正式回复的第二部分。','Reply content changed or leaked a progress line');
      const user=await CFB.prepare(CFB.cloneAnswer(found[0].parts[0],{userMessage:true}));
      assert(user.text==='第一行\n第二行\n\n末段'&&user.html.includes('<br><strong')&&user.html.includes('</strong><br><br>'),'User line breaks or formatting were lost');
    }finally{root.remove();}
  });
  await test('停止后重发同一提问，整段复制保留新版容器内的旧格式正文',async()=>{
    const root=document.createElement('main');
    root.innerHTML=`
      <article data-turn-key="stopped"><div data-message-author-role="user" data-message-id="u1">同一提问</div>
        <div data-turn="assistant" data-chatgpt-selection-message-id="stopped-reply">
          <div role="status"><div class="markdown">已停止生成</div></div>
        </div>
      </article>
      <article data-turn-key="resent"><div data-message-author-role="user" data-message-id="u2">同一提问</div>
        <div data-chatgpt-selection-message-id="thinking"><div class="markdown">独立思考摘要</div></div>
        <div data-turn="assistant" data-chatgpt-selection-message-id="final">
          <div data-markdown-copy="exclude"><div class="markdown">回复外的状态</div></div>
          <div class="markdown"><p>重发后的正式答复</p></div>
        </div>
        <div data-turn="assistant" aria-hidden="true"><div class="markdown">隐藏分支的答复</div></div>
      </article>`;
    document.body.append(root);
    try{
      const archive=await CFBConversation.collect({delay:10,convert:async message=>({
        html:message.parts.map(part=>part.outerHTML).join('')
      })});
      const clipboard=CFBArchive.buildClipboard(archive);
      assert(archive.messages.map(message=>message.key).join(',')==='user:u1,user:u2,assistant:final','The resent answer or one of the prompts was lost');
      assert(clipboard.text.match(/同一提问/g)?.length===2&&clipboard.text.includes('重发后的正式答复'),'The whole conversation did not contain both prompts and the final answer');
      for(const omitted of ['已停止生成','独立思考摘要','回复外的状态','隐藏分支的答复'])assert(!clipboard.text.includes(omitted),`Unexpected text: ${omitted}`);
    }finally{root.remove();}
  });
  await test('同一轮有多个回复容器时，分别保留可见正文及页面顺序',()=>{
    const root=document.createElement('div');
    root.innerHTML=`
      <article data-turn-key="mixed" data-turn="assistant">
        <div data-message-author-role="assistant" data-message-id="legacy">
          <div data-message-content><div class="markdown">旧格式正式答复<img alt="答复图片" src="data:image/png;base64,AA=="></div></div>
        </div>
        <div data-chatgpt-selection-message-id="modern">
          <div class="markdown"><div data-markdown-text-style="assistant-message">带标记的正式答复</div></div>
        </div>
      </article>`;
    document.body.append(root);
    try{
      const found=CFBConversation.messages(root);
      const texts=found.map(message=>message.parts.map(part=>part.textContent.trim()).join('|'));
      assert(texts.join(',')==='旧格式正式答复,带标记的正式答复','The marked answer masked another answer or changed its position');
      assert(found[0].key==='assistant:legacy','The legacy answer lost its message ID');
      assert(found[0].parts[0].querySelector('img')&&!found[1].parts.some(part=>part.matches('img')||part.querySelector('img')),'The image was lost or copied into the neighboring reply');
    }finally{root.remove();}
  });
  await test('无法扫完整段历史时失败，不返回部分会话冒充完整结果',async()=>{
    const f=fixture(20);let failed=false;
    try{await CFBConversation.collect({root:f.root,scroller:f.root,convert,delay:10,maxSteps:1});}catch(e){failed=e.message.includes('扫描未完成');}finally{f.remove();}
    assert(failed,'Incomplete scan accepted');
  });
  await test('取消导出会终止扫描且恢复原滚动位置',async()=>{
    const f=fixture(16),controller=new AbortController();f.root.scrollTop=600;f.render();const top=f.root.scrollTop;let cancelled=false;
    try{await CFBConversation.collect({root:f.root,scroller:f.root,signal:controller.signal,delay:15,convert:async item=>{controller.abort();return convert(item);}});}catch{cancelled=controller.signal.aborted;}finally{assert(Math.abs(f.root.scrollTop-top)<3,'Cancelled scan left the page at the wrong position');f.remove();}
    assert(cancelled,'Cancellation ignored');
  });
  await test('生成中的回复拒绝导出，避免截断内容',async()=>{
    const f=fixture();f.root.insertAdjacentHTML('beforeend','<button data-testid="stop-button">Stop</button>');let failed=false;
    try{await CFBConversation.collect({root:f.root,scroller:f.root,convert});}catch(e){failed=e.message.includes('正在生成');}finally{f.remove();}assert(failed,'Streaming answer accepted');
  });
  await test('排序支持迟到消息插入，拒绝反向顺序',async()=>{
    const order=['a','c'];CFBConversation.mergeOrder(order,['a','b','c']);assert(order.join(',')==='a,b,c','Late history inserted incorrectly');let failed=false;try{CFBConversation.mergeOrder(order,['c','a']);}catch{failed=true;}assert(failed,'Branch reordering accepted');
  });
  await test('延迟绘制的 Canvas 和 SVG 更新会触发重新收集',async()=>{
    const root=document.createElement('div');root.innerHTML='<canvas width="20" height="20"></canvas><svg><path d="M0 0L10 10"/></svg>';document.body.append(root);
    try{const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),before=CFBConversation.fingerprint(root);ctx.fillStyle='red';ctx.fillRect(0,0,20,20);const after=CFBConversation.fingerprint(root);assert(before!==after,'Canvas repaint not detected');root.querySelector('path').setAttribute('d','M0 10L10 0');assert(CFBConversation.fingerprint(root)!==after,'SVG geometry update not detected');}finally{root.remove();}
  });
  let assets,output,directCopy;
  await test('离线 HTML 打包字体与脚本，转义标题并保存原生公式',async()=>{
    const text=path=>fetch('../'+path).then(r=>r.text());
    const [viewerScript,clipboardScript,katexScript,css]=await Promise.all([text('archive-viewer.js'),text('archive-clipboard.js'),text('vendor/katex.min.js'),text('vendor/katex.min.css')]);
    let katexCSS=css;
    for(const path of [...new Set([...css.matchAll(/url\((fonts\/[^)]+)\)/g)].map(m=>m[1]))]){
      const buffer=new Uint8Array(await(await fetch('../vendor/'+path)).arrayBuffer());let raw='';for(const byte of buffer)raw+=String.fromCharCode(byte);katexCSS=katexCSS.replaceAll('url('+path+')','url(data:font/woff2;base64,'+btoa(raw)+')');
    }
    assets={viewerScript,clipboardScript,katexScript,katexCSS};assert((katexCSS.match(/@font-face/g)||[]).length===20,'Bundled font faces missing');assert(!katexCSS.includes('url(fonts/'),'Offline CSS needs external font files');
    const prepared=await CFB.prepare(CFB.parseMarkdown('行内 $x^2$。\n\n$$\\frac{a}{b}$$\n\n```text\n$keep_literal$\n```'));
    const code=await CFB.prepare('<div data-code-block="true"><div data-markdown-copy="exclude">Python<button>运行</button></div><div data-code-block-source="true"><code># 注释保持代码\n    return "$literal$"</code></div></div>');prepared.html+=code.html;
    prepared.html='<div>\n    <h2>正式回复</h2>\n    <h3>详细说明</h3>\n    '+prepared.html+'</div>';
    const archive={title:'测试 </title><script>window.PWNED=1</script>',url:'https://chatgpt.com/c/example',createdAt:new Date().toISOString(),messages:[{role:'user',html:'<p>第一问<br>第二行<br><br>另一段</p>',stats:{},warnings:[]},{role:'assistant',...prepared}]};
    output=CFBArchive.build(archive,assets);directCopy=CFBArchive.buildClipboard(archive);
    assert(!output.html.includes('<script>window.PWNED'),'Untrusted title executable');assert(output.html.includes('data-export-tex="x^2"'),'Formula metadata absent');assert(output.html.includes('$keep_literal$'),'Code modified');assert(output.stats.users===1&&output.stats.assistants===1,'Export roles not counted');assert(!/[<>:"/\\|?*]/.test(output.filename),'Unsafe filename');
  });
  await test('离线预览渲染公式，复制恢复 LaTeX 且不复制按钮',async()=>{
    assert(output,'Archive build failed');
    const frame=document.createElement('iframe');frame.style.cssText='width:900px;height:650px';document.body.append(frame);
    try{
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Offline viewer load timeout')),8000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc=output.html;});
      const doc=frame.contentDocument,win=frame.contentWindow;assert(doc.querySelectorAll('.katex').length===2,'Offline formula preview failed');assert(!win.PWNED,'Archive executed untrusted title');
      assert(doc.querySelector('pre > code.language-python')?.textContent==='# 注释保持代码\n    return "$literal$"','Exported code lost its native block or indentation');
      let copied;Object.defineProperty(win.navigator,'clipboard',{configurable:true,value:{write:async items=>{copied={html:await(await items[0].getType('text/html')).text(),text:await(await items[0].getType('text/plain')).text()};}}});
      doc.getElementById('copy-all').click();await new Promise(r=>setTimeout(r,50));assert(copied?.html.includes('$x^2$')&&copied.html.includes('$$\\frac{a}{b}$$'),'Copy did not restore native formula source');assert(!copied.html.includes('class="katex')&&!copied.html.includes('复制本条'),'Viewer markup or buttons copied');assert(copied.text.includes('第一问')&&copied.text.includes('keep_literal'),'Conversation text lost');
      assert(directCopy.html===copied.html&&directCopy.text===copied.text,'Direct conversation copy differs from offline copy-all');
      const clipHTML=new DOMParser().parseFromString(copied.html,'text/html');
      assert([...clipHTML.querySelectorAll('h1,h2,h3,h4')].map(h=>h.tagName+':'+h.textContent).slice(1).join('|')==='H2:用户 · 第 1 条|H2:ChatGPT · 第 2 条|H3:正式回复|H4:详细说明','Message headings and answer headings lost their nesting');
      assert(!clipHTML.querySelector('[data-export-message]')&&copied.text.includes('第一问\n第二行\n\n另一段'),'Offline layout or broken line breaks reached the clipboard');
      assert(copied.html.includes('data-lark-language="python"')&&copied.html.includes('# 注释保持代码'),'Offline copy dropped Python code metadata');
      copied=null;doc.querySelectorAll('[data-copy-message]')[1].click();await new Promise(r=>setTimeout(r,50));assert(copied?.text.startsWith('ChatGPT · 第 2 条\n正式回复\n详细说明')&&!copied.text.includes('第一问'),'Per-message copy lost the heading or included another message');
    }finally{frame.remove();}
  });
  await test('整段复制超过 24 MB 时提示改用离线导出',()=>{
    const archive={title:'超限测试',url:'https://chatgpt.com/c/example',createdAt:'2026-01-01T00:00:00Z',messages:[{role:'assistant',html:'<p>'+'中'.repeat(8*1024*1024)+'</p>'}]};
    let error;try{CFBArchive.buildClipboard(archive);}catch(e){error=e;}
    assert(error?.message.includes('超过 24 MB')&&error?.message.includes('导出当前会话到本地'),'Oversize clipboard did not offer the offline export fallback');
  });
  globalThis.TEST_RESULTS=results;document.getElementById('results').textContent=JSON.stringify(results,null,2);
})();
