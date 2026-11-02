import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { makeRCTrophyTruck } from './truck-model.js';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const carButtons = [...document.querySelectorAll('[data-car]')];
const carName = document.querySelector('#car-name');
const compact = matchMedia('(max-width: 700px)').matches;
const maxPixelRatio = compact ? 1.4 : 1.8;
const vehicleData = [
  {color:'#d95643',name:'RALLY RED',x:-4.45,z:-3.05},
  {color:'#6ecb55',name:'RACING GREEN',x:-4.45,z:3.55},
  {color:'#4f85df',name:'ELECTRIC BLUE',x:4.45,z:3.55},
  {color:'#f2c33e',name:'SUNBURST YELLOW',x:4.45,z:-3.05}
];

let renderer, camera, scene, trucks, sun, floor;
let selected = 3;
let mode = 'lineup';
const currentTarget = new THREE.Vector3(0,1,0);
const desiredTarget = new THREE.Vector3(0,1,0);
const clock = new THREE.Clock();
const orbit = {theta:2.51,phi:.82,distance:compact?33:29};
const actual = {theta:2.51,phi:.82,distance:compact?33:29};
const pointerPositions = new Map();
let dragStart = null;
let pinchDistance = 0;

function material(color,roughness=.8,metalness=0) {
  return new THREE.MeshStandardMaterial({color,roughness,metalness});
}
function cube(parent,mat,x,y,z,w,h,d) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);
  m.castShadow=true;m.receiveShadow=true;
  parent.add(m);
  return m;
}
function cylinder(parent,mat,x,y,z,radius,height){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,12),mat);
  m.position.set(x,y,z);
  m.castShadow=true;m.receiveShadow=true;
  parent.add(m);
  return m;
}
function asphaltTexture(){
  const size=1024;
  const paper=document.createElement('canvas');
  paper.width=size;paper.height=size;
  const ctx=paper.getContext('2d');
  ctx.fillStyle='#555d5c';ctx.fillRect(0,0,size,size);
  let seed=48713;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<17000;i++){
    const x=rnd()*size,y=rnd()*size,w=.6+rnd()*4;
    const tone=rnd()>.51?'#a5aaa0':'#282c2a';
    ctx.globalAlpha=.045+rnd()*.12;
    ctx.fillStyle=tone;
    ctx.fillRect(x,y,w,w*.7);
  }
  ctx.globalAlpha=1;
  const texture=new THREE.CanvasTexture(paper);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(1.9,2.1);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
