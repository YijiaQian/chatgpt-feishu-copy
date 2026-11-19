/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const blockTags=/^(P|DIV|SECTION|ARTICLE|H[1-6]|PRE|BLOCKQUOTE|UL|OL|LI|TABLE|TBODY|THEAD|TR|TH|TD)$/;
  function plain(root){
    function walk(node){
      if(node.nodeType===Node.TEXT_NODE){
        const text=node.nodeValue;
        if(/^[\t\r\n ]+$/.test(text)&&/[\r\n]/.test(text)&&!node.parentElement?.closest('pre,code')&&
          (!node.previousSibling||!node.nextSibling||blockTags.test(node.previousSibling.tagName)||blockTags.test(node.nextSibling.tagName)))return '';
        return text;
      }
      if(node.nodeType!==Node.ELEMENT_NODE)return '';
      if(node.tagName==='IMG')return node.alt||'[图片]';
      if(node.tagName==='BR')return '\n';
      const text=[...node.childNodes].map(walk).join('');
      if(/^(TH|TD)$/.test(node.tagName))return text+'\t';
      return blockTags.test(node.tagName)?text+'\n':text;
    }
    return walk(root).replace(/\n{3,}/g,'\n\n').trim();
  }
  function prepare(target,tooLarge){
    const clone=document.createElement('div');clone.append(...target.cloneNode(true).childNodes);
    clone.querySelectorAll('[data-export-ui]').forEach(n=>n.remove());
    clone.querySelectorAll('[data-export-tex]').forEach(node=>node.replaceWith(document.createTextNode(node.dataset.exportDelimiters)));
    for(const section of clone.querySelectorAll(':scope > [data-export-message]'))section.replaceWith(...section.childNodes);
    const html='<meta charset="utf-8">'+clone.outerHTML;
    if(new Blob([html]).size>24*1024*1024)throw new Error(tooLarge);
    return {html,text:plain(clone)};
  }
  globalThis.CFBArchiveClipboard=Object.freeze({prepare});
})();
