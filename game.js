import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const $ = (id) => document.getElementById(id);
const el = {
  game: $('game'), menu: $('menu'), hud: $('hud'), pause: $('pause-screen'),
  finish: $('finish-screen'), toast: $('toast'), countdown: $('countdown'),
  timer: $('timer'), speed: $('speed'), place: $('place'), section: $('section'),
  progress: $('progress'), heat: $('heat-fill'), heatLabel: $('heat-label'),
  bestHUD: $('best-hud'), sound: $('sound'), pauseButton: $('pause'),
  finishTime: $('finish-time'), finishPlace: $('finish-place'), finishBest: $('finish-best'),
  finishTitle: $('finish-title'), medal: $('medal'), newBest: $('new-best'),
  fallback: $('fallback')
};
const FINISH = 1460;
const TRACK_HALF = 8.4;
const CAR_HEIGHT = 0.92;
const GRAVITY = 23;
const isTouch = matchMedia('(pointer: coarse)').matches;
const clamp = THREE.MathUtils.clamp;
const sections = [
  { z: 0, name: 'MULCH MILE' },
  { z: 230, name: 'RULER RAPIDS' },
  { z: 455, name: 'PUDDLE POPPER' },
  { z: 705, name: 'DOUBLE TROUBLE' },
  { z: 965, name: 'GARAGE GAUNTLET' },
  { z: 1230, name: 'FINAL FLYER' }
];
const ramps = [
  {z: 118, length: 19, height: 3.6},
  {z: 346, length: 19, height: 4.4},
  {z: 570, length: 22, height: 3.5},
  {z: 777, length: 22, height: 4.8},
  {z: 1052, length: 21, height: 4.2},
  {z: 1327, length: 25, height: 5.0}
];
const rollers = [
  {z: 53, length: 18, height: 0.85},
  {z: 79, length: 17, height: 0.9},
  {z: 257, length: 16, height: 1.1},
  {z: 282, length: 16, height: 0.9},
  {z: 482, length: 18, height: 0.8},
  {z: 507, length: 17, height: 1.1},
  {z: 735, length: 16, height: 1},
  {z: 753, length: 15, height: 0.85},
  {z: 991, length: 15, height: 1.0},
  {z: 1015, length: 15, height: 1.3},
  {z: 1252, length: 15, height: 0.85},
  {z: 1273, length: 16, height: 1.1}
];
const obstacleData = [
  {z: 172,x:-4.4,type:'cone',radius:1.1},{z:206,x:4.1,type:'crate',radius:1.4},
  {z: 303,x:0.1,type:'cone',radius:1.1},{z:399,x:-4.7,type:'crate',radius:1.3},
  {z: 435,x:4.6,type:'cone',radius:1.1},{z: 626,x:3.8,type:'crate',radius:1.4},
  {z: 678,x:-4.5,type:'cone',radius:1.1},{z: 854,x:0,type:'crate',radius:1.3},
  {z: 893,x:4.5,type:'cone',radius:1.1},{z: 940,x:-4.6,type:'crate',radius:1.4},
  {z:1117,x:0,type:'cone',radius:1.1},{z:1168,x:-4.3,type:'crate',radius:1.3},
  {z:1224,x:4.3,type:'cone',radius:1.1},{z:1378,x:0,type:'crate',radius:1.4}
];
const pickupData = [
  {z:98,x:0},{z:230,x:4.6},{z:326,x:-4.6},{z:462,x:0},
  {z:548,x:4.4},{z:708,x:-4.4},{z:832,x:4.3},{z:955,x:0},
  {z:1035,x:-4.5},{z:1200,x:4.5},{z:1295,x:0},{z:1412,x:-4.4}
];
const keys = {left:false,right:false,accel:false,brake:false,boost:false,leanBack:false,leanForward:false};
const player = {
  z: 12, x: 0, y: CAR_HEIGHT, vy: 0, vx: 0, speed: 0, pitch: 0,
  grounded: true, launchVy: 0, heat: 0, overheated: false, airtime: 0,
  lastGroundZ: 12, hit: new Set(), collected: new Set(), boostActive: false
};
const game = {mode:'menu', time:0, countdown:3.35, autoThrottle:isTouch, toastUntil:0, shake:0, best:null, muted:false};
try { const n = Number(localStorage.getItem('micro-mayhem-best-v1')); if (n > 0 && n < 10000) game.best = n; } catch (_) {}

