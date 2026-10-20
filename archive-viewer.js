/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const status=document.getElementById('archive-status');
  const plain=root=>{
    function walk(node){if(node.nodeType===3)return node.nodeValue;if(node.nodeType!==1)return '';if(node.tagName==='IMG')return node.alt||'[图片]';if(node.tagName==='BR')return '\n';const text=[...node.childNodes].map(walk).join('');return /^(P|DIV|SECTION|H[1-6]|PRE|BLOCKQUOTE|LI|TR)$/.test(node.tagName)?text+'\n':/^(TH|TD)$/.test(node.tagName)?text+'\t':text;}
    return walk(root).replace(/\n{3,}/g,'\n\n').trim();
  };
  async function copy(target){
    const clone=target.cloneNode(true);clone.querySelectorAll('[data-export-ui]').forEach(n=>n.remove());
    clone.querySelectorAll('[data-export-tex]').forEach(node=>node.replaceWith(document.createTextNode(node.dataset.exportDelimiters)));
    const html='<meta charset="utf-8">'+clone.outerHTML,text=plain(clone);
    if(new Blob([html]).size>24*1024*1024)throw new Error('整份内容较大，请使用各条消息旁的“复制本条”。');
    if(navigator.clipboard?.write&&globalThis.ClipboardItem){
      try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);return;}catch{/* file:// can deny async clipboard; try the user-gesture fallback. */}
    }
    const handler=e=>{e.preventDefault();e.clipboardData.setData('text/html',html);e.clipboardData.setData('text/plain',text);};
    document.addEventListener('copy',handler,{capture:true,once:true});
    try{if(!document.execCommand('copy'))throw new Error('浏览器阻止了复制，请用 Chrome / Edge 打开此文件后重试。');}finally{document.removeEventListener('copy',handler,true);}
  }
  document.getElementById('copy-all').addEventListener('click',async()=>{
    try{await copy(document.getElementById('export-content'));status.textContent='已复制全部内容，可在飞书文档中按 Ctrl+V。';}catch(e){status.textContent=e.message;}
  });
  document.querySelectorAll('[data-copy-message]').forEach(button=>button.addEventListener('click',async()=>{
    try{await copy(button.closest('[data-export-message]'));status.textContent='已复制本条消息，可在飞书文档中按 Ctrl+V。';}catch(e){status.textContent=e.message;}
  }));
  document.querySelectorAll('[data-export-tex]').forEach(node=>{
    try{katex.render(node.dataset.exportTex,node,{displayMode:node.dataset.exportDisplay==='true',throwOnError:true,trust:false,maxExpand:1000});}catch{node.textContent=node.dataset.exportDelimiters;}
  });
})();
