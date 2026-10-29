'use strict';
document.getElementById('extension-version').textContent=chrome.runtime.getManifest().name+' · '+chrome.runtime.getManifest().version;
const defaults={enabled:true,embedImages:true,markdownCode:true};
chrome.storage.local.get({...defaults,lastResult:null}).then(values=>{
  for(const key of Object.keys(defaults)){
    const input=document.getElementById(key);input.checked=values[key];input.addEventListener('change',()=>chrome.storage.local.set({[key]:input.checked}));
  }
  const last=values.lastResult;
  document.getElementById('last').textContent=last?`上次复制：${last.stats.formulas} 个公式 · ${last.stats.images} 张图片 · ${last.stats.icons} 个图标${last.stats.diagrams?'\n其中 '+last.stats.diagrams+' 张完整流程或卡片布局。':''}${last.stats.tableFormulas?'\n其中 '+last.stats.tableFormulas+' 个表格公式以图片保留。':''}${last.warnings.length?'\n注意：'+last.warnings.join('\n'):''}`:'准备就绪 · 内容在本机转换';
});
document.getElementById('open').addEventListener('click',()=>chrome.runtime.openOptionsPage());
async function pageStatus(repair=false){
  const status=document.getElementById('page-status');
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.url?.match(/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//)){status.textContent='请先切到 ChatGPT 对话网页。';return;}
    if(repair){
      const files=['vendor/markdown-it.min.js','vendor/purify.min.js','vendor/html2canvas.min.js','charts.js','core.js','conversation.js','archive.js','content.js'];
      await chrome.scripting.executeScript({target:{tabId:tab.id},files});
    }
    const info=await chrome.tabs.sendMessage(tab.id,{type:'CFB_PING'});
    status.textContent=`当前页面已连接 v${info.version}\n识别 ${info.answers} 条回复；增强复制${info.enabled?'已开启':'已关闭'}。`;
  }catch(error){status.textContent='当前网页尚未连接扩展。点击下方“启用当前页面”，或刷新 ChatGPT 网页后重试。';}
}
document.getElementById('repair').addEventListener('click',()=>pageStatus(true));
document.getElementById('export-conversation').addEventListener('click',async event=>{
  const button=event.currentTarget,status=document.getElementById('page-status');button.disabled=true;
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.url?.match(/^https:\/\/(chatgpt\.com|chat\.openai\.com)\/(c|g)\//))throw new Error('请先打开一条已有的 ChatGPT 对话。');
    const result=await chrome.tabs.sendMessage(tab.id,{type:'CFB_EXPORT'});
    if(!result?.ok)throw new Error(result?.error||'导出未启动，请刷新当前页面后重试。');
    window.close();
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
pageStatus();
