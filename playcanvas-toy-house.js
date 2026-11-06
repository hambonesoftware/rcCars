import * as pc from 'playcanvas';
import {buildPhotographicMiniature} from './photographic-miniature.js';

/**
 * Micro Mayhem · PlayCanvas miniature world proof-of-concept.
 *
 * Separate PlayCanvas WebGL2 engine, not a wrapper around Three.js.
 * The toy car optionally loads a Creative Commons Zero glTF model from
 * KhronosGroup/glTF-Sample-Assets (ToyCar, CC0-1.0).
 *
 * All other geometry, turf imagery, facade parts and roadwork are generated
 * locally and seeded. This is a visual ENGINE test, not yet the race game.
 */
const canvas=document.querySelector('#playcanvas');
const loading=document.querySelector('#loading');
const assetStatus=document.querySelector('#asset-status');
const viewer=document.querySelector('.viewer');
const state={
  light:'table',
  view:'three-quarter',
  yaw:Math.PI/4.2,
  pitch:.48,
  radius:37,
  target:new pc.Vec3(0,2.3,-.4),
  pointer:null,
  touches:new Map(),
  modelLoaded:false,
  ready:false
};
let pcApp=null;

function color(hex){
  const text=hex.replace('#','');
  const n=parseInt(text,16);
  return new pc.Color(
    ((n>>16)&255)/255,
    ((n>>8)&255)/255,
    (n&255)/255
  );
}
function makeMaterial(name,hex,{roughness=.60,metalness=0,
  clearcoat=0,clearcoatGloss=.65,map=null}={}){
  const m=new pc.StandardMaterial();
  m.name=name;
  m.diffuse=color(hex);
  m.useMetalness=true;
  m.metalness=metalness;
  m.gloss=1-roughness;
  m.clearCoat=clearcoat;
  m.clearCoatGloss=clearcoatGloss;
  if(map)m.diffuseMap=map;
  m.update();
  return m;
}
function block(parent,name,material,xyz,size,rotation=[0,0,0],mesh='box'){
  const entity=new pc.Entity(name);
  entity.addComponent('render',{type:mesh,material});
  entity.setLocalPosition(...xyz);
  entity.setLocalEulerAngles(...rotation);
  entity.setLocalScale(...size);
  parent.addChild(entity);
  entity.render.castShadows=true;
  entity.render.receiveShadows=true;
  return entity;
}
function seededRandom(seed=12425){
  let s=seed>>>0;
  return ()=>{
    s=(Math.imul(s,1664525)+1013904223)>>>0;
    return s/4294967296;
  };
}
function makeFlockTexture(device){
  const size=256;
  const pixel=document.createElement('canvas');
  pixel.width=pixel.height=size;
  const ctx=pixel.getContext('2d',{alpha:false});
  const rand=seededRandom(1927);
  ctx.fillStyle='#94a56f';
  ctx.fillRect(0,0,size,size);
  // Model-railroad surface flock: small, almost uniformly sized fibers,
  // visible as a matted surface instead of cartoon upright grass blades.
  for(let n=0;n<45000;n++){
    const x=rand()*size,y=rand()*size;
    const shade=rand();
    ctx.fillStyle=shade<.34?'rgba(47,70,37,.23)':
      shade<.68?'rgba(198,201,125,.24)':
      'rgba(100,117,57,.24)';
    ctx.fillRect(x,y,.35+rand()*.9,.55+rand()*1.5);
  }
  const t=new pc.Texture(device,{
    width:size,height:size,
    format:pc.PIXELFORMAT_RGBA8,
    mipmaps:true
  });
  t.setSource(pixel);
  t.addressU=pc.ADDRESS_REPEAT;
  t.addressV=pc.ADDRESS_REPEAT;
  t.minFilter=pc.FILTER_LINEAR_MIPMAP_LINEAR;
  t.magFilter=pc.FILTER_LINEAR;
  t.anisotropy=4;
  return t;
}
async function start(){
  const device=await pc.createGraphicsDevice(canvas,{
    deviceTypes:[pc.DEVICETYPE_WEBGL2],
    antialias:true
  });
  device.maxPixelRatio=Math.min(window.devicePixelRatio||1,1.5);
  const options=new pc.AppOptions();
  options.graphicsDevice=device;
  options.componentSystems=[
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
  ];
  options.resourceHandlers=[
    pc.TextureHandler,
    pc.ContainerHandler
  ];
  const app=new pc.AppBase(canvas);
  pcApp=app;
  app.init(options);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.scene.ambientLight=color('#969d9b');
  app.scene.exposure=1.08;

  const camera=new pc.Entity('PlayCanvas photographic camera');
  camera.addComponent('camera',{
    clearColor:color('#b9b6a9'),
    nearClip:.4,
    farClip:250,
    fov:40
  });
  camera.camera.toneMapping=pc.TONEMAP_NEUTRAL;
  app.root.addChild(camera);

  const sun=new pc.Entity('Indoor daylight key');
  sun.addComponent('light',{
    type:'directional',
    color:color('#fff4e6'),
    intensity:1.72,
    castShadows:true,
    shadowResolution:2048,
    shadowDistance:58
  });
  sun.setEulerAngles(59,-42,0);
  app.root.addChild(sun);

  const fill=new pc.Entity('Diffused ceiling bounce');
  fill.addComponent('light',{
    type:'directional',
    color:color('#e7e3d9'),
    intensity:.28,
    castShadows:false
  });
  fill.setEulerAngles(40,146,0);
  app.root.addChild(fill);

  const mats={
    plywood:makeMaterial('Painted plywood display edge','#ac835b',{roughness:.7}),
    plasticBase:makeMaterial('Model railway grass sheet backing','#777c60',{roughness:.95}),
    flock:makeMaterial('Synthetic granular grass flock','#829361',{roughness:1,map:makeFlockTexture(device)}),
    pavement:makeMaterial('Cast-in-place gray model concrete','#c1bfb3',{roughness:.90}),
    road:makeMaterial('Matte miniature road surface','#4a5355',{roughness:.94}),
    paint:makeMaterial('Road stripe paint','#dfcf90',{roughness:.9}),
    wall:makeMaterial('Colored-in-mold polystyrene','#c3cebf',{roughness:.44,clearcoat:.12}),
    wallAlt:makeMaterial('Cream plastic garage siding','#d2d0c4',{roughness:.47,clearcoat:.12}),
    foundation:makeMaterial('Gray plastic footings','#92938a',{roughness:.74}),
    roof:makeMaterial('Gray injection-molded shingle shell','#626b70',{roughness:.52,clearcoat:.09}),
    seam:makeMaterial('Joint between snap-fit roof shells','#343d42',{roughness:.76}),
    trim:makeMaterial('Off-white snap-in window frames','#f4f0e3',{roughness:.34,clearcoat:.18}),
    glass:makeMaterial('Tinted molded acrylic window insert','#42565c',{roughness:.18,clearcoat:.50,clearcoatGloss:.9}),
    door:makeMaterial('Dark plastic entry door','#446b68',{roughness:.37,clearcoat:.3}),
    garageDoor:makeMaterial('One-piece sectional garage insert','#dfdbca',{roughness:.40,clearcoat:.25}),
    wood:makeMaterial('Cheap fence plastic','#eee8ce',{roughness:.55,clearcoat:.08}),
    hedge:makeMaterial('Molded plastic hedge pieces','#47734b',{roughness:.68}),
    shrub:makeMaterial('Plastic shrub foliage','#648d59',{roughness:.73}),
    flowers:makeMaterial('Pink molded flowers','#d68b91',{roughness:.67}),
    flowerCream:makeMaterial('Pressed plastic blossom insert','#e8d0a1',{roughness:.55,clearcoat:.13}),
    sidingEdge:makeMaterial('Fine lap-siding mold parting line','#a0afa0',{roughness:.63}),
    drivewayJoint:makeMaterial('Scribed concrete panel joints','#8b8d83',{roughness:.95}),
    gardenBed:makeMaterial('Fine dark model-railroad bark ballast','#625346',{roughness:1}),
    gardenStone:makeMaterial('Painted garden edging stones','#d2c9af',{roughness:.89}),
    gutter:makeMaterial('Snap-on pale plastic gutters','#ecebe4',{roughness:.45,clearcoat:.16}),
    tree:makeMaterial('Brown molded tree trunk','#866a51',{roughness:.75}),
    leaves:makeMaterial('Plastic foliage canopy','#668454',{roughness:.75}),
    leavesBright:makeMaterial('Plastic foliage canopy highlights','#94a875',{roughness:.72}),
    carBody:makeMaterial('Die-cast lacquer body','#b94e3c',{roughness:.26,metalness:.54,clearcoat:.87,clearcoatGloss:.9}),
    carBase:makeMaterial('Injection-molded black toy chassis','#22282a',{roughness:.82}),
    chrome:makeMaterial('Vacuum-plated plastic chrome','#c4c9c9',{roughness:.24,metalness:.82}),
    tires:makeMaterial('Black plastic tires','#292b2c',{roughness:.95})
  };
  const model=new pc.Entity('HO town block display');
  app.root.addChild(model);

  block(model,'Plywood workbench base',mats.plywood,[0,-.7,0],[37,1.5,33]);
  block(model,'Backing of fake grass',mats.plasticBase,[0,.13,0],[36.5,.12,32.5]);
  block(model,'Glued-on commercial grass mat',mats.flock,[0,.21,-1.55],[35.8,.11,28.0]);
  block(model,'Toy scale road',mats.road,[0,.23,13.6],[36.5,.16,5.6]);
  block(model,'Concrete curb and pedestrian sidewalk',mats.pavement,[0,.32,10.4],[36.5,.21,1.15]);
  for(let x=-13;x<=13;x+=6){
    block(model,'Printed road center stripe',mats.paint,[x,.32,15.0],[3.5,.018,.085]);
  }
  const house=new pc.Entity('Manufactured plastic house kit');
  model.addChild(house);

  block(house,'Main injection-molded wall shell',mats.wall,[-4.0,3.48,-4.0],[13.4,6.65,9.4]);
  block(house,'Snap-fit foundation',mats.foundation,[-4,.30,-4],[13.8,.53,9.8]);
  block(house,'Garage foundation',mats.foundation,[8.65,.28,-3.1],[9.2,.52,9.8]);
  block(house,'Garage molded wall shell',mats.wallAlt,[8.65,2.39,-3.1],[8.9,4.55,9.3]);
  // Roof shells are deliberately TWO thick rigid plastic pieces. Their
  // darker joint and painted edge seams should be visible in closeups.
  const housePitch=27;
  for(const side of [-1,1]){
    block(house,'Molded shingled roof half',mats.roof,
      [-4+side*3.38,7.98,-4],
      [8.18,.31,10.8],[0,0,side*-housePitch]);
    block(house,'Roof under-edge plastic lip',mats.seam,
      [-4+side*6.56,6.89,-4],
      [.16,.15,11.0]);
  }
  block(house,'Roof ridge joint',mats.seam,[-4,9.58,-4],[.31,.19,11.2]);
  // Distinct injection-molded shingle courses follow the actual roof slope.
  // This is relief geometry, not a photograph pasted on a box.
  for(const side of [-1,1]){
    const roofCenter=-4+side*3.38;
    const roofAngle=side*-housePitch;
    for(let n=1;n<=8;n++){
      const localX=(n-4.5)*.77;
      const x=roofCenter+localX;
      const y=7.98-side*Math.tan(housePitch*Math.PI/180)*localX+.20;
      block(house,'Raised molded shingle-course lap',mats.seam,
        [x,y,-4],[.053,.04,10.45],[0,0,roofAngle]);
    }
    for(let n=0;n<5;n++){
      const z=-8.55+n*2.25;
      const x=roofCenter+side*.15;
      const y=7.98-side*Math.tan(housePitch*Math.PI/180)*(x-roofCenter)+.22;
      block(house,'Short offset shingle end joint',mats.seam,
        [x,y,z],[.85,.036,.05],[0,0,roofAngle]);
    }
  }
  for(const z of [-9.25,1.25]){
    block(house,'White clip-on eave gutter',mats.gutter,[-4,7.04,z],
      [13.7,.18,.20]);
  }

  const garagePitch=26;
  for(const side of [-1,1]){
    block(house,'Garage roof molded half',mats.roof,
      [8.65+side*2.13,5.84,-3.1],
      [5.10,.27,10.3],[0,0,side*-garagePitch]);
  }
  block(house,'Garage ridge seam',mats.seam,[8.65,6.91,-3.1],[.27,.15,10.4]);
  // Roof facets and chimney are deliberately not a photoreal wall texture:
  // they expose the manufacturing joins of a model kit.
  block(house,'Brick-red clip-on chimney',makeMaterial('Brick plastic','#9b5d50',{roughness:.61}),[-7.5,9.9,-6.4],[1.34,3.10,1.45]);
  block(house,'Chimney cap',mats.seam,[-7.5,11.57,-6.4],[1.68,.16,1.8]);

  function framedWindow(x,y,z,w=1.8,h=2.10){
    block(house,'Window outer snap-in trim',mats.trim,[x,y,z],[w+.31,h+.32,.21]);
    block(house,'Dark glossy acrylic insert',mats.glass,[x,y,z+.15],[w,h,.085]);
    block(house,'Window center mullion',mats.trim,[x,y,z+.23],[.095,h,.08]);
    block(house,'Window horizontal mullion',mats.trim,[x,y,z+.23],[w,.10,.08]);
    block(house,'Window sill',mats.trim,[x,y-h*.53,z+.31],[w+.43,.14,.46]);
  }
  const frontZ=.78;
  // Mold-part lap lines terminate at actual window and door openings.
  // Avoid drawing horizontal stripes straight across the acrylic glazing.
  const frontOpenings=[
    [-8.45,3.8,2.0,1.9],
    [-.02,3.8,2.0,1.9],
    [-4.0,4.85,1.85,1.62],
    [-4.0,1.75,1.60,2.85]
  ];
  let sidingPieces=0;
  for(let y=.64;y<=6.60;y+=.29){
    let runs=[[-10.57,2.57]];
    for(const [cx,cy,w,h] of frontOpenings){
      if(y<cy-h/2-.11||y>cy+h/2+.11)continue;
      const left=cx-w/2-.12,right=cx+w/2+.12;
      runs=runs.flatMap(([a,b])=>{
        if(right<=a||left>=b)return [[a,b]];
        const parts=[];
        if(left-a>.20)parts.push([a,left]);
        if(b-right>.20)parts.push([right,b]);
        return parts;
      });
    }
    for(const [a,b] of runs){
      block(house,'Scale molded clapboard overlap',mats.sidingEdge,
        [(a+b)/2,y,frontZ+.025],[b-a,.045,.11]);
      sidingPieces++;
    }
  }
  framedWindow(-8.45,3.8,frontZ,2.0,1.9);
  framedWindow(-.02,3.8,frontZ,2.0,1.9);
  framedWindow(-4.0,4.85,frontZ,1.85,1.62);
  block(house,'Molded front door',mats.door,[-4.0,1.75,frontZ+.10],[1.60,2.85,.21]);
  block(house,'Door frame',mats.trim,[-4,3.23,frontZ+.17],[2.05,.16,.31]);
  block(house,'Porch step',mats.pavement,[-4,.30,2.6],[4.7,.44,3.3]);
  block(house,'Wide front steps',mats.pavement,[-4,.19,4.20],[2.65,.25,1.0]);
  block(house,'Molded porch canopy',mats.roof,[-4,4.03,2.6],[5.5,.29,3.7]);
  for(const x of [-6.4,-1.6]){
    block(house,'Molded veranda post',mats.trim,[x,2.15,4.05],[.20,3.48,.20]);
  }
  // The cheap plastic garage door is one fitted insert and broad stamped ribs.
  const garageZ=1.65;
  block(house,'Garage opening dark joint',mats.seam,[8.65,2.45,garageZ],[6.25,4.30,.18]);
  block(house,'Injected garage door face',mats.garageDoor,[8.65,2.46,garageZ+.11],[6.06,4.13,.15]);
  for(let y=.92;y<4.28;y+=.75){
    block(house,'Garage door panel groove',mats.foundation,[8.65,y,garageZ+.24],[5.85,.055,.063]);
  }
  for(const x of [6.7,8.0,9.3,10.6]){
    block(house,'Garage window in stamped door',mats.glass,[x,3.87,garageZ+.25],[.73,.44,.06]);
  }

  block(model,'Garage concrete driveway',mats.pavement,[8.65,.28,6.30],[6.8,.10,9.7]);
  block(model,'House path to the street',mats.pavement,[-4,.29,6.35],[1.78,.09,9.5]);
  // Scribed expansion joints, slab modules and ballast planters reveal
  // the separate pieces of a hand-built railway layout.
  for(const z of [3.55,6.1,8.65]){
    block(model,'Driveway expansion joint',mats.drivewayJoint,
      [8.65,.337,z],[6.68,.012,.042]);
    block(model,'Walkway joint',mats.drivewayJoint,
      [-4,.348,z],[1.72,.012,.043]);
  }
  block(model,'Fine ballast front planting bed',mats.gardenBed,
    [-9.2,.325,2.52],[3.0,.095,1.25]);
  block(model,'Fine ballast side planting bed',mats.gardenBed,
    [1.26,.325,2.52],[2.45,.095,1.25]);
  for(const x of [-10.62,-9.74,-8.86,-7.98,.15,.95,1.75]){
    block(model,'Scattered molded ornamental foliage',mats.shrub,
      [x,.55,2.5],[.52,.48,.55],[0,0,0],'sphere');
    block(model,'Clip-in flower head',mats.flowers,
      [x+.14,.88,2.48],[.20,.15,.19],[0,0,0],'sphere');
    block(model,'Small cream flower insert',mats.flowerCream,
      [x-.15,.82,2.3],[.17,.12,.14],[0,0,0],'sphere');
  }
  for(const [x,z] of [[-10.8,3.27],[-7.72,3.27],[-.05,3.25],[2.52,3.25]]){
    block(model,'Garden bed stone edging',mats.gardenStone,
      [x,.39,z],[.68,.18,.31]);
  }
  // Separate toy accessories keep recognizable real-world scale.
  block(model,'Mailbox mounting post',mats.wood,[-14.7,.84,9.28],[.15,1.3,.15]);
  block(model,'Injection-molded rural mailbox',mats.garageDoor,
    [-14.7,1.58,9.28],[.76,.46,.48]);
  block(model,'Molded red mailbox flag',mats.carBody,
    [-14.25,1.66,9.28],[.06,.44,.15]);
  for(const x of [-7.8,0.10]){
    block(house,'Porch wall lantern body',mats.seam,[x,3.22,.94],
      [.31,.52,.29]);
    block(house,'Lantern acrylic diffuser',mats.trim,[x,3.25,1.13],
      [.18,.33,.12]);
  }

  // A slightly raised trim edge makes the pre-flocked synthetic sheet look
  // like a physical layer glued to a layout board.
  for(const z of [-15.6,10.42]){
    block(model,'Grass mat cut edge',mats.plasticBase,[0,.26,z],[36,.08,.13]);
  }
  for(const x of [-17.9,17.9]){
    block(model,'Grass mat cut edge',mats.plasticBase,[x,.26,-2.59],[.12,.08,26.0]);
  }
  // One-piece clip-in shrubs: faceted molded geometries instead of
  // diffuse sphere clouds.
  const shrubAt=(x,z,s)=>{
    block(model,'Shrub mounting stem',mats.hedge,[x,.39,z],[.15,.33,.15],[0,0,0],'cylinder');
    block(model,'Single-piece molded shrub',mats.shrub,[x,.78,z],[s,1.0,s], [0,0,0],'sphere');
  };
  // V3 plants are grouped into natural leaf-cloud meshes by the hero builder,
  // not the previous conspicuously spherical toy hedge placeholders.
  // Model railroad fence: repeat snap-fit plastic pickets.
  for(let x=-15.5;x<15.6;x+=.9){
    if(x>5.1&&x<12)continue;
    block(model,'Picket fence',mats.wood,[x,.84,-14.35],[.14,1.23,.16]);
  }
  block(model,'Plastic fence rail',mats.wood,[-4.6,.90,-14.35],[21.8,.12,.12]);
  // Small handmade static grass patches: flocking is primarily texture.
  const turfRandom=seededRandom(19343);
  for(let n=0;n<210;n++){
    const x=(turfRandom()-.5)*32;
    const z=(turfRandom()-.5)*25;
    if(x>-11.0&&x<13.6&&z>-8.8&&z<3)continue;
    if(x>4.5&&x<12.8&&z>1.4)continue;
    if(x>-5.2&&x<-2.4&&z>1.0)continue;
    const height=.06+turfRandom()*.08;
    block(model,'Short commercial static grass',mats.shrub,
      [x,.32+height*.5,z],[.034,height,.034]);
  }
  // The rounded plastic toy tree pieces are explicitly modeled as an
  // inexpensive clip-on product: rigid trunk and tight foliage forms.
  // The previous spherical foliage was removed. The new hero asset has
  // detailed branch armatures and hundreds of batched irregular leaf clusters.
  // Preserve the first generation under a disabled parent for comparison.
  house.enabled=false;
  buildPhotographicMiniature({
    pc,app,root:model,device,block,makeMaterial
  });

  function fallbackToyCar(){
    const car=new pc.Entity('Fallback local toy car');
    app.root.addChild(car);
    car.setLocalPosition(8.65,.49,6.55);
    block(car,'Toy black plastic base',mats.carBase,[0,.24,0],[2.25,.25,4.1]);
    block(car,'Die-cast enamel shell',mats.carBody,[0,.73,0],[2.56,.95,4.55]);
    block(car,'Cabin',mats.carBody,[0,1.27,-.22],[2.1,.77,2.40]);
    block(car,'Tinted windshield',mats.glass,[0,1.40,1.06],[1.95,.49,.09],[24,0,0]);
    for(const side of [-1,1]){
      for(const z of [-1.43,1.42]){
        block(car,'Black plastic toy wheel',mats.tires,[side*1.32,.30,z],
          [.58,.9,.90],[0,0,90],'cylinder');
        block(car,'Vacuum plated plastic hubcap',mats.chrome,
          [side*1.62,.30,z],[.18,.47,.47],[0,0,90],'cylinder');
      }
    }
    return car;
  }
  const fallbackCar=fallbackToyCar();
  // Imported glTF models may use radically different authoring units.
  // Measure the real render bounds and fit the CC0 die-cast car to the
  // physical width of the miniature driveway.
  function fitImportedCar(car){
    const renderers=car.findComponents('render');
    const bounds=()=>{
      const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
      let meshes=0;
      for(const renderer of renderers){
        for(const mesh of renderer.meshInstances||[]){
          const bb=mesh.aabb;
          if(!bb?.center||!bb?.halfExtents)continue;
          for(let i=0;i<3;i++){
            const key=['x','y','z'][i];
            const v=bb.center[key],e=bb.halfExtents[key];
            low[i]=Math.min(low[i],v-e);
            high[i]=Math.max(high[i],v+e);
          }
          meshes++;
        }
      }
      return {low,high,meshes};
    };
    let b=bounds();
    if(!b.meshes)return false;
    const length=Math.max(b.high[0]-b.low[0],b.high[2]-b.low[2]);
    if(!Number.isFinite(length)||length<=1e-5)return false;
    const factor=Math.max(.08,Math.min(1000,4.25/length));
    car.setLocalScale(.95*factor,.95*factor,.95*factor);
    b=bounds();
    if(!b.meshes||!b.low.every(Number.isFinite))return false;
    const cx=(b.low[0]+b.high[0])/2;
    const cz=(b.low[2]+b.high[2])/2;
    const origin=car.getLocalPosition();
    car.setLocalPosition(
      origin.x+8.45-cx,
      origin.y+.36-b.low[1],
      origin.z+6.25-cz
    );
    document.body.dataset.pcCarScaleFactor=factor.toFixed(3);
    return true;
  }
  const carUrl='https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb';
  // The Khronos CC0 model is the asset-quality benchmark. It provides
  // actual artist-authored geometry and car materials, not primitive blocks.
  assetStatus.textContent='Loading CC0 toy-car GLB (fallback model already visible)';
  app.assets.loadFromUrlAndFilename(carUrl,'ToyCar.glb','container',(error,asset)=>{
    if(error||!asset?.resource){
      console.warn('GLB benchmark unavailable; using procedural car',error);
      assetStatus.textContent='CC0 glTF car unavailable; procedural fallback active';
      document.body.dataset.pcCarSource='fallback';
      return;
    }
    try{
      const car=asset.resource.instantiateRenderEntity();
      car.name='Khronos ToyCar · licensed CC0';
      car.setLocalPosition(8.65,.4,6.55);
      car.setLocalScale(.95,.95,.95);
      car.setLocalEulerAngles(0,20,0);
      app.root.addChild(car);
      if(!fitImportedCar(car)){
        car.enabled=false;
        throw Error('ToyCar GLB had invalid dimensions');
      }
      fallbackCar.enabled=false;
      state.modelLoaded=true;
      document.body.dataset.pcCarSource='khronos-cc0-glb';
      assetStatus.textContent='Khronos ToyCar GLB loaded · scaled to the HO driveway · CC0';
    }catch(e){
      console.warn('GLB instantiate failed; retaining fallback',e);
      assetStatus.textContent='Toy-car glTF could not be instantiated; fallback visible';
      document.body.dataset.pcCarSource='fallback';
    }
  });

  function applyLighting(){
    if(state.light==='studio'){
      sun.light.intensity=2.08;
      fill.light.intensity=.42;
      app.scene.ambientLight=color('#9a9c99');
      camera.camera.toneMapping=pc.TONEMAP_ACES;
      app.scene.exposure=1.04;
    }else{
      sun.light.intensity=1.72;
      fill.light.intensity=.28;
      app.scene.ambientLight=color('#969d9b');
      camera.camera.toneMapping=pc.TONEMAP_NEUTRAL;
      app.scene.exposure=1.08;
    }
    document.body.dataset.pcLight=state.light;
    for(const el of document.querySelectorAll('button[data-light]')){
      el.setAttribute('aria-pressed',String(el.dataset.light===state.light));
    }
  }
  function applyView(){
    const phone=window.matchMedia('(max-width:850px)').matches;
    state.target.set(phone?-.3:0,3.45,-1.65);
    if(state.view==='front'){
      state.yaw=.04;state.pitch=.28;state.radius=phone?55:45;
    }else if(state.view==='top'){
      state.yaw=.54;state.pitch=1.05;state.radius=phone?62:47;
    }else if(state.view==='detail'){
      state.target.set(-5.1,4.3,.5);
      state.yaw=.27;state.pitch=.24;state.radius=phone?24:20;
    }else{
      state.yaw=.42;state.pitch=.33;state.radius=phone?57:49;
    }
    document.body.dataset.pcView=state.view;
    for(const el of document.querySelectorAll('button[data-view]')){
      el.setAttribute('aria-pressed',String(el.dataset.view===state.view));
    }
  }
  for(const el of document.querySelectorAll('button[data-light]')){
    el.addEventListener('click',()=>{state.light=el.dataset.light;applyLighting();});
  }
  for(const el of document.querySelectorAll('button[data-view]')){
    el.addEventListener('click',()=>{state.view=el.dataset.view;applyView();});
  }
  function cameraUpdate(){
    const h=Math.cos(state.pitch),r=state.radius;
    camera.setLocalPosition(
      state.target.x+Math.sin(state.yaw)*h*r,
      state.target.y+Math.sin(state.pitch)*r,
      state.target.z+Math.cos(state.yaw)*h*r);
    camera.lookAt(state.target);
  }
  const contacts=new Map();
  let gestureDistance=null;
  canvas.addEventListener('pointerdown',event=>{
    contacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    state.pointer=event.pointerId;
    gestureDistance=null;
  });
  canvas.addEventListener('pointermove',event=>{
    if(!contacts.has(event.pointerId))return;
    const previous=contacts.get(event.pointerId);
    contacts.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(contacts.size===2){
      const [a,b]=[...contacts.values()];
      const distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(gestureDistance!==null){
        state.radius=Math.min(65,Math.max(18,
          state.radius*gestureDistance/Math.max(distance,1)));
      }
      gestureDistance=distance;
    }else{
      state.yaw-=(event.clientX-previous.x)*.008;
      state.pitch=Math.min(1.30,Math.max(.18,
        state.pitch+(event.clientY-previous.y)*.005));
      state.view='custom';
    }
  });
  function endPointer(e){
    contacts.delete(e.pointerId);
    gestureDistance=null;
  }
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    state.radius=Math.min(65,Math.max(18,state.radius*Math.exp(event.deltaY*.001)));
  },{passive:false});
  window.addEventListener('resize',()=>{
    app.resizeCanvas();
    if(state.view!=='custom')applyView();
  });
  applyView();
  applyLighting();
  app.on('update',()=>cameraUpdate());
  app.start();
  state.ready=true;
  document.body.dataset.pcReady='true';
  document.body.dataset.pcEngine='PlayCanvas';
  document.body.dataset.pcVersion='2.23.3';
  document.body.dataset.pcSidingPieces=String(sidingPieces);
  document.body.dataset.pcMiniatureDetails='v3';
  document.body.dataset.pcCarSource='loading';
  loading.hidden=true;
  requestAnimationFrame(()=>{
    document.body.dataset.pcRendered='true';
  });
}
start().catch(error=>{
  console.error('PlayCanvas miniature engine failed to start',error);
  document.body.dataset.pcReady='error';
  document.body.dataset.pcErrorStack=String(error?.stack||error).slice(0,2500);
  loading.textContent='PlayCanvas viewer could not start: '+
    (error?.message||String(error));
  assetStatus.textContent='Renderer failed; inspect error console';
});