function centerAt(z) { return Math.sin(z / 115) * 3.1 + Math.sin(z / 48) * 1.4; }
function heightAt(z) {
  let h = 0;
  for (const ramp of ramps) {
    if (z >= ramp.z && z < ramp.z + ramp.length) h += ramp.height * (z - ramp.z) / ramp.length;
  }
  for (const bump of rollers) {
    if (z >= bump.z && z < bump.z + bump.length) {
      h += Math.sin(Math.PI * (z - bump.z) / bump.length) * bump.height;
    }
  }
  return h;
}
function slopeAt(z) { return (heightAt(z + 0.6) - heightAt(z - 0.6)) / 1.2; }
function formatTime(t) {
  const total = Math.max(0, Math.floor(t * 100));
  const mins = Math.floor(total / 6000);
  const secs = Math.floor(total / 100) % 60;
  const hundredths = total % 100;
  return String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0') + '.' + String(hundredths).padStart(2,'0');
}
function ordinal(n) { return ['','1ST','2ND','3RD','4TH'][n] || String(n); }
function rand(n) { const x = Math.sin(n * 117.71 + 5.31) * 47182.934; return x - Math.floor(x); }
function showToast(message, seconds=1.4) {
  el.toast.textContent = message;
  game.toastUntil = performance.now() + seconds * 1000;
  el.toast.classList.add('show');
}
function mat(color, roughness=0.8, metalness=0) {
  return new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true});
}
const materials = {
  dirt: mat('#bb824d'), dirtAlt: mat('#cd945a'), soil: mat('#74513b'),
  grass: mat('#7ebc68'), foliage: mat('#478e58'),
  stem: mat('#337d55'), yellow:mat('#ffda64'),
  wood:mat('#c88c58'), woodDark:mat('#8d5c3c'), white:mat('#fff9df'),
  teal:mat('#5de3da',.35,.16), red:mat('#f66b4d'),
  dark:mat('#213944'), rubber:mat('#203139',.96),
  metal:mat('#becad0',.35,.5), stripe:mat('#f9edcd')
};
let renderer, scene, camera, sun, car, shadow, aiCars = [], pickupMeshes = [];
const scenePieces = [];
const particles = [];
let lastFrame = performance.now();
let audio = null;
let engineOsc = null;
let engineGain = null;
let audioContext = null;