function checker(parent,zCenter){
  const white=material('#e7e4d6'),black=material('#4b5454');
  const columns=20,rows=3,tile=1.07;
  const left=-columns*tile/2;
  for(let i=0;i<columns;i++){
    for(let j=0;j<rows;j++){
      cube(parent,(i+j)%2?black:white,
        left+(i+.5)*tile,.047,zCenter+(j-1)*tile,
        tile,.017,tile);
    }
  }
}
function makeStartingGrid(root){
  const asphalt=material('#696d68');
  const ground=material('#6c8462');
  const rim=material('#c6d1ab');
  const yellow=material('#d7bd64');
  const concrete=material('#a0a79e');
  floor=cube(root,asphalt,0,-.19,0,25,.35,29);
  floor.material=new THREE.MeshStandardMaterial({map:asphaltTexture(),roughness:.97});
  // Soft green verges bring the photo's roadside feeling into the 3D scene.
  cube(root,ground,-17.9,-.28,0,10,.25,29);
  cube(root,ground,17.9,-.28,0,10,.25,29);
  for(const side of [-1,1]){
    cube(root,rim,side*12.2,.035,0,.13,.045,28.5);
    for(let i=0;i<29;i++){
      const z=-13.75+i*.97;
      cube(root,i%2?yellow:material('#4e5554'),side*12.55,.055,z,.6,.08,.56);
    }
    for(let i=0;i<20;i++){
      const z=-13.3+i*1.37;
      const x=side*(13.3+((i*11)%17)*.34);
      const stem=new THREE.Mesh(
        new THREE.IcosahedronGeometry(.16+((i*7)%5)*.08,0),
        material(i%3===0?'#668b57':'#426f44'));
      stem.position.set(x,.2+((i*7)%5)*.08,z);
      stem.scale.set(1.8,.8,1.2);
      root.add(stem);
    }
  }
  // White lane box markings from the supplied reference.
  const stripe=material('#f1f0de');
  const positions=[
    [-4.45,-3.05],[-4.45,3.55],[4.45,3.55],[4.45,-3.05]
  ];
  for(const [x,z] of positions){
    const w=6.5,d=5.35,th=.135;
    cube(root,stripe,x-w/2,.07,z,th,.025,d);
    cube(root,stripe,x+w/2,.07,z,th,.025,d);
    cube(root,stripe,x,.07,z-d/2,w,.025,th);
    cube(root,stripe,x,.07,z+d/2,w,.025,th);
  }
  checker(root,8.5);
  // Tire scuffs and a tiny painted course orientation arrow.
  const skid=material('#333c3b');
  for(let i=0;i<3;i++){
    const track=cube(root,skid,-9.5+i*8,.055,-10, .13,.01,4);
    track.rotation.y=.05;
  }
  // Simple kerb blocks in the photo's yellow-black style.
  for(let z=-13.8;z<13.8;z+=1.35){
    for(const side of [-1,1]){
      cube(root,Math.round(z*3)%2?yellow:material('#4a4c41'),
        side*11.8,.085,z,.35,.11,.82);
    }
  }
}
function addAmbientDetails(root){
  const darkGreen=material('#385e3d'),green=material('#4d8755');
  // Deliberately sparse vegetation keeps the four trucks visually dominant.
  for(let i=0;i<62;i++){
    const side=i%2===0?-1:1;
    const x=side*(15.3+(Math.sin(i*9.31)*.5+.5)*6.7);
    const z=-13.8+((i*17)%61)/61*28;
    const r=.5+(i%7)*.115;
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),i%3===0?darkGreen:green);
    b.position.set(x,r*.7,z);
    b.scale.set(1.25,.7,1);
    b.castShadow=true;
    root.add(b);
  }
  // RC scale: a few tall realistic-looking plants, far from the race boxes.
  for(let i=0;i<6;i++){
    const side=i%2===0?-1:1;
    const x=side*(20.5+(i%3)*1.2);
    const z=-11+i*4;
    cylinder(root,material('#7c6b4e'),x,1,z,.22,2);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.05,1),green);
    crown.position.set(x,3,z);crown.castShadow=true;
    root.add(crown);
  }
}
function makeGroundShadow(root,x,z){
  const p=document.createElement('canvas');
  p.width=p.height=64;
  const ctx=p.getContext('2d');
  const g=ctx.createRadialGradient(32,32,1,32,32,31);
  g.addColorStop(0,'rgba(0,0,0,.38)');
  g.addColorStop(.55,'rgba(0,0,0,.14)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(p);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(3.7,5.5),
    new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(x,.062,z);
  root.add(m);
}
function init(){
  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:!compact,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,maxPixelRatio));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.46;
    renderer.shadowMap.enabled=!compact;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setClearColor('#9cc2c0');
    scene=new THREE.Scene();
    scene.background=new THREE.Color('#a7c6c1');
    scene.fog=new THREE.Fog('#a7c6c1',45,115);
    camera=new THREE.PerspectiveCamera(37,1,.1,200);
    scene.add(new THREE.HemisphereLight('#fffbe7','#4e655e',2.1));
    sun=new THREE.DirectionalLight('#fff0cf',3.0);
    sun.position.set(-18,30,9);
    sun.castShadow=!compact;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-30;sun.shadow.camera.right=30;
    sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;
    sun.shadow.camera.near=1;sun.shadow.camera.far=100;
    sun.shadow.bias=-.00018;
    scene.add(sun);
    makeStartingGrid(scene);
    addAmbientDetails(scene);
    trucks=vehicleData.map(item=>{
      const truck=makeRCTrophyTruck(THREE,item.color);
      truck.position.set(item.x,.065,item.z);
      truck.rotation.y=-.07;
      truck.userData.entry=item;
      scene.add(truck);
      makeGroundShadow(scene,item.x,item.z);
      return truck;
    });
    updateViewport();
    updateSelection();
    loading.classList.add('hidden');
    requestAnimationFrame(frame);
  }catch(err){
    console.error(err);
    loading.textContent='3D preview could not load. Please try a newer browser with WebGL.';
  }
}
function updateViewport(){
  if(!renderer)return;
  const w=innerWidth,h=innerHeight;
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
function selectTruck(index){
  selected=index;
  carName.textContent=vehicleData[index].name;
  carButtons.forEach((b,i)=>b.classList.toggle('active',i===index));
  if(mode==='lineup')setMode('detail');
  else updateTarget();
}
function updateSelection(){
  carName.textContent=vehicleData[selected].name;
  carButtons.forEach((b,i)=>b.classList.toggle('active',i===selected));
}
function updateTarget(){
  if(mode==='lineup'){
    desiredTarget.set(0,.8,0);
  }else{
    desiredTarget.set(vehicleData[selected].x,1.38,vehicleData[selected].z);
  }
}
function setMode(nextMode){
  mode=nextMode;
  viewButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===mode));
  if(mode==='lineup'){
    orbit.phi=.82;orbit.theta=2.51;orbit.distance=compact?33:29;
  }else if(mode==='top'){
    orbit.phi=.12;orbit.theta=2.45;orbit.distance=compact?18:14;
  }else{
    orbit.phi=1.00;orbit.theta=2.43;orbit.distance=compact?12.2:8.5;
  }
  updateTarget();
}
function render(){
  renderer.render(scene,camera);
}
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.05);
  actual.theta=THREE.MathUtils.damp(actual.theta,orbit.theta,7,dt);
  actual.phi=THREE.MathUtils.damp(actual.phi,orbit.phi,7,dt);
  actual.distance=THREE.MathUtils.damp(actual.distance,orbit.distance,6,dt);
  currentTarget.lerp(desiredTarget,1-Math.exp(-8*dt));
  const spherical=new THREE.Spherical(actual.distance,actual.phi,actual.theta);
  const offset=new THREE.Vector3().setFromSpherical(spherical);
  camera.position.copy(currentTarget).add(offset);
  camera.lookAt(currentTarget);
  // Gently idle one showcased vehicle; keep the four-truck reference lineup static.
  if(mode==='detail'||mode==='top'){
    const model=trucks[selected];
    model.rotation.y=-.07+Math.sin(clock.elapsedTime*.25)*.027;
  }
  render();
}
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);
  pointerPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
  dragStart={x:e.clientX,y:e.clientY};
  if(pointerPositions.size===2){
    const [a,b]=[...pointerPositions.values()];
    pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!pointerPositions.has(e.pointerId))return;
  const old=pointerPositions.get(e.pointerId);
  pointerPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointerPositions.size===1){
    orbit.theta+=(old.x-e.clientX)*.006;
    orbit.phi=THREE.MathUtils.clamp(orbit.phi+(old.y-e.clientY)*.005,.09,1.45);
  }else if(pointerPositions.size===2){
    const [a,b]=[...pointerPositions.values()];
    const distance=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinchDistance>0){
      orbit.distance=THREE.MathUtils.clamp(orbit.distance*pinchDistance/Math.max(1,distance),5,48);
    }
    pinchDistance=distance;
  }
});
function release(e){pointerPositions.delete(e.pointerId);if(pointerPositions.size<2)pinchDistance=0;}
canvas.addEventListener('pointerup',release);
canvas.addEventListener('pointercancel',release);
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  orbit.distance=THREE.MathUtils.clamp(orbit.distance*Math.exp(e.deltaY*.0007),5,48);
},{passive:false});
carButtons.forEach(button=>button.addEventListener('click',()=>selectTruck(Number(button.dataset.car))));
viewButtons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.view)));
window.addEventListener('resize',updateViewport);
init();
