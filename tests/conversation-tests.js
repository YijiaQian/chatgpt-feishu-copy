/* SPDX-License-Identifier: MIT */
(async()=>{
  const results=[],assert=(condition,message)=>{if(!condition)throw new Error(message);};
  async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
  function fixture(count=12){
    const root=document.createElement('main');root.style.cssText='height:220px;width:600px;overflow-y:auto;position:relative';
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
  await test('图片生成回复和正文外的图片一起纳入消息',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-turn-key="images"><div data-chatgpt-search-unit-key="images:0:user"><div data-user-message-bubble>请看图片</div><img alt="用户图片" src="data:image/png;base64,AA=="></div><div data-chatgpt-selection-message-id="image-response"><div data-markdown-text-style="assistant-message">生成结果</div><button><img alt="生成图片" src="data:image/png;base64,AA=="></button></div></div><div data-turn-key="only-image"><div data-chatgpt-selection-message-id="image-only"><button><img alt="仅图片回复" src="data:image/png;base64,AA=="></button></div></div>';document.body.append(root);
    try{const found=CFBConversation.messages(root);assert(found.length===3,'Image-only answer omitted or messages duplicated');assert(found[0].role==='user'&&found[0].node.querySelector('img'),'User image omitted');assert(found[1].node.querySelectorAll('img').length===1&&found[2].node.querySelector('img'),'Generated images outside Markdown omitted');}finally{root.remove();}
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
  let assets,output;
  await test('离线 HTML 打包字体与脚本，转义标题并保存原生公式',async()=>{
    const text=path=>fetch('../'+path).then(r=>r.text());
    const [viewerScript,katexScript,css]=await Promise.all([text('archive-viewer.js'),text('vendor/katex.min.js'),text('vendor/katex.min.css')]);
    let katexCSS=css;
    for(const path of [...new Set([...css.matchAll(/url\((fonts\/[^)]+)\)/g)].map(m=>m[1]))]){
      const buffer=new Uint8Array(await(await fetch('../vendor/'+path)).arrayBuffer());let raw='';for(const byte of buffer)raw+=String.fromCharCode(byte);katexCSS=katexCSS.replaceAll('url('+path+')','url(data:font/woff2;base64,'+btoa(raw)+')');
    }
    assets={viewerScript,katexScript,katexCSS};assert((katexCSS.match(/@font-face/g)||[]).length===20,'Bundled font faces missing');assert(!katexCSS.includes('url(fonts/'),'Offline CSS needs external font files');
    const prepared=await CFB.prepare(CFB.parseMarkdown('行内 $x^2$。\n\n$$\\frac{a}{b}$$\n\n```text\n$keep_literal$\n```'));
    const code=await CFB.prepare('<div data-code-block="true"><div data-markdown-copy="exclude">Python<button>运行</button></div><div data-code-block-source="true"><code># 注释保持代码\n    return "$literal$"</code></div></div>');prepared.html+=code.html;
    output=CFBArchive.build({title:'测试 </title><script>window.PWNED=1</script>',url:'https://chatgpt.com/c/example',createdAt:new Date().toISOString(),messages:[{role:'user',html:'<p>第一问</p>',stats:{},warnings:[]},{role:'assistant',...prepared}]},assets);
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
      assert(copied.html.includes('data-lark-language="python"')&&copied.html.includes('# 注释保持代码'),'Offline copy dropped Python code metadata');
      copied=null;doc.querySelectorAll('[data-copy-message]')[1].click();await new Promise(r=>setTimeout(r,50));assert(copied&&!copied.text.includes('第一问'),'Per-message copy included another message');
    }finally{frame.remove();}
  });
  globalThis.TEST_RESULTS=results;document.getElementById('results').textContent=JSON.stringify(results,null,2);
})();
