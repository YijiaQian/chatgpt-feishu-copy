'use strict';
(async()=>{
  const results=[];
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cOZkAAAAASUVORK5CYII=';
  const media=async()=>({dataUrl:png,width:30,height:30,displayWidth:10,displayHeight:10});
  async function check(name,run){try{await run();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
  const parse=(text,options={})=>CFB.prepare(CFB.parseMarkdown(text),{media,...options});
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
  globalThis.TEST_RESULTS=results;document.getElementById('results').textContent=JSON.stringify(results,null,2);
})();