try {
  renderer = new THREE.WebGLRenderer({antialias:!isTouch,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.36;
  renderer.shadowMap.enabled = !isTouch;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.game.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#a6e6f0');
  scene.fog = new THREE.Fog('#a6e6f0', 72, isTouch ? 185 : 230);
  camera = new THREE.PerspectiveCamera(65,innerWidth/innerHeight,0.1,550);
  scene.add(new THREE.HemisphereLight('#fffdf0','#6e9a75',2.25));
  sun = new THREE.DirectionalLight('#fff0c7',2.8);
  sun.position.set(-33,65,-32);
  sun.castShadow = !isTouch;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-48; sun.shadow.camera.right=48;
  sun.shadow.camera.top=54; sun.shadow.camera.bottom=-54;
  sun.shadow.camera.near=1; sun.shadow.camera.far=180;
  sun.shadow.bias=-0.00015;
  scene.add(sun);
  scene.add(sun.target);
  buildWorld();
  resetRace(false);
  requestAnimationFrame(frame);
} catch (error) {
  console.error('Micro Mayhem failed to initialise',error);
  el.fallback.classList.remove('hidden');
}

function mesh(geometry, material, x=0,y=0,z=0,cast=false,receive=false) {
  const m = new THREE.Mesh(geometry,material);
  m.position.set(x,y,z);
  m.castShadow = cast && !isTouch;
  m.receiveShadow = receive && !isTouch;
  return m;
}
function addBox(parent,w,h,d,material,x,y,z,cast=false) {
  const m=mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,cast,true);
  parent.add(m);return m;
}
function addSphere(parent,r,material,x,y,z) {
  const m=mesh(new THREE.IcosahedronGeometry(r,1),material,x,y,z,!isTouch);
  parent.add(m);return m;
}
function textureText(title, subtitle='', dark=false) {
  const canvas=document.createElement('canvas');
  canvas.width=1024;canvas.height=310;
  const c=canvas.getContext('2d');
  c.fillStyle=dark?'#173846':'#e1ff6a';
  c.fillRect(0,0,1024,310);
  c.fillStyle=dark?'#e1ff6a':'#173846';
  c.fillRect(18,18,988,274);
  c.fillStyle=dark?'#173846':'#e1ff6a';
  c.font='italic 900 114px Impact, sans-serif';
  c.textAlign='center';
  c.fillText(title,512,157,940);
  c.font='bold 41px Arial, sans-serif';
  c.fillText(subtitle.toUpperCase(),512,238,930);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
}
function standingSign(z, label, subtitle, right=true) {
  const x=centerAt(z)+(right?16:-16);
  const g=new THREE.Group();g.position.set(x,0,z);
  addBox(g,.35,6,.4,materials.woodDark,-4,3,0);
  addBox(g,.35,6,.4,materials.woodDark,4,3,0);
  g.add(mesh(new THREE.PlaneGeometry(9,2.75),textureText(label,subtitle,true),0,6,0));
  scene.add(g);
}
function createGround() {
  const lawn=mesh(new THREE.PlaneGeometry(420,FINISH+340),materials.grass,0,-0.44,FINISH/2,false,true);
  lawn.rotation.x=-Math.PI/2;scene.add(lawn);
  const under=mesh(new THREE.BoxGeometry(24,1.4,FINISH+100),materials.soil,0,-1.2,FINISH/2);
  scene.add(under);
  const count=Math.ceil((FINISH+25)/0.75);
  const vertices=[],colors=[],indices=[];
  const a=new THREE.Color('#c18b53'),b=new THREE.Color('#b27742');
  for(let i=0;i<=count;i++){
    const z=i*0.75;
    for(let s of [-1,1]){
      vertices.push(centerAt(z)+s*TRACK_HALF,heightAt(z)+0.04,z);
      const col=a.clone().lerp(b,rand(Math.floor(z/7))*0.44);
      colors.push(col.r,col.g,col.b);
    }
  }
  for(let i=0;i<count;i++){
    const n=i*2;
    indices.push(n,n+2,n+1,n+1,n+2,n+3);
  }
  const road=new THREE.BufferGeometry();
  road.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  road.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  road.setIndex(indices);
  road.computeVertexNormals();
  const roadMesh=mesh(road,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),0,0,0,false,true);
  scene.add(roadMesh);
  // Thin track edges curve with the course; lane dashes make the racing lines legible.
  const edgeColor=materials.woodDark;
  for(let z=4;z<FINISH;z+=14){
    for(let s of [-1,1]){
      const m=addBox(scene,.4,.16,10.6,edgeColor,centerAt(z)+s*(TRACK_HALF+.35),heightAt(z)+.09,z);
      m.rotation.y=-(centerAt(z+1)-centerAt(z-1))/2;
    }
    for(let x of [-TRACK_HALF/3, TRACK_HALF/3]){
      const dash=addBox(scene,.12,.06,5.2,materials.stripe,centerAt(z)+x,heightAt(z)+.11,z);
      dash.rotation.y=-(centerAt(z+1)-centerAt(z-1))/2;
    }
  }
  for(let z=14;z<FINISH;z+=7.5){
    for(let side of [-1,1]){
      const x=centerAt(z)+side*(TRACK_HALF-1);
      const skid=addBox(scene,.075,.024,3.3,materials.soil,x,heightAt(z)+.08,z);
      skid.rotation.y=-(centerAt(z+1)-centerAt(z-1))/2;
    }
  }
  // Raised curbs on launch ramps; their brightly coloured tops read at speed.
  for(const ramp of ramps){
    for(let j=0;j<6;j++){
      const z=ramp.z+2+j*(ramp.length-3)/6;
      for(let side of [-1,1]){
        addBox(scene,.8,.13,1.2,j%2?materials.red:materials.yellow,
          centerAt(z)+side*(TRACK_HALF-.55),heightAt(z)+.2,z);
      }
    }
    standingSign(ramp.z-29,'BIG AIR','WATCH YOUR LANDING',rand(ramp.z)>.45);
  }
  for(const section of sections.slice(1)) standingSign(section.z-8,section.name,'BACKYARD BLITZ',rand(section.z)>.4);
  buildStartingGate(10,'START',false);
  buildStartingGate(FINISH,'FINISH',true);
}
function buildStartingGate(z,word,finish=false) {
  const g=new THREE.Group();g.position.set(centerAt(z),0,z);
  for(let side of [-1,1]){
    const pole=addBox(g,.8,12,1,finish?materials.yellow:materials.red,side*(TRACK_HALF+1),6,0);
    pole.castShadow=!isTouch;
    addBox(g,1.5,1,2,materials.dark,side*(TRACK_HALF+1),11.8,0);
  }
  addBox(g,20,1.6,1.6,materials.dark,0,11.7,0);
  const board=mesh(new THREE.PlaneGeometry(17,3.5),textureText(word,finish?'YOU DID IT!':'TINY CARS / BIG TROUBLE',!finish),0,10, -1);
  g.add(board);
  for(let x=-7;x<8;x+=2){
    for(let row=0;row<2;row++){
      addBox(g,1.4,.02,1.35,(Math.floor(x/2)+row)%2?materials.white:materials.dark,x,heightAt(z)+.1,row*1.35-1.1);
    }
  }
  scene.add(g);
}
function buildGarden() {
  // Instanced grass keeps the scene densely populated without excessive draw calls.
  const grassGeo=new THREE.ConeGeometry(.38,1.4,4);
  const grassMat=mat('#3f9964');
  const count=510;
  const instanced=new THREE.InstancedMesh(grassGeo,grassMat,count);
  const temp=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const z=rand(i+501)*(FINISH+80);
    const side=rand(i+1004)>.5?1:-1;
    const dist=10+rand(i+2500)*62;
    temp.position.set(centerAt(z)+side*dist,.1,z);
    const scale=.6+rand(i+2011)*1.35;
    temp.scale.set(scale,scale*1.5,scale);
    temp.rotation.y=rand(i+100)*Math.PI*2;temp.updateMatrix();
    instanced.setMatrixAt(i,temp.matrix);
  }
  instanced.instanceMatrix.needsUpdate=true;
  scene.add(instanced);
  // Oversized garden flowers, bushes, fence pickets, garden stones and playful household props.
  for(let i=0;i<74;i++){
    const z=24+i*19.3;
    const side=i%2?1:-1;
    const x=centerAt(z)+side*(15+rand(i+123)*28);
    if(i%4===0){
      makeFlower(x,z,i);
    } else if(i%3===0){
      makeMushroom(x,z,i);
    } else {
      const bush=addSphere(scene,2+rand(i)*1.5,i%2?materials.foliage:materials.grass,x,1.6,z);
      bush.scale.y=.72;
    }
  }
  for(let z=12;z<FINISH;z+=23){
    for(let side of [-1,1]){
      const x=centerAt(z)+side*47;
      addBox(scene,1.4,6,1.6,materials.wood,x,3,z);
      addBox(scene,1,1.1,4,materials.woodDark,x,5.7,z);
    }
  }
  for(let i=0;i<38;i++){
    const z=35+i*36.8;
    const s=i%2?1:-1;
    makeProp(centerAt(z)+s*(25+rand(i+39)*12),z,i);
  }
  // Distant strips lend depth to the moving backyard.
  for(let i=0;i<14;i++){
    const z=i*114;
    makeTree(centerAt(z)+68,z+35,1.3+rand(i)*.6);
    makeTree(centerAt(z)-73,z+8,1.2+rand(i+2)*.7);
  }
}
function makeFlower(x,z,i){
  const g=new THREE.Group();g.position.set(x,0,z);
  const height=7+rand(i+3)*3;
  addBox(g,.33,height,.33,materials.stem,0,height/2,0);
  addSphere(g,1.5,materials.yellow,0,height,0);
  const petal=mat(i%2?'#fb8d79':'#f9f1d9');
  for(let n=0;n<6;n++){
    const a=n*Math.PI/3;
    const p=addSphere(g,1.4,petal,Math.cos(a)*2,height+Math.sin(a)*2,0);
    p.scale.set(.96,1.16,.4);
  }
  const leaf=addSphere(g,1,materials.foliage,1.1,height*.5,0);
  leaf.scale.set(1.5,.35,.6);
  scene.add(g);
}
function makeMushroom(x,z,i){
  const g=new THREE.Group();g.position.set(x,0,z);
  addBox(g,1.4,3.8,1.4,materials.white,0,1.9,0);
  const cap=mesh(new THREE.ConeGeometry(3.2,2.7,9),i%2?materials.red:materials.yellow,0,4.5,0);
  g.add(cap);scene.add(g);
}
function makeTree(x,z,scale){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);
  addBox(g,2,14,2,materials.woodDark,0,7,0);
  for(let i=0;i<3;i++) addSphere(g,6,materials.foliage,(i-1)*3,16+i%2*2,0);
  scene.add(g);
}
function makeProp(x,z,i){
  const g=new THREE.Group();g.position.set(x,0,z);
  if(i%5===0){
    // Huge watering can.
    addBox(g,8,7,6,materials.teal,0,3.5,0);
    addBox(g,5,1.3,2,materials.metal,5,5,0);
    addBox(g,2.2,7,2,materials.metal,-5,4,0);
  } else if(i%5===1){
    // Striped storage tubs.
    addBox(g,10,7,8,materials.red,0,3.5,0);
    addBox(g,11,1,9,materials.yellow,0,7.1,0);
  } else if(i%5===2){
    // Toy blocks.
    addBox(g,7,6,7,materials.yellow,0,3,0);
    addBox(g,5,5,5,materials.teal,2,8,0);
  } else if(i%5===3){
    // Tall spray bottle.
    addBox(g,5.5,11,5.5,materials.teal,0,5.5,0);
    addBox(g,3,2.6,2.5,materials.white,0,12.3,0);
    addBox(g,5,1.2,2,materials.red,2.2,13,0);
  } else {
    // Small flower pots.
    const pot=mesh(new THREE.CylinderGeometry(5.5,4,7,10),materials.red,0,3.5,0);
    g.add(pot);
    addSphere(g,4.8,materials.foliage,0,9,0);
  }
  g.rotation.y=rand(i+277)*Math.PI;scene.add(g);
}
function createObstacles(){
  for(const o of obstacleData){
    const g=new THREE.Group();g.position.set(centerAt(o.z)+o.x,heightAt(o.z),o.z);
    if(o.type==='cone'){
      const body=mesh(new THREE.ConeGeometry(1,2.4,8),materials.red,0,1.2,0,!isTouch);
      g.add(body);addBox(g,2.4,.22,2.4,materials.dark,0,.12,0);
      const stripe=mesh(new THREE.CylinderGeometry(.51,.67,.34,8),materials.white,0,1.12,0);
      g.add(stripe);
    } else {
      addBox(g,2.5,2.5,2.5,materials.wood,0,1.25,0,true);
      addBox(g,2.6,.25,2.65,materials.woodDark,0,2.4,0);
      addBox(g,2.65,.23,2.65,materials.woodDark,0,.65,0);
      addBox(g,.26,2.45,2.7,materials.woodDark,0,1.3,0);
    }
    scene.add(g);
  }
}
function createPickups(){
  for(const pickup of pickupData){
    const g=new THREE.Group();
    const ring=mesh(new THREE.TorusGeometry(1.1,.28,6,9),materials.teal);
    ring.rotation.y=Math.PI/2;g.add(ring);
    const bolt=mesh(new THREE.OctahedronGeometry(.68,0),materials.yellow);
    g.add(bolt);
    g.position.set(centerAt(pickup.z)+pickup.x,heightAt(pickup.z)+2.5,pickup.z);
    g.userData=pickup;
    pickupMeshes.push(g);scene.add(g);
  }
}
function createCar(color,number){
  const g=new THREE.Group();
  const shell=mat(color,.5,.13);
  const stripe=materials.white, dark=materials.dark;
  addBox(g,1.75,.42,3.1,shell,0,.05,0,true);
  addBox(g,1.5,.45,1.75,shell,0,.45,-.45,true);
  addBox(g,1.41,.35,1.05,dark,0,.56,-.6);
  addBox(g,1.45,.1,.37,materials.metal,0,.48,-1.1);
  addBox(g,1.55,.1,.32,materials.metal,0,.48,.08);
  addBox(g,.33,.07,2.05,stripe,0,.3,.7);
  addBox(g,1.9,.25,.33,materials.dark,0,-.06,1.59);
  addBox(g,1.9,.25,.33,materials.dark,0,-.06,-1.62);
  for(let side of [-1,1]){
    for(let axle of [-1.05,1.08]){
      const tire=mesh(new THREE.CylinderGeometry(.52,.52,.36,12),materials.rubber,side*.99,-.31,axle,true);
      tire.rotation.z=Math.PI/2;g.add(tire);
      const hub=mesh(new THREE.CylinderGeometry(.28,.28,.37,8),materials.metal,side*1.01,-.31,axle);
      hub.rotation.z=Math.PI/2;g.add(hub);
    }
    addBox(g,.23,.16,.3,materials.yellow,side*.7,.08,1.61);
    addBox(g,.23,.16,.3,materials.red,side*.7,.08,-1.62);
  }
  addBox(g,.06,1.25,.07,materials.dark,.6,1.15,-1.15);
  const antenna=addSphere(g,.17,materials.yellow,.6,1.8,-1.15);
  addBox(g,.46,.17,.3,materials.dark,0,.64,-.35);
  const spoiler=addBox(g,2.1,.17,.65,materials.yellow,0,.61,-1.36);
  const numberMaterial=textureText(String(number),'RACING CLUB',false);
  const panel=mesh(new THREE.PlaneGeometry(.75,.3),numberMaterial,0,.59,.19);
  panel.rotation.x=-Math.PI/2;
  g.add(panel);
  g.userData={shell,spoiler,antenna,wheels:g.children.filter(c=>c.geometry?.type==='CylinderGeometry' && c.material===materials.rubber)};
  return g;
}
function buildWorld(){
  createGround();
  buildGarden();
  createObstacles();
  createPickups();
  car=createCar('#ff6b48',7);
  scene.add(car);
  const shadowMat=new THREE.MeshBasicMaterial({color:'#102c30',transparent:true,opacity:.3,depthWrite:false});
  shadow=mesh(new THREE.CircleGeometry(2.1,16),shadowMat);
  shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const rivals=[
    {name:'SKIP',color:'#72e4e5',number:4,lane:-4.8,z:7,base:28.6,seed:.3},
    {name:'NITRO',color:'#ffe16b',number:9,lane:4.7,z:5,base:30.1,seed:1.8},
    {name:'BOLT',color:'#d9a5fb',number:2,lane:0,z:3,base:29.1,seed:3.4}
  ];
  aiCars=rivals.map(r=>({...r,mesh:createCar(r.color,r.number),finishTime:null}));
  for(const ai of aiCars) scene.add(ai.mesh);
}
function resetRace(start){
  player.z=12;player.x=0;player.y=heightAt(12)+CAR_HEIGHT;
  player.vy=0;player.vx=0;player.speed=0;player.pitch=0;
  player.grounded=true;player.launchVy=0;player.heat=0;player.overheated=false;
  player.airtime=0;player.lastGroundZ=12;player.boostActive=false;
  player.hit.clear();player.collected.clear();
  for(let i=0;i<aiCars.length;i++){
    const a=aiCars[i];
    a.z=7-i*3;a.finishTime=null;
  }
  for(const p of pickupMeshes) p.visible=true;
  game.countdown=3.35;game.time=0;game.shake=0;
  for(const k in keys) keys[k]=false;
  document.querySelectorAll('.touch-button').forEach(b=>b.classList.remove('pressed'));
  game.mode=start?'countdown':'menu';
  el.hud.classList.toggle('hidden',!start);
  el.menu.classList.toggle('hidden',start);
  el.pause.classList.add('hidden');
  el.finish.classList.add('hidden');
  el.newBest.classList.add('hidden');
  el.countdown.textContent=start?'3':'';
  updateHUD();
  updateCars(0);
  if(start) initAudio();
}
function onLand(impact){
  const error=Math.abs(player.pitch + Math.atan(slopeAt(player.z)));
  const quality=error < .36 && impact < 18;
  if(player.airtime>.23){
    if(quality){
      player.speed=Math.min(48,player.speed+3);
      player.heat=Math.max(0,player.heat-.11);
      showToast(player.airtime>.9?'✦ BIG AIR · CLEAN LANDING':'✦ PERFECT LANDING');
      beep(740,.12,'triangle');
    } else {
      player.speed*=error>1.0?.53:.79;
      showToast('ROUGH LANDING!');
      beep(110,.18,'sawtooth');
    }
    game.shake=Math.min(.9,impact*.035);
    makeSparks(player.z,player.x,7,quality?'#e8f995':'#ffe3b1');
  }
  player.airtime=0;
  player.grounded=true;player.vy=0;
}
function updatePhysics(dt){
  const steer=(keys.right?1:0)-(keys.left?1:0);
  const throttle=keys.accel?1:(game.autoThrottle?.78:0);
  const brake=keys.brake;
  const boost=keys.boost&&!player.overheated&&player.heat<.995&&player.speed>5&&!brake;
  player.boostActive=boost;
  // Fast, forgiving RC arcade handling rather than a full racing simulator.
  const desired=throttle*(boost?44:35);
  const rate=throttle?1.03:.53;
  player.speed+= (desired-player.speed) * (1-Math.exp(-rate*dt));
  if(brake)player.speed=Math.max(0,player.speed-34*dt);
  if(boost)player.speed=Math.min(47,player.speed+13*dt);
  if(Math.abs(player.x)>TRACK_HALF-1)player.speed=Math.max(8,player.speed-15*dt);
  if(!player.grounded)player.speed=Math.max(0,player.speed-1.2*dt);
  player.speed=clamp(player.speed,0,47);
  if(boost)player.heat=Math.min(1,player.heat+dt*.29);
  else player.heat=Math.max(0,player.heat-dt*(player.grounded?.20:.13));
  if(player.heat>=.995&&!player.overheated){
    player.overheated=true;showToast('⚠ MOTOR OVERHEATED');beep(190,.25,'sawtooth');
  }
  if(player.overheated&&player.heat<.34)player.overheated=false;
  const steerPower=player.grounded?1:.36;
  const vxDesired=steer*player.speed*.32*steerPower;
  player.vx=THREE.MathUtils.damp(player.vx,vxDesired,5.5,dt);
  player.x+=player.vx*dt;
  if(player.x<-10||player.x>10){
    player.x=clamp(player.x,-10,10);
    player.vx*=-.24;player.speed*=Math.max(0,1-dt*1.8);
  }
  const previousGround=heightAt(player.z);
  player.z=Math.min(FINISH+2,player.z+player.speed*dt);
  const ground=heightAt(player.z)+CAR_HEIGHT;
  if(player.grounded){
    const oldY=player.y;
    if(ground<oldY-.15 && player.speed>8){
      player.grounded=false;
      player.airtime=0;
      player.vy=Math.max(1.7,Math.min(15,player.launchVy));
      player.y=oldY;
      player.pitch=Math.min(0,player.pitch);
      if(player.vy>3.5){showToast('↗ BIG AIR!');beep(520,.07,'triangle');}
    }else{
      player.y=ground;
      const slope=slopeAt(player.z);
      if(slope>0)player.launchVy=Math.max(player.launchVy*.35,slope*player.speed*.95);
      else if(slope<-.2)player.launchVy=0;
      else player.launchVy*=Math.exp(-dt*.7);
      const target=-Math.atan(clamp(slope,-.35,.35));
      player.pitch=THREE.MathUtils.damp(player.pitch,target,9,dt);
      player.lastGroundZ=player.z;
    }
  }else{
    player.airtime+=dt;
    player.vy-=GRAVITY*dt;
    player.y+=player.vy*dt;
    const lean=(keys.leanForward?1:0)-(keys.leanBack?1:0);
    player.pitch=clamp(player.pitch+lean*1.65*dt+dt*.15,-1.45,1.45);
    if(player.y<=ground && player.vy<0){
      const impact=Math.abs(player.vy);
      player.y=ground;
      onLand(impact);
    }
  }
  if(player.grounded&&previousGround<=heightAt(player.z) && player.z>player.lastGroundZ+10){
    player.launchVy=0;
  }
  for(let i=0;i<obstacleData.length;i++){
    const o=obstacleData[i];
    if(player.hit.has(i))continue;
    if(Math.abs(player.z-o.z)<1.8 && Math.abs(player.x-o.x)<o.radius+.72 && player.y-heightAt(player.z)<2.3){
      player.hit.add(i);
      player.speed*=.56;
      player.vy=3;
      player.grounded=false;
      player.airtime=0;
      player.pitch-=.13;
      game.shake=.65;
      showToast('CRUNCH! WATCH THE TRACK');
      makeSparks(player.z,player.x,12,'#ffe06c');
      beep(145,.2,'sawtooth');
    }
  }
  for(let i=0;i<pickupData.length;i++){
    if(player.collected.has(i))continue;
    const p=pickupData[i];
    if(Math.abs(player.z-p.z)<2.1 && Math.abs(player.x-p.x)<1.85 &&
        Math.abs(player.y-(heightAt(p.z)+2.5))<3.3){
      player.collected.add(i);
      pickupMeshes[i].visible=false;
      player.heat=Math.max(0,player.heat-.24);
      player.speed=Math.min(47,player.speed+3);
      showToast('⚡ COOLANT PICKUP · +SPEED');
      makeSparks(player.z,player.x,10,'#68f5df');
      beep(980,.14,'sine');
    }
  }
  if(player.z>=FINISH)finishRace();
}
function updateAI(dt){
  for(const ai of aiCars){
    if(ai.z>=FINISH){if(ai.finishTime===null)ai.finishTime=game.time;continue;}
    const w=ai.base+Math.sin(game.time*.19+ai.seed)*2.5+Math.sin(game.time*.63+ai.seed)*.75;
    ai.z=Math.min(FINISH+1,ai.z+Math.max(14,w)*dt);
    if(ai.z>=FINISH)ai.finishTime=game.time;
  }
}
function updateCars(dt){
  const pos=centerAt(player.z)+player.x;
  car.position.set(pos,player.y,player.z);
  car.rotation.order='YXZ';
  car.rotation.y=THREE.MathUtils.damp(car.rotation.y,player.vx*.022+(centerAt(player.z+5)-centerAt(player.z))*.06,6,Math.max(.001,dt));
  car.rotation.x=player.pitch;
  car.rotation.z=THREE.MathUtils.damp(car.rotation.z,-player.vx*.014,5,Math.max(.001,dt));
  if(car.userData.wheels){
    for(const w of car.userData.wheels)w.rotation.x+=dt*player.speed*2.1;
  }
  shadow.position.set(pos,heightAt(player.z)+.08,player.z);
  const altitude=player.y-(heightAt(player.z)+CAR_HEIGHT);
  const shadowScale=1+Math.min(1.5,altitude*.18);
  shadow.scale.set(shadowScale,shadowScale,shadowScale);
  shadow.material.opacity=Math.max(.08,.28-altitude*.024);
  for(const ai of aiCars){
    const z=ai.z, lane=ai.lane+Math.sin(z*.029+ai.seed)*.55;
    ai.mesh.position.set(centerAt(z)+lane,heightAt(z)+CAR_HEIGHT+Math.max(0,Math.sin(z*.11+ai.seed))*.09,z);
    ai.mesh.rotation.y=(centerAt(z+4)-centerAt(z-4))*.015;
    ai.mesh.rotation.x=-Math.atan(clamp(slopeAt(z),-.4,.4))*.55;
    for(const w of ai.mesh.userData.wheels)w.rotation.x+=dt*(ai.base*2);
  }
}
function makeSparks(z,x,count,color){
  for(let i=0;i<count;i++){
    const obj=mesh(new THREE.BoxGeometry(.15,.15,.15),new THREE.MeshBasicMaterial({color}));
    obj.position.set(centerAt(z)+x,player.y-.3,z);
    scene.add(obj);
    particles.push({mesh:obj,life:.35+rand(i+performance.now())*.4,
      x:(rand(i+110)-.5)*8,y:rand(i+210)*7,z:(rand(i+310)-.5)*8});
  }
  while(particles.length>90){
    const p=particles.shift();scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();
  }
}
function updateEffects(dt,time){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;
    if(p.life<=0){
      scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);
    }else{
      p.mesh.position.x+=p.x*dt;
      p.mesh.position.y+=(p.y-5*(.6-p.life))*dt;
      p.mesh.position.z+=p.z*dt;
      p.mesh.scale.setScalar(Math.max(.1,p.life*1.4));
    }
  }
  for(let i=0;i<pickupMeshes.length;i++){
    const p=pickupMeshes[i];
    if(!p.visible)continue;
    p.rotation.y=time*2.5+i;
    p.position.y=heightAt(p.userData.z)+2.6+Math.sin(time*3+i)*.4;
  }
  if(el.toast.classList.contains('show')&&performance.now()>game.toastUntil)el.toast.classList.remove('show');
}
function cameraUpdate(dt,time){
  if(game.mode==='menu'){
    const x=centerAt(12)+3;
    const desired=new THREE.Vector3(x+12,8,12-18);
    camera.position.lerp(desired,1-Math.exp(-2*Math.max(.001,dt)));
    camera.lookAt(centerAt(16),2.2,31);
    camera.fov=62;camera.updateProjectionMatrix();
  }else{
    const speed=player.speed;
    const back=16+speed*.12;
    const height=6.4+speed*.033;
    const desired=new THREE.Vector3(centerAt(player.z)+player.x*.72,player.y+height,player.z-back);
    if(game.shake>0){
      desired.x+=(Math.random()-.5)*game.shake;
      desired.y+=(Math.random()-.5)*game.shake*.45;
      game.shake=Math.max(0,game.shake-dt*2);
    }
    camera.position.lerp(desired,1-Math.exp(-5*Math.max(.001,dt)));
    const look=new THREE.Vector3(centerAt(player.z+18)+player.x*.45,Math.max(1,player.y+1.1),player.z+19);
    camera.lookAt(look);
    const targetFOV=65+speed*.16+(player.grounded?0:4);
    camera.fov=THREE.MathUtils.damp(camera.fov,targetFOV,4,Math.max(.001,dt));
    camera.updateProjectionMatrix();
  }
  sun.position.set(centerAt(player.z)-35,58,player.z+12);
  sun.target.position.set(centerAt(player.z),0,player.z);
}
function updateHUD(){
  const place=1+aiCars.filter(a=>a.z>player.z).length;
  el.place.textContent=place;
  el.timer.textContent=formatTime(game.time);
  el.speed.textContent=String(Math.round(player.speed*4));
  const section=sections.reduce((last,s)=>player.z>=s.z?s:last,sections[0]);
  el.section.textContent=section.name;
  el.progress.style.width=(clamp(player.z/FINISH*100,0,100)).toFixed(1)+'%';
  el.heat.style.width=(player.heat*100).toFixed(1)+'%';
  el.heatLabel.textContent=player.overheated?'OVERHEAT!':player.heat>.72?'HOT':player.boostActive?'TURBO!':'COOL';
  el.heatLabel.style.color=player.overheated?'#ff705a':player.boostActive?'#e1ff6a':'#b6f4e7';
  el.bestHUD.textContent='BEST '+(game.best?formatTime(game.best):'--:--.--');
}
function finishRace(){
  if(game.mode!=='racing')return;
  const place=1+aiCars.filter(ai=>ai.finishTime!==null).length;
  game.mode='finished';
  el.finish.classList.remove('hidden');
  el.hud.classList.add('hidden');
  el.finishTime.textContent=formatTime(game.time);
  el.finishPlace.textContent=ordinal(place)+' / 4';
  let bestSet=false;
  if(game.best===null||game.time<game.best){
    game.best=game.time;bestSet=true;
    try{localStorage.setItem('micro-mayhem-best-v1',String(game.time));}catch(_){}
  }
  el.newBest.classList.toggle('hidden',!bestSet);
  el.finishBest.textContent=formatTime(game.best);
  el.finishTitle.textContent=place===1?'YOU WON!':place===2?'SO CLOSE!':'NICE RUN!';
  const stars=game.time<49?3:game.time<58?2:game.time<69?1:0;
  el.medal.textContent=stars?'★ '.repeat(stars).trim():'KEEP RACING!';
  beep(place===1?950:560,.34,'triangle');
  stopEngine();
}
function beep(hz,duration,type='sine'){
  if(!audioContext||game.muted)return;
  try{
    const osc=audioContext.createOscillator();
    const gain=audioContext.createGain();
    osc.type=type;osc.frequency.value=hz;
    gain.gain.setValueAtTime(.0001,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.07,audioContext.currentTime+.015);
    gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);
    osc.connect(gain);gain.connect(audioContext.destination);
    osc.start();osc.stop(audioContext.currentTime+duration+.015);
  }catch(_){}
}
function initAudio(){
  if(game.muted)return;
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    if(!audioContext)audioContext=new Context();
    audioContext.resume();
    if(!engineOsc){
      engineOsc=audioContext.createOscillator();
      engineGain=audioContext.createGain();
      const filter=audioContext.createBiquadFilter();
      filter.type='lowpass';filter.frequency.value=240;
      engineOsc.type='sawtooth';engineOsc.frequency.value=65;
      engineGain.gain.value=.001;
      engineOsc.connect(filter);filter.connect(engineGain);engineGain.connect(audioContext.destination);
      engineOsc.start();
    }
  }catch(error){console.warn('Audio unavailable',error);}
}
function stopEngine(){if(engineGain&&audioContext)engineGain.gain.setTargetAtTime(.00001,audioContext.currentTime,.06);}
function updateEngine(){
  if(!engineOsc||!engineGain||!audioContext)return;
  const active=game.mode==='racing'||game.mode==='countdown';
  engineOsc.frequency.setTargetAtTime(65+player.speed*4.3+(player.boostActive?65:0),audioContext.currentTime,.08);
  engineGain.gain.setTargetAtTime(active&&!game.muted?.018:.00001,audioContext.currentTime,.12);
}
function frame(time){
  requestAnimationFrame(frame);
  const dt=Math.min(.038,Math.max(0,(time-lastFrame)/1000));
  lastFrame=time;
  if(!scene||!renderer)return;
  if(game.mode==='countdown'){
    const old=Math.ceil(game.countdown);
    game.countdown-=dt;
    const now=Math.ceil(Math.max(0,game.countdown));
    el.countdown.textContent=now>0?String(now):'GO!';
    if(now!==old)beep(now?420:960,.11,'triangle');
    if(game.countdown<-.47){game.mode='racing';el.countdown.textContent='';}
  }else if(game.mode==='racing'){
    game.time+=dt;
    updatePhysics(dt);
    updateAI(dt);
    updateHUD();
  }
  if(game.mode==='menu'){
    car.position.set(centerAt(player.z),heightAt(player.z)+CAR_HEIGHT,player.z);
    car.rotation.y=Math.sin(time*.0004)*.04;
  }
  updateCars(game.mode==='racing'?dt:dt*.18);
  updateEffects(dt,time*.001);
  cameraUpdate(dt,time*.001);
  updateEngine();
  renderer.render(scene,camera);
}
function pauseRace(){
  if(game.mode!=='racing')return;
  game.mode='paused';el.pause.classList.remove('hidden');el.hud.classList.add('hidden');stopEngine();
  clearKeys();
}
function resumeRace(){
  if(game.mode!=='paused')return;
  game.mode='racing';el.pause.classList.add('hidden');el.hud.classList.remove('hidden');initAudio();
}
function clearKeys(){
  for(const k in keys)keys[k]=false;
  document.querySelectorAll('.touch-button').forEach(b=>b.classList.remove('pressed'));
}
function handleKey(event,down){
  const mapping={
    ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',
    ArrowUp:'accel',KeyW:'accel',ArrowDown:'brake',KeyS:'brake',
    ShiftLeft:'boost',ShiftRight:'boost',Space:'boost',
    KeyQ:'leanBack',KeyE:'leanForward'
  };
  if(event.code==='Escape'&&down){
    if(game.mode==='racing')pauseRace();
    else if(game.mode==='paused')resumeRace();
    event.preventDefault();return;
  }
  if(event.code==='KeyT'&&down){game.autoThrottle=!game.autoThrottle;showToast(game.autoThrottle?'AUTO THROTTLE ON':'AUTO THROTTLE OFF');}
  const key=mapping[event.code];
  if(key){
    keys[key]=down;
    event.preventDefault();
  }
}
document.addEventListener('keydown',event=>handleKey(event,true),{passive:false});
document.addEventListener('keyup',event=>handleKey(event,false),{passive:false});
window.addEventListener('blur',()=>{if(game.mode==='racing')pauseRace();clearKeys();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='racing')pauseRace();});
document.querySelectorAll('[data-control]').forEach(button=>{
  const key=button.dataset.control;
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    if(button.setPointerCapture)button.setPointerCapture(event.pointerId);
    keys[key]=true;button.classList.add('pressed');
  });
  const release=event=>{
    event.preventDefault();keys[key]=false;button.classList.remove('pressed');
  };
  button.addEventListener('pointerup',release);
  button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',release);
});
$('play').addEventListener('click',()=>resetRace(true));
$('again').addEventListener('click',()=>resetRace(true));
$('resume').addEventListener('click',resumeRace);
$('restart-pause').addEventListener('click',()=>resetRace(true));
$('quit-pause').addEventListener('click',()=>{resetRace(false);stopEngine();});
$('quit-finish').addEventListener('click',()=>{resetRace(false);stopEngine();});
el.pauseButton.addEventListener('click',pauseRace);
el.sound.addEventListener('click',()=>{
  game.muted=!game.muted;
  el.sound.textContent=game.muted?'♪̸':'♫';
  if(!game.muted)initAudio();
  else stopEngine();
});
window.addEventListener('resize',()=>{
  if(!renderer||!camera)return;
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,isTouch?1.5:2));
  renderer.setSize(innerWidth,innerHeight);
});
window.addEventListener('contextmenu',event=>event.preventDefault());
