'use strict';
(async()=>{
  const results=[];
  const vector='<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 400 200"><rect width="200" height="200" fill="red"/><rect x="200" width="200" height="200" fill="blue"/></svg>';
  for(const encoded of [false,true]){
    const name=encoded?'SVG data URL 使用网页显示尺寸生成清晰 PNG':'百分比 SVG 按显示尺寸渲染，保留比例和图形内容';
    try{
      const result=await raster({src:encoded?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(vector):vector,svg:!encoded,width:600,height:300});
      if(result.width!==1200||result.height!==600)throw new Error('Vector fell back to intrinsic dimensions');
      const image=new Image();image.src=result.dataUrl;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=600;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const left=ctx.getImageData(100,100,1,1).data,right=ctx.getImageData(1000,100,1,1).data;
      if(left[0]!==255||left[2]!==0||right[0]!==0||right[2]!==255)throw new Error('Vector content clipped or changed');
      results.push({name,passed:true});
    }catch(e){results.push({name,passed:false,error:e.message});}
  }
  try{
    const result=await raster({src:vector,svg:true,width:16,height:16});
    if(result.width!==16||result.height!==16)throw new Error('Inline icon was enlarged');
    results.push({name:'小型 SVG 图标保持自然尺寸，避免飞书导入后放大',passed:true});
  }catch(e){results.push({name:'小型 SVG 图标保持自然尺寸，避免飞书导入后放大',passed:false,error:e.message});}
  globalThis.TEST_RESULTS=results;document.getElementById('results').textContent=JSON.stringify(results,null,2);
})();
