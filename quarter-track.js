import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import {makeRCTrophyTruck} from './truck-model.js';
import {COURSE_PRESETS,getCourse} from './course-presets.js';
import {buildCourseLoop} from './track-layouts.js';
import {createMiniatureWorld} from './miniature-world.js';

const $=id=>document.getElementById(id);
const ui={
  viewport:$('viewport'),loading:$('loading'),intro:$('intro'),results:$('results'),
  pauseOverlay:$('pause-overlay'),start:$('start'),pause:$('pause'),resume:$('resume'),
  retry:$('retry'),restart:$('restart'),exit:$('exit'),camera:$('camera'),
  focusToggle:$('focus-toggle'),
  marker:$('marker'),flash:$('flash'),speed:$('speed'),time:$('time'),
  place:$('place'),sector:$('sector'),lap:$('lap'),
  heat:$('heat'),heatLabel:$('heat-label'),
  progress:$('progress-fill'),map:$('map'),resultTime:$('result-time'),
  resultPlace:$('result-place'),resultSplit:$('result-split'),
  resultLap2:$('result-lap2'),resultBest:$('result-best')
};
const mobile=matchMedia('(pointer:coarse)').matches;
// Connected centerline definition. Each section starts tangent to the
// previous one, avoiding discontinuities at the quarter-track handoff.
const REQUESTED_COURSE=typeof window==='undefined'?null:
  new URLSearchParams(window.location.search).get('course');
const COURSE=getCourse(REQUESTED_COURSE);
const CUSTOM_TRACK=buildCourseLoop(COURSE.id);
// Closure is analytic, not dependent on arbitrary corrective road segments.
// The two long return straights are solved from the signed 90° arc offsets.
const R=COURSE.r1,STRAIGHT=COURSE.start,TURN=R*Math.PI*.5,EXIT=COURSE.exit1;
const SECTOR_1_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.24:STRAIGHT+TURN+EXIT;
const SECTOR_2_STRAIGHT=COURSE.s2Straight;
const SECTOR_2_LEFT_RADIUS=COURSE.r2Left;
const SECTOR_2_LEFT_LENGTH=SECTOR_2_LEFT_RADIUS*Math.PI*.5;
const SECTOR_2_NORTH=COURSE.s2North;
const SECTOR_2_RIGHT_RADIUS=COURSE.r2Right;
const SECTOR_2_RIGHT_LENGTH=SECTOR_2_RIGHT_RADIUS*Math.PI*.5;
const SECTOR_2_EXIT=COURSE.s2Exit;
const SECTOR_2_LEFT_START=CUSTOM_TRACK?CUSTOM_TRACK.length*.30:SECTOR_1_END+SECTOR_2_STRAIGHT;
const SECTOR_2_LEFT_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.39:SECTOR_2_LEFT_START+SECTOR_2_LEFT_LENGTH;
const SECTOR_2_RIGHT_START=CUSTOM_TRACK?CUSTOM_TRACK.length*.41:SECTOR_2_LEFT_END+SECTOR_2_NORTH;
const SECTOR_2_RIGHT_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.46:SECTOR_2_RIGHT_START+SECTOR_2_RIGHT_LENGTH;
const SECTOR_2_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.49:SECTOR_2_RIGHT_END+SECTOR_2_EXIT;
const SECTOR_3_EAST=COURSE.s3East;
const SECTOR_3_RIGHT_RADIUS=COURSE.r3Right;
const SECTOR_3_RIGHT_LENGTH=Math.PI*.5*SECTOR_3_RIGHT_RADIUS;
const SECTOR_3_HAIRPIN_RADIUS=COURSE.r3Hairpin;
const SECTOR_3_HAIRPIN_LENGTH=Math.PI*.5*SECTOR_3_HAIRPIN_RADIUS;
const SECTOR_4_RETURN_RADIUS=COURSE.r4Return;
const SECTOR_4_RETURN_LENGTH=Math.PI*.5*SECTOR_4_RETURN_RADIUS;
const SECTOR_4_NORTH=COURSE.s4North;
const SECTOR_3_SOUTH=STRAIGHT+R+SECTOR_2_LEFT_RADIUS+SECTOR_2_NORTH+
  SECTOR_2_RIGHT_RADIUS-SECTOR_3_RIGHT_RADIUS-SECTOR_3_HAIRPIN_RADIUS+
  SECTOR_4_RETURN_RADIUS+SECTOR_4_NORTH;
const SECTOR_4_WEST=R+EXIT+SECTOR_2_STRAIGHT+SECTOR_2_LEFT_RADIUS+
  SECTOR_2_RIGHT_RADIUS+SECTOR_2_EXIT+SECTOR_3_EAST+
  SECTOR_3_RIGHT_RADIUS-SECTOR_3_HAIRPIN_RADIUS-SECTOR_4_RETURN_RADIUS;
const SECTOR_3_EAST_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.54:SECTOR_2_END+SECTOR_3_EAST;
const SECTOR_3_RIGHT_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.59:SECTOR_3_EAST_END+SECTOR_3_RIGHT_LENGTH;
const SECTOR_3_SOUTH_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.69:SECTOR_3_RIGHT_END+SECTOR_3_SOUTH;
const SECTOR_3_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.75:SECTOR_3_SOUTH_END+SECTOR_3_HAIRPIN_LENGTH;
const SECTOR_4_WEST_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.89:SECTOR_3_END+SECTOR_4_WEST;
const SECTOR_4_RETURN_END=CUSTOM_TRACK?CUSTOM_TRACK.length*.94:SECTOR_4_WEST_END+SECTOR_4_RETURN_LENGTH;
const END=CUSTOM_TRACK?CUSTOM_TRACK.length:SECTOR_4_RETURN_END+SECTOR_4_NORTH;
const LAPS=COURSE.laps;
const SEGMENT_LAYOUT=[
  {kind:'straight',length:STRAIGHT},
  {kind:'turn',length:TURN,radius:R,sign:1},
  {kind:'straight',length:EXIT},
  {kind:'straight',length:SECTOR_2_STRAIGHT},
  {kind:'turn',length:SECTOR_2_LEFT_LENGTH,radius:SECTOR_2_LEFT_RADIUS,sign:-1},
  {kind:'straight',length:SECTOR_2_NORTH},
  {kind:'turn',length:SECTOR_2_RIGHT_LENGTH,radius:SECTOR_2_RIGHT_RADIUS,sign:1},
  {kind:'straight',length:SECTOR_2_EXIT},
  {kind:'straight',length:SECTOR_3_EAST},
  {kind:'turn',length:SECTOR_3_RIGHT_LENGTH,radius:SECTOR_3_RIGHT_RADIUS,sign:1},
  {kind:'straight',length:SECTOR_3_SOUTH},
  {kind:'turn',length:SECTOR_3_HAIRPIN_LENGTH,radius:SECTOR_3_HAIRPIN_RADIUS,sign:1},
  {kind:'straight',length:SECTOR_4_WEST},
  {kind:'turn',length:SECTOR_4_RETURN_LENGTH,radius:SECTOR_4_RETURN_RADIUS,sign:1},
  {kind:'straight',length:SECTOR_4_NORTH}
];
function pathLayout(){
  let x=0,z=0,angle=0,s=0;
  for(const seg of SEGMENT_LAYOUT){
    seg.startS=s;seg.x=x;seg.z=z;seg.angle=angle;
    const turnRate=seg.kind==='turn'?seg.sign/seg.radius:0;
    if(turnRate===0){
      x+=Math.sin(angle)*seg.length;
      z+=Math.cos(angle)*seg.length;
    }else{
      const finish=angle+seg.length*turnRate;
      x+=(Math.cos(angle)-Math.cos(finish))/turnRate;
      z+=(Math.sin(finish)-Math.sin(angle))/turnRate;
      angle=finish;
    }
    s+=seg.length;
  }
}
if(!CUSTOM_TRACK)pathLayout();
// Double the previous race speed consistently for player and rivals.
// All values are world-units/second; the speedometer is arcade-scaled.
const RACE_SPEED_MULTIPLIER=2;
const HALF=9.1,CRUISE_SPEED=15.4*RACE_SPEED_MULTIPLIER;
const MAX_SPEED=21.6*RACE_SPEED_MULTIPLIER,GRAVITY=19.5;
const STARTLINE=19,FINAL_GATE=END-3;
const ramps=[
  {start:COURSE.id==='backyard'?58:STRAIGHT*.68,
    end:COURSE.id==='backyard'?72:STRAIGHT*.83,
    height:2.15*COURSE.rampScale,
    name:COURSE.id==='backyard'?'Backyard Launch':COURSE.id==='creek'?'Creek Hop':COURSE.id==='garage'?'Toolbox Takeoff':'Quarry Kick'},
  {start:SECTOR_2_LEFT_END+7,end:SECTOR_2_LEFT_END+20,height:2.6*COURSE.rampScale,
    name:COURSE.id==='creek'?'Stream Leap':COURSE.id==='garage'?'Ramp Alley':'Garden Leap'},
  {start:SECTOR_3_RIGHT_END+Math.min(76,SECTOR_3_SOUTH*.29),
    end:SECTOR_3_RIGHT_END+Math.min(92,SECTOR_3_SOUTH*.37),
    height:3.0*COURSE.rampScale,name:COURSE.id==='quarry'?'Mega Quarry Air':'Canyon Launcher'},
  {start:SECTOR_3_END+SECTOR_4_WEST*.48,
    end:SECTOR_3_END+SECTOR_4_WEST*.54,
    height:2.3*COURSE.rampScale,name:'Final Flyer'}
];
const rollers=[
  {start:25,end:35,height:.44},{start:40,end:51,height:.55},
  {start:213,end:224,height:.42},{start:234,end:244,height:.58},
  {start:SECTOR_1_END+7,end:SECTOR_1_END+17,height:.42},
  {start:SECTOR_2_LEFT_END-23,end:SECTOR_2_LEFT_END-13,height:.47},
  {start:SECTOR_2_RIGHT_END+10,end:SECTOR_2_RIGHT_END+22,height:.58},
  {start:SECTOR_3_RIGHT_END+35,end:SECTOR_3_RIGHT_END+46,height:.48},
  {start:SECTOR_3_RIGHT_END+57,end:SECTOR_3_RIGHT_END+70,height:.64},
  {start:SECTOR_3_SOUTH_END-30,end:SECTOR_3_SOUTH_END-16,height:.46},
  {start:SECTOR_3_END+48,end:SECTOR_3_END+59,height:.50},
  {start:SECTOR_4_WEST_END-54,end:SECTOR_4_WEST_END-41,height:.66},
  {start:SECTOR_4_RETURN_END+10,end:SECTOR_4_RETURN_END+21,height:.44}
];
const controls={left:false,right:false,accel:false,brake:false,boost:false,leanBack:false,leanForward:false};
const game={mode:'intro',time:0,countdown:3.4,camera:'follow',toastUntil:0,shake:0,muted:false,split1:null,split2:null,split3:null,lap:1,lapSplits:[],lapStartTime:0,nextCheckpoint:0,checkpoints:[],bestLap:null};
const player={
  mesh:null,x:0,y:0,z:0,s:7,d:-3.35,heading:0,speed:0,
  vy:0,grounded:true,airtime:0,pitch:0,roll:0,
  heat:0,overheated:false,collisionCooldown:0,launchConsumed:false
};
let renderer,scene,camera,sun;
let miniatureFocusEnabled=!(typeof matchMedia==='function'&&
  matchMedia('(prefers-reduced-transparency: reduce)').matches);
function setMiniatureFocus(on){
  miniatureFocusEnabled=Boolean(on);
  const lens=document.getElementById('tiltshift');
  if(lens)lens.dataset.effect=miniatureFocusEnabled?'on':'off';
  if(ui.focusToggle){
    ui.focusToggle.textContent='TILT-SHIFT FOCUS: '+
      (miniatureFocusEnabled?'ON':'OFF');
    ui.focusToggle.setAttribute('aria-pressed',
      String(miniatureFocusEnabled));
  }
}
let ai=[];
let shadow;
const rivalShadows=[];
let worldClock=0,lastFrame=performance.now();
const particles=[],cones=[];
let audioCtx=null;
let audioOsc=null;
let audioGain=null;

