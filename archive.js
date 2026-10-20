/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  function previewHTML(html){
    const root=document.createElement('div');root.innerHTML=CFB.cleanHTML(html);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode())if(!walker.currentNode.parentElement.closest('pre,code'))texts.push(walker.currentNode);
    for(const node of texts){
      const source=node.nodeValue,fragment=document.createDocumentFragment();let last=0,changed=false;
      for(let i=0;i<source.length;i++){
        if(source[i]!=='$'&&source[i]!=='\\')continue;
        const math=CFB.readMath(source,i);if(!math)continue;
        fragment.append(document.createTextNode(source.slice(last,i)));
        const span=document.createElement('span');span.dataset.exportTex=math.tex;span.dataset.exportDisplay=String(math.display);span.dataset.exportDelimiters=source.slice(i,math.end);span.textContent=span.dataset.exportDelimiters;
        fragment.append(span);last=math.end;i=last-1;changed=true;
      }
      if(changed){fragment.append(document.createTextNode(source.slice(last)));node.replaceWith(fragment);}
    }
    return root.innerHTML;
  }
  const scriptText=source=>source.replace(/<\/script/gi,'<\\/script');
  function filename(title,date=new Date()){
    const safe=title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,90)||'ChatGPT 会话';
    return 'ChatGPT-'+safe+'-'+date.toISOString().slice(0,10)+'.html';
  }
  function build(archive,assets){
    if(!assets?.viewerScript||!assets?.katexScript||!assets?.katexCSS)throw new Error('离线查看资源不完整，未生成文件。');
    const esc=CFB.esc,nonce=crypto.randomUUID().replaceAll('-',''),warnings=[];
    const stats={messages:archive.messages.length,users:0,assistants:0,formulas:0,images:0,icons:0,tableFormulas:0,diagrams:0,charts:0};
    const sections=archive.messages.map((message,index)=>{
      message.role==='user'?stats.users++:stats.assistants++;
      for(const key of ['formulas','images','icons','tableFormulas','diagrams','charts'])stats[key]+=message.stats?.[key]||0;
      for(const warning of message.warnings||[])warnings.push(`第 ${index+1} 条：${warning}`);
      return `<section data-export-message="${index+1}" style="margin:28px 0;padding-top:12px;border-top:1px solid #e5e7eb"><div data-export-ui class="message-tools"><button data-copy-message>复制本条</button></div><h2 style="font-size:18px;font-weight:700;margin:8px 0 16px">${message.role==='user'?'用户':'ChatGPT'} · 第 ${index+1} 条</h2>${previewHTML(message.html)}</section>`;
    }).join('\n');
    const warningHTML=warnings.length?`<details class="warnings" open><summary>有 ${warnings.length} 项内容需要检查</summary><ul>${warnings.map(w=>'<li>'+esc(w)+'</li>').join('')}</ul></details>`:'';
    const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><!-- Bundled licenses:\n${(assets.licenseText||'').replaceAll('--','- -')}\n--><title>${esc(archive.title)}</title><style>${assets.katexCSS}</style><style>
body{margin:0;background:#f6f7f9;color:#1f2329;font:15px/1.75 Arial,'Microsoft YaHei',sans-serif}.toolbar{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e7eb;padding:14px max(24px,calc((100% - 920px)/2));z-index:10}button{border:1px solid #d0d5dd;border-radius:8px;background:white;color:#344054;font:inherit;padding:6px 12px;cursor:pointer}button:hover{background:#f2f4f7}.toolbar button{background:#215df1;color:white;border-color:#215df1}#archive-status{margin:6px 0 0;font-size:13px;color:#667085}.page{max-width:920px;margin:24px auto;padding:30px 40px;background:white;border:1px solid #e5e7eb;border-radius:12px}.message-tools{float:right}.message-tools button{font-size:12px}.warnings{padding:12px 18px;margin-bottom:20px;background:#fffaeb;border:1px solid #fedf89;border-radius:8px;font-size:13px}img{max-width:100%;height:auto}table{max-width:100%}pre{overflow:auto}.katex-display{overflow-x:auto;overflow-y:hidden}a{overflow-wrap:anywhere}@media(max-width:680px){.page{margin:0;padding:20px;border:0;border-radius:0}.toolbar{padding:12px 20px}}@media print{.toolbar,[data-export-ui],.warnings{display:none}.page{border:0;margin:0;padding:0}}
</style></head><body><div class="toolbar" data-export-ui><button id="copy-all">复制全部到飞书</button><div id="archive-status" role="status">离线文件 · ${stats.messages} 条消息（用户 ${stats.users} / ChatGPT ${stats.assistants}）· ${stats.formulas} 个公式 · ${stats.images} 张图片。卡片内文字为图片。</div></div><main class="page">${warningHTML}<div id="export-content" style="font-family:Arial,'Microsoft YaHei',sans-serif;font-size:14px;color:#1f2329"><h1 style="font-size:28px;font-weight:700;margin:0 0 10px">${esc(archive.title)}</h1><p style="font-size:13px;color:#667085">当前分支 · 导出于 ${esc(new Date(archive.createdAt).toLocaleString('zh-CN'))}<br>来源：<a href="${esc(archive.url)}" rel="noopener noreferrer">${esc(archive.url)}</a></p>${sections}</div></main><script nonce="${nonce}">${scriptText(assets.katexScript)}</script><script nonce="${nonce}">${scriptText(assets.viewerScript)}</script></body></html>`;
    if(new Blob([html]).size>128*1024*1024)throw new Error('导出文件超过 128 MB，请分段导出。');
    return {html,filename:filename(archive.title,new Date(archive.createdAt)),stats,warnings};
  }
  function download(result){
    const url=URL.createObjectURL(new Blob([result.html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=result.filename;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  globalThis.CFBArchive=Object.freeze({previewHTML,filename,build,download});
})();
