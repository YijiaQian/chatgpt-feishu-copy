'use strict';
(async()=>{
  const results=[];
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cOZkAAAAASUVORK5CYII=';
  const media=async()=>({dataUrl:png,width:30,height:30,displayWidth:10,displayHeight:10});
  async function check(name,run){try{await run();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
  const parse=(text,options={})=>CFB.prepare(CFB.parseMarkdown(text),{media,...options});
  async function clipboardFixture(run){
    const clipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
    const execCommand=Object.getOwnPropertyDescriptor(document,'execCommand');
    try{await run();}finally{
      if(clipboard)Object.defineProperty(navigator,'clipboard',clipboard);else delete navigator.clipboard;
      if(execCommand)Object.defineProperty(document,'execCommand',execCommand);else delete document.execCommand;
    }
  }
  await check('异步剪贴板写入 HTML 和纯文本，成功后不触发备用复制',()=>clipboardFixture(async()=>{
    const result={html:'<p>公式 $x^2$</p>',text:'公式 $x^2$'};let copied,fallbacks=0;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{copied=items[0];}}});
    Object.defineProperty(document,'execCommand',{configurable:true,value:()=>{fallbacks++;return true;}});
    await CFB.writeClipboard(result);
    assert(await(await copied.getType('text/html')).text()===result.html,'HTML clipboard payload changed');
    assert(await(await copied.getType('text/plain')).text()===result.text,'Plain text clipboard payload changed');
    assert(fallbacks===0,'Successful async write triggered fallback');
  }));
  await check('异步剪贴板被拒绝时回退复制，两种格式与当前选区均保留',()=>clipboardFixture(async()=>{
    const result={html:'<pre><code>    print(1)</code></pre>',text:'    print(1)'};
    const node=document.createElement('p');node.textContent='保留当前选择';document.body.append(node);
    const selection=getSelection();selection.setBaseAndExtent(node.firstChild,1,node.firstChild,4);const selected=selection.toString();
    let copied,fallbacks=0;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{throw new DOMException('Denied','NotAllowedError');}}});
    Object.defineProperty(document,'execCommand',{configurable:true,value:command=>{
      assert(command==='copy','Unexpected legacy command');fallbacks++;
      copied=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),cancelable:true});document.dispatchEvent(copied);return copied.defaultPrevented;
    }});
    try{
      await CFB.writeClipboard(result);
      assert(fallbacks===1,'Rejected async write did not use fallback once');
      assert(copied.clipboardData.getData('text/html')===result.html&&copied.clipboardData.getData('text/plain')===result.text,'Fallback lost a clipboard format');
      assert(selection.toString()===selected,'Fallback overwrote current selection');
      const later=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),cancelable:true});document.dispatchEvent(later);
      assert(!later.defaultPrevented&&!later.clipboardData.getData('text/html'),'Copy handler leaked after success');
    }finally{selection.removeAllRanges();node.remove();}
  }));
  await check('两种剪贴板写入均失败时明确报错且移除备用事件监听',()=>clipboardFixture(async()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{throw new DOMException('Denied','NotAllowedError');}}});
    Object.defineProperty(document,'execCommand',{configurable:true,value:()=>false});
    let error;try{await CFB.writeClipboard({html:'<p>private</p>',text:'private'});}catch(e){error=e;}
    const later=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),cancelable:true});document.dispatchEvent(later);
    assert(!later.defaultPrevented&&!later.clipboardData.getData('text/plain'),'Failed fallback left a copy handler');
    assert(error?.message.includes('浏览器阻止了剪贴板写入'),'Clipboard failure did not explain how to retry');
  }));
  await check('四种公式分隔符及反斜杠不损坏',async()=>{
    const r=await parse(String.raw`\(a_b^2\) 与 $\alpha+\beta$`+'\n\n'+String.raw`\[\frac{a}{b}\]`+'\n\n$$\nx^2\n$$');
    assert(r.stats.formulas===4,JSON.stringify(r.stats));assert(r.html.includes('\\frac{a}{b}'),'LaTeX source lost');assert(!r.warnings.length,'Unexpected warnings');
  });
  await check('行内代码与代码块不转换公式',async()=>{
    const r=await parse('`$a$`\n\n~~~python\nprice="$10"\ns="$x$"\n~~~');
    assert(r.stats.formulas===0,'Code turned into formula');assert(r.html.includes('language-python'),'Code language lost');assert(r.html.includes('$x$'),'Code content lost');
  });
  await check('旧版 KaTeX annotation 只提取一次',async()=>{
    const r=await CFB.prepare('<p>公式 <span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span><span class="katex-html">duplicate</span></span></p>',{media});
    assert(r.stats.formulas===1,'Annotation not found');assert(r.html.includes('$x^2$')&&!r.html.includes('duplicate'),'Formula duplicated');
  });
  await check('新版 data-math-source 与块级公式',async()=>{
    const r=await CFB.prepare('<div data-math-source="x^2"><span class="katex-display"><span class="katex">visible</span></span></div>',{media});
    assert(r.stats.formulas===1&&r.html.includes('$$x^2$$'),'Modern source or display mode lost');
  });
  await check('表格保留为原生表格且公式不会变成源码',async()=>{
    const r=await parse('| A | B |\n|---|---|\n| 数学 | $x^2$ |');
    assert(r.html.includes('class="ace-table"'),'Table would become Sheets');assert(r.stats.tableFormulas===1,'Cell formula not rasterized');assert(r.html.includes('<img'),'Cell formula absent');assert(r.text.includes('$x^2$'),'Cell LaTeX fallback lost');
  });
  await check('原始 HTML 表格中的公式也转换',async()=>{
    const r=await parse('<table><tr><td>\\(x+1\\)</td></tr></table>');
    assert(r.stats.tableFormulas===1,'Raw table formula missed');
  });
  await check('PNG 与 SVG 均嵌入',async()=>{
    const r=await parse(`![plot](${png})\n\n<svg width="24" height="24"><path d="M0 0L20 20"/></svg>`);
    assert(r.stats.images===1&&r.stats.icons===1,'Media missing');assert((r.html.match(/<img/g)||[]).length===2,'Image count wrong');
  });
  await check('图片失败保留原图入口并明确警告',async()=>{
    const r=await parse('![important](https://example.invalid/chart.png)',{media:async()=>{throw new Error('blocked');}});
    assert(r.warnings.length===1,'Failure hidden');assert(r.html.includes('https://example.invalid/chart.png')&&r.html.includes('查看原图'),'Source link lost');
  });
  await check('脚本、事件与危险链接不能进入剪贴板',async()=>{
    const r=await parse('<script>alert(1)</script><p onclick="alert(2)">ok</p><a href="javascript:alert(3)">bad</a>');
    assert(!r.html.includes('<script')&&!r.html.includes('onclick')&&!r.html.includes('javascript:'),'Unsafe HTML retained');
  });
  await check('复制回复时删除按钮和代码工具栏',async()=>{
    const element=document.createElement('div');element.innerHTML='<p>正文</p><button>Copy</button><pre><div>Python toolbar</div><code class="language-python">print(1)</code></pre>';document.body.append(element);
    try{const clone=CFB.cloneAnswer(element),r=await CFB.prepare(clone,{media});assert(!r.html.includes('toolbar')&&!r.html.includes('Copy'),'UI leaked');assert(r.html.includes('print(1)'),'Code lost');}finally{element.remove();}
  });
  await check('生成图片在可点击按钮内仍然保留',async()=>{
    const element=document.createElement('div');element.innerHTML=`<button aria-label="打开图片"><img alt="generated" src="${png}">下载图片</button>`;document.body.append(element);
    try{const r=await CFB.prepare(CFB.cloneAnswer(element),{media});assert(r.stats.images===1,'Clickable generated image lost');assert(!r.html.includes('下载图片'),'Button text leaked');}finally{element.remove();}
  });
  await check('嵌套列表、链接、粗体和表格结构保留',async()=>{
    const r=await parse('1. **one**\n   - [link](https://www.feishu.cn)\n2. two');assert(r.html.includes('<ol')&&r.html.includes('<ul')&&r.html.includes('<strong')&&r.html.includes('href="https://www.feishu.cn"'),'Structure lost');
  });
  await check('超长文本明确拒绝',async()=>{
    let failed=false;try{CFB.parseMarkdown('x'.repeat(2_000_001));}catch{failed=true;}assert(failed,'Oversized text accepted');
  });
  await check('纯 Markdown 缺失 Chart 数据时明确提示',async()=>{
    const r=await parse('## 图表\n\nChart\n\n原始 rA / Clip 后的 rA / 最终 L = min');
    assert(r.warnings.some(w=>w.includes('没有图表数据')),'Missing chart data silently accepted');
  });
  await check('交互 SVG 曲线图截图保留颜色与曲线',async()=>{
    const root=document.createElement('div');root.style.cssText='width:320px;height:180px;position:relative;background:white';
    root.className='recharts-wrapper';root.innerHTML='<svg width="320" height="180" viewBox="0 0 320 180"><path d="M10 160L300 20" fill="none" stroke="#539af8" stroke-width="5"/><path d="M10 160L190 80L300 80" fill="none" stroke="#ef8b57" stroke-width="5"/></svg><span class="sr-only">hidden chart data</span>';
    document.body.append(root);
    try{
      const shot=await CFBCharts.capture(root),img=new Image();img.src=shot.dataUrl;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let colored=0;
      for(let i=0;i<pixels.length;i+=4)if(Math.max(...pixels.slice(i,i+3))-Math.min(...pixels.slice(i,i+3))>50)colored++;
      assert(colored>500,'Blank screenshot without colored curves');assert(shot.width>320,'No padding for axis labels');
    }finally{root.remove();}
  });
  await check('引用来源图标不作为正文图片下载 且真实插图保留',async()=>{
    const element=document.createElement('div');element.innerHTML=`<p>来源：<a href="https://example.org/paper"><span data-d-component="favicon"><img width="12" src="https://www.google.com/s2/favicons?domain=https://example.org&sz=32"></span>研究来源</a></p><img alt="actual illustration" src="${png}" width="160">`;document.body.append(element);
    try{const r=await CFB.prepare(CFB.cloneAnswer(element),{media});assert(!r.html.includes('favicons')&&!r.html.includes('查看原图'),'Citation favicon leaked');assert(r.html.includes('https://example.org/paper')&&r.html.includes('研究来源'),'Citation link lost');assert(r.stats.images===1,'Real illustration lost');}finally{element.remove();}
  });
  await check('流程卡片选择完整外层且不捕获普通提示文字',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-d-component="box" data-d-has-border id="flow" style="width:400px;height:200px"><div data-d-component="box">步骤一</div><div data-d-component="row"><svg data-d-component="icon" width="16" height="16"><path d="M0 0L16 16"/></svg></div><div data-d-component="box">步骤二</div></div><div data-d-component="box" data-d-has-border style="width:400px;height:60px"><p>普通提示段落保持文本</p></div>';document.body.append(root);
    try{const roots=CFBCharts.diagramRoots(root);assert(roots.length===1&&roots[0].id==='flow','Wrong diagram boundary');const clone=CFB.cloneAnswer(root,{snapshots:new Map([[roots[0],{dataUrl:png,width:400,height:200,alt:'完整流程图'}]])});assert(clone.querySelectorAll('img').length===1&&!clone.querySelector('svg'),'Flow was split into icons');assert(clone.textContent.includes('普通提示段落保持文本'),'Unrelated text lost');}finally{root.remove();}
  });
  await check('无箭头数字卡片整组捕获且保留卡片内真实图片',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-d-component="grid" style="display:grid;grid-template-columns:1fr 1fr;width:400px;height:140px"><div data-d-component="grid-item"><div data-d-component="box"><p>正样本概率 P</p><h1>0.90</h1><p>Loss ≈ 0.105</p><img src="https://example.org/card.png" width="20" height="20"></div></div><div data-d-component="grid-item"><div data-d-component="box"><p>正样本概率 P</p><h1>0.10</h1><p>Loss ≈ 2.303</p></div></div></div>';document.body.append(root);
    try{const roots=CFBCharts.diagramRoots(root);assert(roots.length===1,'Number cards not recognized');let markup='';const result=await CFBCharts.snapshot(root,{media:async payload=>{if(payload.diagram){markup=payload.src;return {dataUrl:png,displayWidth:400,displayHeight:140};}assert(payload.src==='https://example.org/card.png','Wrong card image');return {dataUrl:png};}});assert(result.snapshots.size===1&&!result.warnings.length,'Card snapshot failed');assert(markup.includes('0.90')&&markup.includes('0.10')&&markup.includes('grid-template-columns'),'Card content or layout lost');assert(markup.includes(png)&&!markup.includes('example.org/card.png'),'Card illustration lost or remote request leaked');}finally{root.remove();}
  });
  await check('弹出式引用没有可读链接时保留来源标签',async()=>{
    const root=document.createElement('div');root.innerHTML='<p>正文<span role="button" data-d-component="popover-trigger"><span data-d-component="favicon"><img src="https://www.google.com/s2/favicons?domain=https://example.org&sz=32"></span>研究来源</span></p>';document.body.append(root);
    try{const result=await CFB.prepare(CFB.cloneAnswer(root),{media});assert(result.html.includes('来源：研究来源'),'Source label lost');assert(!result.html.includes('favicons')&&result.stats.images===0,'Source icon treated as illustration');}finally{root.remove();}
  });
  await check('没有 ChatGPT 专用标记时按 Grid 和卡片样式识别',async()=>{
    const root=document.createElement('div');root.innerHTML='<section id="styled-cards" style="display:grid;grid-template-columns:1fr 1fr;width:400px;gap:12px"><div style="background:#eee;border-radius:8px;height:90px">指标一 0.90</div><div style="border:1px solid #ccc;height:90px">指标二 0.10</div></section><div style="display:flex;width:400px;height:90px"><p>普通段落一</p><p>普通段落二</p></div><table style="display:grid;width:400px"><tr><td>原生表格</td></tr></table>';document.body.append(root);
    try{const roots=CFBCharts.diagramRoots(root);assert(roots.length===1&&roots[0].id==='styled-cards','Generic layout detection captured ordinary text or missed visual cards');}finally{root.remove();}
  });
  await check('卡片现代颜色转换为截图引擎兼容的 RGB',async()=>{
    const node=document.createElement('div');node.style.cssText='width:300px;height:80px;background:oklab(90% 0 0);border:1px solid oklch(50% 0.1 160);color:color(srgb 0.2 0.3 0.4)';node.textContent='现代颜色卡片';document.body.append(node);
    try{const markup=CFBCharts.diagramHTML(node);assert(!/oklab|oklch|color\(srgb/i.test(markup),'Unsupported CSS color leaked to screenshot engine');const copy=document.createElement('div');copy.innerHTML=markup;assert(/rgba?\(/.test(copy.firstElementChild.style.backgroundColor),'RGB background missing');}finally{node.remove();}
  });
  await check('新版无 pre 的 ChatGPT 代码块保留语言、注释和精确缩进',async()=>{
    const source='# 仅作简化示意\nwhile not finished:\n    response = llm(messages)\n\n    # $literal$ 不转公式\n    return "<done>"\n';
    const root=document.createElement('div');root.innerHTML='<p>代码之前</p><div data-code-block="true" data-markdown-copy="code-block"><div data-markdown-copy="exclude"><span>Python</span><button>复制代码</button><button>运行</button></div><div data-code-block-source="true"><code></code></div></div><p>代码之后</p>';root.querySelector('code').textContent=source;document.body.append(root);
    try{const result=await CFB.prepare(CFB.cloneAnswer(root),{media}),parsed=document.createElement('div');parsed.innerHTML=result.html;const code=parsed.querySelector('pre > code');assert(code?.textContent===source,'Code indentation, blank lines or source changed');assert(code.className==='language-python'&&code.dataset.larkLanguage==='python','Python metadata missing');assert(result.stats.formulas===0&&!parsed.querySelector('h1'),'Code comment or dollar literal interpreted as prose');assert(!result.html.includes('复制代码')&&!result.html.includes('运行'),'Code toolbar leaked');assert(parsed.textContent.includes('代码之前')&&parsed.textContent.includes('代码之后'),'Surrounding prose lost');}finally{root.remove();}
  });
  await check('直接 HTML、旧版 pre 和未知语言仍输出标准代码块',async()=>{
    const result=await CFB.prepare('<pre class="language-js"><code>const x = "$x$";\n  // 中文\n</code></pre><div data-code-block="true"><div data-code-block-source="true"><code>第一行<br>    第二行</code></div></div>',{media});const root=document.createElement('div');root.innerHTML=result.html;const blocks=root.querySelectorAll('pre > code');assert(blocks.length===2,'Code blocks missing');assert(blocks[0].dataset.larkLanguage==='javascript','Language alias not normalized');assert(blocks[1].dataset.larkLanguage==='plaintext'&&blocks[1].textContent==='第一行\n    第二行','Plaintext code or br newline lost');assert(result.stats.formulas===0,'Raw code interpreted as formula');
  });
  await check('代码容器不会被通用卡片或图表截图规则捕获',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-code-block="true" style="display:grid;width:400px;grid-template-columns:1fr 1fr"><div style="border:1px solid gray;height:80px">Python</div><div style="border:1px solid gray;height:80px"><svg width="160" height="80"><path d="M0 0L160 80"/></svg></div><div data-code-block-source="true"><code>print(1)</code></div></div>';document.body.append(root);
    try{assert(CFBCharts.diagramRoots(root).length===0&&CFBCharts.chartRoots(root).length===0,'Code block rasterized as a chart');}finally{root.remove();}
  });
  await check('整条 Flex 回复中的标题、公式、表格和结尾不会随卡片截图',async()=>{
    const root=document.createElement('div');root.setAttribute('data-chatgpt-selection-message-id','regression');root.innerHTML='<div data-markdown-text-style="assistant-message"><div style="display:flex;flex-direction:column;width:600px"><h2>指标定义</h2><p>独立正文必须可编辑</p><div data-math-source="\\frac{3}{5}" data-display="true">公式占位</div><table><tr><td>原生表格</td></tr></table><div id="metric-cards" data-d-component="grid" style="display:grid;grid-template-columns:1fr 1fr;width:400px;height:90px"><div data-d-component="grid-item"><div data-d-component="box" style="background:#eee;border-radius:8px;height:90px">指标一 60%</div></div><div data-d-component="grid-item"><div data-d-component="box" style="background:#eee;border-radius:8px;height:90px">指标二 30%</div></div></div><blockquote>独立结尾必须可编辑</blockquote></div></div>';document.body.append(root);
    try{const roots=CFBCharts.diagramRoots(root);assert(roots.length===1&&roots[0].id==='metric-cards','Whole reply captured instead of tight card group');const result=await CFBCharts.snapshot(root,{media});const converted=await CFB.prepare(CFB.cloneAnswer(root,{snapshots:result.snapshots}),{media});const copy=document.createElement('div');copy.innerHTML=converted.html;assert(copy.querySelector('h2')?.textContent==='指标定义'&&copy.querySelector('blockquote')?.textContent.includes('独立结尾'),'Native headings or prose lost');assert(copy.querySelector('table')&&copy.querySelectorAll('img').length===1,'Table rasterized or cards split');assert(converted.stats.formulas===1&&converted.html.includes('\\frac{3}{5}'),'Native formula lost into screenshot');}finally{root.remove();}
  });
  await check('没有代码块的正文加流程图也仅截取流程区域',async()=>{
    const root=document.createElement('div');root.style.cssText='display:flex;flex-direction:column;width:600px';root.innerHTML='<h2>流程之前</h2><p>正文</p><div id="tight-flow" data-d-component="box" data-d-has-border style="width:400px;height:180px"><div data-d-component="box">输入</div><div data-d-component="row"><svg data-d-component="icon" width="16" height="16"></svg></div><div data-d-component="box">输出</div></div><p>流程之后</p>';document.body.append(root);
    try{const roots=CFBCharts.diagramRoots(root);assert(roots.length===1&&roots[0].id==='tight-flow','Flex prose wrapper mistaken for semantic flow');}finally{root.remove();}
  });
  await check('卡片内 KaTeX 分式只渲染一次且不依赖源页面定位样式',async()=>{
    const root=document.createElement('div');root.innerHTML='<div data-d-component="grid" style="display:grid;grid-template-columns:1fr 1fr;width:400px;height:100px"><div data-d-component="grid-item"><div data-d-component="box"><span data-math-source="\\frac{3}{5}"><span class="katex"><span class="katex-mathml">不可见 MathML</span><span class="katex-html">重叠分式</span></span></span></div></div><div data-d-component="grid-item"><div data-d-component="box">另一个指标</div></div></div>';document.body.append(root);
    try{let formulaCalls=0;const result=await CFBCharts.snapshot(root,{media:async payload=>{if(payload.formula){formulaCalls++;assert(payload.src==='\\frac{3}{5}','Formula source wrong');return {dataUrl:png,displayWidth:20,displayHeight:35};}assert(payload.diagram,'Wrong media mode');assert(!payload.src.includes('不可见 MathML')&&!payload.src.includes('重叠分式')&&!payload.src.includes('<math'),'Duplicate or unpositioned formula leaked');assert(payload.src.includes(png),'Rendered formula missing');return {dataUrl:png,displayWidth:400,displayHeight:100};}});assert(formulaCalls===1&&result.snapshots.size===1&&!result.warnings.length,'Formula screenshot failed');}finally{root.remove();}
  });
  globalThis.TEST_RESULTS=results;document.getElementById('results').textContent=JSON.stringify(results,null,2);
})();
