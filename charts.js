/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const candidates='.recharts-wrapper,.js-plotly-plot,.vega-embed,[data-chart],[data-testid*="chart"],.chart-container,[role="graphics-document"]';
  function chartRoots(root){
    const nodes=new Set();
    for(const element of root.querySelectorAll(candidates)){
      if(element.closest('.katex,mjx-container,math')||!element.querySelector('svg,canvas'))continue;
      const rect=element.getBoundingClientRect();if(rect.width>90&&rect.height>60)nodes.add(element);
    }
    for(const graphic of root.querySelectorAll('svg,canvas')){
      if(graphic.closest('.katex,mjx-container,math,button,[data-cfb-ui]'))continue;
      if([...nodes].some(n=>n.contains(graphic)))continue;
      const rect=graphic.getBoundingClientRect();
      if(rect.width>100&&rect.height>60)nodes.add(graphic);
    }
    return [...nodes].filter(n=>![...nodes].some(parent=>parent!==n&&parent.contains(n)));
  }
  function svgWithStyles(original){
    const clone=original.cloneNode(true),src=[original,...original.querySelectorAll('*')],dst=[clone,...clone.querySelectorAll('*')];
    const props=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline','visibility','display','color'];
    src.forEach((node,i)=>{
      const style=getComputedStyle(node);
      for(const property of props)dst[i].style.setProperty(property,style.getPropertyValue(property));
      if(node.tagName.toLowerCase()==='use'){
        const href=node.getAttribute('href')||node.getAttribute('xlink:href');
        const definition=href?.startsWith('#')?original.ownerDocument.getElementById(href.slice(1)):null;
        if(definition){const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.innerHTML=definition.innerHTML;dst[i].replaceWith(g);}
      }
    });
    const rect=original.getBoundingClientRect();clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',Math.ceil(rect.width));clone.setAttribute('height',Math.ceil(rect.height));
    return clone;
  }
  async function capture(node){
    const rect=node.getBoundingClientRect();
    if(rect.width*rect.height>8_000_000)throw new Error('图表过大，请单独复制');
    // Serialize only the chart. Cloning the whole ChatGPT document with a DOM
    // screenshot library is costly and can trigger layout/virtualization work.
    const padX=24,padY=12;
    const canvas=document.createElement('canvas');canvas.width=Math.ceil((rect.width+padX*2)*2);canvas.height=Math.ceil((rect.height+padY*2)*2);
    const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,rect.width+padX*2,rect.height+padY*2);ctx.translate(padX,padY);
    const graphics=[...(node.matches('svg,canvas')?[node]:node.querySelectorAll('svg,canvas'))];
    for(const graphic of graphics){
      const box=graphic.getBoundingClientRect();if(!box.width||!box.height)continue;
      if(graphic.matches('canvas')){ctx.drawImage(graphic,box.x-rect.x,box.y-rect.y,box.width,box.height);continue;}
      const svg=svgWithStyles(graphic);
      const vb=graphic.viewBox?.baseVal;
      if(vb?.width&&vb?.height){
        const px=padX*vb.width/box.width,py=padY*vb.height/box.height;
        svg.setAttribute('viewBox',`${vb.x-px} ${vb.y-py} ${vb.width+2*px} ${vb.height+2*py}`);
      }
      svg.style.removeProperty('width');svg.style.removeProperty('height');svg.setAttribute('width',box.width+padX*2);svg.setAttribute('height',box.height+padY*2);
      const markup=DOMPurify.sanitize(new XMLSerializer().serializeToString(svg),{USE_PROFILES:{svg:true},FORBID_TAGS:['script','foreignObject','image'],FORBID_ATTR:['href','xlink:href']});
      const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}));
      try{
        const image=new Image();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('SVG 图表解码超时')),10000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('SVG 图表无法解码'));};image.src=url;});
        ctx.drawImage(image,box.x-rect.x-padX,box.y-rect.y-padY,box.width+padX*2,box.height+padY*2);
      }finally{URL.revokeObjectURL(url);}
    }
    // Recharts legends live in HTML outside the SVG. Preserve their markers and
    // text at their measured positions instead of dropping the clickable labels.
    for(const marker of node.querySelectorAll('.Chart_LegendItemMarker,.recharts-legend-item .recharts-surface')){
      if(marker.matches('svg'))continue;
      const b=marker.getBoundingClientRect(),style=getComputedStyle(marker);ctx.fillStyle=style.backgroundColor;ctx.fillRect(b.x-rect.x,b.y-rect.y,b.width,b.height);
    }
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const text=walker.currentNode,parent=text.parentElement,value=text.nodeValue.trim();
      if(!value||parent.closest('svg,script,style,[aria-hidden="true"],.sr-only,.recharts-tooltip-wrapper,[role="tooltip"]')||parent.closest('button')&&!parent.closest('.recharts-legend-wrapper'))continue;
      const style=getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden')continue;
      const range=document.createRange();range.selectNodeContents(text);const b=range.getBoundingClientRect();if(!b.width||!b.height)continue;
      ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.color;ctx.textBaseline='middle';ctx.fillText(value,b.x-rect.x,b.y-rect.y+b.height/2);
    }
    const dataUrl=canvas.toDataURL('image/png');
    if(canvas.width<1||canvas.height<1||dataUrl.length<100)throw new Error('图表尚未加载，请展开后重试');
    return {dataUrl,width:Math.round(rect.width+padX*2),height:Math.round(rect.height+padY*2)};
  }
  async function snapshot(root){
    const snapshots=new Map(),warnings=[];
    for(const node of chartRoots(root)){
      try{snapshots.set(node,await capture(node));}
      catch(error){warnings.push('交互图表截图失败：'+error.message);}
    }
    return {snapshots,warnings};
  }
  globalThis.CFBCharts=Object.freeze({chartRoots,svgWithStyles,capture,snapshot});
})();
