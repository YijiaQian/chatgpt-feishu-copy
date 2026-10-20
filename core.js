/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const LIMIT = 24 * 1024 * 1024;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uiSelector = 'button,[role=button],[data-cfb-ui],script,style,iframe,form,textarea,input,nav';
  const formulaSelector = '[data-cfb-math],.katex-display,[data-math-source],[data-latex],.katex,mjx-container,math';
  const blockTags = new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','PRE','BLOCKQUOTE','UL','OL','LI','TABLE','TR','HR']);
  const codeBlockSelector='pre,[data-code-block],[data-code-block-source],[data-markdown-copy="code-block"],[data-d-component="code-block"]';
  function codeLanguage(block){
    const code=block.querySelector('code');
    const nodes=[code,block,block.querySelector('[data-language],[data-lark-language]')].filter(Boolean);
    let value='';
    for(const node of nodes){value=node.getAttribute('data-lark-language')||node.getAttribute('data-language')||node.getAttribute('lang')||node.className?.match?.(/\blanguage-([\w+#.-]+)/)?.[1]||'';if(value)break;}
    if(!value){
      const header=block.querySelector('[data-markdown-copy="exclude"],[data-code-block-controls]')?.cloneNode(true);
      header?.querySelectorAll('button,[role="button"],svg,.sr-only').forEach(node=>node.remove());
      value=header?.textContent.trim()||'';
    }
    value=value.toLowerCase().trim().replace(/^language-/, '');
    const aliases={py:'python',python3:'python',js:'javascript',ts:'typescript',sh:'bash',shell:'bash',zsh:'bash',md:'markdown',yml:'yaml',csharp:'c#',cpp:'c++','纯文本':'plaintext','文本':'plaintext',text:'plaintext','plain text':'plaintext'};
    value=aliases[value]||value;
    return /^[\w+#.-]{1,32}$/.test(value)?value:'plaintext';
  }
  function codeText(block){
    const body=block.querySelector('[data-code-block-source] code')||block.querySelector('pre code')||block.querySelector('code')||block.querySelector('.cm-content')||block.querySelector('[data-code-block-source]')||block;
    const lines=[...body.querySelectorAll('.cm-line')];
    if(lines.length)return lines.map(line=>line.textContent).join('\n');
    const copy=body.cloneNode(true);copy.querySelectorAll('br').forEach(br=>br.replaceWith(document.createTextNode('\n')));
    return copy.textContent.replace(/\r\n?/g,'\n');
  }
  function codeBlock(text,language='plaintext'){
    const pre=document.createElement('pre'),code=document.createElement('code');
    code.className='language-'+language;code.setAttribute('data-lark-language',language);code.textContent=text;pre.append(code);return pre;
  }
  function normalizeCodeBlocks(root){
    const blocks=[...root.querySelectorAll(codeBlockSelector)].filter(node=>!node.parentElement?.closest(codeBlockSelector));
    for(const block of blocks){if(block.hasAttribute('data-cfb-remove'))block.remove();else block.replaceWith(codeBlock(codeText(block),codeLanguage(block)));}
  }
  function mathHTML(tex, display) {
    return `<span data-cfb-math="true" data-tex="${esc(tex)}" data-display="${display}">${esc(display ? `$$${tex}$$` : `$${tex}$`)}</span>`;
  }
  const md = markdownit({html:true,linkify:true,breaks:false,typographer:false});
  function readMath(src,start){
    if(start>0&&src[start-1]==='\\')return null;
    let open, close, display = false;
    if (src.startsWith('\\(',start)) {open='\\(';close='\\)';}
    else if(src.startsWith('\\[',start)) {open='\\[';close='\\]';display=true;}
    else if(src.startsWith('$$',start)) {open=close='$$';display=true;}
    else if(src[start]==='$' && !/\s/.test(src[start+1]||' ')) {open=close='$';}
    else return null;
    let end = start + open.length;
    for (;;) {
      end = src.indexOf(close,end);
      if(end<0) return null;
      let slashes=0;for(let i=end-1;i>=0 && src[i]==='\\';i--)slashes++;
      if(slashes%2===0 && (close!=='$' || (!/\s/.test(src[end-1]||' ') && !/\d/.test(src[end+1]||'')))) break;
      end+=close.length;
    }
    const tex=src.slice(start+open.length,end);
    if(!tex.trim() || (close==='$' && tex.includes('\n')))return null;
    return {tex,display,end:end+close.length};
  }
  md.inline.ruler.before('escape','cfb_math', (state, silent) => {
    const found=readMath(state.src,state.pos);if(!found)return false;
    const {tex,display,end}=found;
    if(!silent){const token=state.push('cfb_math','',0);token.content=tex;token.meta={display};}
    state.pos=end;return true;
  });
  md.renderer.rules.cfb_math=(tokens,i)=>mathHTML(tokens[i].content,tokens[i].meta.display);
  md.block.ruler.before('fence','cfb_math_block',(state,line,endLine,silent)=>{
    const start=state.bMarks[line]+state.tShift[line];
    const first=state.src.slice(start,state.eMarks[line]).trim();
    const open=first.startsWith('$$')?'$$':first.startsWith('\\[')?'\\[':null;
    if(!open)return false;
    const close=open==='$$'?'$$':'\\]';
    const parts=[];let next=line,tail=first.slice(open.length),found=false;
    for(;;){
      const pos=tail.indexOf(close);
      if(pos>=0){if(tail.slice(pos+close.length).trim())return false;parts.push(tail.slice(0,pos));found=true;break;}
      parts.push(tail);next++;if(next>=endLine)break;
      tail=state.src.slice(state.bMarks[next]+state.tShift[next],state.eMarks[next]);
    }
    if(!found)return false;if(silent)return true;
    const token=state.push('cfb_math_block','',0);token.content=parts.join('\n').trim();token.block=true;token.map=[line,next+1];
    state.line=next+1;return true;
  },{alt:['paragraph','reference','blockquote','list']});
  md.renderer.rules.cfb_math_block=(tokens,i)=>`<p>${mathHTML(tokens[i].content,true)}</p>\n`;

  function cleanHTML(html) {
    return DOMPurify.sanitize(html,{
      USE_PROFILES:{html:true,svg:true,svgFilters:false,mathMl:true},
      ADD_TAGS:['annotation','semantics'],
      ADD_ATTR:['encoding','data-cfb-math','data-tex','data-display','data-cfb-src','data-cfb-width','data-cfb-height','data-cfb-canvas'],
      FORBID_TAGS:['script','style','iframe','object','embed','form','input','textarea','video','audio','foreignObject'],
      FORBID_ATTR:['srcdoc'],ALLOW_UNKNOWN_PROTOCOLS:false
    });
  }
  function parseMarkdown(source) {
    if(source.length>2_000_000)throw new Error('文本超过 200 万字符，请分段复制。');
    const root=document.createElement('div');root.innerHTML=cleanHTML(md.render(source));return root;
  }
  function texFrom(node) {
    for(const attr of ['data-tex','data-math-source','data-latex','data-tex-source']) {
      const value=node.getAttribute(attr);if(value?.trim())return stripDelimiters(value.trim());
    }
    const annotation=node.querySelector('annotation[encoding="application/x-tex"],annotation[encoding="application/tex"],annotation[encoding="TeX"]');
    if(annotation?.textContent.trim())return stripDelimiters(annotation.textContent.trim());
    return '';
  }
  function stripDelimiters(tex){
    for(const [a,b] of [['$$','$$'],['\\[','\\]'],['\\(','\\)'],['$','$']])
      if(tex.startsWith(a)&&tex.endsWith(b))return tex.slice(a.length,-b.length).trim();
    return tex;
  }
  function isDisplay(node){return node.getAttribute('data-display')==='true'||node.matches('.katex-display,[display="block"],[display="true"]')||node.classList.contains('math-display')||Boolean(node.querySelector('.katex-display,math[display="block"]'));}

  function cloneAnswer(source,{snapshots=new Map()}={}) {
    const clone=source.cloneNode(true);
    const srcNodes=[source,...source.querySelectorAll('*')], dstNodes=[clone,...clone.querySelectorAll('*')];
    srcNodes.forEach((node,i)=>{
      const copy=dstNodes[i];
      if(snapshots.has(node)){
        const shot=snapshots.get(node),img=document.createElement('img');img.src=shot.dataUrl;img.alt=shot.alt||'交互曲线图';
        img.setAttribute('data-cfb-width',String(shot.width));img.setAttribute('data-cfb-height',String(shot.height));
        img.setAttribute('data-cfb-chart-image','true');
        if(node===source){clone.replaceChildren(img);}else copy.replaceWith(img);
        return;
      }
      if(node.matches('img')){
        copy.setAttribute('data-cfb-src',node.currentSrc||node.getAttribute('src')||node.getAttribute('data-src')||'');
        const rect=node.getBoundingClientRect();
        copy.setAttribute('data-cfb-width',String(Math.round(rect.width)||node.naturalWidth||0));
        copy.setAttribute('data-cfb-height',String(Math.round(rect.height)||node.naturalHeight||0));
      }
      if(node.matches('canvas')){
        try{copy.setAttribute('data-cfb-canvas',node.toDataURL('image/png'));}catch{copy.setAttribute('data-cfb-canvas','unavailable');}
      }
      if(node.closest('svg')){
        const style=getComputedStyle(node);
        for(const attr of ['fill','stroke','color'])if(style[attr])copy.style[attr]=style[attr];
        if(node.tagName.toLowerCase()==='use'){
          const ref=node.getAttribute('href')||node.getAttribute('xlink:href');
          if(ref?.startsWith('#')){
            const target=document.getElementById(ref.slice(1));
            if(target){const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.innerHTML=target.innerHTML;copy.replaceWith(group);}
          }
        }
      }
      if(node.matches('svg')){
        const rect=node.getBoundingClientRect();
        copy.setAttribute('data-cfb-width',String(Math.round(rect.width)||32));
        copy.setAttribute('data-cfb-height',String(Math.round(rect.height)||32));
      }
      if(getComputedStyle(node).display==='none'&&!node.closest(formulaSelector))copy.setAttribute('data-cfb-remove','true');
    });
    // Modern ChatGPT renders a block as a div + code, without a pre. Rebuild
    // semantic blocks before removing the toolbar that contains the language.
    normalizeCodeBlocks(clone);
    // Source-chip favicons are decoration, not document illustrations. Keep the
    // surrounding citation/link text without downloading their tracking URLs.
    clone.querySelectorAll('[data-d-component="popover-trigger"][role="button"]').forEach(node=>{
      if(!node.querySelector('[data-d-component="favicon"]'))return;
      const links=[...node.querySelectorAll('a[href]')];
      const label=document.createElement('span');label.textContent=links.length?'':`〔来源：${node.textContent.trim()}〕`;
      node.replaceWith(label,...links);
    });
    clone.querySelectorAll('[data-d-component="favicon"]').forEach(node=>node.remove());
    clone.querySelectorAll('img').forEach(img=>{
      const src=img.getAttribute('data-cfb-src')||img.getAttribute('src')||'';
      const width=Number(img.getAttribute('data-cfb-width')||img.getAttribute('width'));
      if(/^https:\/\/(?:www\.)?google\.com\/s2\/favicons\?/i.test(src)&&width>0&&width<=32)img.remove();
    });
    // Generated image cards can be wrapped in a clickable button. Preserve the
    // image while discarding the interactive wrapper and its control text.
    clone.querySelectorAll('button,[role=button]').forEach(n=>{
      const images=[...n.querySelectorAll('img,canvas')];
      if(images.length)n.replaceWith(...images);
    });
    clone.querySelectorAll(`${uiSelector},[data-cfb-remove],.sr-only,[data-markdown-copy="exclude"]`).forEach(n=>n.remove());
    for(const pre of clone.querySelectorAll('pre')){const code=pre.querySelector('code');if(code)pre.replaceChildren(code);}
    return clone;
  }
  function toText(root) {
    function walk(node){
      if(node.nodeType===3)return node.nodeValue;
      if(node.nodeType!==1)return '';
      if(node.tagName==='IMG')return node.alt?(node.alt.startsWith('$')?node.alt:`[图片：${node.alt}]`):'';
      if(node.tagName==='BR')return '\n';
      const children=[...node.childNodes].map(walk).join('');
      if(node.tagName==='TD'||node.tagName==='TH')return children+'\t';
      if(node.tagName==='LI')return '- '+children+'\n';
      return blockTags.has(node.tagName)?children+'\n':children;
    }
    return walk(root).replace(/\n{3,}/g,'\n\n').trim();
  }
  function decorate(root){
    const styles={P:'margin:0 0 10px;line-height:1.7',H1:'font-size:28px;font-weight:700;margin:20px 0 12px',H2:'font-size:24px;font-weight:700;margin:18px 0 10px',H3:'font-size:20px;font-weight:700;margin:16px 0 8px',H4:'font-size:18px;font-weight:700',PRE:'white-space:pre-wrap;background:#f5f6f7;padding:12px;font-family:Consolas,monospace',CODE:'font-family:Consolas,monospace',TABLE:'border-collapse:collapse;margin:12px 0',TH:'border:1px solid #c9cdd4;padding:8px;background:#f5f6f7;font-weight:700',TD:'border:1px solid #c9cdd4;padding:8px',BLOCKQUOTE:'border-left:3px solid #3370ff;margin:12px 0;padding-left:12px;color:#4e5969',UL:'padding-left:24px',OL:'padding-left:24px',A:'color:#1456f0;text-decoration:underline'};
    for(const node of root.querySelectorAll('*')){
      const tag=node.tagName;
      if(tag==='IMG')continue;
      const language=tag==='CODE'&&node.closest('pre')?(node.className.match(/\blanguage-([\w+#.-]+)/)?.[1]||node.getAttribute('data-lark-language')):null;
      const align=node.getAttribute('align');
      node.removeAttribute('style');
      if(styles[tag])node.style.cssText=styles[tag];
      if(['left','center','right'].includes(align))node.style.textAlign=align;
      for(const attr of [...node.attributes])if(!['href','src','alt','title','width','height','colspan','rowspan','start','style','checked','type'].includes(attr.name))node.removeAttribute(attr.name);
      // Feishu's HTML importer uses ace-table to distinguish native document tables
      // from embedded Sheets. Cell formulas are handled as images below.
      if(tag==='TABLE')node.className='ace-table';
      if(language){node.className='language-'+language;node.setAttribute('data-language',language);node.setAttribute('data-lark-language',language);}
      if(tag==='A'&&!/^(https?:|mailto:)/i.test(node.getAttribute('href')||''))node.removeAttribute('href');
    }
  }
  async function prepare(input,{media,embedImages=true}={}){
    const root=document.createElement('div');root.innerHTML=cleanHTML(input.outerHTML||input);
    normalizeCodeBlocks(root);
    const warnings=[],stats={formulas:0,images:0,icons:0,tableFormulas:0};
    if(/(?:^|\n)\s*Chart\s*(?:\n|$)/.test(root.innerText||root.textContent)&&!root.querySelector('svg,canvas,img'))warnings.push('文本里只有 Chart 占位符，没有图表数据。Markdown 无法还原原图；请从原始网页复制，或插入图表图片。');
    // Text-only equations also occur in raw HTML tables and unrendered answers.
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode())if(!walker.currentNode.parentElement.closest('pre,code,'+formulaSelector))texts.push(walker.currentNode);
    for(const text of texts){
      const src=text.nodeValue,fragment=document.createDocumentFragment();let last=0,changed=false;
      for(let pos=0;pos<src.length;pos++){
        if(src[pos]!=='$'&&src[pos]!=='\\')continue;
        const found=readMath(src,pos);if(!found)continue;
        fragment.append(document.createTextNode(src.slice(last,pos)));
        const span=document.createElement('span');span.setAttribute('data-cfb-math','true');span.dataset.tex=found.tex;span.dataset.display=String(found.display);fragment.append(span);
        last=found.end;pos=found.end-1;changed=true;
      }
      if(changed){fragment.append(document.createTextNode(src.slice(last)));text.replaceWith(fragment);}
    }
    // Process outer formula wrappers once, before stripping hidden KaTeX duplicates.
    const formulas=[...root.querySelectorAll(formulaSelector)].filter(n=>!n.parentElement?.closest(formulaSelector)&&!n.closest('pre,code'));
    for(const node of formulas){
      const tex=texFrom(node);
      if(!tex){warnings.push('有公式无法提取 LaTeX 源码，已保留可见内容。');continue;}
      stats.formulas++;
      const display=isDisplay(node);
      if(tex.length>16000)warnings.push('存在超过 16000 字符的公式，目标文档可能无法渲染，请拆分。');
      if(node.closest('td,th')){
        // Feishu's post-paste Markdown conversion skips table cells. Rasterize
        // cell formulas locally rather than leaving raw $...$ in the document.
        try{
          if(tex.length>16000)throw new Error('单个表格公式过长，请拆分');
          const result=await media({src:tex,formula:true,display});
          const img=document.createElement('img');img.src=result.dataUrl;img.alt=(display?'$$':'$')+tex+(display?'$$':'$');img.title='LaTeX: '+tex;
          img.width=result.displayWidth||Math.ceil(result.width/3);img.height=result.displayHeight||Math.ceil(result.height/3);
          img.setAttribute('data-lark-image-width',String(img.width));img.setAttribute('data-lark-image-height',String(img.height));
          img.setAttribute('data-cfb-formula-image','true');node.replaceWith(img);stats.tableFormulas++;continue;
        }catch(error){warnings.push('表格公式转换失败，已保留源码：'+error.message);}
      }
      const value=document.createTextNode(display?`$$${tex}$$`:`$${tex}$`);
      node.replaceWith(value);
    }
    root.querySelectorAll(uiSelector).forEach(n=>n.remove());
    root.querySelectorAll('canvas').forEach(node=>{
      const src=node.getAttribute('data-cfb-canvas');
      if(src&&src!=='unavailable'){const img=document.createElement('img');img.src=src;img.alt='画布图';node.replaceWith(img);}
      else {node.replaceWith(document.createTextNode('[画布无法读取，请下载原图后插入]'));warnings.push('有画布受跨域限制，无法读取。');}
    });
    let total=[...root.querySelectorAll('[data-cfb-formula-image]')].reduce((sum,n)=>sum+n.src.length,0);
    const jobs=[...root.querySelectorAll('img,svg')].filter(n=>!n.parentElement?.closest('svg')&&!n.hasAttribute('data-cfb-formula-image'));
    // Bounded sequential media work avoids clipboard message and image decode spikes.
    for(const node of jobs){
      const svg=node.tagName.toLowerCase()==='svg';
      let src=svg?new XMLSerializer().serializeToString(node):(node.getAttribute('data-cfb-src')||node.getAttribute('src')||'');
      let width=Number(node.getAttribute('data-cfb-width')||node.getAttribute('width'))||0;
      let height=Number(node.getAttribute('data-cfb-height')||node.getAttribute('height'))||0;
      const alt=node.getAttribute('alt')||node.getAttribute('aria-label')||(svg?'SVG 图标':'图片');
      if(svg){
        node.setAttribute('xmlns','http://www.w3.org/2000/svg');
        node.setAttribute('width',String(width||32));node.setAttribute('height',String(height||32));
        src=new XMLSerializer().serializeToString(node);
      }
      if(!embedImages&&!svg){
        if(/^https:\/\//i.test(src)){node.src=src;warnings.push('图片使用原始链接，飞书可能无法访问需要登录或已过期的图片。');}
        else {node.replaceWith(document.createTextNode(`[${alt}：未嵌入]`));warnings.push('关闭嵌入后，本地或临时图片无法随文本携带。');}
        continue;
      }
      try{
        if(!media)throw new Error('图片转换服务不可用');
        const result=await media({src,svg,width,height});
        if(!/^data:image\/png;base64,/.test(result.dataUrl||''))throw new Error('图片转换未返回 PNG');
        total+=result.dataUrl.length;
        if(total>LIMIT)throw new Error('嵌入图片总量超过 24 MB，请分段复制');
        const img=document.createElement('img');img.src=result.dataUrl;img.alt=alt;
        const naturalWidth=result.width,naturalHeight=result.height;
        width=width||naturalWidth;height=height||naturalHeight;
        if(!width||!height||Math.abs(width/height-naturalWidth/naturalHeight)>0.1)height=width*naturalHeight/naturalWidth;
        const scale=Math.min(1,720/width);img.width=Math.max(1,Math.round(width*scale));img.height=Math.max(1,Math.round(height*scale));
        img.setAttribute('data-lark-image-width',String(img.width));img.setAttribute('data-lark-image-height',String(img.height));
        img.style.cssText='max-width:100%;vertical-align:middle';
        node.replaceWith(img);svg?stats.icons++:stats.images++;
      }catch(error){
        warnings.push(`${alt}：${error.message}`);
        const span=document.createElement('span');span.textContent=`[${alt}：未能嵌入]`;
        if(!svg&&/^https:\/\//i.test(src)){const a=document.createElement('a');a.href=src;a.textContent=`[${alt}：查看原图]`;node.replaceWith(a);}
        else node.replaceWith(span);
      }
    }
    root.querySelectorAll('[data-cfb-formula-image]').forEach(n=>n.removeAttribute('data-cfb-formula-image'));
    decorate(root);
    const html='<meta charset="utf-8"><div style="font-family:Arial,\'Microsoft YaHei\',sans-serif;font-size:14px;color:#1f2329">'+root.innerHTML+'</div>';
    return {html,text:toText(root),warnings:[...new Set(warnings)],stats};
  }
  async function writeClipboard(result){
    if(navigator.clipboard?.write&&globalThis.ClipboardItem){
      await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([result.html],{type:'text/html'}),'text/plain':new Blob([result.text],{type:'text/plain'})})]);
      return;
    }
    // Legacy fallback still writes both formats and never overwrites the selection.
    const handler=e=>{e.preventDefault();e.clipboardData.setData('text/html',result.html);e.clipboardData.setData('text/plain',result.text);};
    document.addEventListener('copy',handler,{capture:true,once:true});
    try{if(!document.execCommand('copy'))throw new Error('浏览器阻止了剪贴板写入，请保持页面在前台再试。');}
    finally{document.removeEventListener('copy',handler,true);}
  }
  globalThis.CFB=Object.freeze({parseMarkdown,prepare,cloneAnswer,writeClipboard,cleanHTML,toText,texFrom,esc,formulaSelector,readMath,codeBlockSelector,codeLanguage,codeText,codeBlock});
})();
