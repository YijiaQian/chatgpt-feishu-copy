/* SPDX-License-Identifier: MIT */
'use strict';
let creating;
async function offscreen(){
  const url=chrome.runtime.getURL('offscreen.html');
  if((await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]})).length)return;
  if(!creating)creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['DOM_PARSER','BLOBS'],justification:'在本机将用户复制的图片和 SVG 图标转换为可粘贴的 PNG。'}).finally(()=>creating=null);
  await creating;
}
async function blobData(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let str='';
  for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return `data:${blob.type||'application/octet-stream'};base64,${btoa(str)}`;
}
async function fetchImage(src){
  const url=new URL(src);
  if(url.protocol!=='https:')throw new Error('仅支持 HTTPS 图片，请先下载后在转换页插入本地图片。');
  if(!await chrome.permissions.contains({origins:[url.origin+'/*']}))throw new Error(`需要图片域名权限：${url.origin}。可在转换页添加授权。`);
  const own=/^(chatgpt\.com|chat\.openai\.com)$/.test(url.hostname);
  const response=await fetch(url.href,{credentials:own?'include':'omit',redirect:'follow',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`图片下载失败（HTTP ${response.status}），请确认原图已加载且链接未过期。`);
  if(Number(response.headers.get('content-length'))>16*1024*1024)throw new Error('单张图片超过 16 MB，请缩小后重试。');
  const reader=response.body.getReader();let size=0;const chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16*1024*1024){await reader.cancel();throw new Error('单张图片超过 16 MB。');}chunks.push(value);}
  const mime=(response.headers.get('content-type')||'').split(';')[0];
  if(!mime.startsWith('image/'))throw new Error('图片地址返回了非图片内容，可能需要登录或链接已过期。');
  return blobData(new Blob(chunks,{type:mime}));
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.target!=='background'||msg.type!=='MEDIA')return;
  // Content scripts may request media only from the two declared ChatGPT origins.
  if(sender.tab&&!sender.url?.startsWith(chrome.runtime.getURL(''))&&!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(sender.url||'')){reply({ok:false,error:'来源页面未授权'});return;}
  (async()=>{
    let {src,svg,width,height,formula,display}=msg.payload||{};
    if(typeof src!=='string'||src.length>24*1024*1024)throw new Error('图片数据过大或无效。');
    if(!svg&&!formula&&!src.startsWith('data:'))src=await fetchImage(src);
    await offscreen();
    const response=await chrome.runtime.sendMessage({target:'offscreen',type:'RASTER',payload:{src,svg,width,height,formula,display}});
    if(!response?.ok)throw new Error(response?.error||'本地图片转换失败。');
    return response;
  })().then(reply).catch(e=>reply({ok:false,error:e.message}));
  return true;
});
