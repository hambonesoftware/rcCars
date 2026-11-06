import * as pc from 'playcanvas';

/**
 * Injection-molded material fidelity benchmark.
 * Independent of Garage Gauntlet gameplay. Two deliberately identical
 * compositions share one PBR light rig / camera. The right-hand version
 * changes model construction and manufacturing details, not lighting.
 */
const canvas=document.querySelector('#fidelity-canvas');
const output=document.querySelector('#render-status');
const info=document.querySelector('#lab-facts');
const state={turn:.11,pitch:.24,zoom:64,target:new pc.Vec3(0,3.4,-.8),
  pointer:null,mode:'both',region:'house'};
const counts={baselineParts:0,moldedParts:0,beveled:0,panels:0,grooves:0};
const color=(hex)=>new pc.Color(
  parseInt(hex.slice(1,3),16)/255,
  parseInt(hex.slice(3,5),16)/255,
  parseInt(hex.slice(5,7),16)/255
);
function rand(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function makeTexture(device,name,draw){
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d',{alpha:false});
  draw(ctx,c.width,c.height);
  const t=new pc.Texture(device,{width:256,height:256,
    format:pc.PIXELFORMAT_RGBA8,mipmaps:true});
  t.name=name;t.setSource(c);t.addressU=pc.ADDRESS_REPEAT;
  t.addressV=pc.ADDRESS_REPEAT;t.minFilter=pc.FILTER_LINEAR_MIPMAP_LINEAR;
  t.magFilter=pc.FILTER_LINEAR;t.anisotropy=8;return t;
}
async function boot(){
  const device=await pc.createGraphicsDevice(canvas,{deviceTypes:[pc.DEVICETYPE_WEBGL2],antialias:true});
  device.maxPixelRatio=Math.min(device.maxPixelRatio||1,1.6);
  const opts=new pc.AppOptions();
  opts.graphicsDevice=device;
  opts.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];
  opts.resourceHandlers=[pc.TextureHandler];
  const app=new pc.AppBase(canvas);app.init(opts);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.scene.ambientLight=color('#7d898c');
  app.scene.exposure=1.05;
  const cam=new pc.Entity('Identical fixed comparison camera');
  cam.addComponent('camera',{nearClip:.15,farClip:220,fov:43,clearColor:color('#c2bbb1')});
  cam.camera.toneMapping=pc.TONEMAP_ACES;app.root.addChild(cam);

  const key=new pc.Entity('Warm large studio key');
  key.addComponent('light',{type:'directional',color:color('#ffeed8'),
    intensity:1.9,castShadows:true,shadowResolution:2048,shadowDistance:90});
  key.setEulerAngles(59,-41,0);app.root.addChild(key);
  const fill=new pc.Entity('Cool studio fill');
  fill.addComponent('light',{type:'directional',color:color('#d3e3ef'),
    intensity:.56,castShadows:false});
  fill.setEulerAngles(28,142,0);app.root.addChild(fill);
  const rim=new pc.Entity('Edge-light grazing round plastic');
  rim.addComponent('light',{type:'directional',color:color('#fff9ed'),
    intensity:.48,castShadows:false});
  rim.setEulerAngles(38,210,0);app.root.addChild(rim);

  const environment=makeTexture(device,'Real studio card reflections',(ctx,w,h)=>{
    const gradient=ctx.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0,'#cad3d4');gradient.addColorStop(.5,'#969d9a');
    gradient.addColorStop(1,'#8f8071');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#fff9f0';ctx.fillRect(24,43,66,63);
    ctx.fillStyle='#eaf0f3';ctx.fillRect(157,67,33,77);
  });
  let reflection=false;
  try{
    environment.projection=pc.TEXTUREPROJECTION_EQUIRECT;
    const source=pc.EnvLighting.generateLightingSource(environment);
    app.scene.envAtlas=pc.EnvLighting.generateAtlas(source);
    source.destroy();
    reflection=true;
  }catch(error){console.warn('Studio atlas unsupported',error);}
  document.body.dataset.fidelityReflections=reflection?'on':'fallback';

  const normal=makeTexture(device,'Fine satin styrene molding grain normal',(ctx,w,h)=>{
    const im=ctx.createImageData(w,h),r=rand(11012);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=4*(y*w+x);
      const d=(r()-.5)*15+Math.sin(x*.39+y*.075)*3;
      im.data[i]=Math.max(0,Math.min(255,128+d));
      im.data[i+1]=Math.max(0,Math.min(255,128+(r()-.5)*13));
      im.data[i+2]=254;im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);
  });
  const occlusion=makeTexture(device,'Subtle hand-baked edge and crevice AO',(ctx,w,h)=>{
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
    const grad=ctx.createRadialGradient(w*.5,h*.5,w*.27,w*.5,h*.5,w*.74);
    grad.addColorStop(0,'rgba(55,48,44,0)');
    grad.addColorStop(1,'rgba(64,56,51,.36)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  });
  const plastic=(name,hex,{gloss=.48,coat=.10,metal=.0,texture=true,ao=true}={})=>{
    const m=new pc.StandardMaterial();m.name=name;
    m.diffuse=color(hex);m.useMetalness=true;m.metalness=metal;
    m.gloss=gloss;m.clearCoat=coat;m.clearCoatGloss=.69;
    m.fresnelModel=pc.FRESNEL_SCHLICK;
    if(texture){
      m.normalMap=normal;m.bumpiness=.26;
      m.normalMapTiling=new pc.Vec2(2.0,2.0);
    }
    if(ao){
      m.aoMap=occlusion;m.aoIntensity=.60;m.occludeDirect=false;
    }
    m.update();return m;
  };
  const materials={
    oldWall:plastic('Baseline plain colored box','#b5c9b8',{gloss:.44,coat:0,texture:false,ao:false}),
    oldTrim:plastic('Baseline sharp white trim','#e8e6da',{gloss:.42,coat:0,texture:false,ao:false}),
    oldRoof:plastic('Baseline gray untextured roof','#747b7a',{gloss:.34,coat:0,texture:false,ao:false}),
    styrene:plastic('Satin pigmented injection molded wall','#b5c9b8',{gloss:.47,coat:.07}),
    offwhite:plastic('Warm semi gloss molded window and fascia','#e8e6da',{gloss:.58,coat:.14}),
    roofing:plastic('Grained molded gray roofing','#747b7a',{gloss:.34,coat:.025}),
    roofRaised:plastic('Separated injection molded shingle tiles','#6e7472',{gloss:.36,coat:.02}),
    groove:plastic('Recessed plastic parting lines and cavity','#64766c',{gloss:.28,coat:0}),
    glass:plastic('Smoked inset acrylic glass','#465d63',{gloss:.88,coat:.58,texture:false,ao:false}),
    shutter:plastic('Deep evergreen molded shutters','#57736b',{gloss:.49,coat:.10}),
    concrete:plastic('Scored miniature gray concrete','#b6b4ac',{gloss:.12,coat:0,texture:false,ao:false}),
    turf:plastic('Matte model grass base','#697a4b',{gloss:.05,coat:0,texture:false,ao:false}),
    base:plastic('Exposed warm model display board','#92765c',{gloss:.19,coat:0,texture:false,ao:false}),
    wallBack:plastic('Inset dark gray cavity shadow','#20292c',{gloss:.17,coat:0,texture:false,ao:false}),
    sill:plastic('Pale plastic insert highlight','#f2ecdc',{gloss:.54,coat:.16})
  };
  const geometryCache=new Map();
  function roundedGeometry(size,radius){
    const key=size.map(n=>n.toFixed(4)).join('/')+'/'+radius.toFixed(4);
    if(geometryCache.has(key))return geometryCache.get(key);
    const dims=size.map(v=>v*.5);
    const r=Math.min(radius,Math.min(...dims)*.86);
    const data={positions:[],normals:[],uvs:[],indices:[]};
    const axes=[[2,1,0,1],[2,-1,0,1],[0,1,2,1],[0,-1,2,1],[1,1,0,2],[1,-1,0,2]];
    function coords(half){
      return [-half,-half+r*.40,-half+r,0,half-r,half-r*.40,half];
    }
    for(const [axis,sign,uAxis,vAxis] of axes){
      const base=data.positions.length/3;
      const us=coords(dims[uAxis]),vs=coords(dims[vAxis]);
      for(let j=0;j<7;j++)for(let i=0;i<7;i++){
        const p=[0,0,0];p[axis]=sign*dims[axis];
        p[uAxis]=us[i];p[vAxis]=vs[j];
        const inside=p.map((v,k)=>Math.max(-dims[k]+r,Math.min(dims[k]-r,v)));
        const n=p.map((v,k)=>v-inside[k]);
        const length=Math.hypot(...n)||1;
        for(let k=0;k<3;k++)n[k]/=length;
        const rounded=inside.map((v,k)=>v+n[k]*r);
        data.positions.push(...rounded);data.normals.push(...n);
        data.uvs.push(i/6,j/6);
      }
      const tangent=[0,0,0],bitangent=[0,0,0];
      tangent[uAxis]=1;bitangent[vAxis]=1;
      const cross=[
        tangent[1]*bitangent[2]-tangent[2]*bitangent[1],
        tangent[2]*bitangent[0]-tangent[0]*bitangent[2],
        tangent[0]*bitangent[1]-tangent[1]*bitangent[0]
      ];
      const flip=cross[axis]*sign<0;
      for(let j=0;j<6;j++)for(let i=0;i<6;i++){
        const a=base+j*7+i,b=a+1,c=a+7,d=c+1;
        if(flip)data.indices.push(a,d,b,a,c,d);
        else data.indices.push(a,b,d,a,d,c);
      }
    }
    const g=new pc.Geometry();
    g.positions=data.positions;g.normals=data.normals;g.uvs=data.uvs;g.indices=data.indices;
    g.tangents=pc.calculateTangents(g.positions,g.normals,g.uvs,g.indices);
    const mesh=pc.Mesh.fromGeometry(device,g);
    geometryCache.set(key,mesh);return mesh;
  }
  function addBox(parent,label,material,xyz,size,{bevel=0,rot=[0,0,0],molded=false}={}){
    const e=new pc.Entity(label);
    if(bevel>0){
      e.addComponent('render',{meshInstances:[
        new pc.MeshInstance(roundedGeometry(size,bevel),material)
      ]});
      counts.beveled++;
    }else{
      e.addComponent('render',{type:'box',material});
      e.setLocalScale(...size);
    }
    e.setLocalPosition(...xyz);e.setLocalEulerAngles(...rot);
    e.render.castShadows=true;e.render.receiveShadows=true;
    parent.addChild(e);
    if(molded)counts.moldedParts++;else counts.baselineParts++;
    return e;
  }
  function specimen(position,isMolded){
    const group=new pc.Entity(isMolded?'AFTER: physically manufactured model kit':'BEFORE: flat primitive CG house');
    group.setLocalPosition(position,0,0);app.root.addChild(group);
    const molded=isMolded;
    const p=(label,mat,xyz,size,bevel=0,rot=[0,0,0])=>
      addBox(group,label,mat,xyz,size,{bevel:molded?bevel:0,rot,molded});
    p('A real tabletop base',materials.base,[0,-.5,0],[17.2,1.05,13.1],.09);
    p('Short fake grass mat',materials.turf,[0,.045,-.8],[16.6,.13,10.85],.04);
    // House: physical enclosure + subdivided façade panels.
    p('Main house deep structural enclosure',molded?materials.styrene:materials.oldWall,
      [-3.66,3.2,-3.30],[8.1,5.4,4.7],.065);
    p('Garage enclosure',molded?materials.styrene:materials.oldWall,
      [3.80,2.37,-2.83],[6.72,3.75,5.7],.07);
    const front=.0,winX=-5.1,winY=3.42;
    if(molded){
      // A front facade made from actual raised/slabbed sections, with the
      // window and door inset BEHIND the outer edge instead of pasted on top.
      const z=.165,th=.24;
      const wall=(name,cx,y,w,h)=>p(name,materials.styrene,[cx,y,z],[w,h,th],.040);
      wall('Solid left window margin',-6.90,3.20,1.63,5.40);
      wall('Window opening lower wall',winX,1.64,2.02,2.28);
      wall('Window opening upper lintel',winX,5.40,2.02,1.0);
      wall('Between window and door',-3.25,3.20,1.71,5.40);
      wall('Above recessed entryway',-1.65,5.0,1.5,1.8);
      wall('Right entrance jamb',-.50,3.20,.7,5.40);
      // Accurate, relatively slim parallel molded lap-siding profiles.
      for(let row=0;row<18;row++){
        const y=.73+row*.286;
        const spans=[
          [-7.72,-6.1],[-4.10,-2.39],[-.85,-.23]
        ];
        if(y<2.76||y>4.63)spans.push([-6.1,-4.10]);
        if(y>4.2)spans.push([-2.39,-.85]);
        for(const [a,b] of spans){
          const width=b-a-.028;
          if(width<.15)continue;
          p('Snap-molded rounded clapboard edge',materials.offwhite,
            [(a+b)/2,y,.31],[width,.047,.085],.018);
          counts.panels++;
        }
      }
    }
    // Both samples are recognizable at the same silhouette and scale.
    // Only the right variant has actual molded part depths and edge normals.
    p('Deep window cavity',materials.wallBack,[winX,winY,molded?.14:.19],
      [2.28,2.36,.13],molded?.045:0);
    p('Inset acrylic glazing',materials.glass,[winX,winY,molded?.19:.25],
      [2.05,2.13,.058],molded?.025:0);
    for(const x of [winX-1.22,winX+1.22]){
      p('Raised window casing and jamb',molded?materials.offwhite:materials.oldTrim,
        [x,winY,.38],[.19,2.64,.29],.065);
      if(molded){
        p('Inset separate shutter slab',materials.shutter,
          [x+(x<winX?-.40:.40),winY,.355],[.55,2.6,.19],.06);
        for(let k=0;k<8;k++){
          p('Shutter louver molded depression',materials.groove,
            [x+(x<winX?-.40:.40),winY-.95+k*.265,.470],
            [.40,.035,.023],.01);
          counts.grooves++;
        }
      }
    }
    for(const y of [winY+1.21,winY-1.21]){
      p('Rounded molded window head and sill',molded?materials.offwhite:materials.oldTrim,
        [winX,y,.41],[2.68,.22,.37],.074);
    }
    if(molded){
      p('Two separate glazing sash verticals',materials.offwhite,[winX,winY,.27],
        [.09,2.10,.08],.026);
      p('Inset glazing middle transverse',materials.offwhite,[winX,winY-.02,.27],
        [2.10,.09,.08],.026);
    }
    p('Main dark entry door',molded?materials.shutter:materials.oldTrim,
      [-1.52,1.95,.37],[1.47,2.78,.16],.05);
    if(molded){
      for(const y of [1.15,1.78,2.49]){
        p('Molded doorway raised recessed panels',materials.offwhite,
          [-1.52,y,.49],[1.02,.075,.035],.027);
      }
      p('Molded exterior entry casing',materials.offwhite,
        [-1.52,3.44,.47],[1.92,.20,.22],.055);
    }
    // Sectional garage: compare plain one-piece slab against inset panels
    // whose bevels catch a bright, sculpted highlight at identical lighting.
    p('Garage recessed black edge',materials.wallBack,
      [3.8,2.32,.16],[5.85,3.39,.20],.05);
    p('Garage raised backing',molded?materials.offwhite:materials.oldTrim,
      [3.8,2.32,.30],[5.57,3.20,.16],.047);
    if(molded){
      for(let row=0;row<4;row++)for(let column=0;column<4;column++){
        const x=1.72+column*1.39,y=.91+row*.79;
        p('Distinct radiused molded garage panel',materials.offwhite,
          [x,y,.433],[1.20,.64,.13],.08);
        counts.panels++;
      }
      for(let row=1;row<4;row++){
        p('Pressed garage joint shadow',materials.groove,
          [3.8,.91+row*.79-.40,.406],[5.32,.026,.026],.01);
        counts.grooves++;
      }
    }
    const degrees=Math.atan2(2.24,4.27)*180/Math.PI;
    for(const sign of [-1,1]){
      const roofX=-3.66+sign*2.31;
      p('Sloped roof panel',molded?materials.roofing:materials.oldRoof,
        [roofX,7.0,-3.25],[4.87,.20,5.34],.075,[0,0,-sign*degrees]);
      if(molded){
        for(let row=0;row<5;row++){
          const u=(row+.5)/5;
          const run=4.75;
          const dx=(u-.5)*run;
          const px=roofX+dx*Math.cos(degrees*Math.PI/180)*sign;
          const py=7.0-dx*Math.sin(degrees*Math.PI/180);
          for(let k=0;k<6;k++){
            const z=-5.60+k*.91;
            p('Overlapping rounded molded roofing slate',k%5===0?materials.roofRaised:materials.roofing,
              [px,py+.135,z],[.84,.079,.98],.021,[0,0,-sign*degrees]);
            counts.panels++;
          }
        }
      }
    }
    p('Roof ridge cast capping',molded?materials.roofing:materials.oldRoof,
      [-3.66,8.27,-3.25],[.37,.26,5.6],.12);
    if(molded){
      for(const x of [-7.7,.36]){
        p('Real soffit and gutter shadow',materials.groove,
          [x,5.80,-3.12],[.19,.16,5.6],.035);
        p('Rounded snap-fit guttering',materials.offwhite,
          [x,5.72,-3.12],[.15,.16,5.85],.062);
      }
    }
    p('Driveway concrete slab',materials.concrete,[3.88,.14,3.18],
      [5.75,.11,5.35],.035);
    if(molded){
      for(const z of [1.28,3.15,5.04]){
        p('Fine pressed driveway expansion score',materials.groove,
          [3.88,.200,z],[5.71,.014,.024],.005);
      }
    }
    p('Front access path',materials.concrete,[-1.5,.13,3.26],
      [1.56,.10,5.30],.035);
    return group;
  }
  const old=specimen(-10.55,false);
  const improved=specimen(10.55,true);
  const divider=new pc.Entity('Independent comparison gap');app.root.addChild(divider);
  function camera(){
    const phone=window.innerWidth<780;
    if(phone){
      state.mode=state.mode==='both'?'improved':state.mode;
      const specimenRoot=state.mode==='before'?-10.55:10.55;
      // On a portrait screen show one meaningful portion at a time,
      // never a huge roof cropped by the left and right edges.
      const selectedX=state.region==='garage'?3.80:-3.65;
      state.target.set(specimenRoot+selectedX,3.45,-2.35);
      state.zoom=46.5;
      state.pitch=.27;state.turn=.035;
    }else{
      // Make both equally lit specimens fill the comparison board.
      state.target.set(0,3.55,-1.40);
      state.zoom=45.5;state.pitch=.27;state.turn=.045;
    }
    renderCamera();
    document.body.dataset.fidelityMobileMode=state.mode;
    document.body.dataset.fidelityRegion=state.region;
  }
  function renderCamera(){
    const rad=state.zoom,c=Math.cos(state.pitch);
    cam.setLocalPosition(
      state.target.x+rad*c*Math.sin(state.turn),
      state.target.y+rad*Math.sin(state.pitch),
      state.target.z+rad*c*Math.cos(state.turn)
    );
    cam.lookAt(state.target);
  }
  document.querySelectorAll('[data-specimen]').forEach(button=>{
    button.addEventListener('click',()=>{
      state.mode=button.dataset.specimen;
      document.querySelectorAll('[data-specimen]').forEach(b=>
        b.setAttribute('aria-pressed',String(b.dataset.specimen===state.mode)));
      camera();
    });
  });
  document.querySelectorAll('[data-region]').forEach(button=>{
    button.addEventListener('click',()=>{
      state.region=button.dataset.region;
      document.querySelectorAll('[data-region]').forEach(b=>
        b.setAttribute('aria-pressed',String(b.dataset.region===state.region)));
      camera();
    });
  });
  document.querySelector('#rotate-light').addEventListener('input',ev=>{
    const angle=Number(ev.target.value);
    key.setEulerAngles(59,angle,0);
    document.body.dataset.fidelityLightAngle=String(angle);
  });
  window.addEventListener('resize',()=>{app.resizeCanvas();camera();});
  camera();
  app.on('update',renderCamera);
  app.start();
  document.body.dataset.fidelityReady='true';
  document.body.dataset.fidelityEngine='PlayCanvas 2.23.3';
  document.body.dataset.fidelityNormalMap='tangent-styrene-normal';
  document.body.dataset.fidelityAO='crevice-texture-and-inset';
  document.body.dataset.fidelityRoundedParts=String(counts.beveled);
  document.body.dataset.fidelityMoldedPanels=String(counts.panels);
  output.textContent='Live PlayCanvas · baseline and molded model use identical studio lights';
  info.textContent=counts.beveled+' physically beveled molded parts · '+
    counts.panels+' raised manufacturing features · '+
    counts.grooves+' recessed detail grooves';
}
boot().catch(error=>{
  console.error('Plastic fidelity lab failed',error);
  output.textContent='Render error: '+(error?.message||error);
  document.body.dataset.fidelityReady='error';
  document.body.dataset.fidelityError=String(error?.stack||error).slice(0,1200);
});
