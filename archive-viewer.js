/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const status=document.getElementById('archive-status');
  async function copy(target){
    const {html,text}=CFBArchiveClipboard.prepare(target,'整份内容较大，请使用各条消息旁的“复制本条”。');
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
