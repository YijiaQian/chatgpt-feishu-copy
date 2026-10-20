/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const candidates='.recharts-wrapper,.js-plotly-plot,.vega-embed,[data-chart],[data-testid*="chart"],.chart-container,[role="graphics-document"]';
  function visualCard(node){
    const rect=node.getBoundingClientRect();if(rect.width<100||rect.height<40)return false;
    const style=getComputedStyle(node);
    const border=['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].some(p=>parseFloat(style[p])>0);
    const background=style.backgroundColor!=='transparent'&&!/rgba\([^)]*,\s*0\s*\)$/.test(style.backgroundColor);
    if((border||background&&parseFloat(style.borderRadius)>0)&&node.textContent.trim())return true;
    // Layout libraries often add one transparent grid-item wrapper per card.
    return node.children.length===1&&node.firstElementChild.matches('div,section,figure')&&visualCard(node.firstElementChild);
  }
  function diagramRoots(root){
    const nodes=[...root.querySelectorAll('div,section,figure,[data-d-component="box"][data-d-has-border],[data-d-component="row"],[data-d-component="grid"]')].filter(node=>{
      if(node.closest('pre,code,table,button,.katex,[data-cfb-ui]')||node.querySelector(candidates))return false;
      const semantic=node.matches('[data-d-component="box"][data-d-has-border],[data-d-component="row"],[data-d-component="grid"]');
      const layout=/^(?:inline-)?(?:grid|flex)$/.test(getComputedStyle(node).display);
      if(!semantic&&!layout)return false;
      const rect=node.getBoundingClientRect();
      if(rect.width<100||rect.height<45||rect.width*rect.height>8_000_000||node.querySelectorAll('*').length>600)return false;
      const boxes=node.querySelectorAll('[data-d-component="box"]');
      const connectors=node.querySelectorAll('svg[data-d-component="icon"]');
      const bars=node.querySelectorAll('[data-d-has-height][data-d-clip]');
      const panels=node.querySelectorAll(':scope > [data-d-component="grid-item"],:scope > [data-d-component="box"]');
      const cards=node.matches('[data-d-component="grid"],[data-d-component="row"]')&&panels.length>=2;
      const styledCards=layout&&[...node.children].filter(visualCard).length>=2;
      return styledCards||boxes.length>=2&&(connectors.length>=1||bars.length>=1||cards);
    });
    return nodes.filter(node=>!nodes.some(parent=>parent!==node&&parent.contains(node)));
  }
  function legacyColor(value){
    if(!/(?:oklab|oklch|lab|lch|color|color-mix)\(/i.test(value))return value;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const [r,g,b,a]=ctx.getImageData(0,0,1,1).data;
    return `rgba(${r},${g},${b},${a/255})`;
  }
  function diagramHTML(node,images=new Map()){
    const clone=node.cloneNode(true),source=[node,...node.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
    const properties=['display','box-sizing','width','height','min-width','min-height','max-width','max-height','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-self','justify-content','gap','row-gap','column-gap','grid-template-columns','grid-template-rows','grid-column','grid-row','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left',...['top','right','bottom','left'].flatMap(side=>['width','style','color'].map(part=>`border-${side}-${part}`)),'border-radius','background-color','color','font-family','font-size','font-weight','font-style','line-height','text-align','letter-spacing','white-space','word-break','overflow-wrap','vertical-align','opacity','fill','stroke','stroke-width','fill-rule'];
    source.forEach((original,index)=>{
      const copy=copies[index],style=getComputedStyle(original);
      copy.removeAttribute('class');copy.removeAttribute('id');copy.removeAttribute('style');
      if(style.display==='none'||style.visibility==='hidden'||original.matches('button,script,style,iframe,form,input,textarea,.sr-only,[data-cfb-ui],[data-d-component="favicon"]')){copy.remove();return;}
      for(const property of properties){let value=style.getPropertyValue(property);if(value&&!/url\s*\(/i.test(value)){if(property.endsWith('color')||property==='fill'||property==='stroke')value=legacyColor(value);copy.style.setProperty(property,value);}}
      if(original.matches('svg')){const b=original.getBoundingClientRect();copy.setAttribute('width',Math.ceil(b.width));copy.setAttribute('height',Math.ceil(b.height));copy.setAttribute('xmlns','http://www.w3.org/2000/svg');}
      if(original.matches('img')&&images.has(original)){copy.setAttribute('src',images.get(original));copy.removeAttribute('srcset');}
    });
    // Layout snapshots must never introduce new remote resource requests.
    clone.querySelectorAll('img').forEach(img=>{if(!/^data:image\/(png|jpeg|webp);base64,/i.test(img.getAttribute('src')||''))img.remove();});
    clone.querySelectorAll('a').forEach(a=>a.removeAttribute('href'));
    return clone.outerHTML;
  }
  async function captureDiagram(node,media){
    if(!media)throw new Error('布局截图服务未连接，请刷新后重试');
    const rect=node.getBoundingClientRect();
    const images=new Map();
    for(const img of node.querySelectorAll('img')){
      if(img.closest('[data-d-component="favicon"]')||getComputedStyle(img).visibility==='hidden'||!img.getBoundingClientRect().width)continue;
      const src=img.currentSrc||img.getAttribute('src')||'';
      if(/^data:image\/(png|jpeg|webp);base64,/i.test(src))continue;
      // Preserve real illustrations inside cards. A failed image falls back to
      // normal conversion with a warning instead of disappearing in a snapshot.
      if(!src)throw new Error('卡片内图片尚未加载');
      images.set(img,(await media({src})).dataUrl);
    }
    const result=await media({src:diagramHTML(node,images),diagram:true,width:Math.ceil(rect.width),height:Math.ceil(rect.height)});
    return {dataUrl:result.dataUrl,width:result.displayWidth,height:result.displayHeight,kind:'diagram',alt:'流程图与卡片示意图'};
  }
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
  async function snapshot(root,{media}={}){
    const snapshots=new Map(),warnings=[];
    for(const node of diagramRoots(root)){
      try{snapshots.set(node,await captureDiagram(node,media));}
      catch(error){warnings.push('流程或卡片布局截图失败：'+error.message);}
    }
    for(const node of chartRoots(root)){
      if([...snapshots.keys()].some(parent=>parent.contains(node)))continue;
      try{snapshots.set(node,await capture(node));}
      catch(error){warnings.push('交互图表截图失败：'+error.message);}
    }
    return {snapshots,warnings};
  }
  globalThis.CFBCharts=Object.freeze({chartRoots,diagramRoots,diagramHTML,svgWithStyles,capture,captureDiagram,snapshot});
})();
