'use strict';
/**
 * Real browser validation of imported, generated glTF binaries.
 * Catches failure to create actual files, glTF parsing errors, missing
 * materials and iPhone UI/runtime exceptions before public deployment.
 */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
const {PNG}=require('pngjs');
const ROOT=path.resolve(__dirname,'..');
const assets={
  house:'maple_craftsman_house.glb',
  hardware:'maple_mainstreet_hardware.glb',
  car:'maple_cherry_coupe.glb',
  tree:'maple_scenic_tree.glb'
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let file;
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    file=path.resolve(ROOT,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(ROOT+path.sep))throw Error('Outside repository');
  }catch(error){res.writeHead(403);res.end();return;}
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
});
function browserPath(){
  for(const x of [process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome']){
    if(x&&fs.existsSync(x))return x;
  }
  return execFileSync('which',['chromium'],{encoding:'utf8'}).trim();
}
function difference(a,b){
  const x=PNG.sync.read(a),y=PNG.sync.read(b);
  if(x.width!==y.width||x.height!==y.height)
    throw Error('Different screenshot dimensions');
  let sum=0,n=0;
  for(let row=Math.floor(x.height*.22);row<Math.floor(x.height*.78);row+=3)
    for(let col=Math.floor(x.width*.24);col<Math.floor(x.width*.76);col+=3){
      const i=(row*x.width+col)*4;
      sum+=Math.abs(x.data[i]-y.data[i])+
        Math.abs(x.data[i+1]-y.data[i+1])+
        Math.abs(x.data[i+2]-y.data[i+2]);
      n+=3;
    }
  return sum/Math.max(n,1);
}
async function verify(){
  const assetDirectory=path.join(ROOT,'assets','maple-junction','glb');
  for(const file of Object.values(assets)){
    const full=path.join(assetDirectory,file);
    const stat=fs.statSync(full);
    const head=Buffer.alloc(12);
    const handle=fs.openSync(full,'r');fs.readSync(handle,head,0,12,0);fs.closeSync(handle);
    if(stat.size<50000||head.toString('ascii',0,4)!=='glTF'||
       head.readUInt32LE(4)!==2||head.readUInt32LE(8)!==stat.size){
      throw Error('Invalid exported GLB: '+file);
    }
  }
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/maple-asset-gallery.html';
  const browser=await chromium.launch({
    executablePath:browserPath(),headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--use-gl=angle','--use-angle=swiftshader']
  });
  const output=path.join(ROOT,'tests','screenshots');
  fs.mkdirSync(output,{recursive:true});
  const errors=[];
  const shots={};
  try{
    const desktop=await browser.newPage({viewport:{width:1380,height:860},deviceScaleFactor:1});
    desktop.on('pageerror',error=>errors.push('desktop '+error.message));
    await desktop.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    for(const name of Object.keys(assets)){
      if(name!=='house')await desktop.locator('[data-model="'+name+'"]').click();
      try{
        await desktop.waitForFunction(name=>document.body.dataset.assetReady===name,name,
          {timeout:65000});
      }catch(error){
        throw Error(name+' gallery did not load GLB: '+JSON.stringify(
          await desktop.evaluate(()=>({
            loaded:document.body.dataset.assetReady,
            status:document.querySelector('#asset-status').textContent
          }))
        ));
      }
      await desktop.waitForTimeout(280);
      const shot=await desktop.screenshot({
        path:path.join(output,'maple-glb-'+name+'-desktop.png'),
        animations:'disabled'
      });
      shots[name]=shot;
    }
    const visualChange=difference(shots.house,shots.hardware);
    if(visualChange<2.5)throw Error('Different authored models appear identical in actual render: '+visualChange);
    const mobile=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,
      isMobile:true,hasTouch:true
    });
    const phone=await mobile.newPage();
    phone.on('pageerror',e=>errors.push('iPhone '+e.message));
    await phone.goto(url,{waitUntil:'domcontentloaded',timeout:65000});
    await phone.waitForFunction(()=>document.body.dataset.assetReady==='house',null,{timeout:65000});
    const layout=await phone.evaluate(()=>{
      const c=document.querySelector('canvas').getBoundingClientRect();
      const footer=document.querySelector('footer').getBoundingClientRect();
      return{
        ready:document.body.dataset.assetReady,
        canvasHeight:c.height,
        footerHeight:footer.height,
        scroll:document.documentElement.scrollHeight>innerHeight+2,
        selected:document.querySelector('[data-model="house"]').getAttribute('aria-pressed')
      };
    });
    if(layout.canvasHeight<500||layout.footerHeight>90||layout.scroll||layout.selected!=='true')
      throw Error('iPhone gallery UI regression: '+JSON.stringify(layout));
    await phone.screenshot({
      path:path.join(output,'maple-glb-house-iphone.png'),animations:'disabled'
    });
    await phone.locator('[data-model="car"]').tap();
    await phone.waitForFunction(()=>document.body.dataset.assetReady==='car',null,{timeout:65000});
    await phone.screenshot({
      path:path.join(output,'maple-glb-car-iphone.png'),animations:'disabled'
    });
    if(errors.length)throw Error(errors.join('; '));
    console.log('PASS four exported GLBs load in actual PlayCanvas WebGL2 with correct mesh/material parsing');
    console.log('PASS desktop distinct-model visual difference RGB',visualChange.toFixed(2));
    console.log('PASS iPhone responsive model selector and working GLB viewer',JSON.stringify(layout));
    await mobile.close();await desktop.close();
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}
verify().catch(e=>{console.error(e);process.exitCode=1;server.close();});
