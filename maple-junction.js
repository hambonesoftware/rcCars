import * as pc from 'playcanvas';
import {BOARD,buildMapleWorld,groundHeight} from './maple-junction-world.js';
import {loadAuthoredMapleAssets} from './maple-authored-assets.js';
import {loadImportedMapleTown} from './maple-imported-assets.js';

const canvas=document.querySelector('#maple-canvas');
const ui={
  intro:document.querySelector('#intro'),
  start:document.querySelector('#start-race'),
  result:document.querySelector('#finish-screen'),
  again:document.querySelector('#race-again'),
  lap:document.querySelector('#lap'),
  time:document.querySelector('#time'),
  best:document.querySelector('#best'),
  speed:document.querySelector('#speed'),
  sector:document.querySelector('#sector'),
  msg:document.querySelector('#message'),
  progress:document.querySelector('#progress-fill'),
  camera:document.querySelector('#overview'),
  brake:document.querySelector('#brake-status'),
  map:document.querySelector('#course-minimap'),
  finishing:document.querySelector('#finish-time'),
  finishBest:document.querySelector('#finish-best'),
  spec:document.querySelector('#specular-intensity'),
  status:document.querySelector('#loading'),
  restart:document.querySelector('#restart'),
  photo:document.querySelector('#overview')
};
const controls={left:false,right:false,brake:false,boost:false,gas:false};
const state={
  mode:'intro',camera:'overview',lap:1,laps:3,time:0,
  speed:0,boostHeat:0,brushes:0,checkpoint:0,
  s:0,lastS:0,steeringHelp:true,
  position:{x:0,z:0},yaw:0,
  best:0,elapsedLap:0,lapStart:0,
  onMobile:window.matchMedia('(max-width:800px)').matches
};
let app,cam,world,car,device,trainAudio=0,previousTs=0;
const radians=180/Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrappedAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const timeText=seconds=>{
  const min=Math.floor(seconds/60),sec=Math.floor(seconds%60);
  return String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0')+'.'+
    String(Math.floor((seconds%1)*100)).padStart(2,'0');
};
const sections=[
  {name:'Main Street',at:0},
  {name:'Hill Switchbacks',at:.20},
  {name:'High Ridge',at:.39},
  {name:'Depot Crossing',at:.61},
  {name:'Residential Bend',at:.80},
  {name:'Main Street Return',at:.94}
];
const targets=[.18,.40,.64,.86];
function section(s){
  const u=s/world.road.length;
  let current=sections[0].name;
  for(const item of sections)if(u>=item.at)current=item.name;
  return current;
}
function makeCar(){
  const node=new pc.Entity('Playable lacquered diecast miniature race car');
  app.root.addChild(node);
  const m=world.materials;
  function box(name,mat,x,y,z,w,h,d){
    const ent=new pc.Entity(name);
    ent.addComponent('render',{type:'box',material:mat});
    ent.setLocalPosition(x,y,z);ent.setLocalScale(w,h,d);
    ent.render.castShadows=true;ent.render.receiveShadows=true;
    node.addChild(ent);return ent;
  }
  box('Diecast metal race body',m.carPaint,0,.67,0,2.35,.88,4.15);
  box('Painted sloped toy roof',m.carPaint,0,1.21,-.22,2.05,.49,2.13);
  box('Smoked plastic toy windshield',m.glass,0,1.19,1.01,1.82,.36,.13);
  box('Rear tinted window',m.glass,0,1.19,-1.40,1.78,.31,.11);
  box('Front miniature bumper',m.cream,0,.44,2.10,2.47,.22,.25);
  box('Rear miniature bumper',m.cream,0,.45,-2.12,2.47,.22,.22);
  box('Chrome front radiator insert',m.cream,0,.73,2.18,1.10,.30,.08);
  for(const side of [-1,1]){
    for(const z of [-1.27,1.23]){
      const wheel=new pc.Entity('Black rubber model car tire');
      wheel.addComponent('render',{type:'cylinder',material:m.black});
      wheel.setLocalPosition(side*1.24,.36,z);
      wheel.setLocalEulerAngles(0,0,90);
      wheel.setLocalScale(.86,.32,.86);
      node.addChild(wheel);
      const hub=new pc.Entity('Small plastic wheel cap');
      hub.addComponent('render',{type:'cylinder',material:m.cream});
      hub.setLocalPosition(side*1.43,.36,z);
      hub.setLocalEulerAngles(0,0,90);
      hub.setLocalScale(.41,.075,.41);
      node.addChild(hub);
    }
    box('Headlight lens',m.cream,side*.76,.66,2.21,.40,.18,.06);
    box('Rear light',m.carPaint,side*.78,.65,-2.19,.37,.20,.075);
  }
  return node;
}
function saveBest(seconds){
  const existing=state.best;
  if(!existing||seconds<existing){
    state.best=seconds;
    try{localStorage.setItem('garage-gauntlet-maple-junction-best',String(seconds));}
    catch(error){console.info('Private storage unavailable, keeping session best');}
    return true;
  }
  return false;
}
function resetRace(){
  state.time=0;state.lap=1;state.elapsedLap=0;state.lapStart=0;
  state.speed=0;state.s=0;state.lastS=0;state.boostHeat=0;
  state.brushes=0;state.checkpoint=0;
  const origin=world.road.pointAt(1.75);
  state.position.x=origin.x;state.position.z=origin.z;
  state.yaw=Math.atan2(origin.tx,origin.tz);
  car.setLocalPosition(origin.x,origin.y+.51,origin.z);
  car.setLocalEulerAngles(0,state.yaw*radians,0);
  state.mode='ready';
  ui.result.hidden=true;
  ui.progress.style.width='0%';
  updateHud();
}
function updateHud(){
  ui.lap.textContent=Math.min(state.lap,state.laps)+' / '+state.laps;
  ui.time.textContent=timeText(state.time);
  ui.best.textContent=state.best?timeText(state.best):'--:--.--';
  ui.speed.textContent=Math.round(state.speed*4.0);
  ui.sector.textContent=section(state.s);
  ui.progress.style.width=(100*clamp(state.s/world.road.length,0,1)).toFixed(1)+'%';
  ui.brake.textContent=state.brushes?'CURB TOUCHES '+state.brushes:'CLEAN LINE';
  document.body.dataset.mapleLap=String(state.lap);
  document.body.dataset.mapleRaceState=state.mode;
  document.body.dataset.mapleProgress=state.s.toFixed(2);
  document.body.dataset.mapleSpeed=state.speed.toFixed(2);
}
function notice(message){
  ui.msg.textContent=message;
  ui.msg.classList.add('active');
  state.noticeUntil=state.time+2.3;
}
function finish(){
  state.mode='finished';
  const isBest=saveBest(state.time);
  ui.finishing.textContent=timeText(state.time);
  ui.finishBest.textContent=timeText(state.best);
  document.querySelector('#finish-title').textContent=
    isBest?'NEW MAPLE JUNCTION RECORD!':'MAPLE JUNCTION COMPLETED';
  ui.result.hidden=false;
  ui.intro.hidden=true;
  ui.msg.classList.remove('active');
  updateHud();
}
function lapGate(last,now){
  const length=world.road.length;
  const u=now/length;
  if(state.checkpoint<targets.length&&u>=targets[state.checkpoint]&&
     last/length<targets[state.checkpoint]){
    state.checkpoint++;
    if(state.checkpoint===targets.length)notice('CHECKPOINTS CLEAR · HEAD TO MAIN STREET');
  }
  // A valid completed lap crosses the start line in forward order,
  // after all four intermediate waypoint gates have been visited.
  if(last>length*.91&&now<length*.08&&state.checkpoint===targets.length){
    state.lap++;
    state.checkpoint=0;
    if(state.lap>state.laps){finish();return;}
    notice('LAP '+state.lap+' / '+state.laps+' · KEEP GOING');
    state.lapStart=state.time;
  }
}
function updatePhysics(dt){
  if(state.mode!=='racing')return;
  const last=state.s;
  const steer=Number(controls.right)-Number(controls.left);
  const braking=controls.brake;
  const gas=controls.gas;
  const assist=world.road.nearest(state.position.x,state.position.z);
  const aiming=world.road.pointAt(assist.s+Math.max(5.5,state.speed*.40));
  const goal=Math.atan2(aiming.x-state.position.x,aiming.z-state.position.z);
  const error=wrappedAngle(goal-state.yaw);
  const throttle=gas?1.24:1;
  const boosted=controls.boost&&state.boostHeat<1;
  const target=(braking?5.2:boosted?29:23)*throttle;
  const acceleration=braking?25:8;
  state.speed+=(target-state.speed)*Math.min(1,acceleration*dt/Math.max(3,target));
  if(boosted)state.boostHeat=Math.min(1,state.boostHeat+dt*.28);
  else state.boostHeat=Math.max(0,state.boostHeat-dt*.17);
  // Always-on low-level steering assistance keeps this a readable
  // beginner's course, while steering buttons change the chosen line.
  state.yaw+=clamp(error,-1.85,1.85)*dt*(steer?.64:1.22);
  state.yaw+=steer*dt*(1.35+state.speed*.009);
  state.position.x+=Math.sin(state.yaw)*state.speed*dt;
  state.position.z+=Math.cos(state.yaw)*state.speed*dt;
  const nearest=world.road.nearest(state.position.x,state.position.z);
  if(nearest.dist>5.30){
    state.speed=Math.min(state.speed,13);
    // Driveable curbs, but no disappearing through model houses.
    const excess=nearest.dist-5.3;
    const dx=state.position.x-nearest.x,dz=state.position.z-nearest.z;
    const distance=Math.hypot(dx,dz)||1;
    const correction=Math.min(1,excess/3+.4);
    state.position.x-=dx/distance*excess*correction;
    state.position.z-=dz/distance*excess*correction;
    if(!state.inCurb){state.brushes++;notice('CURB BRUSH · SLOW DOWN');}
    state.inCurb=true;
  }else if(nearest.dist<4.4)state.inCurb=false;
  if(Math.abs(state.position.x)>98||Math.abs(state.position.z)>48){
    const p=world.road.pointAt(assist.s);
    state.position.x=p.x;state.position.z=p.z;state.speed=0;
    state.yaw=Math.atan2(p.tx,p.tz);
    notice('BACK ON THE TABLE');
  }
  state.s=nearest.s;
  lapGate(last,state.s);
  car.setLocalPosition(state.position.x,groundHeight(state.position.x,state.position.z)+.51,
    state.position.z);
  car.setLocalEulerAngles(0,state.yaw*radians,0);
  world.animatePlayerWheels?.(dt,state.speed);
  state.time+=dt;
  state.elapsedLap=state.time-state.lapStart;
  if(state.noticeUntil&&state.time>state.noticeUntil)ui.msg.classList.remove('active');
  updateHud();
}
const pcam=new pc.Vec3();
const plook=new pc.Vec3();
function updateCamera(dt,hard=false){
  const phone=window.innerWidth<800;
  const p=state.position;
  if(state.camera==='overview'||state.mode==='intro'){
    const pos=phone?[130,127,0]:[100,135,130];
    const target=phone?[0,1.8,0]:[0,1.7,0];
    cam.setLocalPosition(...pos);cam.lookAt(...target);
  }else{
    const forwardX=Math.sin(state.yaw),forwardZ=Math.cos(state.yaw);
    const height=groundHeight(p.x,p.z);
    // The scale-correct RC truck is shorter than the old large coupe.
    // Bring the chase camera in just enough to keep it legible on phones.
    const follow=phone?15.6:13.7,eye=phone?14.1:13.0;
    pcam.set(p.x-forwardX*follow,height+eye,p.z-forwardZ*follow);
    plook.set(p.x+forwardX*(phone?10:12),height+1.6,
      p.z+forwardZ*(phone?10:12));
    if(hard){cam.setLocalPosition(pcam);}
    else{
      const alpha=1-Math.exp(-Math.max(.001,dt)*6);
      cam.setLocalPosition(
        cam.getLocalPosition().x+(pcam.x-cam.getLocalPosition().x)*alpha,
        cam.getLocalPosition().y+(pcam.y-cam.getLocalPosition().y)*alpha,
        cam.getLocalPosition().z+(pcam.z-cam.getLocalPosition().z)*alpha
      );
    }
    cam.lookAt(plook);
  }
  document.body.dataset.mapleCamera=state.camera;
}
function resize(){
  app.resizeCanvas();
  state.onMobile=window.innerWidth<800;
  updateCamera(0,true);
}
function drawMinimap(){
  const ctx=ui.map.getContext('2d');
  if(!ctx)return;
  const w=ui.map.width,h=ui.map.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(242,237,219,.94)';ctx.fillRect(0,0,w,h);
  const mapX=x=>15+(x+100)*((w-30)/200);
  const mapZ=z=>11+(z+50)*((h-22)/100);
  ctx.strokeStyle='#9b7955';ctx.lineWidth=3;ctx.strokeRect(4,4,w-8,h-8);
  ctx.strokeStyle='#c2a477';ctx.lineWidth=1.6;
  ctx.beginPath();
  for(let i=0;i<=120;i++){
    const t=2*Math.PI*i/120,x=86*Math.cos(t),z=39*Math.sin(t);
    if(i===0)ctx.moveTo(mapX(x),mapZ(z));else ctx.lineTo(mapX(x),mapZ(z));
  }
  ctx.stroke();
  ctx.beginPath();ctx.strokeStyle='#4b5f5b';ctx.lineWidth=5;
  world.road.samples.forEach((p,i)=>{
    if(i===0)ctx.moveTo(mapX(p.x),mapZ(p.z));
    else ctx.lineTo(mapX(p.x),mapZ(p.z));
  });
  ctx.closePath();ctx.stroke();
  const s=world.road.pointAt(0);
  ctx.beginPath();ctx.arc(mapX(s.x),mapZ(s.z),3,0,Math.PI*2);
  ctx.fillStyle='#e5ba6e';ctx.fill();
  const carX=mapX(state.position.x),carY=mapZ(state.position.z);
  ctx.fillStyle='#ba4c3b';ctx.beginPath();ctx.arc(carX,carY,4.4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.stroke();
}
function bindButton(selector,key){
  const button=document.querySelector(selector);
  if(!button)return;
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();controls[key]=true;
    document.body.dataset.mapleLastTouch=key;
    button.setPointerCapture(event.pointerId);
    button.classList.add('held');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
    button.addEventListener(event,()=>{
      controls[key]=false;button.classList.remove('held');
    });
  }
}
function installInput(){
  for(const [selector,key] of [
    ['#left','left'],['#right','right'],
    ['#brake','brake'],['#boost','boost']
  ])bindButton(selector,key);
  window.addEventListener('keydown',event=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))
      event.preventDefault();
    const k=event.key.toLowerCase();
    if(k==='arrowleft'||k==='a')controls.left=true;
    if(k==='arrowright'||k==='d')controls.right=true;
    if(k==='arrowdown'||k==='s')controls.brake=true;
    if(k==='arrowup'||k==='w')controls.gas=true;
    if(event.code==='Space')controls.boost=true;
    if(k==='v'&&state.mode!=='intro')toggleCamera();
    if(k==='r')start();
    if(k==='escape'&&state.mode==='racing')togglePause();
  });
  window.addEventListener('keyup',event=>{
    const k=event.key.toLowerCase();
    if(k==='arrowleft'||k==='a')controls.left=false;
    if(k==='arrowright'||k==='d')controls.right=false;
    if(k==='arrowdown'||k==='s')controls.brake=false;
    if(k==='arrowup'||k==='w')controls.gas=false;
    if(event.code==='Space')controls.boost=false;
  });
  window.addEventListener('blur',()=>Object.keys(controls).forEach(k=>controls[k]=false));
  ui.start.addEventListener('click',start);
  ui.again.addEventListener('click',start);
  ui.restart.addEventListener('click',start);
  ui.camera.addEventListener('click',toggleCamera);
  document.querySelector('#pause').addEventListener('click',togglePause);
  document.querySelector('#resume').addEventListener('click',()=>togglePause());
  ui.spec.addEventListener('input',event=>{
    world.applySpecular(Number(event.target.value));
  });
}
function toggleCamera(){
  state.camera=state.camera==='overview'?'chase':'overview';
  ui.camera.textContent=state.camera==='overview'?'FOLLOW':'TABLE';
  updateCamera(0,true);
}
function togglePause(){
  if(state.mode==='racing'){
    state.mode='paused';
    document.querySelector('#pause-overlay').hidden=false;
  }else if(state.mode==='paused'){
    state.mode='racing';
    document.querySelector('#pause-overlay').hidden=true;
  }
  updateHud();
}
function start(){
  resetRace();
  ui.intro.hidden=true;ui.result.hidden=true;
  document.querySelector('#pause-overlay').hidden=true;
  state.camera='chase';
  ui.camera.textContent='TABLE';
  state.mode='racing';
  updateCamera(0,true);
  notice('MAPLE JUNCTION · 3 LAPS · WATCH THE TRAIN');
  updateHud();
}
function setupStudio(){
  const color=hex=>new pc.Color(
    parseInt(hex.slice(1,3),16)/255,
    parseInt(hex.slice(3,5),16)/255,
    parseInt(hex.slice(5,7),16)/255
  );
  app.scene.ambientLight=color('#78847b');
  app.scene.exposure=.84;
  const key=new pc.Entity('Warm tabletop softbox key light');
  key.addComponent('light',{
    type:'directional',color:color('#fff1dc'),
    intensity:1.38,castShadows:true,shadowResolution:2048,shadowDistance:200
  });
  key.setEulerAngles(56,-45,0);app.root.addChild(key);
  const fill=new pc.Entity('Soft cool miniature photographic fill');
  fill.addComponent('light',{
    type:'directional',color:color('#dcece7'),intensity:.34,castShadows:false
  });
  fill.setEulerAngles(35,135,0);app.root.addChild(fill);
  const rim=new pc.Entity('Specular edge card');
  rim.addComponent('light',{
    type:'directional',color:color('#f0eee0'),intensity:.52,
    affectSpecularity:true,castShadows:false
  });
  rim.setEulerAngles(30,-20,0);app.root.addChild(rim);
  // Prefiltered equirect studio reflection cards match the verified
  // miniature-specular benchmark, without relying on downloaded assets.
  const panel=document.createElement('canvas');
  panel.width=512;panel.height=256;
  const ctx=panel.getContext('2d',{alpha:false});
  const back=ctx.createLinearGradient(0,0,0,256);
  back.addColorStop(0,'#cdd7d6');back.addColorStop(.45,'#a2aca8');
  back.addColorStop(1,'#817969');
  ctx.fillStyle=back;ctx.fillRect(0,0,512,256);
  ctx.fillStyle='#f9f3e5';ctx.fillRect(40,37,121,90);
  ctx.fillStyle='#e7eff1';ctx.fillRect(345,67,72,110);
  let reflections='fallback';
  try{
    const t=new pc.Texture(device,{
      width:512,height:256,format:pc.PIXELFORMAT_RGBA8,
      projection:pc.TEXTUREPROJECTION_EQUIRECT,mipmaps:false
    });
    t.setSource(panel);
    const source=pc.EnvLighting.generateLightingSource(t);
    app.scene.envAtlas=pc.EnvLighting.generateAtlas(source);
    source.destroy();t.destroy();reflections='prefiltered-physical-softboxes';
  }catch(error){console.warn('Fallback to direct light:',error);}
  document.body.dataset.mapleReflections=reflections;
}
async function main(){
  device=await pc.createGraphicsDevice(canvas,{
    deviceTypes:[pc.DEVICETYPE_WEBGL2],antialias:true
  });
  const opts=new pc.AppOptions();
  opts.graphicsDevice=device;
  opts.componentSystems=[
    pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem
  ];
  opts.resourceHandlers=[pc.TextureHandler,pc.ContainerHandler];
  app=new pc.AppBase(canvas);
  app.init(opts);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio=Math.min(window.devicePixelRatio||1,1.65);
  cam=new pc.Entity('Photographic HO miniature camera');
  cam.addComponent('camera',{
    nearClip:.25,farClip:600,fov:state.onMobile?54:52,
    clearColor:new pc.Color(.64,.69,.68)
  });
  cam.camera.toneMapping=pc.TONEMAP_NEUTRAL;app.root.addChild(cam);
  setupStudio();
  world=buildMapleWorld(app,device,{specular:Number(ui.spec.value)});
  car=makeCar();
  resetRace();
  state.camera='overview';
  state.mode='intro';
  try{const v=Number(localStorage.getItem('garage-gauntlet-maple-junction-best'));
    if(v>0&&Number.isFinite(v))state.best=v;
  }catch(error){/* local best remains optional */}
  updateHud();
  installInput();
  resize();
  window.addEventListener('resize',resize);
  let renderedFrames=0;
  app.on('update',dt=>{
    try{
      renderedFrames++;
      document.body.dataset.mapleFrameCount=String(renderedFrames);
      const step=Math.min(dt||1/60,.045);
      world.updateTrain(step);
      updatePhysics(step);
      updateCamera(step);
      if(Math.floor(state.time*10)%2===0)drawMinimap();
    }catch(error){
      document.body.dataset.mapleFrameError=String(error.stack||error).slice(0,1000);
      throw error;
    }
  });
  app.start();
  // Install four verified GLB sources; share their meshes across the town.
  // On any asset failure the existing driveable procedural world survives.
  loadAuthoredMapleAssets(app,world,car).then(result=>{
    console.info('Authored Maple Junction PBR mesh imports:',result);
  }).catch(error=>{
    console.warn('Maintaining legacy scene after mesh import failure',error);
    document.body.dataset.mapleAuthoredAssets='fallbacks-active';
  });
  // Secondary CC0 buildings and vegetation enrich the rest of the table.
  // Missing optional imports must never stop the authored race or its HUD.
  loadImportedMapleTown(app,world,car).then(result=>{
    console.info('Imported CC0 miniature town assets:',result);
  }).catch(error=>{
    console.warn('Keeping the original town if downloaded scenery fails',error);
    document.body.dataset.mapleImportedAssets='fallbacks-active';
    document.body.dataset.mapleImportedError=String(error);
  });
  ui.status.hidden=true;
  document.body.dataset.mapleGameReady='true';
  document.body.dataset.mapleEngine='PlayCanvas-2.23.3';
  document.body.dataset.mapleCourse='Maple Junction Loop';
  document.body.dataset.mapleLaps='3';
  document.body.dataset.mapleTrainAnimated='true';
  document.body.dataset.mapleMobileControls='left-right-brake-boost';
}
main().catch(error=>{
  console.error('Maple Junction failed to start',error);
  ui.status.textContent='The miniature town could not start: '+(error.message||error);
  document.body.dataset.mapleGameReady='error';
  document.body.dataset.mapleError=String(error.stack||error).slice(0,1500);
});
