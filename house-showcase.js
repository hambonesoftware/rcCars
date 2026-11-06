import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import {createHOHouse} from './ho-hero-house.js';

const $=id=>document.getElementById(id);
const stage=$('viewport');
const renderer=new THREE.WebGLRenderer({
  antialias:true,alpha:false,powerPreference:'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.30));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.26;
renderer.domElement.setAttribute('aria-label',
  'Interactive procedural HO model railroad house and landscaped yard');
renderer.domElement.style.touchAction='none';
stage.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color('#c0cdc5');
scene.fog=new THREE.Fog('#c0cdc5',105,175);

/**
 * A cheap plastic train-table toy has soft ceiling-light reflection, not
 * multiple glossy high-end product photography softboxes. Build only
 * two broad, subdued white cards for the die-cast paint and window plastic,
 * preserving the appearance of a room-lit hobby exhibition layout.
 */
function makePlasticStudioReflections(){
  const studio=new THREE.Scene();
  studio.background=new THREE.Color(0x747a73);
  const panels=[
    {p:[-4,8,3],size:[10.5,4.2],color:0xf1f0e5},
    {p:[6,4,-2],size:[4.0,5.1],color:0xa6b1af}
  ];
  for(const part of panels){
    const shape=new THREE.Mesh(
      new THREE.PlaneGeometry(...part.size),
      new THREE.MeshBasicMaterial({color:part.color,side:THREE.DoubleSide})
    );
    shape.position.set(...part.p);
    shape.lookAt(0,0,0);
    studio.add(shape);
  }
  let probe=null;
  try{
    const generator=new THREE.PMREMGenerator(renderer);
    try{
      probe=generator.fromScene(studio,.085,.1,25);
      scene.environment=probe.texture;
      scene.environmentIntensity=.43;
    }finally{
      generator.dispose();
    }
  }catch(error){
    // The basic 3D house must still run on phones that cannot allocate
    // an additional temporary environment capture.
    console.warn('Physical miniature reflection probe unavailable',error);
  }
  studio.traverse(object=>{
    object.geometry?.dispose();
    object.material?.dispose();
  });
  return probe;
}
const studioReflectionProbe=makePlasticStudioReflections();
const hemi=new THREE.HemisphereLight(0xf6faf5,0x968e7f,1.70);
scene.add(hemi);
const ambient=new THREE.AmbientLight(0xf7e8d1,.28);
scene.add(ambient);
const sun=new THREE.DirectionalLight(0xffeee0,2.65);
sun.position.set(-33,62,31);
sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.near=.5;
sun.shadow.camera.far=190;
sun.shadow.camera.left=-75;
sun.shadow.camera.right=75;
sun.shadow.camera.top=75;
sun.shadow.camera.bottom=-75;
sun.shadow.normalBias=.032;
sun.shadow.bias=-.00006;
sun.shadow.radius=2.5;
scene.add(sun,sun.target);
sun.target.position.set(0,0,0);
const fill=new THREE.DirectionalLight(0xb8c6c5,.64);
fill.position.set(34,28,-28);
scene.add(fill);

// Simple photographic studio surface catches the table's shadow.
const studio=new THREE.Mesh(
  new THREE.PlaneGeometry(300,300),
  new THREE.MeshStandardMaterial({color:'#b7beb1',roughness:1})
);
studio.rotation.x=-Math.PI/2;
studio.position.y=-2.20;
studio.receiveShadow=true;
scene.add(studio);

const camera=new THREE.OrthographicCamera(-42,42,28,-28,.1,350);
const modelGroup=new THREE.Group();
scene.add(modelGroup);
const params=new URLSearchParams(location.search);
const seedParameter=params.get('seed');
const validSeed=seedParameter!==null&&
  seedParameter.trim()!==''&&Number.isFinite(Number(seedParameter));
const state={
  palette:['sage','cream','blue'].includes(params.get('color'))?
    params.get('color'):'sage',
  seed:validSeed?Math.max(1,Math.trunc(Number(seedParameter))):1407,
  yaw:-.57,
  elevation:.54,
  zoom:1,
  sceneView:'three-quarter',
  dusk:false,
  busy:false,
  frame:0
};

function syncUI(){
  for(const element of document.querySelectorAll('[data-palette]')){
    const selected=element.dataset.palette===state.palette;
    element.classList.toggle('selected',selected);
    element.setAttribute('aria-pressed',String(selected));
  }
  for(const element of document.querySelectorAll('[data-view]')){
    const selected=element.dataset.view===state.sceneView;
    element.classList.toggle('selected',selected);
    element.setAttribute('aria-pressed',String(selected));
  }
  const seed=$('seed-readout');
  if(seed)seed.textContent=String(state.seed).padStart(4,'0');
  if($('light-switch')){
    $('light-switch').textContent=state.dusk?'Daylight':'Evening';
    $('light-switch').setAttribute('aria-pressed',String(state.dusk));
  }
}
function clearOldModel(){
  const geometries=new Set(),textures=new Set(),materials=new Set();
  modelGroup.traverse(obj=>{
    if(obj.geometry)geometries.add(obj.geometry);
    const ms=Array.isArray(obj.material)?obj.material:
      obj.material?[obj.material]:[];
    for(const m of ms){
      materials.add(m);
      if(m.map)textures.add(m.map);
      if(m.normalMap)textures.add(m.normalMap);
    }
  });
  while(modelGroup.children.length){
    modelGroup.remove(modelGroup.children[0]);
  }
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  for(const texture of textures)texture.dispose();
}
function rebuild(){
  clearOldModel();
  const built=createHOHouse(THREE,{
    seed:state.seed,palette:state.palette,
    detail:true
  });
  modelGroup.add(built.root);
  const houseName=$('house-name');
  if(houseName)houseName.textContent='Elm Street Gable House';
  $('model-summary').textContent=
    'Snap-fit Plasticville-style house kit · glued fake grass mat · die-cast toy car';
  $('object-count').textContent=String(built.stats.grassTufts);
  document.body.dataset.modelReady='true';
  document.body.dataset.modelPalette=built.stats.palette;
  document.body.dataset.modelSeed=String(built.stats.seed);
  document.body.dataset.modelDetail=built.stats.architecture;
  document.body.dataset.modelType='procedural Three.js geometry';
  document.body.dataset.modelCar='diecast';
  document.body.dataset.modelFlocking=String(built.stats.flockingFibers);
  document.body.dataset.modelRealism=built.stats.realismPass;
  document.body.dataset.modelMoldSeams=String(
    built.stats.manufacturing.visibleShellJoints);
  document.body.dataset.modelSnapParts=String(
    built.stats.manufacturing.snapFitParts);
  document.body.dataset.modelMoldShrubs=String(
    built.stats.manufacturing.moldedShrubs);
  document.body.dataset.modelRoofClearcoat=String(
    built.stats.roofShellClearcoat);
  document.body.dataset.modelWallClearcoat=String(
    built.stats.houseWallClearcoat);
  document.body.dataset.modelCarClearcoat=String(
    built.stats.carPaintClearcoat);
  syncUI();
}

function setView(view){
  state.sceneView=view;
  if(view==='overhead'){
    state.yaw=-.45;state.elevation=1.12;
    state.zoom=.89;
  }else if(view==='street'){
    state.yaw=-.30;state.elevation=.31;
    state.zoom=1.12;
  }else if(view==='diecast'){
    state.yaw=.75;state.elevation=.32;
    state.zoom=3.0;
  }else{
    state.yaw=-.57;state.elevation=.54;
    state.zoom=1.0;
  }
  syncUI();
}
function setLighting(dusk){
  state.dusk=dusk;
  sun.intensity=dusk?2.25:3.55;
  hemi.intensity=dusk?1.05:2.05;
  ambient.intensity=dusk?.45:.28;
  fill.intensity=dusk?.60:.92;
  scene.background.set(dusk?'#b8aba2':'#c0cdc5');
  scene.fog.color.copy(scene.background);
  renderer.toneMappingExposure=dusk?1.17:1.26;
  sun.color.set(dusk?'#ffb77b':'#ffe6bd');
  sun.position.set(dusk?-53:-33,dusk?32:62,31);
  syncUI();
}
function resize(){
  const w=Math.max(1,window.innerWidth);
  const h=Math.max(1,window.innerHeight);
  const aspect=w/h;
  const baseHeight=aspect<.70?83:aspect<1?69:57;
  const visibleHeight=baseHeight/state.zoom;
  camera.left=-visibleHeight*aspect*.5;
  camera.right=visibleHeight*aspect*.5;
  camera.top=visibleHeight*.5;
  camera.bottom=-visibleHeight*.5;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}
function updateCamera(){
  const closeup=state.sceneView==='diecast';
  const r=closeup?36:87;
  const focus=closeup?
    new THREE.Vector3(9.7,1.03,13.4):
    new THREE.Vector3(
      window.innerWidth>780?-8:0,
      2.1,
      window.innerWidth>780?-1:0
    );
  const c=Math.cos(state.elevation);
  camera.position.set(
    focus.x+Math.sin(state.yaw)*c*r,
    focus.y+Math.sin(state.elevation)*r,
    focus.z+Math.cos(state.yaw)*c*r
  );
  camera.lookAt(focus);
  camera.updateProjectionMatrix();
}
let pointer=null;
renderer.domElement.addEventListener('pointerdown',e=>{
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
  renderer.domElement.setPointerCapture(e.pointerId);
  stage.classList.add('dragging');
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  state.yaw-=dx*.0062;
  state.elevation=THREE.MathUtils.clamp(
    state.elevation+dy*.0047,.23,1.40
  );
  pointer.x=e.clientX;pointer.y=e.clientY;
});
function endDrag(e){
  if(pointer&&pointer.id===e.pointerId)pointer=null;
  stage.classList.remove('dragging');
}
renderer.domElement.addEventListener('pointerup',endDrag);
renderer.domElement.addEventListener('pointercancel',endDrag);
renderer.domElement.addEventListener('wheel',e=>{
  e.preventDefault();
  state.zoom=THREE.MathUtils.clamp(
    state.zoom*Math.exp(-e.deltaY*.0011),.65,4.2);
  resize();
},{passive:false});
for(const element of document.querySelectorAll('[data-palette]')){
  element.addEventListener('click',()=>{
    if(state.palette!==element.dataset.palette){
      state.palette=element.dataset.palette;
      rebuild();
    }
  });
}
for(const element of document.querySelectorAll('[data-view]')){
  element.addEventListener('click',()=>{
    setView(element.dataset.view);
    resize();
  });
}
$('regen').addEventListener('click',()=>{
  state.seed=(state.seed+104729)%999999;
  if(!state.seed)state.seed=1;
  rebuild();
});
$('light-switch').addEventListener('click',()=>setLighting(!state.dusk));
window.addEventListener('resize',resize,{passive:true});
window.addEventListener('keydown',e=>{
  if(e.key==='1'||e.key==='2'||e.key==='3'){
    setView({1:'three-quarter',2:'street',3:'overhead'}[e.key]);
    resize();
  }
  if(e.key==='r'||e.key==='R'){
    $('regen').click();
  }
});
function animate(){
  requestAnimationFrame(animate);
  updateCamera();
  renderer.render(scene,camera);
  if(state.frame<3){
    document.body.dataset.renderedFrame=String(++state.frame);
  }
}
try{
  rebuild();
  setView('three-quarter');
  resize();
  animate();
  $('loading').classList.add('hidden');
}catch(error){
  $('loading').classList.remove('hidden');
  $('loading').textContent='3D house failed to start: '+
    (error?.message||String(error));
  console.error('HO hero house preview failed',error);
}
