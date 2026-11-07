'use strict';
/** Maple Junction must work in a REAL desktop and phone Chromium WebGL2 render. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');

const ROOT=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.png':'image/png'};
function findBrowser(){
  for(const x of [process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/google-chrome']){
    if(x&&fs.existsSync(x))return x;
  }
  return execFileSync('which',['chromium'],{encoding:'utf8'}).trim();
}
const server=http.createServer((req,res)=>{
  let uri;
  try{uri=new URL(req.url,'http://127.0.0.1');}
  catch(error){res.writeHead(400);res.end();return;}
  let file;
  try{file=path.resolve(ROOT,'.'+decodeURIComponent(uri.pathname));}
  catch(error){res.writeHead(400);res.end();return;}
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(error,st)=>{
    if(error||!st.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
});
async function run(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/maple-junction.html';
  const browser=await chromium.launch({
    executablePath:findBrowser(),headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
      '--use-gl=angle','--use-angle=swiftshader']
  });
  const images=path.join(ROOT,'tests','screenshots');fs.mkdirSync(images,{recursive:true});
  const bad=[];
  try{
    const desktop=await browser.newPage({viewport:{width:1450,height:930}});
    desktop.on('pageerror',e=>bad.push('Desktop JS error: '+e.message));
    await desktop.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    try{
      await desktop.waitForFunction(()=>document.body.dataset.mapleGameReady==='true',
        null,{timeout:90000});
    }catch(e){
      throw Error('Maple Junction did not start: '+JSON.stringify(
        await desktop.evaluate(()=>({
          ready:document.body.dataset.mapleGameReady,
          error:document.body.dataset.mapleError,
          loading:document.querySelector('#loading').textContent
        }))
      ));
    }
    await desktop.waitForFunction(()=>['all-four-loaded','fallbacks-active'].includes(
      document.body.dataset.mapleAuthoredAssets),null,{timeout:120000});
    await desktop.waitForFunction(()=>['all-sources-loaded','fallbacks-active'].includes(
      document.body.dataset.mapleImportedAssets),null,{timeout:120000});
    const initial=await desktop.evaluate(()=>({
      title:document.title,ready:document.body.dataset.mapleGameReady,
      course:document.body.dataset.mapleCourse,
      world:document.body.dataset.mapleTable,
      buildings:Number(document.body.dataset.mapleBuildings),
      trees:Number(document.body.dataset.mapleTrees),
      ties:Number(document.body.dataset.mapleRailTies),
      trainCars:Number(document.body.dataset.mapleTrainCars),
      roadSamples:Number(document.body.dataset.mapleRoadSamples),
      reflections:document.body.dataset.mapleReflections,
      specular:document.body.dataset.mapleSpecular,
      authored:document.body.dataset.mapleAuthoredAssets,
      authoredLoaded:Number(document.body.dataset.mapleAuthoredLoaded),
      authoredFailed:Number(document.body.dataset.mapleAuthoredFailed),
      townInstances:Number(document.body.dataset.mapleTownAssetInstances),
      dressedTown:document.body.dataset.mapleDressedTown,
      imported:document.body.dataset.mapleImportedAssets,
      importedLoaded:Number(document.body.dataset.mapleImportedLoaded),
      importedFailed:Number(document.body.dataset.mapleImportedFailed),
      importedBuildings:Number(document.body.dataset.mapleImportedBuildings),
      importedTrees:Number(document.body.dataset.mapleImportedTrees),
      importedInstances:Number(document.body.dataset.mapleImportedInstances),
      playerModel:document.body.dataset.maplePlayerModel,
      rcTruckWidth:Number(document.body.dataset.mapleTruckWidth),
      rcTruckHeight:Number(document.body.dataset.mapleTruckHeight),
      rcTruckLength:Number(document.body.dataset.mapleTruckLength),
      rcTruckHouseWidthRatio:Number(document.body.dataset.mapleTruckHouseWidthRatio),
      rcTruckRoadWidthRatio:Number(document.body.dataset.mapleTruckRoadWidthRatio),
      rcTruckGrounded:document.body.dataset.mapleTruckGrounded,
      rcTruckWheels:Number(document.body.dataset.mapleTruckWheelNodes),
      rcTruckFront:document.body.dataset.mapleTruckFrontAlongTravel,
      rcTruckOriginalAxis:document.body.dataset.mapleTruckOriginalFrontAxis,
      rcTruckGroundError:Number(document.body.dataset.mapleTruckGroundError),
      trackRevision:document.body.dataset.mapleTrackRevision,
      curbedRoad:document.body.dataset.mapleCurbedRoad,
      crosswalks:Number(document.body.dataset.mapleCrosswalkCount),
      roadLength:Number(document.body.dataset.mapleRoadLength),
      roadSurface:Number(document.body.dataset.mapleRoadSurface),
      importedTrucks:Number(document.body.dataset.mapleImportedTrucks),
      dressedLots:Number(document.body.dataset.mapleDressedLots),
      streetLamps:Number(document.body.dataset.mapleStreetlamps),
      camera:document.body.dataset.mapleCamera,
      race:document.body.dataset.mapleRaceState,
      context:!!document.querySelector('#maple-canvas').getContext('webgl2'),
      introVisible:!document.querySelector('#intro').hidden,
      trainX:Number(document.body.dataset.mapleTrainX),
      trainZ:Number(document.body.dataset.mapleTrainZ)
    }));
    if(!initial.title.includes('Maple Junction')||initial.course!=='Maple Junction Loop'||
       initial.world!=='20x10-feet'||initial.buildings<12||initial.trees<30||
       initial.ties<100||initial.trainCars!==3||initial.roadSamples<200||
       initial.specular!=='50'||!initial.context||
       initial.authored!=='all-four-loaded'||
       initial.authoredLoaded!==4||initial.authoredFailed!==0||
       initial.imported!=='all-sources-loaded'||
       initial.importedLoaded!==11||initial.importedFailed!==0||
       initial.playerModel!=='downloaded-kenney-rc-truck-red'||
       initial.importedTrucks!==1||initial.rcTruckGrounded!=='true'||
       initial.rcTruckWidth<.9||initial.rcTruckWidth>2.17||
       initial.rcTruckHeight<.6||initial.rcTruckHeight>2.33||
       initial.rcTruckLength<1.6||initial.rcTruckLength>3.61||
       initial.rcTruckHouseWidthRatio<.07||initial.rcTruckHouseWidthRatio>.181||
       initial.rcTruckRoadWidthRatio>.25||initial.rcTruckWheels!==4||
       initial.rcTruckFront!=='true'||!['-Z','+Z'].includes(initial.rcTruckOriginalAxis)||
       initial.rcTruckGroundError>.005||initial.trackRevision!=='town-streets-v2'||
       initial.curbedRoad!=='true'||initial.crosswalks!==4||
       initial.roadLength<310||initial.roadLength>390||
       Math.abs(initial.roadSurface-.405)>.001||
       initial.importedBuildings<5||initial.importedTrees<5||
       initial.importedInstances<10||
       initial.townInstances<13||initial.dressedTown!=='true'||
       initial.dressedLots<5||initial.streetLamps<3||
       !initial.introVisible||initial.race!=='intro'){
      throw Error('The photographed 20x10 train-table scene is incomplete: '+
        JSON.stringify(initial));
    }
    await desktop.waitForTimeout(2200);
    const trainDebug=await desktop.evaluate(()=>({
      x:Number(document.body.dataset.mapleTrainX),
      z:Number(document.body.dataset.mapleTrainZ),
      frames:document.body.dataset.mapleFrameCount,
      error:document.body.dataset.mapleFrameError,
      race:document.body.dataset.mapleRaceState
    }));
    if(Math.hypot(trainDebug.x-initial.trainX,trainDebug.z-initial.trainZ)<.06)
      throw Error('Train motion regression: '+JSON.stringify({
        before:initial.trainX,after:trainDebug,jsErrors:bad
      }));
    await desktop.screenshot({
      path:path.join(images,'maple-junction-desktop-full-train-table.png'),
      animations:'disabled'
    });
    await desktop.locator('#start-race').click();
    // SwiftShader on CI can take several seconds per frame with authored GLBs.
    // Wait for real simulation progress instead of wall-clock sleep.
    await desktop.waitForFunction(()=>
      Number(document.body.dataset.mapleSpeed||0)>.95 &&
      Number(document.body.dataset.mapleProgress||0)>1.80,
      null,{timeout:90000});
    const race=await desktop.evaluate(()=>({
      race:document.body.dataset.mapleRaceState,
      lap:document.body.dataset.mapleLap,
      camera:document.body.dataset.mapleCamera,
      progress:Number(document.body.dataset.mapleProgress),
      speed:Number(document.body.dataset.mapleSpeed),
      time:document.querySelector('#time').textContent
    }));
    if(race.race!=='racing'||race.camera!=='chase'||
       race.lap!=='1'||race.speed<.95||race.progress<1.80)
      throw Error('Driveable three-lap circuit did not begin: '+JSON.stringify(race));
    await desktop.screenshot({
      path:path.join(images,'maple-junction-desktop-racing.png'),
      animations:'disabled'
    });
    // Verify real steering semantics, not merely whether the input button
    // receives a touch event. Screen-right is negative world yaw in the
    // chase-camera orientation used by this course.
    const headingBefore=Number(await desktop.locator('body').getAttribute('data-maple-heading-degrees'));
    await desktop.keyboard.down('ArrowRight');
    try {
      await desktop.waitForFunction(previous=>
        document.body.dataset.mapleSteeringIntent==='-1' &&
        Number(document.body.dataset.mapleHeadingDegrees)<previous-.35,
        headingBefore,{timeout:60000});
    } finally {
      await desktop.keyboard.up('ArrowRight');
    }
    const headingAfterRight=Number(await desktop.locator('body').getAttribute('data-maple-heading-degrees'));
    await desktop.keyboard.down('ArrowLeft');
    try {
      await desktop.waitForFunction(previous=>
        document.body.dataset.mapleSteeringIntent==='1' &&
        Number(document.body.dataset.mapleHeadingDegrees)>previous+.35,
        headingAfterRight,{timeout:60000});
    } finally {
      await desktop.keyboard.up('ArrowLeft');
    }
    await desktop.screenshot({
      path:path.join(images,'maple-junction-steering-corrected.png'),
      animations:'disabled'
    });
    await desktop.locator('#overview').click();
    if(await desktop.locator('body').getAttribute('data-maple-camera')!=='overview')
      throw Error('Tabletop overview did not switch from live chase camera');
    await desktop.locator('#specular-intensity').fill('85');
    if(await desktop.locator('body').getAttribute('data-maple-specular')!=='85')
      throw Error('Approved plastic specular lighting was not wired into course');
    await desktop.screenshot({
      path:path.join(images,'maple-junction-overview-specular-85.png'),
      animations:'disabled'
    });
    await desktop.close();

    const context=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true
    });
    const phone=await context.newPage();
    phone.on('pageerror',e=>bad.push('iPhone JS error: '+e.message));
    await phone.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await phone.waitForFunction(()=>document.body.dataset.mapleGameReady==='true',
      null,{timeout:90000});
    await phone.waitForFunction(()=>['all-four-loaded','fallbacks-active'].includes(
      document.body.dataset.mapleAuthoredAssets),null,{timeout:120000});
    await phone.waitForFunction(()=>['all-sources-loaded','fallbacks-active'].includes(
      document.body.dataset.mapleImportedAssets),null,{timeout:120000});
    if(await phone.locator('body').getAttribute('data-maple-imported-assets')!=='all-sources-loaded')
      throw Error('Phone failed to load imported town models');
    if(Number(await phone.locator('body').getAttribute('data-maple-imported-instances'))<8)
      throw Error('Phone miniature town has too few independent GLB instances');
    if(await phone.locator('body').getAttribute('data-maple-player-model')!=='downloaded-kenney-rc-truck-red')
      throw Error('Phone is not driving the downloaded red RC truck');
    if(await phone.locator('body').getAttribute('data-maple-truck-grounded')!=='true')
      throw Error('The imported RC truck does not sit on the miniature roadway');
    if(await phone.locator('body').getAttribute('data-maple-truck-front-along-travel')!=='true')
      throw Error('The RC truck nose points behind the direction of travel');
    if(await phone.locator('body').getAttribute('data-maple-track-revision')!=='town-streets-v2')
      throw Error('Phone is loading an outdated racing track');
    if(await phone.locator('body').getAttribute('data-maple-authored-assets')!=='all-four-loaded')
      throw Error('iPhone GLB mesh imports did not complete');
    if(Number(await phone.locator('body').getAttribute('data-maple-town-asset-instances'))<9)
      throw Error('The authored model-railroad town was not populated on iPhone');
    const phoneLayout=await phone.evaluate(()=>{
      const scene=document.querySelector('main').getBoundingClientRect();
      const left=document.querySelector('#left').getBoundingClientRect();
      const brake=document.querySelector('#brake').getBoundingClientRect();
      return{
        canvasWidth:document.querySelector('#maple-canvas').width,
        sceneHeight:scene.height,
        hudWidth:document.querySelector('#hud').getBoundingClientRect().width,
        leftButton:left.width,
        brakeButton:brake.width,
        hasScroll:document.documentElement.scrollHeight>innerHeight+2,
        controlsSeen:left.bottom<=innerHeight&&brake.bottom<=innerHeight,
        intro:!document.querySelector('#intro').hidden
      };
    });
    if(phoneLayout.sceneHeight<640||phoneLayout.leftButton<56||
       !phoneLayout.controlsSeen||phoneLayout.hasScroll||!phoneLayout.intro)
      throw Error('Mobile-first race camera and controls are broken: '+
        JSON.stringify(phoneLayout));
    await phone.screenshot({
      path:path.join(images,'maple-junction-iphone-town-overview.png'),
      animations:'disabled'
    });
    await phone.locator('#start-race').tap();
    await phone.waitForTimeout(900);
    const first=Number(await phone.locator('body').getAttribute('data-maple-progress'));
    await phone.locator('#right').tap();
    if(await phone.locator('body').getAttribute('data-maple-last-touch')!=='right')
      throw Error('Actual iPhone touch did not activate right steering');
    await phone.waitForFunction(previous=>{
      const s=Number(document.body.dataset.mapleProgress||0);
      return s>previous+.065;
    },first,{timeout:50000});
    const second=Number(await phone.locator('body').getAttribute('data-maple-progress'));
    if(second<=first+.065)
      throw Error('Touch controlled miniature race car did not advance: '+
        JSON.stringify({first,second}));
    await phone.screenshot({
      path:path.join(images,'maple-junction-iphone-gameplay.png'),
      animations:'disabled'
    });
    await phone.locator('#overview').tap();
    if(await phone.locator('body').getAttribute('data-maple-camera')!=='overview')
      throw Error('Mobile tabletop overview button did not work');
    if(bad.length)throw Error('Browser JavaScript failures: '+bad.join('; '));
    console.log('PASS Maple Junction complete 20x10 model railway:',initial);
    console.log('PASS live 3-lap course drive and train animation:',race);
    console.log('PASS mobile camera, automatic drive and real touch steering:',phoneLayout);
    await context.close();
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;server.close();});
