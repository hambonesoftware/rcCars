'use strict';

/**
 * Post-deployment smoke test for the ACTUAL public GitHub Pages URL.
 * Unlike local file tests, this catches missing Pages assets, wrong paths,
 * stale CDN versions, import failures and inaccessible controls.
 */
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');

const BASE='https://hambonesoftware.github.io/rcCars/';
const MODELS={
  house:'maple_craftsman_house.glb',
  store:'maple_mainstreet_hardware.glb',
  car:'maple_cherry_coupe.glb',
  tree:'maple_scenic_tree.glb'
};
const output=path.resolve(__dirname,'screenshots');
fs.mkdirSync(output,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchWithRetry(url,validator,tries=8){
  let lastError;
  for(let i=0;i<tries;i++){
    try{
      const response=await fetch(url,{redirect:'follow',cache:'no-store',
        signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('HTTP '+response.status+' '+response.statusText);
      const body=Buffer.from(await response.arrayBuffer());
      if(!validator(body,response))throw Error('Invalid response body or content');
      return {body,response,attempt:i+1};
    }catch(error){
      lastError=error;
      console.warn('Live URL attempt '+(i+1)+' failed for '+url+': '+error.message);
      if(i+1<tries)await pause(2500);
    }
  }
  throw Error('LIVE DEPLOYMENT FAILURE '+url+' '+lastError.message);
}
async function main(){
  const url=BASE+'assets/maple-junction/gallery.html';
  const html=await fetchWithRetry(url,(body,res)=>
    body.toString('utf8').includes('Maple Junction')&&
    body.toString('utf8').includes('maple_craftsman_house.glb'));
  console.log('PUBLISHED gallery HTTP 200, bytes:',html.body.length);
  for(const [key,file] of Object.entries(MODELS)){
    const model=await fetchWithRetry(BASE+'assets/maple/glb/'+file,
      b=>b.length>100000&&b.subarray(0,4).toString('ascii')==='glTF'&&
       b.readUInt32LE(8)===b.length);
    console.log('PUBLISHED model HTTP 200',key,file,
      'bytes',model.body.length,'attempt',model.attempt);
  }
  const chrome=[process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome']
    .find(x=>x&&fs.existsSync(x))||
    execFileSync('which',['chromium'],{encoding:'utf8'}).trim();
  const browser=await chromium.launch({executablePath:chrome,headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--use-gl=angle','--use-angle=swiftshader']});
  try{
    const errors=[];
    const desktop=await browser.newPage({viewport:{width:1365,height:900}});
    desktop.on('pageerror',e=>errors.push('Desktop '+e.message));
    desktop.on('response',r=>{
      if(r.status()>=400&&r.url().includes('/rcCars/'))
        errors.push('HTTP '+r.status()+' '+r.url());
    });
    await desktop.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    for(const [key,file] of Object.entries(MODELS)){
      if(key!=='house')await desktop.locator('[data-model="'+key+'"]').click();
      await desktop.waitForFunction(k=>
        document.body.dataset.assetLoaded===k||
        !!document.body.dataset.assetError,
        key,{timeout:70000});
      const check=await desktop.evaluate(()=>({
        loaded:document.body.dataset.assetLoaded,
        error:document.body.dataset.assetError,
        ready:document.body.dataset.galleryStartup,
        gl:!!document.querySelector('#canvas').getContext('webgl2')
      }));
      if(check.loaded!==key||!check.gl||check.error)
        throw Error('LIVE PAGE failed to render '+key+': '+JSON.stringify(check));
      await desktop.screenshot({path:path.join(output,'maple-live-'+key+'-desktop.png'),
        animations:'disabled'});
      console.log('PASS PUBLIC URL PlayCanvas rendered',key);
    }
    const mobileContext=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true
    });
    const mobile=await mobileContext.newPage();
    mobile.on('pageerror',e=>errors.push('Mobile '+e.message));
    await mobile.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await mobile.waitForFunction(()=>
      document.body.dataset.assetLoaded==='house'||
      !!document.body.dataset.assetError,
      null,{timeout:70000});
    if(await mobile.locator('body').getAttribute('data-asset-error'))
      throw Error('LIVE iPhone cannot render the Craftsman house');
    await mobile.screenshot({path:path.join(output,'maple-live-house-iphone.png'),
      animations:'disabled'});
    await mobile.locator('[data-model="car"]').tap();
    await mobile.waitForFunction(()=>
      document.body.dataset.assetLoaded==='car'||
      !!document.body.dataset.assetError,
      null,{timeout:70000});
    if(await mobile.locator('body').getAttribute('data-asset-loaded')!=='car')
      throw Error('LIVE iPhone cannot switch to actual loaded car model');
    await mobile.screenshot({path:path.join(output,'maple-live-car-iphone.png'),
      animations:'disabled'});
    if(errors.length)throw Error('Public gallery browser errors: '+errors.join('; '));
    console.log('PASS LIVE GitHub Pages gallery, all four GLBs, desktop and iPhone');
    await mobileContext.close();await desktop.close();
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
