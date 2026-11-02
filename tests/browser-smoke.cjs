'use strict';

/**
 * End-to-end smoke test for all four Micro Mayhem courses.
 * This intentionally launches a real headless browser. Pure geometry
 * tests did not catch the Garage Gauntlet "Building Track" hang.
 */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');

const ROOT=path.resolve(__dirname,'..');
const types={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.png':'image/png',
  '.svg':'image/svg+xml',
  '.webp':'image/webp',
  '.json':'application/json; charset=utf-8'
};
function findChrome(){
  for(const candidate of [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome'
  ]){
    if(candidate&&fs.existsSync(candidate))return candidate;
  }
  try{return execFileSync('which',['google-chrome'],{encoding:'utf8'}).trim();}
  catch(e){throw new Error('Chrome/Chromium not found on CI runner');}
}
const server=http.createServer((req,res)=>{
  const uri=new URL(req.url,'http://localhost');
  let target;
  try{target=path.resolve(ROOT,'.'+decodeURIComponent(uri.pathname));}
  catch(e){res.writeHead(400);res.end('Bad request');return;}
  if(target!==ROOT&&!target.startsWith(ROOT+path.sep)){
    res.writeHead(403);res.end('Forbidden');return;
  }
  if(target===ROOT)target=path.join(ROOT,'index.html');
  const ext=path.extname(target);
  fs.stat(target,(error,stats)=>{
    if(error||!stats.isFile()){
      res.writeHead(404);res.end('Not found: '+uri.pathname);return;
    }
    res.writeHead(200,{
      'Content-Type':types[ext]||'application/octet-stream',
      'Cache-Control':'no-store'
    });
    fs.createReadStream(target).pipe(res);
  });
});
async function smoke(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const executablePath=findChrome();
  console.log('Using Chromium:',executablePath);
  const browser=await chromium.launch({
    executablePath,headless:true,
    args:[
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader'
    ]
  });
  try{
    for(const id of ['garage','creek','quarry','backyard']){
      const page=await browser.newPage({viewport:{width:1050,height:700}});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('requestfailed',request=>{
        if(/three\.module\.js|course-presets|track-layouts|quarter-track/.test(request.url())){
          errors.push('Failed required resource: '+request.url()+' '+request.failure()?.errorText);
        }
      });
      const url=origin+'/quarter-track.html?course='+id;
      try{
        await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
        await page.waitForFunction(
          ()=>document.getElementById('loading')?.classList.contains('hidden'),
          null,{timeout:40000}
        );
        if(errors.length)throw new Error(errors.join('; '));
        const result=await page.evaluate(()=>({
          title:document.title,
          course:document.getElementById('course-title')?.textContent,
          canvas:document.querySelectorAll('#viewport canvas').length,
          intro:!document.getElementById('intro')?.classList.contains('hidden')
        }));
        if(!result.canvas||!result.intro||
          !result.course||!result.title.toUpperCase().includes(result.course.toUpperCase())){
          throw new Error('Unexpected game startup: '+JSON.stringify(result));
        }
        console.log('PASS course startup',id,JSON.stringify(result));
        if(id==='garage'){
          await page.getByRole('button',{name:/START THE GRAND PRIX/i}).click();
          await page.keyboard.down('w');
          await page.waitForTimeout(5100);
          const speed=await page.locator('#speed').textContent();
          await page.keyboard.up('w');
          if(!(Number(speed)>0)){
            throw new Error('Garage game did not enter moving race; speed='+speed);
          }
          console.log('PASS interactive Garage race, speed='+speed);
        }
      }catch(e){
        const loading=await page.locator('#loading').textContent().catch(()=>'?');
        throw new Error(id+' browser smoke failed: '+e.message+
          ' | loading='+loading+' | JS errors='+errors.join('; '));
      }finally{
        await page.close();
      }
    }
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
smoke().then(
  ()=>console.log('PASS: all four courses load and Garage gameplay advances'),
  error=>{console.error(error.stack||error);process.exitCode=1;}
);
