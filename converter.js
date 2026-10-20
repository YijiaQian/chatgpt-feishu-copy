'use strict';
const source=document.getElementById('source'),preview=document.getElementById('preview'),status=document.getElementById('status');
const sample=String.raw`# 公式与图片粘贴验收

这段文字包含 **粗体**、*斜体*、~~删除线~~、[飞书](https://www.feishu.cn)，以及图标 ✅ 🚀。

## 行内和独立公式

能量公式 \(E=mc^2\)，以及 $\alpha+\beta=\gamma$。

$$
\int_0^1 x^2\,dx=\frac{1}{3}
$$

\[
\begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}
\]

## 表格和列表

| 项目 | 内容 |
| --- | --- |
| 公式 | $a^2+b^2=c^2$ |
| 状态 | ✅ 已完成 |

1. 第一项
2. 第二项
   - 嵌套列表

> 引用内容：请检查公式、表格与图片。

## SVG 图标

<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="12" fill="#2663e8"/><path d="M11 20l6 6 13-14" fill="none" stroke="white" stroke-width="4"/></svg>

## 代码块

~~~python
price = "$10"  # 保持为代码，不转为公式
print("Hello, Feishu")
~~~
`;
function show(message,warning=false){status.textContent=message;status.classList.toggle('warning',warning);}
function render(){
  try{
    const root=CFB.parseMarkdown(source.value);
    preview.replaceChildren(root);
    for(const node of preview.querySelectorAll('[data-cfb-math]')){
      try{katex.render(node.dataset.tex,node,{displayMode:node.dataset.display==='true',throwOnError:true,trust:false,strict:'warn',maxExpand:1000});}
      catch(e){node.textContent=(node.dataset.display==='true'?'$$':'$')+node.dataset.tex+(node.dataset.display==='true'?'$$':'$');node.title=e.message;}
    }
  }catch(e){show(e.message,true);}
}
async function media(payload){
  const response=await chrome.runtime.sendMessage({target:'background',type:'MEDIA',payload});
  if(!response?.ok)throw new Error(response?.error||'图片转换服务不可用');return response.result;
}
async function convert(){
  if(!source.value.trim())throw new Error('请先填写 Markdown 内容。');
  return CFB.prepare(CFB.parseMarkdown(source.value),{media,embedImages:true});
}
async function action(kind){
  const buttons=[document.getElementById('copy'),document.getElementById('export')];buttons.forEach(b=>b.disabled=true);show('正在准备公式、图片和图标…');
  try{
    const result=await convert();
    if(kind==='copy')await CFB.writeClipboard(result);
    else{
      const blob=new Blob(['<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>飞书兼容内容</title></head><body>'+result.html+'</body></html>'],{type:'text/html'});
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='飞书兼容内容.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    const {formulas,images,icons}=result.stats;
    show(`${kind==='copy'?'已复制，请在飞书文档中按 Ctrl+V。':'已导出 HTML。'}\n${formulas} 个公式 · ${images} 张图片 · ${icons} 个图标${result.stats.tableFormulas?'\n其中 '+result.stats.tableFormulas+' 个表格公式以高清图片保留。':''}${result.warnings.length?'\n需要处理：\n'+result.warnings.join('\n'):''}`,result.warnings.length>0);
    await chrome.storage.local.set({lastResult:{time:Date.now(),stats:result.stats,warnings:result.warnings}});
  }catch(e){show('转换失败：'+e.message,true);}finally{buttons.forEach(b=>b.disabled=false);}
}
document.getElementById('render').addEventListener('click',render);
document.getElementById('sample').addEventListener('click',()=>{source.value=sample;render();show('示例已填入，可以补充本地图片后复制测试。');});
document.getElementById('copy').addEventListener('click',()=>action('copy'));
document.getElementById('export').addEventListener('click',()=>action('export'));
document.getElementById('insert').addEventListener('click',()=>document.getElementById('file').click());
document.getElementById('file').addEventListener('change',event=>{
  const file=event.target.files[0];if(!file)return;
  if(file.size>16*1024*1024){show('本地图片超过 16 MB，请缩小后插入。',true);return;}
  const reader=new FileReader();reader.onload=()=>{const label=file.name.replace(/[\[\]\r\n]/g,'_');source.setRangeText(`\n![${label}](${reader.result})\n`,source.selectionStart,source.selectionEnd,'end');render();};reader.readAsDataURL(file);event.target.value='';
});
document.getElementById('grant').addEventListener('click',async()=>{
  try{
    const url=new URL(document.getElementById('origin').value.trim());if(url.protocol!=='https:')throw new Error('请输入 HTTPS 图片域名。');
    const granted=await chrome.permissions.request({origins:[url.origin+'/*']});show(granted?`已授权 ${url.origin}，现在可以重新复制。`:'未授权该图片域名。',!granted);
  }catch(e){show(e.message,true);}
});
let timer;source.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,350);});
render();
