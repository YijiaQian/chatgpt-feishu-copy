/* SPDX-License-Identifier: MIT */
'use strict';
let queue=Promise.resolve();
async function raster({src,svg,formula,display,diagram,width,height}){
  if(diagram){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>8_000_000)throw new Error('流程图尺寸无效或过大');
    const root=document.createElement('div');root.style.cssText=`width:${width}px;background:white;color:#1f2329;padding:0;overflow:hidden`;
    root.innerHTML=DOMPurify.sanitize(src,{USE_PROFILES:{html:true,svg:true,mathMl:true},FORBID_TAGS:['script','style','iframe','object','embed','form','input','textarea','video','audio','foreignObject','image','use'],FORBID_ATTR:['href','xlink:href','srcset','srcdoc']});
    root.querySelectorAll('*').forEach(node=>{for(const property of [...node.style])if(/url\s*\(|@import/i.test(node.style.getPropertyValue(property)))node.style.removeProperty(property);});
    root.querySelectorAll('img').forEach(img=>{if(!/^data:image\/(png|jpeg|webp);base64,/i.test(img.getAttribute('src')||''))img.remove();});
    document.body.append(root);
    try{
      await document.fonts.ready;
      const canvas=await html2canvas(root,{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:false,windowWidth:Math.max(1024,width),windowHeight:Math.max(1024,height),scrollX:0,scrollY:0});
      const dataUrl=canvas.toDataURL('image/png');if(dataUrl.length>20*1024*1024)throw new Error('流程图过大，请拆分后复制');
      return {dataUrl,width:canvas.width,height:canvas.height,displayWidth:Math.ceil(canvas.width/2),displayHeight:Math.ceil(canvas.height/2)};
    }finally{root.remove();}
  }
  if(formula){
    const root=document.createElement('div');root.style.cssText='display:inline-block;width:max-content;white-space:nowrap;background:white;color:#1f2329;padding:5px 7px;font-size:16px';
    document.body.append(root);
    try{
      katex.render(src,root,{displayMode:Boolean(display),throwOnError:true,trust:false,maxExpand:1000});
      await document.fonts.ready;
      const canvas=await html2canvas(root,{scale:3,backgroundColor:'#ffffff',logging:false,useCORS:false,windowWidth:2048,windowHeight:1024,scrollX:0,scrollY:0});
      return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,displayWidth:Math.ceil(canvas.width/3),displayHeight:Math.ceil(canvas.height/3)};
    }finally{root.remove();}
  }
  let blob;
  if(svg){
    const safe=DOMPurify.sanitize(src,{USE_PROFILES:{svg:true},FORBID_TAGS:['foreignObject','image','script','style','a','use'],FORBID_ATTR:['href','xlink:href']});
    const doc=new DOMParser().parseFromString(safe,'image/svg+xml'),vector=doc.documentElement;
    if(vector.localName!=='svg'||doc.querySelector('parsererror'))throw new Error('SVG 内容无效。');
    // Percentage-sized SVG images otherwise decode at a tiny default size.
    // Rasterize at twice their measured display size, within the image budget.
    if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0){
      const scale=Math.min(width>64||height>64?2:1,2000/width,Math.sqrt(8_000_000/(width*height)));
      const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
      vector.setAttribute('width',String(w));vector.setAttribute('height',String(h));
      vector.style.width=w+'px';vector.style.height=h+'px';
    }
    blob=new Blob([new XMLSerializer().serializeToString(vector)],{type:'image/svg+xml;charset=utf-8'});
  }else{
    if(!/^data:image\/(png|jpeg|jpg|gif|webp|avif|bmp|svg\+xml)(?:;|,)/i.test(src))throw new Error('图片类型不受支持。');
    const response=await fetch(src);blob=await response.blob();
    if(blob.type.includes('svg'))return raster({src:await blob.text(),svg:true,width,height});
  }
  const url=URL.createObjectURL(blob);
  try{
    const image=new Image();
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('图片解码超时。')),12000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('图片解码失败。'));};image.src=url;});
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!w||!h||w*h>64_000_000)throw new Error('图片尺寸无效或超过 6400 万像素。');
    const scale=Math.min(1,2000/w,Math.sqrt(8_000_000/(w*h)));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/png');
    if(dataUrl.length>20*1024*1024)throw new Error('转换后的 PNG 超过 20 MB，请缩小原图。');
    return {dataUrl,width:canvas.width,height:canvas.height};
  }finally{URL.revokeObjectURL(url);}
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.target!=='offscreen'||msg.type!=='RASTER')return;
  const job=queue.then(()=>raster(msg.payload));queue=job.catch(()=>{});
  job.then(result=>reply({ok:true,result})).catch(e=>reply({ok:false,error:e.message}));return true;
});
