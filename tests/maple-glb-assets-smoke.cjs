'use strict';
/** Test actual binary GLB loading in PlayCanvas with desktop and iPhone Chromium. */
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
const ROOT=path.resolve(__dirname,'..');
const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.glb':'model/gltf-binary','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let requested;try{requested=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}
  catch(e){res.writeHead(400);res.end();return;}
  const file=path.resolve(ROOT,'.'+requested);
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':contentTypes[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
});
function chrome(){
  for(const f of [process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome'])
    if(f&&fs.existsSync(f))return f;
  return execFileSync('which',['chromium'],{encoding:'utf8'}).trim();
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/assets/maple-junction/gallery.html';
  const output=path.resolve(ROOT,'tests/screenshots');
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:chrome(),args:[
    '--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
    '--use-gl=angle','--use-angle=swiftshader'
  ]});
  const errors=[];
  async function verify(page,model){
    try{
      await page.waitForFunction(name=>document.body.dataset.assetLoaded===name,
        model,{timeout:75000});
    }catch(e){
      throw Error('GLB failed: '+model+'; state '+JSON.stringify(
        await page.evaluate(()=>({
          current:document.body.dataset.assetLoaded,
          error:document.body.dataset.assetError,
          status:document.querySelector('#model-state').textContent
        }))
      ));
    }
  }
  async function screenshot(page,name){
    const data=await page.screenshot({path:path.join(output,name),animations:'disabled'});
    if(data.length<23000)throw Error('GLB screenshot unexpectedly blank: '+name+', '+data.length);
  }
  try{
    const desktop=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
    desktop.on('pageerror',error=>errors.push(error.message));
    await desktop.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await verify(desktop,'house');
    await screenshot(desktop,'maple-glb-craftsman-desktop.png');
    for(const kind of ['store','car','tree']){
      await desktop.locator('[data-model="'+kind+'"]').click();
      await verify(desktop,kind);
      await screenshot(desktop,'maple-glb-'+kind+'-desktop.png');
    }
    const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    phone.on('pageerror',error=>errors.push('iPhone: '+error.message));
    await phone.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await verify(phone,'house');
    await screenshot(phone,'maple-glb-craftsman-iphone.png');
    await phone.locator('[data-model="car"]').tap();
    await verify(phone,'car');
    await screenshot(phone,'maple-glb-car-iphone.png');
    // Simulate the exact Pages propagation failure: the page is live,
    // but all copies of its first .glb briefly return HTTP 404.
    // A person must see an error and be able to retry, not stare at Loading.
    const retryPage=await browser.newPage({viewport:{width:920,height:680}});
    const blockGlb=route=>route.fulfill({status:404,body:'Model not yet published'});
    await retryPage.route('**/*maple_craftsman_house.glb',blockGlb);
    await retryPage.goto(url,{waitUntil:'domcontentloaded',timeout:50000});
    await retryPage.waitForFunction(()=>document.body.dataset.assetStatus==='error',
      null,{timeout:75000});
    if(!(await retryPage.locator('#retry-model').isVisible()))
      throw Error('Missing 3D models left no visible Retry action');
    if(!(await retryPage.locator('#model-state').textContent()).includes('Could not load'))
      throw Error('Gallery did not explain the missing model error');
    await retryPage.unroute('**/*maple_craftsman_house.glb',blockGlb);
    await retryPage.locator('#retry-model').click();
    await verify(retryPage,'house');
    if(await retryPage.locator('body').getAttribute('data-asset-status')!=='ready')
      throw Error('Retry left GLB gallery in an error state');
    await retryPage.close();
    console.log('PASS: missing Pages/backup model shows actionable error and Retry recovers');
    if(errors.length)throw Error('Browser JavaScript error(s): '+errors.join('; '));
    console.log('PASS: all 4 authored GLBs import and render in PlayCanvas desktop');
    console.log('PASS: real iPhone-sized WebGL2 renders and asset selector');
    await browser.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
