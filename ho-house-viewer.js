import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createHOHouse} from './ho-hero-house.js';

/**
 * A standalone, inspectable procedural HO railway model.
 * This page uses exactly the model kit that will inform future town work.
 * Only two dependencies come from the existing Three.js 0.164.1 CDN.
 */
const stage=document.getElementById('stage');
const viewport=document.getElementById('viewport');
const loading=document.getElementById('loading');
const statsElement=document.getElementById('model-stats');
const tiltLayer=document.getElementById('tilt');
const tiltToggle=document.getElementById('tilt-toggle');

const settings={
  palette:'sage',
  lighting:'day',
  view:'hero',
  focus:!(matchMedia('(prefers-reduced-transparency: reduce)').matches),
  details:true
};

const scene=new THREE.Scene();
scene.background=new THREE.Color('#cdded9');
const renderer=new THREE.WebGLRenderer({
  antialias:true,
  alpha:false,
  powerPreference:'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.28;
renderer.setClearColor('#cdded9');
renderer.domElement.setAttribute('aria-label',
  'Interactive 3D procedural HO house with complete model railroad yard');
viewport.appendChild(renderer.domElement);

const camera=new THREE.PerspectiveCamera(36,1,.2,650);
const target=new THREE.Vector3(0,3.0,-.9);
camera.position.set(76,62,104);
camera.lookAt(target);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.085;
controls.rotateSpeed=.65;
controls.zoomSpeed=.81;
controls.minDistance=58;
controls.maxDistance=210;
controls.minPolarAngle=.22;
controls.maxPolarAngle=Math.PI*.47;
controls.enablePan=false;
controls.screenSpacePanning=false;
controls.target.copy(target);
controls.update();

const hemisphere=new THREE.HemisphereLight('#ecf5ff','#89917a',2.0);
hemisphere.position.set(0,85,0);
scene.add(hemisphere);

const sun=new THREE.DirectionalLight('#fff4df',3.10);
sun.position.set(-36,86,62);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-63;
sun.shadow.camera.right=63;
sun.shadow.camera.top=67;
sun.shadow.camera.bottom=-67;
sun.shadow.camera.near=.1;
sun.shadow.camera.far=250;
sun.shadow.bias=-.00018;
sun.shadow.normalBias=.04;
sun.shadow.radius=2.8;
sun.target.position.set(0,0,-3);
scene.add(sun,sun.target);

const fill=new THREE.DirectionalLight('#cfe0ed',1.15);
fill.position.set(70,35,-55);
scene.add(fill);

const studioBase=new THREE.Mesh(
  new THREE.PlaneGeometry(1000,1000),
  new THREE.MeshStandardMaterial({color:'#c6cabd',roughness:1})
);
studioBase.rotation.x=-Math.PI/2;
studioBase.position.y=-2.18;
studioBase.receiveShadow=true;
scene.add(studioBase);

let currentKit=null;
let cameraTween=null;
let lastAnimation=0;
let spinning=true;

const VIEWS={
  hero:[76,62,104],
  front:[0,45,134],
  top:[2,150,29]
};

function animateView(which){
  if(!Object.prototype.hasOwnProperty.call(VIEWS,which))return;
  settings.view=which;
  cameraTween={
    from:camera.position.clone(),
    to:new THREE.Vector3(...VIEWS[which]),
    started:performance.now(),
    duration:760
  };
  for(const button of document.querySelectorAll('[data-view]')){
    button.setAttribute('aria-pressed',
      String(button.dataset.view===which));
  }
}
controls.addEventListener('start',()=>{
  cameraTween=null;
  settings.view='custom';
  for(const button of document.querySelectorAll('[data-view]')){
    button.setAttribute('aria-pressed','false');
  }
});

function disposeKit(kit){
  if(!kit)return;
  scene.remove(kit.root);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  kit.root.traverse(obj=>{
    if(!obj.isMesh)return;
    if(obj.geometry)geometries.add(obj.geometry);
    const meshes=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const material of meshes){
      if(material)materials.add(material);
    }
  });
  for(const material of materials){
    for(const value of Object.values(material)){
      if(value&&value.isTexture)textures.add(value);
    }
    material.dispose();
  }
  for(const geom of geometries)geom.dispose();
  for(const tex of textures)tex.dispose();
}

function countKit(kit){
  let meshes=0,triangles=0,instances=0;
  kit.root.traverse(object=>{
    if(!object.isMesh)return;
    meshes++;
    const geom=object.geometry;
    if(geom){
      const index=geom.getIndex();
      const faces=index?index.count/3:
        (geom.getAttribute('position')?.count||0)/3;
      const multiple=object.isInstancedMesh?object.count:1;
      triangles+=faces*multiple;
      if(object.isInstancedMesh)instances+=multiple;
    }
  });
  return {
    ...kit.stats,
    meshes,
    triangles:Math.round(triangles),
    instances
  };
}

function constructKit(){
  const nextKit=createHOHouse(THREE,{
    seed:1407,
    palette:settings.palette,
    detail:settings.details
  });
  if(!nextKit.root||!nextKit.stats)
    throw new Error('House geometry was not generated.');
  disposeKit(currentKit);
  currentKit=nextKit;
  scene.add(currentKit.root);
  const stats=countKit(currentKit);
  window.__housePreviewState={
    ready:true,
    palette:settings.palette,
    lighting:settings.lighting,
    view:settings.view,
    focus:settings.focus,
    ...stats
  };
  document.body.dataset.houseReady='true';
  document.body.dataset.houseMeshes=String(stats.meshes);
  document.body.dataset.houseTriangles=String(stats.triangles);
  document.body.dataset.houseGrassTufts=String(stats.grassTufts);
  statsElement.innerHTML=
    '<strong>PROCEDURAL KIT 001</strong><br>'+
    stats.meshes.toLocaleString()+' modeled parts · '+
    stats.grassTufts.toLocaleString()+' static-grass tufts<br>'+
    '3 painted clapboard variants · original geometry, no model downloads';
  for(const button of document.querySelectorAll('[data-palette]')){
    const selected=button.dataset.palette===settings.palette;
    button.setAttribute('aria-pressed',String(selected));
    button.textContent=selected?'✓':'';
  }
  renderer.render(scene,camera);
}

function setLight(which){
  settings.lighting=which;
  const lightSets={
    day:{
      bg:'#cdded9',hemisphere:2.0,sun:3.10,fill:1.15,
      exposure:1.28,sunColor:'#fff4df',ground:'#c6cabd'
    },
    golden:{
      bg:'#e6d5c0',hemisphere:1.65,sun:3.45,fill:.88,
      exposure:1.33,sunColor:'#ffbf87',ground:'#cdbda3'
    },
    evening:{
      bg:'#596f82',hemisphere:.80,sun:1.55,fill:.85,
      exposure:1.22,sunColor:'#f5b68c',ground:'#7d8885'
    }
  };
  const chosen=lightSets[which]||lightSets.day;
  scene.background.set(chosen.bg);
  hemisphere.intensity=chosen.hemisphere;
  sun.intensity=chosen.sun;
  sun.color.set(chosen.sunColor);
  fill.intensity=chosen.fill;
  renderer.toneMappingExposure=chosen.exposure;
  studioBase.material.color.set(chosen.ground);
  for(const button of document.querySelectorAll('[data-light]')){
    button.setAttribute('aria-pressed',
      String(button.dataset.light===which));
  }
  if(window.__housePreviewState)window.__housePreviewState.lighting=which;
}

function setFocus(on){
  settings.focus=Boolean(on);
  tiltLayer.dataset.off=String(!settings.focus);
  tiltToggle.setAttribute('aria-pressed',String(settings.focus));
  if(window.__housePreviewState)window.__housePreviewState.focus=settings.focus;
}

function resize(){
  const bounds=viewport.getBoundingClientRect();
  const width=Math.max(1,Math.floor(bounds.width));
  const height=Math.max(1,Math.floor(bounds.height));
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
}

function tick(now){
  if(!spinning)return;
  requestAnimationFrame(tick);
  if(cameraTween){
    const t=Math.max(0,Math.min(1,
      (now-cameraTween.started)/cameraTween.duration));
    const eased=t*t*(3-2*t);
    camera.position.lerpVectors(
      cameraTween.from,cameraTween.to,eased);
    if(t>=1)cameraTween=null;
  }
  controls.update();
  renderer.render(scene,camera);
  lastAnimation=now;
}
function fail(error){
  console.error('HO house preview startup failed',error);
  document.body.dataset.houseReady='error';
  const message=document.getElementById('loading-message');
  message.textContent='Could not display the model: '+
    (error?.message||'Graphics setup failed')+
    '. Please reload this page.';
}

for(const button of document.querySelectorAll('[data-view]')){
  button.addEventListener('click',()=>animateView(button.dataset.view));
}
for(const button of document.querySelectorAll('[data-palette]')){
  button.addEventListener('click',()=>{
    settings.palette=button.dataset.palette;
    try{constructKit();}
    catch(e){fail(e);}
  });
}
for(const button of document.querySelectorAll('[data-light]')){
  button.addEventListener('click',()=>setLight(button.dataset.light));
}
tiltToggle.addEventListener('click',()=>{
  setFocus(!settings.focus);
});
const mediaQuery=window.matchMedia(
  '(prefers-reduced-transparency: reduce)'
);
mediaQuery.addEventListener?.('change',event=>{
  if(event.matches)setFocus(false);
});

const observer=new ResizeObserver(resize);
observer.observe(viewport);
window.addEventListener('pagehide',()=>{
  spinning=false;
  observer.disconnect();
  controls.dispose();
});
try{
  resize();
  constructKit();
  setLight('day');
  setFocus(settings.focus);
  loading.hidden=true;
  requestAnimationFrame(tick);
}catch(e){
  fail(e);
}
