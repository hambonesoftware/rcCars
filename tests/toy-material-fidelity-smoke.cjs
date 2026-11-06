'use strict';
/** Real Chromium WebGL2 fidelity proof. No mock pixels or AI-generated screenshots. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
function chromiumPath(){
  for(const v of [process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome']){
    if(v&&fs.existsSync(v))return v;
  }
  return execFileSync('which',['chromium'],{encoding:'utf8'}).trim();
}
const server=http.createServer((req,res)=>{
  let url;
  try{url=new URL(req.url,'http://127.0.0.1');}
  catch(error){res.writeHead(400);res.end('Bad URL');return;}
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}
  catch(error){res.writeHead(400);res.end('Invalid path');return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/toy-material-comparison.html';
  const browser=await chromium.launch({
    executablePath:chromiumPath(),headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--use-gl=angle','--use-angle=swiftshader']
  });
  const output=path.join(root,'tests','screenshots');
  fs.mkdirSync(output,{recursive:true});
  const errorList=[];
  function pixelChange(pngA,pngB,box){
    const a=PNG.sync.read(pngA),b=PNG.sync.read(pngB);
    if(a.width!==b.width||a.height!==b.height)
      throw Error('Image dimensions changed during fixed-camera lighting test');
    const x0=Math.max(0,box.x),y0=Math.max(0,box.y);
    const x1=Math.min(a.width,x0+box.w),y1=Math.min(a.height,y0+box.h);
    let sum=0,large=0,bright=0,seen=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const i=(y*a.width+x)*4;
      const dr=b.data[i]-a.data[i],dg=b.data[i+1]-a.data[i+1],
        db=b.data[i+2]-a.data[i+2];
      const magnitude=(Math.abs(dr)+Math.abs(dg)+Math.abs(db))/3;
      sum+=magnitude;
      if(magnitude>12)large++;
      if((dr+dg+db)/3>10)bright++;
      seen++;
    }
    return {mean:sum/seen,changed12:large/seen,bright10:bright/seen,pixels:seen};
  }
  try{
    const desktop=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
    desktop.on('pageerror',error=>errorList.push('desktop: '+error.message));
    await desktop.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
    try{
      await desktop.waitForFunction(()=>document.body.dataset.fidelityReady==='true',
        null,{timeout:50000});
    }catch(error){
      throw Error('Desktop startup: '+JSON.stringify(await desktop.evaluate(()=>({
        state:document.body.dataset.fidelityReady,
        error:document.body.dataset.fidelityError,
        status:document.querySelector('#render-status').textContent
      }))));
    }
    const stats=await desktop.evaluate(()=>({
      engine:document.body.dataset.fidelityEngine,
      reflections:document.body.dataset.fidelityReflections,
      normal:document.body.dataset.fidelityNormalMap,
      ao:document.body.dataset.fidelityAO,
      beveled:Number(document.body.dataset.fidelityRoundedParts),
      raised:Number(document.body.dataset.fidelityMoldedPanels),
      canvasWidth:document.querySelector('#fidelity-canvas').width,
      context:!!document.querySelector('#fidelity-canvas').getContext('webgl2'),
      roofConnection:document.body.dataset.fidelityRoofConnection,
      garageRoof:document.body.dataset.fidelityGarageRoof,
      lighting:document.body.dataset.fidelityLightTreatment,
      specular:document.body.dataset.fidelitySpecularPercent,
      specularLight:document.body.dataset.fidelitySpecularLight,
      specularIntensity:Number(document.body.dataset.fidelitySpecularIntensity),
      diffuseLightIntensity:Number(document.body.dataset.fidelityDiffuseLightIntensity),
      specularGloss:Number(document.body.dataset.fidelitySpecularGloss)
    }));
    if(stats.engine!=='PlayCanvas 2.23.3'||stats.normal!=='tangent-styrene-normal'||
       stats.ao!=='crevice-texture-and-inset'||stats.beveled<60||
       stats.raised<65||!stats.context||stats.canvasWidth<850||
       stats.roofConnection!=='gable-and-eaves-aligned'||
       stats.garageRoof!=='pitched-molded-roof'||
       stats.lighting!=='satin-neutral-v2'||
       stats.specular!=='65'||
       stats.specularLight!=='dielectric-specular-f0-v3'||
       Math.abs(stats.specularIntensity-.558)>.001||
       Math.abs(stats.diffuseLightIntensity-.82)>.001||
       !(stats.specularGloss>.65)){
      throw Error('Incomplete physical plastic fidelity preview '+JSON.stringify(stats));
    }
    await desktop.waitForTimeout(600);
    await desktop.screenshot({
      path:path.join(output,'molded-plastic-before-after-desktop.png'),
      animations:'disabled'
    });
    await desktop.locator('#rotate-light').fill('20');
    const angle=await desktop.locator('body').getAttribute('data-fidelity-light-angle');
    if(angle!=='20')throw Error('Adjustable light failed: '+angle);
    await desktop.screenshot({
      path:path.join(output,'molded-plastic-studio-angle.png'),
      animations:'disabled'
    });
    await desktop.locator('#specular-light').fill('0');
    if(await desktop.locator('body').getAttribute('data-fidelity-specular-percent')!=='0'||
       await desktop.locator('body').getAttribute('data-fidelity-specular-intensity')!=='0.015')
      throw Error('Specular slider did not set matte baseline');
    await desktop.waitForTimeout(350);
    const low=await desktop.screenshot({
      path:path.join(output,'molded-plastic-specular-low.png'),
      animations:'disabled'
    });
    await desktop.locator('#specular-light').fill('100');
    if(await desktop.locator('body').getAttribute('data-fidelity-specular-percent')!=='100'||
       await desktop.locator('body').getAttribute('data-fidelity-specular-intensity')!=='0.850'||
       await desktop.locator('body').getAttribute('data-fidelity-diffuse-light-intensity')!=='0.820')
      throw Error('Specular slider did not change material BRDF independently of diffuse light');
    await desktop.waitForTimeout(350);
    const high=await desktop.screenshot({
      path:path.join(output,'molded-plastic-specular-high.png'),
      animations:'disabled'
    });
    // We MUST measure the rendered image. Changing an intensity variable is
    // not proof that the user will see a reflective highlight.
    const regions={
      moldedGarage:pixelChange(low,high,{x:1150,y:525,w:230,h:105}),
      moldedRoof:pixelChange(low,high,{x:865,y:360,w:290,h:110}),
      plainGarage:pixelChange(low,high,{x:430,y:525,w:210,h:105}),
      sky:pixelChange(low,high,{x:900,y:225,w:400,h:100}),
      grass:pixelChange(low,high,{x:870,y:670,w:270,h:40})
    };
    console.log('Specular image measurements (low vs high):',JSON.stringify(regions));
    if(regions.moldedGarage.mean<8||
       regions.moldedGarage.mean<regions.plainGarage.mean*2.2||
       regions.moldedGarage.changed12<.08||
       regions.moldedRoof.mean<3.5||
       regions.sky.mean>1.2||
       regions.grass.mean>3.5){
      throw Error('Specular is not visibly distinguishable from diffuse brightness: '+
        JSON.stringify(regions));
    }
    await desktop.close();

    const context=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,
      isMobile:true,hasTouch:true
    });
    const mobile=await context.newPage();
    mobile.on('pageerror',e=>errorList.push('mobile: '+e.message));
    await mobile.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
    await mobile.waitForFunction(()=>document.body.dataset.fidelityReady==='true',
      null,{timeout:50000});
    if(await mobile.locator('body').getAttribute('data-fidelity-mobile-mode')!=='improved')
      throw Error('Mobile did not start on molded specimen');
    const mobileUI=await mobile.evaluate(()=>{
      const scene=document.querySelector('.scene').getBoundingClientRect();
      const controls=document.querySelector('.controls').getBoundingClientRect();
      return {
        sceneHeight:scene.height,
        controlsHeight:controls.height,
        isolate:document.body.dataset.fidelityIsolation,
        roof:document.body.dataset.fidelityRoofConnection,
        garage:document.body.dataset.fidelityGarageRoof,
        indicator:document.querySelector('#scene-indicator').textContent,
        scrolling:document.documentElement.scrollHeight>window.innerHeight+2,
        specular:document.body.dataset.fidelitySpecularPercent
      };
    });
    if(mobileUI.isolate!=='single-specimen'||
       mobileUI.roof!=='gable-and-eaves-aligned'||
       mobileUI.garage!=='pitched-molded-roof'||
       mobileUI.controlsHeight>167||
       mobileUI.specular!=='65'||
       mobileUI.sceneHeight<390||
       mobileUI.scrolling)
      throw Error('Mobile miniature layout regression: '+JSON.stringify(mobileUI));
    await mobile.waitForTimeout(300);
    await mobile.screenshot({
      path:path.join(output,'molded-plastic-mobile-after.png'),
      animations:'disabled'
    });
    await mobile.locator('[data-specimen="before"]').tap();
    if(await mobile.locator('body').getAttribute('data-fidelity-mobile-mode')!=='before')
      throw Error('Mobile specimen selection failed');
    await mobile.screenshot({
      path:path.join(output,'molded-plastic-mobile-before.png'),
      animations:'disabled'
    });
    await mobile.locator('[data-specimen="improved"]').tap();
    await mobile.locator('#specular-light').fill('80');
    if(await mobile.locator('body').getAttribute('data-fidelity-specular-percent')!=='80')
      throw Error('Mobile specular highlight control did not respond');
    await mobile.locator('[data-region="garage"]').tap();
    if(await mobile.locator('body').getAttribute('data-fidelity-region')!=='garage')
      throw Error('Mobile garage detail camera not selectable');
    await mobile.screenshot({
      path:path.join(output,'molded-plastic-mobile-garage.png'),
      animations:'disabled'
    });
    await mobile.screenshot({
      path:path.join(output,'molded-plastic-mobile-specular-high.png'),
      animations:'disabled'
    });
    await mobile.close();
    if(errorList.length)throw Error('JavaScript error(s): '+errorList.join('; '));
    console.log('PASS: real PlayCanvas physical bevel meshes and tangent normal maps',stats);
    console.log('PASS: connected pitched roofs, toned-down satin plastic and calibrated mobile UI');
    console.log('PASS: exact same studio lights, draggable angle, phone specimen comparison',mobileUI);
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close();});
