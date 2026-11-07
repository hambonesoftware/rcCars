'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let url;
 try{url=new URL(req.url,'http://127.0.0.1');}
 catch{res.writeHead(400);res.end('Invalid URL');return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
 fs.stat(file,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
   fs.createReadStream(file).pipe(res);
 });
});
async function verify(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 // Use the public entry point so a broken/missing redirect fails CI.
 const url='http://127.0.0.1:'+server.address().port+'/maple-asset-gallery.html';
 const executablePath=[process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&fs.existsSync(p))||
   execFileSync('which',['chromium'],{encoding:'utf8'}).trim();
 const browser=await chromium.launch({headless:true,executablePath,args:[
   '--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
   '--use-gl=angle','--use-angle=swiftshader'
 ]});
 const shots=path.join(root,'tests','screenshots');fs.mkdirSync(shots,{recursive:true});
 try{
   const errors=[];
   const desktop=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
   desktop.on('pageerror',err=>errors.push('desktop: '+err.message));
   await desktop.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
   await desktop.waitForURL('**/assets/maple-junction/gallery.html',{timeout:15000});
   console.log('PASS stable public gallery link redirects to actual GLB gallery');
   for(const variant of ['house','store','car','tree']){
     await desktop.waitForFunction(type=>document.body.dataset.assetLoaded===type||
       !!document.body.dataset.assetError,variant,{timeout:90000});
     const status=await desktop.evaluate(()=>({
       type:document.body.dataset.assetLoaded,error:document.body.dataset.assetError,
       gl:!!document.querySelector('#canvas').getContext('webgl2')
     }));
     if(status.type!==variant||!status.gl||status.error)
       throw Error('Desktop GLB load failed for '+variant+': '+JSON.stringify(status));
     await desktop.waitForTimeout(450);
     const file=path.join(shots,'maple-asset-'+variant+'-desktop.png');
     const png=await desktop.screenshot({path:file,animations:'disabled'});
     if(png.length<12000)throw Error('Rendered GLB screenshot unexpectedly tiny '+variant);
     console.log('PASS authored GLB',variant,'screenshot bytes',png.length);
     if(variant!=='tree')await desktop.locator('[data-model="'+
       ({house:'store',store:'car',car:'tree'}[variant])+'"]').click();
   }
   const tablet=await browser.newContext({
      viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2
   });
   const phone=await tablet.newPage();
   phone.on('pageerror',err=>errors.push('iPhone: '+err.message));
   await phone.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
   await phone.waitForURL('**/assets/maple-junction/gallery.html',{timeout:15000});
   await phone.waitForFunction(()=>document.body.dataset.assetLoaded==='house'||
      !!document.body.dataset.assetError,null,{timeout:90000});
   if(await phone.locator('body').getAttribute('data-asset-error'))
     throw Error('Phone GLB load failed');
   await phone.screenshot({path:path.join(shots,'maple-asset-house-iphone.png'),animations:'disabled'});
   await phone.locator('[data-model="car"]').tap();
   await phone.waitForFunction(()=>document.body.dataset.assetLoaded==='car',null,{timeout:90000});
   await phone.screenshot({path:path.join(shots,'maple-asset-car-iphone.png'),animations:'disabled'});
   const ui=await phone.evaluate(()=>({
     bottom:document.querySelector('footer').getBoundingClientRect().bottom,
     height:innerHeight,scroll:document.documentElement.scrollHeight>innerHeight+2
   }));
   if(ui.scroll||ui.bottom>ui.height+2)throw Error('Mobile gallery does not fit: '+JSON.stringify(ui));
   if(errors.length)throw Error('Browser page errors: '+errors.join('; '));
   console.log('PASS real WebGL 2 GLBs: desktop models, iPhone house/car and mobile gallery layout');
   await tablet.close();
   await desktop.close();
 }finally{
   await browser.close();
   await new Promise(resolve=>server.close(resolve));
 }
}
verify().catch(e=>{console.error(e);process.exitCode=1;server.close();});