const mats={
  asphalt:new THREE.MeshStandardMaterial({color:'#777975',roughness:.96,side:THREE.DoubleSide}),
  shoulder:new THREE.MeshStandardMaterial({color:'#766b50',roughness:1,side:THREE.DoubleSide}),
  curbYellow:new THREE.MeshStandardMaterial({color:'#e9bf47',roughness:.8}),
  curbBlack:new THREE.MeshStandardMaterial({color:'#353b35',roughness:.9}),
  curbWhite:new THREE.MeshStandardMaterial({color:'#eee9d8',roughness:.88}),
  grass:new THREE.MeshStandardMaterial({color:'#5f8b51',roughness:1}),
  darkGrass:new THREE.MeshStandardMaterial({color:'#3e7a4a',roughness:1}),
  leaves:new THREE.MeshStandardMaterial({color:'#3e7250',roughness:1}),
  leavesLight:new THREE.MeshStandardMaterial({color:'#568d52',roughness:1}),
  trunk:new THREE.MeshStandardMaterial({color:'#6f6550',roughness:1}),
  rail:new THREE.MeshStandardMaterial({color:'#c7c0a2',roughness:.42,metalness:.35}),
  black:new THREE.MeshStandardMaterial({color:'#303634',roughness:.9}),
  cone:new THREE.MeshStandardMaterial({color:'#ee8549',roughness:.65}),
  white:new THREE.MeshStandardMaterial({color:'#f9efde',roughness:.85}),
  sign:new THREE.MeshStandardMaterial({color:'#213e43',roughness:.75}),
  steel:new THREE.MeshStandardMaterial({color:'#b9c5be',metalness:.55,roughness:.4})
};
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function ease(a,b,v){const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);}
function rnd(seed){let a=Math.sin(seed*171.17+31.11)*28473.17;return a-Math.floor(a);}
function modAngle(v){return Math.atan2(Math.sin(v),Math.cos(v));}
function timeString(t){
  const n=Math.max(0,Math.floor(t*100));
  return String(Math.floor(n/6000)).padStart(2,'0')+':'+String(Math.floor(n/100)%60).padStart(2,'0')+'.'+String(n%100).padStart(2,'0');
}
function makeBox(parent,material,x,y,z,w,h,d){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  mesh.castShadow=!mobile;mesh.receiveShadow=!mobile;
  parent.add(mesh);return mesh;
}
function tube(points,radius,material){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*2),radius,5,false),material);
  mesh.castShadow=!mobile;scene.add(mesh);return mesh;
}
function surfaceHeight(s,d=0){
  let h=.30;
  for(const b of rollers){
    if(s>=b.start&&s<=b.end)h+=Math.sin(Math.PI*(s-b.start)/(b.end-b.start))*b.height*COURSE.roughness;
  }
  for(const jump of ramps){
    if(s>=jump.start&&s<jump.end){
      h+=jump.height*ease(jump.start,jump.end,s);
    }
  }
  // Direction-aware banking for authored turns follows the actual curve
  // tangent rather than assuming every course has the same six corners.
  if(CUSTOM_TRACK){
    const before=CUSTOM_TRACK.point(Math.max(0,s-3)).angle;
    const after=CUSTOM_TRACK.point(Math.min(END,s+3)).angle;
    const curvature=modAngle(after-before)/6;
    return h-d*clamp(curvature*6,-.085,.085);
  }
  // Original banked racing arcs.
  for(const curve of [
    {from:STRAIGHT,to:STRAIGHT+TURN,sign:1},
    {from:SECTOR_2_LEFT_START,to:SECTOR_2_LEFT_END,sign:-1},
    {from:SECTOR_2_RIGHT_START,to:SECTOR_2_RIGHT_END,sign:1},
    {from:SECTOR_3_EAST_END,to:SECTOR_3_RIGHT_END,sign:1},
    {from:SECTOR_3_SOUTH_END,to:SECTOR_3_END,sign:1},
    {from:SECTOR_4_WEST_END,to:SECTOR_4_RETURN_END,sign:1}
  ]){
    if(s>=curve.from&&s<=curve.to){
      const t=(s-curve.from)/(curve.to-curve.from);
      h-=curve.sign*d*Math.pow(Math.sin(t*Math.PI),1.35)*.078;
    }
  }
  return h;
}
function point(s){
  if(CUSTOM_TRACK)return CUSTOM_TRACK.point(s);
  const distance=clamp(s,0,END);
  for(let i=0;i<SEGMENT_LAYOUT.length;i++){
    const segment=SEGMENT_LAYOUT[i];
    if(distance<=segment.startS+segment.length||i===SEGMENT_LAYOUT.length-1){
      const u=clamp(distance-segment.startS,0,segment.length);
      if(segment.kind==='straight'){
        return {
          x:segment.x+Math.sin(segment.angle)*u,
          z:segment.z+Math.cos(segment.angle)*u,
          angle:segment.angle
        };
      }
      const k=segment.sign/segment.radius;
      const angle=segment.angle+k*u;
      return {
        x:segment.x+(Math.cos(segment.angle)-Math.cos(angle))/k,
        z:segment.z+(Math.sin(angle)-Math.sin(segment.angle))/k,
        angle
      };
    }
  }
  return {x:0,z:0,angle:0};
}
function position(s,d=0){
  const p=point(s);
  return {x:p.x+Math.cos(p.angle)*d,z:p.z-Math.sin(p.angle)*d,
    y:surfaceHeight(s,d),angle:p.angle};
}
function project(x,z,estimate){
  let bestS=clamp(estimate,0,END),best=Infinity;
  const min=Math.max(0,bestS-12),max=Math.min(END,bestS+16);
  for(let s=min;s<=max+.01;s+=1){
    const p=point(s),dx=x-p.x,dz=z-p.z,dist=dx*dx+dz*dz;
    if(dist<best){best=dist;bestS=s;}
  }
  let lo=Math.max(0,bestS-1.2),hi=Math.min(END,bestS+1.2);
  for(let j=0;j<8;j++){
    const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;
    const pa=point(a),pb=point(b);
    const da=(pa.x-x)**2+(pa.z-z)**2,db=(pb.x-x)**2+(pb.z-z)**2;
    if(da<db)hi=b;else lo=a;
  }
  const s=(lo+hi)/2,p=point(s);
  const lateral=(x-p.x)*Math.cos(p.angle)-(z-p.z)*Math.sin(p.angle);
  return {s,d:lateral,angle:p.angle};
}

function createSkyEnvironment(){
  // A lightweight, locally generated outdoor reflection source: cool sky,
  // warm sunlit horizon and leafy surroundings. Reflects in clearcoat and
  // windshield glass without downloading HDR imagery or adding render passes.
  const c=document.createElement('canvas');
  c.width=512;c.height=256;
  const ctx=c.getContext('2d');
  const upper=ctx.createLinearGradient(0,0,0,256);
  upper.addColorStop(0,'#6594a9');
  upper.addColorStop(.32,'#abc6cd');
  upper.addColorStop(.49,'#ebdcc2');
  upper.addColorStop(.53,'#8d9c73');
  upper.addColorStop(1,'#414e39');
  ctx.fillStyle=upper;
  ctx.fillRect(0,0,512,256);
  const sunlight=ctx.createRadialGradient(118,75,8,118,75,85);
  sunlight.addColorStop(0,'rgba(255,250,225,.95)');
  sunlight.addColorStop(.21,'rgba(255,239,203,.62)');
  sunlight.addColorStop(1,'rgba(255,233,198,0)');
  ctx.fillStyle=sunlight;
  ctx.fillRect(0,0,512,256);
  const env=new THREE.CanvasTexture(c);
  env.mapping=THREE.EquirectangularReflectionMapping;
  env.colorSpace=THREE.SRGBColorSpace;
  return env;
}
function createAsphaltTextures(){
  // Albedo and micro-normal are generated once. The colour is worn grey
  // aggregate, not uniform charcoal; tiny height variations catch sunlight.
  const size=512;
  const c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d');
  ctx.fillStyle=COURSE.road;
  ctx.fillRect(0,0,size,size);
  let seed=11775;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<65;i++){
    const x=random()*size,y=random()*size,r=13+random()*97;
    const stain=ctx.createRadialGradient(x,y,0,x,y,r);
    stain.addColorStop(0,random()>.5?'rgba(36,40,37,.13)':'rgba(204,201,178,.10)');
    stain.addColorStop(1,'rgba(100,102,95,0)');
    ctx.fillStyle=stain;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<23500;i++){
    const x=random()*size,y=random()*size,w=.35+random()*2.2;
    ctx.fillStyle=random()>.54?'#d8d1b9':'#242b28';
    ctx.globalAlpha=.052+random()*.18;
    ctx.fillRect(x,y,w,w*(.5+random()));
  }
  ctx.globalAlpha=1;
  // Irregular fine seams, edge scuffs and occasional faded tyre rubber.
  for(let i=0;i<11;i++){
    const x=random()*size,y=random()*size;
    ctx.globalAlpha=.09+random()*.055;
    ctx.strokeStyle='#303b37';ctx.lineWidth=.5+random()*.8;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.bezierCurveTo(x+8,y+3,x+15,y-5,x+25+random()*35,y+random()*12);
    ctx.stroke();
  }
  for(let i=0;i<7;i++){
    const x=random()*size,y=random()*size;
    ctx.globalAlpha=.04;
    ctx.strokeStyle='#282b2a';ctx.lineWidth=2+random()*2;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*6,y+35+random()*95);ctx.stroke();
  }
  ctx.globalAlpha=1;
  const color=new THREE.CanvasTexture(c);
  color.wrapS=color.wrapT=THREE.RepeatWrapping;
  color.repeat.set(1,1);
  color.anisotropy=4;
  color.colorSpace=THREE.SRGBColorSpace;

  // Subtle blue-channel-up tangent-space normal map from coarse pebble grain.
  // Only 256px, because deep surface detail should not cost mobile memory.
  const res=256,noise=new Float32Array(res*res);
  for(let y=0;y<res;y++)for(let x=0;x<res;x++){
    noise[y*res+x]=random()*.72+.15*Math.sin(x*.55)*Math.cos(y*.47);
  }
  const n=document.createElement('canvas');n.width=n.height=res;
  const nctx=n.getContext('2d');
  const im=nctx.createImageData(res,res);
  const sample=(x,y)=>noise[((y+res)%res)*res+((x+res)%res)];
  for(let y=0;y<res;y++)for(let x=0;x<res;x++){
    const dx=(sample(x-1,y)-sample(x+1,y))*.35;
    const dy=(sample(x,y-1)-sample(x,y+1))*.35;
    const inv=1/Math.sqrt(dx*dx+dy*dy+1);
    const k=(y*res+x)*4;
    im.data[k]=(dx*inv*.5+.5)*255;
    im.data[k+1]=(dy*inv*.5+.5)*255;
    im.data[k+2]=(inv*.5+.5)*255;
    im.data[k+3]=255;
  }
  nctx.putImageData(im,0,0);
  const normal=new THREE.CanvasTexture(n);
  normal.wrapS=normal.wrapT=THREE.RepeatWrapping;
  normal.repeat.set(1,1);
  normal.anisotropy=4;
  return {color,normal};
}
function createGrassTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');
  ctx.fillStyle=COURSE.ground;ctx.fillRect(0,0,256,256);
  let seed=9157;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<95;i++){
    const x=random()*256,y=random()*256,r=8+random()*48;
    const grad=ctx.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0,random()>.5?'rgba(40,78,44,.23)':'rgba(179,155,91,.20)');
    grad.addColorStop(1,'rgba(80,114,71,0)');
    ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<8500;i++){
    ctx.globalAlpha=.035+random()*.16;
    ctx.fillStyle=random()>.54?'#c5b376':'#244f33';
    const x=random()*256,y=random()*256;
    ctx.fillRect(x,y,1+random()*4,.6+random()*3);
  }
  ctx.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(19,19);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;return tex;
}

function createGravelTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');
  ctx.fillStyle=COURSE.shoulder;ctx.fillRect(0,0,256,256);
  let seed=443981;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<3400;i++){
    const x=random()*256,y=random()*256,r=.35+random()*3.6;
    ctx.fillStyle=random()>.62?'rgba(205,190,146,.34)':'rgba(68,70,60,.31)';
    ctx.beginPath();ctx.ellipse(x,y,r,r*.64,random()*6.28,0,Math.PI*2);ctx.fill();
  }
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=4;
  return t;
}
function makeDecalTexture(type){
  const c=document.createElement('canvas');
  c.width=128;c.height=512;
  const ctx=c.getContext('2d');
  let seed=type==='rubber'?3482:6872;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  ctx.clearRect(0,0,128,512);
  if(type==='paint'){
    ctx.fillStyle='rgba(236,229,202,.79)';
    ctx.fillRect(0,0,128,512);
    for(let i=0;i<650;i++){
      const x=random()*128,y=random()*512;
      const w=1+random()*13,h=2+random()*17;
      ctx.clearRect(x,y,w,h);
    }
    // Scraped side edges: weathered markings without visible repetition.
    for(let j=0;j<140;j++){
      const x=random()>.5?random()*22:111+random()*17;
      ctx.clearRect(x,random()*512,2+random()*16,2+random()*35);
    }
  }else{
    // Transparent black tyre rubber build-up, split into contact strips.
    for(const side of [-1,1]){
      const cx=64+side*27;
      const gradient=ctx.createLinearGradient(cx-24,0,cx+24,0);
      gradient.addColorStop(0,'rgba(17,20,18,0)');
      gradient.addColorStop(.35,'rgba(21,23,22,.30)');
      gradient.addColorStop(.5,'rgba(18,23,21,.39)');
      gradient.addColorStop(.65,'rgba(19,23,21,.25)');
      gradient.addColorStop(1,'rgba(17,20,18,0)');
      ctx.fillStyle=gradient;
      ctx.fillRect(cx-24,0,48,512);
    }
    for(let i=0;i<1800;i++){
      const x=random()*128,y=random()*512,w=1+random()*8,h=2+random()*15;
      ctx.clearRect(x,y,w,h);
    }
  }
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  return t;
}
function addSurfaceStrip(s0,s1,d,width,material){
  const verts=[],uvs=[],indices=[];
  const count=Math.max(2,Math.ceil((s1-s0)/.8));
  for(let j=0;j<=count;j++){
    const s=s0+(s1-s0)*j/count;
    for(const sign of [-1,1]){
      const p=position(s,d+sign*width*.5);
      verts.push(p.x,p.y+.078,p.z);
      uvs.push(sign<0?0:1,j/count);
    }
  }
  for(let j=0;j<count;j++){
    const i=j*2;
    indices.push(i,i+2,i+1,i+1,i+2,i+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.receiveShadow=false;
  mesh.renderOrder=2;
  scene.add(mesh);
}
function createRoadWeathering(){
  const paint=new THREE.MeshStandardMaterial({
    map:makeDecalTexture('paint'),transparent:true,depthWrite:false,
    roughness:1,metalness:0,side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-1
  });
  const rubber=new THREE.MeshStandardMaterial({
    map:makeDecalTexture('rubber'),transparent:true,depthWrite:false,
    roughness:1,side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-1
  });
  // Dash paint is flush with asphalt and breaks into chipped edges.
  for(let s=23;s<END-5;s+=7.6){
    addSurfaceStrip(s,s+3.35,0,.16,paint);
  }
  // Darkened braking lines leading into the big right-hand bend.
  for(const d of [-3.25,3.35]){
    addSurfaceStrip(84,118,d,1.15,rubber);
    addSurfaceStrip(125,161,d+.35,1.25,rubber);
    addSurfaceStrip(174,197,d,1.05,rubber);
  }
  // Landing scuffs and worn acceleration lines on both straights.
  addSurfaceStrip(75,89,-2.5,.95,rubber);
  addSurfaceStrip(75,90,2.8,1.12,rubber);
  addSurfaceStrip(235,252,-3.3,1.3,rubber);
  // Sector 02 adds broad braking zones into its alternating sweepers.
  for(const d of [-3.4,3.2]){
    addSurfaceStrip(SECTOR_2_LEFT_START-12,SECTOR_2_LEFT_START+22,d,1.28,rubber);
    addSurfaceStrip(SECTOR_2_RIGHT_START-10,SECTOR_2_RIGHT_START+23,d,1.16,rubber);
  }
  addSurfaceStrip(ramps[1].end+6,ramps[1].end+23,1.8,1.15,rubber);
  // The canyon downhill and the long return straight carry heavy rubber.
  for(const d of [-3.1,3.25]){
    addSurfaceStrip(SECTOR_3_EAST_END-12,SECTOR_3_RIGHT_END+16,d,1.25,rubber);
    addSurfaceStrip(SECTOR_3_SOUTH_END-34,SECTOR_3_END+19,d,1.24,rubber);
    addSurfaceStrip(SECTOR_4_WEST_END-40,SECTOR_4_RETURN_END+11,d,1.27,rubber);
  }
  addSurfaceStrip(ramps[2].end+5,ramps[2].end+26,-2,1.5,rubber);
  addSurfaceStrip(ramps[3].end+5,ramps[3].end+28,2.0,1.5,rubber);
}

function createRibbon(side,inside,material,step=1){
  const vertices=[],uvs=[],indices=[];
  const N=Math.ceil(END/step);
  for(let i=0;i<=N;i++){
    const s=END*i/N;
    for(const offset of [inside,side]){
      const p=position(s,offset);
      const isOuter=Math.abs(offset)>HALF+.1;
      const y=isOuter?-.045:p.y+.018;
      vertices.push(p.x,y,p.z);
      uvs.push(offset/5,s/12);
    }
  }
  for(let i=0;i<N;i++){
    const a=i*2;
    indices.push(a,a+2,a+1,a+1,a+2,a+3);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const obj=new THREE.Mesh(geom,material);
  obj.receiveShadow=true;
  obj.castShadow=false;
  scene.add(obj);
}
function createRoad(){
  // The scenery sits on a finite, beautifully edged model railway table.
  const tabletop={
    minX:mapBounds.minX-105,maxX:mapBounds.maxX+105,
    minZ:mapBounds.minZ-105,maxZ:mapBounds.maxZ+105
  };
  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(tabletop.maxX-tabletop.minX,tabletop.maxZ-tabletop.minZ),
    new THREE.MeshStandardMaterial({map:createGrassTexture(),roughness:1})
  );
  ground.rotation.x=-Math.PI/2;
  ground.position.set((tabletop.minX+tabletop.maxX)*.5,-.07,
    (tabletop.minZ+tabletop.maxZ)*.5);
  ground.receiveShadow=true;scene.add(ground);

  // Full-resolution banked road ribbon with actual elevation changes.
  const vertices=[],uvs=[],indices=[];
  const n=Math.ceil(END/.4),cross=18;
  for(let i=0;i<=n;i++){
    const s=END*i/n;
    for(let j=0;j<=cross;j++){
      const d=-HALF+(2*HALF*j/cross);
      const p=position(s,d);
      vertices.push(p.x,p.y+.03,p.z);
      uvs.push(j/cross,s/9);
    }
  }
  for(let i=0;i<n;i++){
    for(let j=0;j<cross;j++){
      const a=i*(cross+1)+j,b=a+1,c=a+cross+1,e=c+1;
      indices.push(a,c,b,b,c,e);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();
  const roadTextures=createAsphaltTextures();
  const roadMaterial=new THREE.MeshStandardMaterial({
    map:roadTextures.color,normalMap:roadTextures.normal,
    normalScale:new THREE.Vector2(.28,.28),
    roughness:.91,metalness:0,side:THREE.DoubleSide
  });
  const road=new THREE.Mesh(g,roadMaterial);
  road.receiveShadow=true;scene.add(road);

  // Gravelly road shoulders with actual textured aggregate.
  mats.shoulder.map=createGravelTexture();
  mats.shoulder.needsUpdate=true;
  for(const side of [-1,1]){
    createRibbon(side*(HALF+3.6),side*HALF,mats.shoulder);
  }
  createRoadWeathering();
  // Instanced curbs: two draw calls instead of hundreds of individual
  // meshes. This offsets the cost of realistic mobile shadow rendering.
  const curbGeo=new THREE.BoxGeometry(.75,.18,2.35);
  const curbCapacity=Math.ceil(END/2.4)*2+4;
  const curbMeshes=[
    new THREE.InstancedMesh(curbGeo,mats.curbYellow,curbCapacity),
    new THREE.InstancedMesh(curbGeo,mats.curbBlack,curbCapacity)
  ];
  const curbCounts=[0,0],curbTransform=new THREE.Object3D();
  for(let s=2,idx=0;s<END-1;s+=2.4,idx++){
    for(const side of [-1,1]){
      const p=position(s,side*(HALF-.33));
      curbTransform.position.set(p.x,p.y+.095,p.z);
      curbTransform.rotation.set(0,p.angle,0);
      curbTransform.scale.set(1,1,1);
      curbTransform.updateMatrix();
      const index=idx%2;
      curbMeshes[index].setMatrixAt(curbCounts[index]++,curbTransform.matrix);
    }
  }
  for(let i=0;i<2;i++){
    curbMeshes[i].count=curbCounts[i];
    curbMeshes[i].instanceMatrix.needsUpdate=true;
    curbMeshes[i].receiveShadow=true;
    curbMeshes[i].castShadow=!mobile;
    scene.add(curbMeshes[i]);
  }
  // Start-grid approach has more visible pristine dashed paint.
  for(let s=7;s<20;s+=7.6){
    const p=position(s,0);
    const paint=makeBox(scene,mats.curbWhite,p.x,p.y+.052,p.z,.13,.024,3.35);
    paint.rotation.y=p.angle;
  }
  // Checkerboard start line before the acceleration straight.
  for(let col=0;col<16;col++){
    for(let row=0;row<2;row++){
      const d=-HALF+(col+.5)*HALF*2/16;
      const s=STARTLINE+row*.67;
      const p=position(s,d);
      const q=makeBox(scene,(col+row)%2?mats.curbWhite:mats.black,
        p.x,p.y+.071,p.z,HALF*2/16+.02,.022,.68);
      q.rotation.y=p.angle;
    }
  }
  for(let s=9;s<18;s+=3){
    const p=position(s,-.1);
    for(let lane of [-3.35,3.35]){
      const q=position(s,lane);
      const line=makeBox(scene,mats.curbWhite,q.x,q.y+.072,q.z,4.1,.025,.11);
      line.rotation.y=q.angle;
    }
  }
  // All four distinct ramp complexes, visible from the rear-iso camera.
  for(const ramp of ramps){
    for(let s=ramp.start+2;s<ramp.end;s+=4){
      for(const side of [-1,1]){
        const edge=position(s,side*2.4);
        const m=makeBox(scene,mats.curbYellow,
          edge.x,edge.y+.08,edge.z,3.4,.035,.32);
        m.rotation.y=edge.angle+side*.38;
      }
    }
  }
  // Safety railings line the outside edge of each significant turn.
  for(const bend of [
    {start:STRAIGHT+5,end:STRAIGHT+TURN-4,outer:-1},
    {start:SECTOR_2_LEFT_START+5,end:SECTOR_2_LEFT_END-4,outer:1},
    {start:SECTOR_2_RIGHT_START+5,end:SECTOR_2_RIGHT_END-4,outer:-1},
    {start:SECTOR_3_EAST_END+5,end:SECTOR_3_RIGHT_END-4,outer:-1},
    {start:SECTOR_3_SOUTH_END+5,end:SECTOR_3_END-4,outer:-1},
    {start:SECTOR_4_WEST_END+5,end:SECTOR_4_RETURN_END-4,outer:-1}
  ]){
    const lower=[],upper=[];
    for(let s=bend.start;s<bend.end;s+=2.5){
      const p=position(s,bend.outer*(HALF+2.8));
      lower.push([p.x,p.y+.73,p.z]);
      upper.push([p.x,p.y+1.12,p.z]);
      if(Math.floor(s/5)%2===0){
        const post=makeBox(scene,mats.steel,p.x,p.y+.55,p.z,.12,1.1,.13);
        post.rotation.y=p.angle;
      }
    }
    tube(lower,.06,mats.rail);
    tube(upper,.063,mats.rail);
  }
}
function signTexture(title,caption){
  const c=document.createElement('canvas');c.width=768;c.height=276;
  const x=c.getContext('2d');
  x.fillStyle='#e3fd7c';x.fillRect(0,0,768,276);
  x.fillStyle='#13323b';x.fillRect(12,12,744,252);
  x.fillStyle='#e3fd7c';
  x.textAlign='center';
  x.font='italic 900 117px Impact, Arial, sans-serif';
  x.fillText(title,384,145,720);
  x.font='bold 42px Arial,sans-serif';
  x.fillText(caption,384,209,720);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});
}
function makeBillboard(s,d,title,caption){
  const p=position(s,d);
  const group=new THREE.Group();
  group.position.set(p.x,p.y,p.z);
  const {angle}=p;
  group.rotation.y=angle;
  makeBox(group,mats.steel,-3,2.9,0,.22,5.8,.22);
  makeBox(group,mats.steel,3,2.9,0,.22,5.8,.22);
  const board=new THREE.Mesh(new THREE.PlaneGeometry(7.0,2.55),signTexture(title,caption));
  board.position.set(0,5.3,0);
  board.rotation.y=Math.PI/2;
  group.add(board);
  scene.add(group);
}
function makeGate(s,caption){
  const g=new THREE.Group();
  const p=point(s);
  g.position.set(p.x,0,p.z);g.rotation.y=p.angle;
  for(const side of [-1,1]){
    const pole=position(s,side*(HALF+.8));
    const y=pole.y+3;
    makeBox(g,mats.sign,side*(HALF+1),y,0,.53,6.2,.65);
    makeBox(g,mats.curbYellow,side*(HALF+1),y+3.1,0,.65,.5,.9);
  }
  makeBox(g,mats.sign,0,6.25,0,HALF*2+2.6,1.7,1.05);
  const board=new THREE.Mesh(new THREE.PlaneGeometry(13,2),signTexture(caption,'MICRO MAYHEM'));
  board.position.set(0,6.28,.56);g.add(board);
  scene.add(g);
}
function makeLeafyGeometry(){
  // Asymmetric, softly rounded leaf clumps. A single shared mesh powers
  // hundreds of bushes and tree crowns through efficient instancing.
  const geo=new THREE.IcosahedronGeometry(1,2);
  const pos=geo.getAttribute('position');
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const rip=.93+.07*Math.sin(x*12+y*3+z*19)+.08*Math.sin(x*5.7-z*8);
    x=x*rip*(1+.09*y);
    y=y*rip*(1-.09*x);
    z=z*rip*(1+.06*Math.sin(y*5));
    pos.setXYZ(i,x,y,z);
  }
  geo.computeVertexNormals();
  return geo;
}
function makeGrassBladeGeometry(){
  // Six curved tapered blades per tuft, with two triangles per blade.
  // This reads like individual grass rather than tiny rigid cones.
  const positions=[],colors=[],indices=[];
  const blades=6;
  for(let i=0;i<blades;i++){
    const a=i*Math.PI*2/blades;
    const dirX=Math.cos(a),dirZ=Math.sin(a);
    const sideX=-dirZ,sideZ=dirX;
    const length=.83+.15*Math.sin(a*3.1);
    const w=.105+.03*Math.sin(a*5);
    const base=positions.length/3;
    const coordinates=[
      [-w,0,0],[w,0,0],
      [-w*.36,length*.57,.18],[w*.36,length*.57,.18],
      [0,length,.29]
    ];
    const colorsAt=[
      [.32,.49,.26],[.37,.55,.28],
      [.68,.81,.45],[.74,.84,.53],
      [.91,.89,.60]
    ];
    for(let j=0;j<coordinates.length;j++){
      const [sx,y,bend]=coordinates[j];
      positions.push(
        sideX*sx+dirX*bend,
        y,
        sideZ*sx+dirZ*bend
      );
      colors.push(...colorsAt[j]);
    }
    indices.push(
      base,base+1,base+2,
      base+1,base+3,base+2,
      base+2,base+3,base+4
    );
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}
// Distinct road-side landmarks make each track feel like a new location,
// not the Backyard geometry with a recolored material.
function buildCourseLandmarks(){
  if(COURSE.id==='backyard')return;
  const mobileFactor=mobile?.66:1;
  const transforms=new THREE.Object3D();
  const place=(s,d,y,rot=0)=>{
    const p=position(clamp(s,1,END-1),d);
    transforms.position.set(p.x,y,p.z);
    transforms.rotation.set(0,p.angle+rot,0);
    transforms.scale.set(1,1,1);
    transforms.updateMatrix();
    return p;
  };
  if(COURSE.id==='creek'){
    const waterMaterial=new THREE.MeshPhysicalMaterial({
      color:'#438c98',roughness:.26,metalness:.1,
      transparent:true,opacity:.82,side:THREE.DoubleSide,
      clearcoat:.8,clearcoatRoughness:.16
    });
    const bankMaterial=new THREE.MeshStandardMaterial({
      color:'#657d5c',roughness:1,side:THREE.DoubleSide
    });
    const lilyMaterial=new THREE.MeshStandardMaterial({
      color:'#638c4e',roughness:.95,side:THREE.DoubleSide
    });
    // The stream runs independently along the outside of several stretches.
    // Long joined ribbons are cheap to render even on a phone.
    for(const [a,b,side] of [
      [32,STRAIGHT-6,1],
      [SECTOR_2_LEFT_END+27,SECTOR_2_RIGHT_START-8,-1],
      [SECTOR_3_RIGHT_END+26,SECTOR_3_RIGHT_END+SECTOR_3_SOUTH*.66,1],
      [SECTOR_3_END+20,SECTOR_3_END+SECTOR_4_WEST*.74,-1]
    ]){
      if(b<=a)continue;
      const verts=[],uv=[],index=[];
      const segments=Math.max(4,Math.ceil((b-a)/3));
      for(let i=0;i<=segments;i++){
        const s=a+(b-a)*i/segments;
        for(const offset of [HALF+7,HALF+18]){
          const p=position(s,side*offset);
          verts.push(p.x,-.037,p.z);
          uv.push(i/segments,offset/18);
        }
      }
      for(let i=0;i<segments;i++){
        const k=i*2;
        index.push(k,k+2,k+1,k+1,k+2,k+3);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geometry.setIndex(index);geometry.computeVertexNormals();
      const water=new THREE.Mesh(geometry,waterMaterial);
      water.renderOrder=1;scene.add(water);
      // Smooth dark creek banks on the boundary of the water.
      const edges=[];
      for(let i=0;i<=segments;i++){
        const ss=a+(b-a)*i/segments;
        const p=position(ss,side*(HALF+18.8));
        edges.push([p.x,.07,p.z]);
      }
      if(edges.length>2)tube(edges,.32,bankMaterial);
    }
    const lilyGeometry=new THREE.CircleGeometry(1,10);
    const lilies=new THREE.InstancedMesh(lilyGeometry,lilyMaterial,Math.round(90*mobileFactor));
    for(let i=0;i<lilies.count;i++){
      const seg=i%2===0?0:1;
      const a=seg===0?34:SECTOR_3_RIGHT_END+30;
      const span=seg===0?Math.max(1,STRAIGHT-45):Math.max(1,SECTOR_3_SOUTH*.52);
      const ss=a+rnd(i+8001)*span;
      const d=(seg===0?1:1)*(HALF+9+rnd(i+991)*7);
      const p=position(ss,d);
      const size=.25+rnd(i+201)*.9;
      transforms.position.set(p.x,-.029,p.z);
      transforms.rotation.set(-Math.PI/2,0,rnd(i+390)*6.283);
      transforms.scale.set(size,size,1);
      transforms.updateMatrix();lilies.setMatrixAt(i,transforms.matrix);
    }
    lilies.instanceMatrix.needsUpdate=true;scene.add(lilies);
    // Wooden hiking footbridges: these are track-side and do not block racing.
    const timber=new THREE.MeshStandardMaterial({
      color:'#866b4b',roughness:.96
    });
    for(const ss of [STRAIGHT*.48,SECTOR_3_RIGHT_END+SECTOR_3_SOUTH*.44]){
      const g=new THREE.Group();
      const p=position(ss,HALF+13);
      g.position.set(p.x,.20,p.z);g.rotation.y=p.angle;
      for(let i=-4;i<=4;i++){
        const plank=makeBox(g,timber,i*.83,0,0,.74,.15,11.7);
        plank.castShadow=false;
      }
      for(const side of [-1,1]){
        const rail=makeBox(g,timber,side*4.25,.76,0,.13,.16,11.7);
        rail.castShadow=false;
        for(const z of [-4.7,0,4.7])
          makeBox(g,timber,side*4.25,.37,z,.17,.72,.16);
      }
      scene.add(g);
    }
  }else if(COURSE.id==='garage'){
    const steelMat=new THREE.MeshStandardMaterial({
      color:'#485a60',roughness:.52,metalness:.65
    });
    const orangeMat=new THREE.MeshStandardMaterial({
      color:'#d99b3b',roughness:.71,metalness:.1
    });
    const containerGeo=new THREE.BoxGeometry(12,7,9);
    const count=24;
    const containers=new THREE.InstancedMesh(containerGeo,steelMat,count);
    for(let i=0;i<count;i++){
      const ss=18+(i+.45)*(END-45)/count;
      const d=(i%2?1:-1)*(HALF+20+rnd(721+i)*12);
      const p=position(ss,d);
      transforms.position.set(p.x,3.45,p.z);
      transforms.rotation.set(0,p.angle+(i%2?Math.PI*.5:0),0);
      transforms.scale.set(.6+rnd(101+i)*.6,.8+rnd(202+i)*.8,1);
      transforms.updateMatrix();containers.setMatrixAt(i,transforms.matrix);
    }
    containers.instanceMatrix.needsUpdate=true;
    containers.castShadow=!mobile;scene.add(containers);
    const hazardGeo=new THREE.BoxGeometry(1.4,1.7,1.4);
    const crates=new THREE.InstancedMesh(hazardGeo,orangeMat,Math.round(85*mobileFactor));
    for(let i=0;i<crates.count;i++){
      const ss=15+rnd(i+912)*(END-35);
      const d=(i%2?1:-1)*(HALF+6+rnd(i+741)*11);
      const p=position(ss,d);
      transforms.position.set(p.x,.82,p.z);
      transforms.rotation.set(0,i*.38,0);
      const scale=.8+rnd(i+811)*1.5;
      transforms.scale.set(scale,scale,scale);
      transforms.updateMatrix();crates.setMatrixAt(i,transforms.matrix);
    }
    crates.instanceMatrix.needsUpdate=true;scene.add(crates);
    // Yellow-black safety hoops provide a recognizable industrial vista.
    for(const ss of [SECTOR_1_END-25,SECTOR_2_END+55,SECTOR_3_END+80]){
      const p=point(ss),g=new THREE.Group();
      g.position.set(p.x,0,p.z);g.rotation.y=p.angle;
      makeBox(g,orangeMat,-(HALF+5),3.8,0,.5,7.6,.7);
      makeBox(g,orangeMat,HALF+5,3.8,0,.5,7.6,.7);
      makeBox(g,steelMat,0,7.45,0,HALF*2+10,.55,.7);
      scene.add(g);
    }
  }else if(COURSE.id==='quarry'){
    const rockGeo=new THREE.DodecahedronGeometry(1,1);
    const rockMats=[
      new THREE.MeshStandardMaterial({color:'#b48860',roughness:1,flatShading:true}),
      new THREE.MeshStandardMaterial({color:'#846a55',roughness:1,flatShading:true}),
      new THREE.MeshStandardMaterial({color:'#d5ac78',roughness:1,flatShading:true})
    ];
    const total=Math.round(225*mobileFactor);
    const groups=rockMats.map(m=>new THREE.InstancedMesh(rockGeo,m,Math.ceil(total/3)));
    const counts=[0,0,0];
    for(let i=0;i<total;i++){
      const ss=rnd(701+i)*END;
      const d=(i%2?1:-1)*(HALF+12+rnd(2411+i)*32);
      const p=position(ss,d);
      const r=1.3+rnd(i+731)*6.1;
      transforms.position.set(p.x,r*.52-.10,p.z);
      transforms.rotation.set(rnd(i+13)*.4,rnd(i+34)*6.283,rnd(i+71)*.3);
      transforms.scale.set(r*(.9+rnd(i+255)*.6),r*(.57+rnd(i+811)*.75),r);
      transforms.updateMatrix();
      const k=i%3;
      groups[k].setMatrixAt(counts[k]++,transforms.matrix);
    }
    for(let i=0;i<3;i++){
      groups[i].count=counts[i];
      groups[i].instanceMatrix.needsUpdate=true;
      groups[i].castShadow=!mobile;
      groups[i].receiveShadow=true;
      scene.add(groups[i]);
    }
    // Giant quarry equipment: industrial-scale loading pipes and stone stacks.
    const metal=new THREE.MeshStandardMaterial({
      color:'#866c52',roughness:.68,metalness:.38
    });
    for(const ss of [SECTOR_2_END+75,SECTOR_3_END+SECTOR_4_WEST*.33]){
      const p=position(ss,HALF+36);
      const g=new THREE.Group();g.position.set(p.x,0,p.z);
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(3,3.6,15,14),metal);
      pipe.position.y=7.5;pipe.castShadow=!mobile;g.add(pipe);
      const mouth=new THREE.Mesh(new THREE.CylinderGeometry(4.1,3,2.2,14),metal);
      mouth.position.y=15.2;g.add(mouth);
      const opening=new THREE.Mesh(
        new THREE.CircleGeometry(3.5,16),
        new THREE.MeshStandardMaterial({color:'#332c29',roughness:1})
      );
      opening.rotation.x=-Math.PI/2;opening.position.y=16.33;g.add(opening);
      scene.add(g);
    }
  }
}
function applyCourseUI(){
  document.title='Micro Mayhem — '+COURSE.title;
  const description=document.querySelector('meta[name="description"]');
  if(description)description.content=COURSE.description;
  const brand=document.getElementById('course-title');
  if(brand)brand.textContent=COURSE.title.toUpperCase();
  const courseOrder=['backyard','creek','garage','quarry'].indexOf(COURSE.id);
  const kicker=document.getElementById('course-kicker');
  if(kicker)kicker.textContent='COURSE 0'+(courseOrder+1)+' / 04';
  const subtitle=document.getElementById('course-subtitle');
  if(subtitle)subtitle.textContent=COURSE.subtitle;
  const heading=document.querySelector('#intro h1');
  if(heading){
    const names={
      backyard:'BACKYARD<br><em>GRAND PRIX.</em>',
      creek:'CREEKSIDE<br><em>SCRAMBLE.</em>',
      garage:'GARAGE<br><em>GAUNTLET.</em>',
      quarry:'SUNSET<br><em>QUARRY.</em>'
    };
    heading.innerHTML=names[COURSE.id];
  }
  const introDescription=document.getElementById('course-description');
  if(introDescription)introDescription.textContent=COURSE.description+
    ' Four sectors, four jumps, two laps and full-speed RC racing.';
  const pills=document.querySelector('#intro .pills');
  if(pills)pills.innerHTML='<span>4 COURSES</span><span>4 BIG JUMPS</span>'+
    '<span>2-LAP GRAND PRIX</span><span>2× BOOST</span>';
  const startText=document.querySelector('#start span:first-child');
  if(startText)startText.textContent='RACE '+COURSE.title.toUpperCase();
  const resultHeading=document.getElementById('result-course-name');
  if(resultHeading)resultHeading.textContent=COURSE.title.toUpperCase()+' · FINISHED';
  const accent=COURSE.id==='quarry'?'#ffcf83':
    COURSE.id==='creek'?'#83f2d9':
    COURSE.id==='garage'?'#ffdc77':'#e5fd7c';
  document.documentElement.style.setProperty('--lime',accent);
  const picker=document.getElementById('picker-link');
  if(picker)picker.href='./courses.html';
  const active=document.querySelector('[data-course="'+COURSE.id+'"]');
  if(active){
    active.classList.add('selected');
    active.setAttribute('aria-current','page');
  }
}

function environment(){
  // Instanced naturalistic planting: lumpy, overlapping foliage in three
  // tones, legible grass blades, varied crown layers and ground patches.
  // Avoids per-plant draw calls and expensive transparent alpha textures.
  const shrubGeo=makeLeafyGeometry();
  const matrix=new THREE.Object3D();
  const isQuarry=COURSE.id==='quarry',isGarage=COURSE.id==='garage';
  const bushMaterials=[
    new THREE.MeshStandardMaterial({color:isQuarry?'#896c48':isGarage?'#68716b':'#396a43',roughness:1}),
    new THREE.MeshStandardMaterial({color:isQuarry?'#ab8958':isGarage?'#82887d':'#568a4d',roughness:1}),
    new THREE.MeshStandardMaterial({color:isQuarry?'#96744d':isGarage?'#858c79':'#729455',roughness:1})
  ];
  const bushCount=isGarage?(mobile?110:160):isQuarry?(mobile?140:200):(mobile?315:480);
  const shrubs=bushMaterials.map(m=>new THREE.InstancedMesh(shrubGeo,m,Math.ceil(bushCount/3)+1));
  const bushIndex=[0,0,0];
  const tint=new THREE.Color();
  for(let i=0;i<bushCount;i++){
    const s=5+rnd(1100+i)*(END-8);
    const side=i%2?1:-1;
    const d=side*(HALF+4.8+rnd(2301+i)*36);
    const p=position(s,d);
    const r=.48+rnd(3100+i)*1.5;
    matrix.position.set(p.x,r*.60-.07,p.z);
    matrix.scale.set(r*1.17,r*(.57+rnd(9211+i)*.28),r*(.87+rnd(1731+i)*.3));
    matrix.rotation.set(0,rnd(i+389)*6.28,0);
    matrix.updateMatrix();
    const group=i%3,index=bushIndex[group]++;
    shrubs[group].setMatrixAt(index,matrix.matrix);
    if(isQuarry)tint.setHSL(.075+rnd(i+91)*.04,.28,.65+rnd(i+498)*.12);
    else if(isGarage)tint.setHSL(.28+rnd(i+91)*.025,.07,.59+rnd(i+498)*.12);
    else tint.setHSL(.30+rnd(i+91)*.045,.35+rnd(i+332)*.13,.67+rnd(i+498)*.16);
    shrubs[group].setColorAt(index,tint);
  }
  for(let i=0;i<3;i++){
    shrubs[i].count=bushIndex[i];
    shrubs[i].instanceMatrix.needsUpdate=true;
    if(shrubs[i].instanceColor)shrubs[i].instanceColor.needsUpdate=true;
    shrubs[i].castShadow=true;
    shrubs[i].receiveShadow=true;
    scene.add(shrubs[i]);
  }
  // Mottled areas of sun-bleached turf and exposed soil.
  const patchGeo=new THREE.CircleGeometry(1,14);
  const patchMat=new THREE.MeshStandardMaterial({
    color:'#aea06f',transparent:true,opacity:.24,depthWrite:false,
    side:THREE.DoubleSide,roughness:1
  });
  const patches=new THREE.InstancedMesh(patchGeo,patchMat,mobile?135:260);
  for(let i=0;i<patches.count;i++){
    const s=rnd(i+9133)*END;
    const d=(i%2?1:-1)*(HALF+4+rnd(i+819)*28);
    const p=position(s,d);
    const scale=.8+rnd(i+712)*2.4;
    matrix.position.set(p.x,-.056,p.z);
    matrix.scale.set(scale*1.5,scale,1);
    matrix.rotation.set(-Math.PI/2,0,rnd(i+880)*6.28);
    matrix.updateMatrix();patches.setMatrixAt(i,matrix.matrix);
  }
  patches.instanceMatrix.needsUpdate=true;scene.add(patches);

  const grassGeo=makeGrassBladeGeometry();
  const grassMaterials=[
    new THREE.MeshStandardMaterial({color:'#b7c987',vertexColors:true,roughness:1,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:'#90b36c',vertexColors:true,roughness:1,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:'#c5b980',vertexColors:true,roughness:1,side:THREE.DoubleSide})
  ];
  const grassTotal=isGarage?(mobile?260:460):isQuarry?(mobile?380:670):(mobile?1500:2600);
  const grassMeshes=grassMaterials.map(m=>new THREE.InstancedMesh(grassGeo,m,Math.ceil(grassTotal/3)+1));
  const grassIndices=[0,0,0];
  for(let i=0;i<grassTotal;i++){
    const s=rnd(4200+i)*END;
    const side=i%2?1:-1;
    const d=side*(HALF+3.7+rnd(i+1301)*36);
    const p=position(s,d);
    const size=.33+rnd(7100+i)*.93;
    matrix.position.set(p.x,-.035,p.z);
    matrix.scale.set(size,size*(.76+rnd(i+321)*.65),size);
    matrix.rotation.set(0,rnd(i+511)*6.28,0);
    matrix.updateMatrix();
    const type=i%3,index=grassIndices[type]++;
    grassMeshes[type].setMatrixAt(index,matrix.matrix);
  }
  for(let i=0;i<3;i++){
    grassMeshes[i].count=grassIndices[i];
    grassMeshes[i].instanceMatrix.needsUpdate=true;
    grassMeshes[i].castShadow=false;
    grassMeshes[i].receiveShadow=false;
    scene.add(grassMeshes[i]);
  }

  // Trees have separate tapered trunks and overlapping irregular crowns.
  // Instance count is bounded so the phone shadow pass remains affordable.
  const trees=isGarage?0:isQuarry?(mobile?5:9):(mobile?28:45);
  if(trees>0){
  const trunks=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.18,.35,3.6,7),
    mats.trunk,trees);
  const leaves=new THREE.InstancedMesh(
    shrubGeo,new THREE.MeshStandardMaterial({color:'#4b8450',roughness:.94}),
    trees*4);
  for(let i=0;i<trees;i++){
    const s=10+rnd(i+889)*(END-12);
    const side=i%2?1:-1;
    const d=side*(HALF+21+rnd(i+1143)*23);
    const p=position(s,d);
    const scale=1.1+rnd(i+2234)*.85;
    matrix.position.set(p.x,1.8*scale,p.z);
    matrix.scale.set(scale,scale,scale);
    matrix.rotation.set(0,rnd(i+300)*Math.PI*2,0);
    matrix.updateMatrix();
    trunks.setMatrixAt(i,matrix.matrix);
    for(let lobe=0;lobe<4;lobe++){
      const a=lobe*Math.PI*.5+rnd(i+12)*.3;
      const offset=lobe===0?0:1.25*scale;
      const crownScale=(lobe===0?2.35:1.7)*scale;
      matrix.position.set(
        p.x+Math.cos(a)*offset,
        (lobe===0?4.7:4.2)*scale+rnd(i+121+lobe)*.45,
        p.z+Math.sin(a)*offset
      );
      matrix.scale.set(
        crownScale*(.88+rnd(i+333+lobe)*.15),
        crownScale*(.58+rnd(i+511+lobe)*.2),
        crownScale*(.86+rnd(i+621+lobe)*.19)
      );
      matrix.rotation.set(0,rnd(i+323+lobe)*6.28,0);
      matrix.updateMatrix();
      leaves.setMatrixAt(i*4+lobe,matrix.matrix);
      tint.setHSL(.33+rnd(i+15+lobe)*.045,.26+rnd(i+93+lobe)*.17,
        .68+rnd(i+61+lobe)*.18);
      leaves.setColorAt(i*4+lobe,tint);
    }
  }
  trunks.instanceMatrix.needsUpdate=true;
  leaves.instanceMatrix.needsUpdate=true;
  if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;
  trunks.castShadow=true;leaves.castShadow=true;
  trunks.receiveShadow=true;leaves.receiveShadow=true;
  scene.add(trunks,leaves);

  }

  // Gravel turnout, and sparse scale-setting maintenance props.
  const gravelColors=[
    new THREE.MeshStandardMaterial({color:'#b2ab96',roughness:1}),
    new THREE.MeshStandardMaterial({color:'#5e6359',roughness:1})
  ];
  const stoneGeo=new THREE.DodecahedronGeometry(.6,0);
  const stoneGroups=gravelColors.map(m=>new THREE.InstancedMesh(stoneGeo,m,45));
  for(let i=0;i<75;i++){
    const s=8+i*1.35;
    const p=position(s,-(HALF+4.5+rnd(i+7)*5.5));
    const scale=.24+rnd(i+3)*.44;
    matrix.position.set(p.x,.055,p.z);
    matrix.scale.set(scale,scale*.43,scale);
    matrix.rotation.set(.2,i*.5,0);
    matrix.updateMatrix();
    stoneGroups[i%2].setMatrixAt(Math.floor(i/2),matrix.matrix);
  }
  for(let i=0;i<2;i++){
    stoneGroups[i].count=i===0?38:37;
    stoneGroups[i].instanceMatrix.needsUpdate=true;
    scene.add(stoneGroups[i]);
  }

  // A few believable infield maintenance barrels with dark cavities.
  for(const [s,d] of [
    [121,HALF+29],[174,-HALF-24],[241,HALF+24],
    [SECTOR_2_LEFT_START+17,HALF+28],
    [SECTOR_2_LEFT_END+32,-HALF-24],
    [SECTOR_2_RIGHT_START+21,HALF+27],
    [SECTOR_3_EAST_END+22,HALF+25],
    [SECTOR_3_RIGHT_END+91,-HALF-24],
    [SECTOR_3_SOUTH_END-30,HALF+20],
    [SECTOR_4_WEST_END-55,-HALF-23]
  ]){
    const p=position(s,d);
    const group=new THREE.Group();group.position.set(p.x,0,p.z);
    const bucket=new THREE.Mesh(
      new THREE.CylinderGeometry(2.25,2.08,3.6,16),mats.curbYellow);
    bucket.position.y=1.8;bucket.castShadow=true;group.add(bucket);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(2.23,.12,7,24),mats.curbBlack);
    lip.rotation.x=Math.PI/2;lip.position.y=3.62;group.add(lip);
    const inner=new THREE.Mesh(
      new THREE.CircleGeometry(2.05,20),mats.black);
    inner.rotation.x=-Math.PI/2;inner.position.y=3.61;group.add(inner);
    scene.add(group);
  }
  buildCourseLandmarks();
  makeGate(STARTLINE-12,'START');
  makeGate(SECTOR_1_END,'SECTOR 02');
  makeGate(SECTOR_2_END,'SECTOR 03');
  makeGate(SECTOR_3_END,'SECTOR 04');
  makeGate(FINAL_GATE,'FINISH');
  makeBillboard(54,-HALF-11,'JUMP','KEEP IT LEVEL');
  makeBillboard(121,-HALF-15,'BERM','HOLD YOUR LINE');
  makeBillboard(226,HALF+13,'EXIT','SEND IT');
  makeBillboard(SECTOR_2_LEFT_START+19,HALF+15,'SWEEPER','HOLD THE OUTSIDE');
  makeBillboard(ramps[1].start-6,-HALF-15,'AIRTIME','FLY INTO THE GARDEN');
  makeBillboard(SECTOR_2_RIGHT_START+14,-HALF-15,'S-BEND','BRAKE OR BOOST');
  makeBillboard(SECTOR_3_EAST_END+25,HALF+15,'CANYON','HOLD THE BERM');
  makeBillboard(ramps[2].start-16,-HALF-14,'MEGA AIR','STICK THE LANDING');
  makeBillboard(SECTOR_3_SOUTH_END-50,HALF+16,'HAIRPIN','BRAKE THEN BOOST');
  makeBillboard(SECTOR_3_END+88,-HALF-15,'HOME RUN','WIDE OPEN');
  makeBillboard(ramps[3].start-16,-HALF-14,'FINAL FLYER','BIG AIR AHEAD');
  makeBillboard(SECTOR_4_RETURN_END+29,HALF+13,'FINISH','LAST SPRINT');
  if(COURSE.id!=='backyard'){
    makeBillboard(SECTOR_2_END+15,-HALF-17,
      COURSE.id==='creek'?'CREEKSIDE':COURSE.id==='garage'?'GARAGE':'QUARRY',
      COURSE.id==='creek'?'KEEP IT CLEAN':COURSE.id==='garage'?'BRAKE HARD':'SEND IT');
  }
}
function makeCone(s,d){
  const p=position(s,d);
  const g=new THREE.Group();g.position.set(p.x,p.y,p.z);
  if(COURSE.hazard==='barrels'){
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.76,.77,1.8,12),
      new THREE.MeshStandardMaterial({color:'#bc6b39',metalness:.26,roughness:.67}));
    base.position.y=.92;base.castShadow=!mobile;g.add(base);
    makeBox(g,mats.curbWhite,0,1.1,.73,1.3,.23,.08);
  }else if(COURSE.hazard==='rocks'){
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.91,0),
      new THREE.MeshStandardMaterial({color:'#a88764',flatShading:true,roughness:1}));
    rock.position.y=.7;rock.scale.set(1,.85,1.1);rock.castShadow=!mobile;
    g.add(rock);
  }else if(COURSE.hazard==='logs'){
    const log=new THREE.Mesh(new THREE.CylinderGeometry(.36,.43,2.0,10),
      new THREE.MeshStandardMaterial({color:'#775b3c',roughness:1}));
    log.rotation.z=Math.PI/2;
    log.position.y=.42;g.add(log);
  }else{
    makeBox(g,mats.black,0,.05,0,.85,.09,.85);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.37,1.2,10),mats.cone);
    cone.position.y=.62;cone.castShadow=!mobile;g.add(cone);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.205,.245,.18,10),mats.white);
    band.position.y=.55;g.add(band);
  }
  scene.add(g);cones.push({s,d,x:p.x,z:p.z,mesh:g});
}
function createHazards(){
  for(const [s,d] of [
    [31,-6.7],[49,6.5],[107,6.6],[138,5.8],[167,7.2],[218,-6.8],[247,6.4],
    [SECTOR_1_END+23,-6.7],[SECTOR_2_LEFT_START+33,6.6],
    [SECTOR_2_LEFT_END+34,-6.6],
    [SECTOR_2_RIGHT_START+24,6.7],
    [SECTOR_2_RIGHT_END+22,-6.9],
    [SECTOR_3_RIGHT_END+24,-6.3],
    [SECTOR_3_RIGHT_END+62,6.5],
    [SECTOR_3_RIGHT_END+129,-5.9],
    [SECTOR_3_SOUTH_END-54,6.6],
    [SECTOR_3_END+36,6.5],
    [SECTOR_3_END+105,-6.4],
    [SECTOR_4_WEST_END-72,6.7],
    [SECTOR_4_RETURN_END+31,-6.8]
  ]){
    makeCone(s,d);
  }
}
function makeShadow(){
  // A cheap soft occlusion decal beneath each vehicle. The directional
  // shadow map supplies the long shadow; this supplies tire/body contact.
  const c=document.createElement('canvas');c.width=c.height=96;
  const ctx=c.getContext('2d');
  const gr=ctx.createRadialGradient(48,48,3,48,48,46);
  gr.addColorStop(0,'rgba(0,0,0,.80)');
  gr.addColorStop(.31,'rgba(0,0,0,.47)');
  gr.addColorStop(.68,'rgba(0,0,0,.15)');
  gr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gr;ctx.fillRect(0,0,96,96);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.25,5.3),
    new THREE.MeshBasicMaterial({
      map:tex,transparent:true,depthWrite:false,opacity:.62,
      polygonOffset:true,polygonOffsetFactor:-1
    }));
  mesh.rotation.x=-Math.PI/2;
  mesh.renderOrder=3;
  scene.add(mesh);return mesh;
}
function setup(){
  try{
    applyCourseUI();
    setMiniatureFocus(miniatureFocusEnabled);
    renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.4:1.8));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=COURSE.exposure;
    // The reference uses substantial natural shadow contrast. Enable the
    // main shadow pass on phones too; desktop earns a finer shadow atlas.
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setSize(innerWidth,innerHeight);
    // Gentle photographic grade, applied only to the 3D layer: avoid
    // oversaturated neon foliage and clipped highlights on painted bodies.
    renderer.domElement.style.filter='contrast(1.055) saturate(.955)';
    ui.viewport.appendChild(renderer.domElement);
    scene=new THREE.Scene();
    scene.background=new THREE.Color(COURSE.sky);
    scene.fog=new THREE.Fog(COURSE.fog,165,385);
    // Environment reflections give the smooth single-shell clearcoat a
    // broad daylight highlight, instead of pure, uniformly coloured plastic.
    scene.environment=createSkyEnvironment();
    scene.environmentIntensity=mobile?.48:.62;
    camera=new THREE.OrthographicCamera(-70,70,45,-45,.2,1800);
    scene.add(new THREE.HemisphereLight(
      COURSE.id==='quarry'?'#ffe6c3':'#cbdde5',
      COURSE.id==='quarry'?'#806748':'#64735b',COURSE.ambient));
    scene.add(new THREE.AmbientLight('#f0e8d7',.12));
    sun=new THREE.DirectionalLight(COURSE.sun,COURSE.sunPower);
    sun.position.set(-52,65,-60);
    sun.castShadow=true;
    const atlasSize=mobile?1024:2048;
    sun.shadow.mapSize.set(atlasSize,atlasSize);
    // Tight frustum means much sharper truck and wheel shadows.
    sun.shadow.camera.left=-51;sun.shadow.camera.right=51;
    sun.shadow.camera.top=51;sun.shadow.camera.bottom=-51;
    sun.shadow.camera.near=.5;sun.shadow.camera.far=178;
    sun.shadow.bias=-.00016;
    sun.shadow.normalBias=.025;
    sun.shadow.radius=1.7;
    scene.add(sun);scene.add(sun.target);
    createRoad();
    environment();
    const diorama=createMiniatureWorld({
      THREE,scene,course:COURSE.id,position,length:END,
      halfWidth:HALF,mobile,bounds:mapBounds
    });
    scene.userData.miniature=diorama;
    // Expose only bounded scene counts to regression tests, not game state.
    document.body.dataset.miniatureBuildings=String(diorama.buildings);
    document.body.dataset.miniaturePeople=String(diorama.people);
    document.body.dataset.miniatureRailTies=String(diorama.railTies);
    document.body.dataset.miniatureDistricts=diorama.districts.join(' / ');
    createHazards();
    player.mesh=makeRCTrophyTruck(THREE,'#f2c33e');
    player.mesh.name='Player / yellow smooth-shell truck';
    scene.add(player.mesh);
    shadow=makeShadow();
    const rivals=[
      {color:'#d95643',name:'RED',s:12,d:-3.35,cruise:13.0*RACE_SPEED_MULTIPLIER,seed:1.7},
      {color:'#65c654',name:'GREEN',s:12,d:3.35,cruise:13.9*RACE_SPEED_MULTIPLIER,seed:2.9},
      {color:'#4e83d9',name:'BLUE',s:7,d:3.35,cruise:13.5*RACE_SPEED_MULTIPLIER,seed:4.1}
    ];
    ai=rivals.map(data=>({...data,mesh:makeRCTrophyTruck(THREE,data.color),speed:0,done:null,lap:1}));
    for(const rival of ai){
      scene.add(rival.mesh);
      rivalShadows.push(makeShadow());
    }
    reset(false);
    ui.loading.classList.add('hidden');
    requestAnimationFrame(frame);
  }catch(e){
    console.error('Race-track setup failed on '+COURSE.id,e);
    ui.loading.classList.remove('hidden');
    ui.loading.textContent='TRACK FAILED: '+(e&&e.message?e.message:'WebGL setup error')+' — choose another course or reload.';
    ui.loading.style.whiteSpace='normal';
    ui.loading.style.padding='24px';
    ui.loading.style.maxWidth='100vw';
  }
}
function reset(start){
  const p=position(7,-3.35);
  Object.assign(player,{
    x:p.x,z:p.z,y:p.y+.025,s:7,d:-3.35,heading:0,speed:0,
    vy:0,grounded:true,airtime:0,pitch:0,roll:0,
    heat:0,overheated:false,collisionCooldown:0,launchConsumed:false
  });
  for(const a of ai){a.s=a.seed===4.1?7:12;a.speed=0;a.done=null;a.lap=1;}
  for(const k in controls)controls[k]=false;
  document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('pressed'));
  ui.results.classList.add('hidden');
  ui.pauseOverlay.classList.add('hidden');
  ui.intro.classList.toggle('hidden',start);
  game.time=0;game.countdown=3.45;
  game.split1=null;game.split2=null;game.split3=null;
  game.lap=1;game.lapSplits=[];game.lapStartTime=0;
  game.nextCheckpoint=0;game.checkpoints=[];
  game.mode=start?'countdown':'intro';
  ui.marker.textContent=start?'3':'';
  ui.flash.classList.remove('show');
  updateHUD();
  positionModels(0);
  if(start)initAudio();
}
function initAudio(){
  if(game.muted)return;
  try{
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=new AC();
    }
    audioCtx.resume();
    if(!audioOsc){
      audioOsc=audioCtx.createOscillator();
      audioGain=audioCtx.createGain();
      const filter=audioCtx.createBiquadFilter();
      filter.type='lowpass';filter.frequency.value=210;
      audioOsc.type='sawtooth';
      audioOsc.frequency.value=56;
      audioGain.gain.value=.00001;
      audioOsc.connect(filter);filter.connect(audioGain);audioGain.connect(audioCtx.destination);
      audioOsc.start();
    }
  }catch(e){console.warn('Audio disabled',e)}
}
function sound(hz,dur,type='sine'){
  if(!audioCtx||game.muted)return;
  const o=audioCtx.createOscillator(),gain=audioCtx.createGain();
  o.type=type;o.frequency.value=hz;
  gain.gain.setValueAtTime(.0001,audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.063,audioCtx.currentTime+.015);
  gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);
  o.connect(gain);gain.connect(audioCtx.destination);
  o.start();o.stop(audioCtx.currentTime+dur+.02);
}
function audioUpdate(){
  if(!audioCtx||!audioOsc||!audioGain)return;
  const active=game.mode==='racing'||game.mode==='countdown';
  audioOsc.frequency.setTargetAtTime(65+player.speed*6+(controls.boost?40:0),audioCtx.currentTime,.075);
  audioGain.gain.setTargetAtTime(active&&!game.muted?.014:.00001,audioCtx.currentTime,.085);
}
function toast(text,seconds=1.2){
  ui.flash.textContent=text;
  ui.flash.classList.add('show');
  game.toastUntil=performance.now()+seconds*1000;
}
function spark(color,count=15){
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.11),
      new THREE.MeshBasicMaterial({color}));
    mesh.position.set(player.x,player.y+.65,player.z);
    scene.add(mesh);
    particles.push({mesh,life:.35+rnd(i+worldClock)*.38,
      dx:(rnd(i+27)-.5)*7,dy:1+rnd(i+49)*6,dz:(rnd(i+59)-.5)*7});
  }
}
function tickPlayer(dt){
  const steer=(controls.right?1:0)-(controls.left?1:0);
  const throttle=controls.accel||mobile?1:0;
  const boosting=controls.boost&&!player.overheated&&!controls.brake&&player.speed>3;
  if(boosting){player.heat=Math.min(1,player.heat+dt*.30);}
  else player.heat=Math.max(0,player.heat-dt*.19);
  if(player.heat>=.998&&!player.overheated){
    player.overheated=true;toast('MOTOR OVERHEATED');sound(125,.21,'sawtooth');
  }
  if(player.overheated&&player.heat<.33)player.overheated=false;
  const offRoad=Math.abs(player.d)>HALF-.65;
  const target=(boosting?MAX_SPEED:CRUISE_SPEED)*(offRoad?.58:1);
  const accel=throttle?16.0:10.6;
  if(throttle)player.speed=Math.min(target,player.speed+accel*dt+(boosting?11*dt:0));
  else player.speed=Math.max(0,player.speed-12*dt);
  if(player.speed>target)player.speed=Math.max(target,player.speed-(offRoad?20:7)*dt);
  if(controls.brake)player.speed=Math.max(0,player.speed-40*dt);
  if(!player.grounded)player.speed=Math.max(6,player.speed-1*dt);
  // Free-steering world-space motion. A modest heading assist makes the
  // banked bend approachable on touch without locking the car to the spline.
  // At double speed the truck covers twice the road each second. Follow
  // the approaching tangent and double turn authority to retain the same
  // approximate metres-per-steering-input around the banked corner.
  const guideS=Math.min(END,player.s+clamp(player.speed*.19,3,8));
  const guide=point(guideS);
  const align=modAngle(guide.angle-player.heading);
  const assist=offRoad?.64:3.7;
  player.heading+=align*assist*dt;
  const steerPower=(.55+Math.min(1,player.speed/24)*.8)*
    (player.grounded?1:.42)*RACE_SPEED_MULTIPLIER;
  player.heading+=steer*steerPower*dt;
  player.heading=modAngle(player.heading);
  const lastS=player.s;
  player.x+=Math.sin(player.heading)*player.speed*dt;
  player.z+=Math.cos(player.heading)*player.speed*dt;
  const projection=project(player.x,player.z,lastS+player.speed*dt);
  player.s=projection.s;player.d=projection.d;
  if(Math.abs(player.d)>HALF+18){
    const safe=position(Math.max(5,player.s-3),0);
    player.x=safe.x;player.z=safe.z;
    player.heading=safe.angle;player.speed=12;
    player.s=Math.max(5,player.s-3);player.d=0;
    player.grounded=true;player.vy=0;player.airtime=0;player.y=safe.y+.04;
    game.time+=2.0;
    toast('RESET TO TRACK · +2 SECONDS');
  }
  if(player.collisionCooldown>0)player.collisionCooldown-=dt;
  for(const ob of cones){
    const dist=Math.hypot(player.x-ob.x,player.z-ob.z);
    if(dist<1.45&&player.collisionCooldown<=0&&player.grounded){
      player.speed*=.55;
      player.collisionCooldown=.8;
      game.shake=.65;
      spark('#ffd05f',10);
      toast('CONE STRIKE!');
      sound(140,.15,'sawtooth');
    }
  }
  for(const rival of ai){
    const q=position(rival.s,rival.d+Math.sin(game.time*.9+rival.seed)*.24);
    const dist=Math.hypot(player.x-q.x,player.z-q.z);
    if(dist<2.45&&player.collisionCooldown<=0&&player.grounded){
      player.speed*=.80;
      player.heading+=player.x<q.x?-.055:.055;
      player.collisionCooldown=.7;game.shake=.18;
      toast('SIDE-BY-SIDE!');
      sound(225,.09,'triangle');
    }
  }
  const ground=surfaceHeight(player.s,player.d)+.045;
  if(player.grounded){
    const launch=ramps.find(r=>lastS<=r.end&&player.s>r.end);
    if(launch){
      player.grounded=false;
      // High-speed takeoff remains tuned for clean landing opportunities.
      player.vy=clamp(player.speed*.24,6,9.2);
      player.airtime=.015;
      player.pitch=-.2;
      toast('↗ '+launch.name.toUpperCase()+'!');
      sound(690,.09,'triangle');
    }else{
      player.y=ground;
      const slope=(surfaceHeight(player.s+.45,player.d)-surfaceHeight(player.s-.45,player.d))/.9;
      player.pitch=THREE.MathUtils.damp(player.pitch,-Math.atan(slope)*.42,7,dt);
    }
  }else{
    player.airtime+=dt;
    player.vy-=GRAVITY*dt;
    player.y+=player.vy*dt;
    const lean=(controls.leanForward?1:0)-(controls.leanBack?1:0);
    player.pitch=clamp(player.pitch+lean*1.15*dt+.13*dt,-.9,1.05);
    if(player.y<=ground&&player.vy<0){
      const hard=player.vy<-10;
      player.y=ground;
      player.grounded=true;player.vy=0;
      if(hard&&Math.abs(player.pitch)>.6){
        player.speed*=.77;
        toast('ROUGH LANDING!');
        game.shake=.45;
      }else{
        player.speed=Math.min(MAX_SPEED,player.speed+2.5);
        toast('CLEAN LANDING · +SPEED!');
        sound(850,.12,'triangle');
      }
      spark('#e8e9b0',10);
      player.airtime=0;
    }
  }
  const onBend=[
    [STRAIGHT,STRAIGHT+TURN],
    [SECTOR_2_RIGHT_START,SECTOR_2_RIGHT_END],
    [SECTOR_3_EAST_END,SECTOR_3_RIGHT_END],
    [SECTOR_3_SOUTH_END,SECTOR_3_END],
    [SECTOR_4_WEST_END,SECTOR_4_RETURN_END]
  ].some(([a,b])=>player.s>a&&player.s<b);
  const onLeft=player.s>SECTOR_2_LEFT_START&&player.s<SECTOR_2_LEFT_END;
  player.roll=THREE.MathUtils.damp(player.roll,
    -steer*.08+(onBend?.07:0)-(onLeft?.07:0),5,dt);
  const checkpoints=[SECTOR_1_END,SECTOR_2_END,SECTOR_3_END];
  while(game.nextCheckpoint<checkpoints.length&&player.s>=checkpoints[game.nextCheckpoint]){
    const i=game.nextCheckpoint++;
    const split=game.time-game.lapStartTime;
    game.checkpoints.push(split);
    if(game.lap===1){
      if(i===0)game.split1=split;
      if(i===1)game.split2=split;
      if(i===2)game.split3=split;
    }
    toast('LAP '+game.lap+' · SECTOR '+String(i+1).padStart(2,'0')+' COMPLETE!',1.25);
    sound(950+i*85,.13,'triangle');
  }
  if(player.s>=END-3&&Math.abs(player.d)<HALF+4)completeLap();
}
function tickAI(dt){
  for(const rival of ai){
    if(rival.done!==null)continue;
    const speed=rival.cruise+Math.sin(game.time*.42+rival.seed)*2.0;
    rival.speed=THREE.MathUtils.damp(rival.speed,speed,3.6,dt);
    rival.s+=rival.speed*dt;
    if(rival.s>=END-3){
      if(rival.lap>=LAPS){
        rival.s=END-3;
        rival.done=game.time;
      }else{
        rival.lap++;
        rival.s=Math.max(0,rival.s-(END-3));
      }
    }
  }
}
function positionModels(dt){
  if(player.mesh){
    player.mesh.position.set(player.x,player.y,player.z);
    player.mesh.rotation.order='YXZ';
    player.mesh.rotation.y=player.heading;
    player.mesh.rotation.x=player.pitch;
    player.mesh.rotation.z=player.roll;
    for(const wheel of player.mesh.userData.wheels)wheel.rotation.x+=dt*player.speed*2.25;
    const under=position(player.s,player.d);
    shadow.position.set(player.x,under.y+.07,player.z);
    shadow.rotation.z=-player.heading;
    const alt=Math.max(0,player.y-under.y);
    const factor=1+alt*.12;
    shadow.scale.set(factor,factor,factor);
    shadow.material.opacity=clamp(.70-alt*.073,.08,.70);
  }
  for(const [i,rival] of ai.entries()){
    const lane=rival.d+Math.sin(game.time*.87+rival.seed)*.25;
    const p=position(rival.s,lane);
    let air=0;
    for(const jump of ramps){
      if(rival.s>jump.end&&rival.s<jump.end+26){
        air=Math.sin((rival.s-jump.end)/26*Math.PI)*2.2;
      }
    }
    rival.mesh.position.set(p.x,p.y+.035+air,p.z);
    rival.mesh.rotation.order='YXZ';
    rival.mesh.rotation.y=p.angle+Math.sin(game.time*.7+rival.seed)*.025;
    rival.mesh.rotation.x=air>0?-.12:0;
    const rivalRight=[
      [STRAIGHT,STRAIGHT+TURN],
      [SECTOR_2_RIGHT_START,SECTOR_2_RIGHT_END],
      [SECTOR_3_EAST_END,SECTOR_3_RIGHT_END],
      [SECTOR_3_SOUTH_END,SECTOR_3_END],
      [SECTOR_4_WEST_END,SECTOR_4_RETURN_END]
    ].some(([a,b])=>rival.s>a&&rival.s<b);
    const rivalLeft=rival.s>SECTOR_2_LEFT_START&&rival.s<SECTOR_2_LEFT_END;
    rival.mesh.rotation.z=(rivalRight?.07:0)-(rivalLeft?.07:0);
    for(const wheel of rival.mesh.userData.wheels)wheel.rotation.x+=dt*rival.speed*2.25;
    const shade=rivalShadows[i];
    if(shade){
      shade.position.set(p.x,p.y+.07,p.z);
      shade.rotation.z=-p.angle;
      const sc=1+air*.13;
      shade.scale.set(sc,sc,sc);
      shade.material.opacity=clamp(.67-air*.15,.15,.67);
    }
  }
}
const focus=new THREE.Vector3(),target=new THREE.Vector3();
// Camera tuned for a close, elevated rear-three-quarter RC arcade view.
// Orthographic projection preserves the isometric model proportions while
// a rotating track-relative follow offset reveals the truck's back and side.
const cameraConfig={
  // An elevated 3/4 miniature-photography framing, still tight enough
  // to see where the RC truck needs to steer next.
  side:19.5,
  behind:27.5,
  elevation:46,
  lookAhead:11.5,
  lateralFollow:.78,
  // Faster damping prevents the 2x-speed truck outrunning the isometric view.
  followDamping:7.5,
  focusDamping:9.0
};
function viewport(){
  if(!camera||!renderer)return;
  const aspect=innerWidth/Math.max(1,innerHeight);
  // Closer crop than the old aerial view, but still fits the whole road
  // on portrait phones. Keep the explicit overview as a separate option.
  const mapWidth=mapBounds.maxX-mapBounds.minX;
  const mapHeight=mapBounds.maxZ-mapBounds.minZ;
  const height=game.camera==='overview'?
    Math.max((mapHeight+210)*1.24,(mapWidth+210)*1.20/Math.max(.35,aspect)):
    (aspect<.65?67:aspect<1?60:51);
  camera.top=height*.5;camera.bottom=-height*.5;
  camera.left=-height*aspect*.5;camera.right=height*aspect*.5;
  camera.updateProjectionMatrix();
  // Full-course overview needs a longer draw distance than close follow.
  if(scene?.fog){
    scene.fog.near=game.camera==='overview'?490:165;
    scene.fog.far=game.camera==='overview'?1600:385;
  }
  renderer.setSize(innerWidth,innerHeight);
}
function updateCamera(dt){
  if(typeof document!=='undefined'){
    const miniature=document.getElementById('tiltshift');
    if(miniature)miniature.dataset.view=
      (game.camera==='overview'||game.mode==='intro')?'overview':'race';
  }
  let desire,look;
  if(game.camera==='overview'||game.mode==='intro'){
    const centerX=(mapBounds.minX+mapBounds.maxX)*.5;
    const centerZ=(mapBounds.minZ+mapBounds.maxZ)*.5;
    look=new THREE.Vector3(centerX,1,centerZ);
    desire=new THREE.Vector3(centerX+200,430,centerZ-180);
  }else{
    // Favor the track direction so tight steering doesn't whip the view.
    // A little vehicle heading influences the rear corner perspective.
    const road=point(player.s);
    const driverBias=clamp(modAngle(player.heading-road.angle),-.48,.48)*.16;
    const tangent=road.angle+driverBias;
    const rightX=Math.cos(tangent),rightZ=-Math.sin(tangent);
    const forwardX=Math.sin(tangent),forwardZ=Math.cos(tangent);
    const lead=(player.s+cameraConfig.lookAhead+player.speed*.10)%END;
    const focusPoint=position(lead,clamp(player.d,-HALF,HALF)*cameraConfig.lateralFollow);
    look=new THREE.Vector3(
      focusPoint.x,focusPoint.y+1.6,focusPoint.z
    );
    const altitude=player.grounded?0:clamp(player.y-surfaceHeight(player.s,player.d),0,8);
    desire=new THREE.Vector3(
      player.x-rightX*cameraConfig.side-forwardX*cameraConfig.behind,
      player.y+cameraConfig.elevation+altitude*.08,
      player.z-rightZ*cameraConfig.side-forwardZ*cameraConfig.behind
    );
  }
  const t=Math.max(dt,.001);
  const f=1-Math.exp(-(game.mode==='intro'?2.2:cameraConfig.followDamping)*t);
  camera.position.lerp(desire,f);
  target.lerp(look,1-Math.exp(-cameraConfig.focusDamping*t));
  if(game.shake>0){
    camera.position.x+=(Math.random()-.5)*game.shake*.13;
    game.shake=Math.max(0,game.shake-dt*2.1);
  }
  camera.lookAt(target);
  // Track-relative shadow camera, fixed sun direction. The low afternoon
  // light places long directional shadows consistently across the bend.
  sun.position.set(player.x-52,player.y+65,player.z-60);
  sun.target.position.set(player.x,player.y,player.z);
}
// A schematic overview that automatically fits the full four-sector loop.
const mapBounds=(()=>{
  const x=[],z=[];
  for(let i=0;i<=400;i++){
    const p=point(i/400*END);
    x.push(p.x);z.push(p.z);
  }
  return {minX:Math.min(...x)-12,maxX:Math.max(...x)+12,
    minZ:Math.min(...z)-12,maxZ:Math.max(...z)+12};
})();
function drawMap(){
  const canvas=ui.map,ctx=canvas.getContext('2d');
  if(!ctx)return;
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#193d3a';ctx.fillRect(0,0,w,h);
  const px=p=>({
    x:12+(p.x-mapBounds.minX)/(mapBounds.maxX-mapBounds.minX)*(w-24),
    y:h-12-(p.z-mapBounds.minZ)/(mapBounds.maxZ-mapBounds.minZ)*(h-24)
  });
  const pixel=s=>px(point(s));
  ctx.beginPath();
  for(let i=0;i<=260;i++){
    const q=pixel(END*i/260);
    if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#b3aaa0';ctx.lineWidth=12;ctx.stroke();
  ctx.strokeStyle='#727675';ctx.lineWidth=9;ctx.stroke();
  ctx.strokeStyle='#e3cf7c';ctx.lineWidth=1.0;ctx.setLineDash([3,5]);ctx.stroke();
  ctx.setLineDash([]);
  for(const checkpointS of [SECTOR_1_END,SECTOR_2_END,SECTOR_3_END]){
    const checkpoint=pixel(checkpointS);
    ctx.fillStyle='#132b30';
    ctx.fillRect(checkpoint.x-3,checkpoint.y-6,6,12);
    ctx.fillStyle='#e5fd7c';
    ctx.fillRect(checkpoint.x-2,checkpoint.y-5,4,10);
  }
  const dot=(s,d,color,r)=>{
    const p=position(s,d);
    const q=px(p);
    ctx.fillStyle='#142d33';
    ctx.beginPath();ctx.arc(q.x,q.y,r+1.4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color;
    ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();
  };
  for(const rival of ai)dot(rival.s,rival.d,rival.color,3.5);
  dot(player.s,player.d,'#e5fd7c',4.5);
  ctx.font='bold 10px Arial';
  ctx.fillStyle='#e5fd7c';
  const start=pixel(0),end=pixel(END);
  ctx.fillText('START',Math.max(4,start.x-2),Math.min(h-4,start.y-6));
  ctx.fillText('FINISH',Math.max(4,end.x-12),Math.max(10,end.y+13));
}
function updateHUD(){
  ui.speed.textContent=Math.round(player.speed*5.1);
  ui.time.textContent=timeString(game.time);
  const totalProgress=(game.lap-1)*END+player.s;
  const position=1+ai.filter(a=>racerProgress(a)>totalProgress).length;
  ui.place.textContent=position+' / 4';
  ui.progress.style.width=(clamp(totalProgress/(END*LAPS),0,1)*100).toFixed(1)+'%';
  const sector=player.s>=SECTOR_3_END?4:
    player.s>=SECTOR_2_END?3:player.s>=SECTOR_1_END?2:1;
  ui.sector.textContent=String(sector).padStart(2,'0')+' / 04';
  if(ui.lap)ui.lap.textContent=game.lap+' / '+LAPS;
  ui.heat.style.width=(player.heat*100).toFixed(1)+'%';
  ui.heatLabel.textContent=player.overheated?'OVERHEATED':player.heat>.75?'HOT':controls.boost?'BOOSTING':'COOL';
  ui.heatLabel.style.color=player.overheated?'#ff7c62':'#e5fd7c';
  drawMap();
}
function racerProgress(racer){
  return (racer.lap-1)*END+racer.s;
}
function completeLap(){
  if(game.mode!=='racing')return;
  const lapTime=game.time-game.lapStartTime;
  const sectorTimes=game.checkpoints.slice();
  game.lapSplits.push({lap:game.lap,time:lapTime,sectors:sectorTimes});
  if(game.bestLap===null||lapTime<game.bestLap)game.bestLap=lapTime;
  if(game.lap>=LAPS){
    finishSector();
    return;
  }
  game.lap++;
  game.lapStartTime=game.time;
  game.nextCheckpoint=0;
  game.checkpoints=[];
  // The course centerline is physically closed: relocate the remaining
  // ~3 units from the finish trigger to an equivalent position just beyond
  // the checkered start, avoiding the projection ambiguity at 0/END.
  const lane=clamp(player.d,-HALF+1,HALF-1);
  const p=position(1.4,lane);
  player.s=1.4;player.d=lane;player.x=p.x;player.z=p.z;
  player.y=p.y+.045;player.vy=0;player.grounded=true;player.airtime=0;
  player.pitch=0;
  player.heading=0;
  toast('LAP 1 COMPLETE · LAP 2 GO!',2.3);
  sound(1060,.28,'triangle');
}
function finishSector(){
  if(game.mode!=='racing')return;
  const position=1+ai.filter(a=>a.done!==null).length;
  game.mode='finished';
  ui.results.classList.remove('hidden');
  ui.resultTime.textContent=timeString(game.time);
  ui.resultPlace.textContent=position+' / 4';
  if(ui.resultSplit)ui.resultSplit.textContent=
    game.lapSplits.length?timeString(game.lapSplits[0].time):'--:--.--';
  if(ui.resultLap2)ui.resultLap2.textContent=
    game.lapSplits.length>1?timeString(game.lapSplits[1].time):'--:--.--';
  if(ui.resultBest)ui.resultBest.textContent=
    game.bestLap===null?'--:--.--':timeString(game.bestLap);
  ui.marker.textContent='';
  toast(position===1?'🏆 FIRST PLACE!':'🏁 FINISH LINE!',2);
  sound(position===1?970:640,.25,'triangle');
}

function pause(){
  if(game.mode!=='racing')return;
  game.mode='paused';
  clearKeys();
  ui.pauseOverlay.classList.remove('hidden');
}
function resume(){
  if(game.mode!=='paused')return;
  game.mode='racing';
  ui.pauseOverlay.classList.add('hidden');
}
function clearKeys(){
  Object.keys(controls).forEach(k=>controls[k]=false);
  document.querySelectorAll('[data-key]').forEach(e=>e.classList.remove('pressed'));
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;
    if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);continue;}
    p.mesh.position.x+=p.dx*dt;
    p.mesh.position.y+=(p.dy-4*(.5-p.life))*dt;
    p.mesh.position.z+=p.dz*dt;
    p.mesh.scale.setScalar(Math.max(.05,p.life));
  }
}
function frame(t){
  requestAnimationFrame(frame);
  const dt=clamp((t-lastFrame)/1000,0,.042);
  lastFrame=t;
  worldClock+=dt;
  if(game.mode==='countdown'){
    const old=Math.ceil(game.countdown);
    game.countdown-=dt;
    const n=Math.ceil(Math.max(0,game.countdown));
    ui.marker.textContent=n>0?String(n):'GO!';
    if(n!==old)sound(n>0?450:970,.12,'triangle');
    if(game.countdown<-.43){game.mode='racing';ui.marker.textContent='';}
  }else if(game.mode==='racing'){
    game.time+=dt;
    tickPlayer(dt);
    tickAI(dt);
  }
  positionModels(game.mode==='racing'?dt:.007);
  updateCamera(dt);
  updateHUD();
  audioUpdate();
  updateParticles(dt);
  if(game.toastUntil>0&&performance.now()>game.toastUntil)ui.flash.classList.remove('show');
  renderer.render(scene,camera);
}
function handleKey(e,isDown){
  const maps={
    ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
    KeyW:'accel',ArrowUp:'accel',KeyS:'brake',ArrowDown:'brake',
    ShiftLeft:'boost',ShiftRight:'boost',Space:'boost',
    KeyQ:'leanBack',KeyE:'leanForward'
  };
  if(e.code==='Escape'&&isDown&&!e.repeat){
    if(game.mode==='racing')pause();
    else if(game.mode==='paused')resume();
    e.preventDefault();return;
  }
  if(e.code==='KeyC'&&isDown&&!e.repeat){
    toggleView();e.preventDefault();return;
  }
  if(e.code==='KeyV'&&isDown&&!e.repeat){
    setMiniatureFocus(!miniatureFocusEnabled);
    toast(miniatureFocusEnabled?'MINIATURE LENS ON':'MINIATURE LENS OFF');
    e.preventDefault();return;
  }
  const control=maps[e.code];
  if(control){controls[control]=isDown;e.preventDefault();}
}
function toggleView(){
  game.camera=game.camera==='follow'?'overview':'follow';
  ui.camera.textContent=game.camera==='follow'?'OVERVIEW':'REAR ISO';
  ui.camera.setAttribute('aria-label',game.camera==='follow'?'Switch to entire sector overview':'Return to close rear-quarter isometric camera');
  ui.camera.classList.toggle('active',game.camera==='overview');
  viewport();
  toast(game.camera==='overview'?'FULL CIRCUIT OVERVIEW':'CLOSE REAR-QUARTER ISO');
}
document.addEventListener('keydown',e=>handleKey(e,true),{passive:false});
document.addEventListener('keyup',e=>handleKey(e,false),{passive:false});
window.addEventListener('blur',()=>{if(game.mode==='racing')pause();clearKeys();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='racing')pause();});
for(const button of document.querySelectorAll('[data-key]')){
  const key=button.dataset.key;
  button.addEventListener('pointerdown',e=>{
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    controls[key]=true;button.classList.add('pressed');
  });
  const release=e=>{
    e.preventDefault();controls[key]=false;button.classList.remove('pressed');
  };
  button.addEventListener('pointerup',release);
  button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',release);
}
ui.start.addEventListener('click',()=>reset(true));
ui.retry.addEventListener('click',()=>reset(true));
ui.restart.addEventListener('click',()=>reset(true));
ui.pause.addEventListener('click',pause);
ui.resume.addEventListener('click',resume);
ui.camera.addEventListener('click',toggleView);
if(ui.focusToggle)ui.focusToggle.addEventListener('click',()=>{
  setMiniatureFocus(!miniatureFocusEnabled);
});
ui.exit.addEventListener('click',()=>window.location.assign('./courses.html'));
window.addEventListener('resize',viewport);
window.addEventListener('contextmenu',e=>e.preventDefault());
setup();
viewport();
