import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import {createHOHouse} from './ho-hero-house.js';
import {RENDER_PRESETS,RENDER_FACTORS,validateRenderState,
  createMaterialExperiment,createContactPatches} from './house-render-lab.js';
import {createHousePhotoPass} from './house-photo-pass.js';

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

const orthographicCamera=new THREE.OrthographicCamera(-42,42,28,-28,.1,350);
// Keep the photographic near plane outside the camera body's immediate
// vicinity: 1 unit versus 0.1 improves usable depth precision tenfold.
const perspectiveCamera=new THREE.PerspectiveCamera(36,1,1,230);
let camera=orthographicCamera;
const modelGroup=new THREE.Group();
scene.add(modelGroup);
const materialExperiment=createMaterialExperiment(THREE);
const contacts=createContactPatches(THREE);
scene.add(contacts.group);
let photoPass=null;
const isLowPower=window.matchMedia('(pointer:coarse)').matches||
  window.innerWidth<700;
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
let activePreset='original';
const labState={...RENDER_PRESETS.original};
const initialPreset=params.get('preset');
const startingPreset=Object.prototype.hasOwnProperty.call(
  RENDER_PRESETS,initialPreset)?initialPreset:'original';

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
  for(const button of document.querySelectorAll('button[data-render-preset]')){
    const selected=button.dataset.renderPreset===activePreset;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  for(const button of document.querySelectorAll('[data-lab-factor]')){
    const key=button.dataset.labFactor;
    const value=key==='dof'?button.dataset.labValue==='true':
      button.dataset.labValue;
    const selected=labState[key]===value;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  const selectedLabel=$('render-lab-status');
  if(selectedLabel){
    selectedLabel.textContent=
      activePreset==='custom'?'Custom rendering comparison':
      RENDER_PRESETS[activePreset]?.label||'Rendering comparison';
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
  materialExperiment.apply(modelGroup,labState.materials==='micro');
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
function updateRoomLighting(){
  const room=labState.light==='room';
  // Original daylight now restores EXACTLY the startup values. The older
  // toggle silently restored different, overbright lights.
  sun.intensity=state.dusk?(room?1.70:2.25):(room?2.48:2.65);
  hemi.intensity=state.dusk?(room?.68:1.05):(room?1.04:1.70);
  ambient.intensity=state.dusk?(room?.18:.45):(room?.18:.28);
  fill.intensity=state.dusk?(room?.26:.60):(room?.38:.64);
  scene.background.set(state.dusk?'#b8aba2':
    room?'#c5c7ba':'#c0cdc5');
  scene.fog.color.copy(scene.background);
  renderer.toneMappingExposure=state.dusk?
    (labState.tone==='neutral'?1.04:1.17):
    (labState.tone==='neutral'?1.08:1.26);
  sun.color.set(state.dusk?'#ffb77b':
    room?'#fff1db':'#ffeee0');
  sun.position.set(state.dusk?-53:(room?-27:-33),
    state.dusk?32:(room?54:62),
    room?38:31);
  scene.environmentIntensity=room?.30:.43;
}
function setLighting(dusk){
  state.dusk=Boolean(dusk);
  updateRoomLighting();
  syncUI();
}
function applyRenderSettings(){
  if(!validateRenderState(labState))
    throw new Error('Invalid house rendering laboratory state');
  renderer.toneMapping=labState.tone==='neutral'?
    THREE.NeutralToneMapping:THREE.ACESFilmicToneMapping;
  // Constrain the physical shadow map to the house and lawn. This gives
  // approximately 3.7x more linear detail than the original 150/1024.
  const detail=labState.shadows==='detail';
  const resolution=detail&&!isLowPower?2048:1024;
  if(sun.shadow.mapSize.x!==resolution){
    sun.shadow.mapSize.set(resolution,resolution);
    sun.shadow.map?.dispose();
    sun.shadow.map=null;
  }
  const limit=detail?40:75;
  sun.shadow.camera.left=-limit;
  sun.shadow.camera.right=limit;
  sun.shadow.camera.top=limit;
  sun.shadow.camera.bottom=-limit;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=detail?-.00014:-.00006;
  sun.shadow.normalBias=detail?.023:.032;
  sun.shadow.needsUpdate=true;
  contacts.setEnabled(detail);
  materialExperiment.apply(modelGroup,labState.materials==='micro');
  camera=labState.lens==='perspective'?
    perspectiveCamera:orthographicCamera;
  updateRoomLighting();
  document.body.dataset.renderPreset=activePreset;
  document.body.dataset.renderTone=labState.tone;
  document.body.dataset.renderLight=labState.light;
  document.body.dataset.renderShadows=labState.shadows;
  document.body.dataset.renderMaterials=labState.materials;
  document.body.dataset.renderLens=labState.lens;
  document.body.dataset.renderDof=String(labState.dof);
  document.body.dataset.renderDofEffective=String(
    labState.dof&&!isLowPower&&labState.lens==='perspective');
  document.body.dataset.renderSeed=String(state.seed);
  resize();
  syncUI();
}
function selectRenderPreset(name){
  const preset=RENDER_PRESETS[name];
  if(!preset)return;
  Object.assign(labState,preset);
  activePreset=name;
  applyRenderSettings();
}
function selectRenderFactor(key,value){
  if(!Object.prototype.hasOwnProperty.call(RENDER_FACTORS,key))return;
  const converted=key==='dof'?value==='true':value;
  if(!RENDER_FACTORS[key].includes(converted))return;
  labState[key]=converted;
  activePreset='custom';
  applyRenderSettings();
}
function resize(){
  const w=Math.max(1,window.innerWidth);
  const h=Math.max(1,window.innerHeight);
  const aspect=w/h;
  const baseHeight=aspect<.70?83:aspect<1?69:57;
  const visibleHeight=baseHeight/state.zoom;
  if(camera.isPerspectiveCamera){
    const radius=state.sceneView==='diecast'?36:87;
    camera.fov=THREE.MathUtils.radToDeg(
      2*Math.atan(baseHeight/(2*radius)));
    camera.aspect=aspect;
    camera.zoom=state.zoom;
  }else{
    camera.left=-visibleHeight*aspect*.5;
    camera.right=visibleHeight*aspect*.5;
    camera.top=visibleHeight*.5;
    camera.bottom=-visibleHeight*.5;
  }
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
for(const button of document.querySelectorAll('button[data-render-preset]')){
  button.addEventListener('click',()=>selectRenderPreset(
    button.dataset.renderPreset));
}
for(const button of document.querySelectorAll('[data-lab-factor]')){
  button.addEventListener('click',()=>selectRenderFactor(
    button.dataset.labFactor,button.dataset.labValue));
}
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
  const usePhoto=labState.dof&&!isLowPower&&
    labState.lens==='perspective';
  if(usePhoto){
    if(!photoPass){
      try{photoPass=createHousePhotoPass(THREE,renderer);}
      catch(error){
        console.warn('Depth of field unavailable, showing original camera',error);
      }
    }
    if(photoPass){
      const target=state.sceneView==='diecast'?
        new THREE.Vector3(9.7,1.03,13.4):
        new THREE.Vector3(window.innerWidth>780?-8:0,2.1,
          window.innerWidth>780?-1:0);
      photoPass.render(scene,camera,target);
    }else{
      renderer.render(scene,camera);
    }
  }else{
    renderer.render(scene,camera);
  }
  if(state.frame<3){
    document.body.dataset.renderedFrame=String(++state.frame);
  }
}
try{
  rebuild();
  setView('three-quarter');
  selectRenderPreset(startingPreset);
  resize();
  animate();
  $('loading').classList.add('hidden');
}catch(error){
  $('loading').classList.remove('hidden');
  $('loading').textContent='3D house failed to start: '+
    (error?.message||String(error));
  console.error('HO hero house preview failed',error);
}
