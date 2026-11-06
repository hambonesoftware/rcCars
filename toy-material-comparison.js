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
  app.scene.ambientLight=color('#627069');
  app.scene.exposure=.86;
  const cam=new pc.Entity('Identical fixed comparison camera');
  cam.addComponent('camera',{nearClip:.15,farClip:220,fov:43,clearColor:color('#c2bbb1')});
  cam.camera.toneMapping=pc.TONEMAP_NEUTRAL;app.root.addChild(cam);

  const key=new pc.Entity('Warm large studio key');
  key.addComponent('light',{type:'directional',color:color('#ffeed8'),
    intensity:1.27,castShadows:true,shadowResolution:2048,shadowDistance:90});
  key.setEulerAngles(59,-41,0);app.root.addChild(key);
  const fill=new pc.Entity('Cool studio fill');
  fill.addComponent('light',{type:'directional',color:color('#d3e3ef'),
    intensity:.23,castShadows:false});
  fill.setEulerAngles(28,142,0);app.root.addChild(fill);
  const rim=new pc.Entity('Edge-light grazing round plastic');
  rim.addComponent('light',{type:'directional',color:color('#fff9ed'),
    intensity:.16,castShadows:false});
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
  const grassTex=makeTexture(device,'Cut-pile railway scenic flock',(ctx,w,h)=>{
    ctx.fillStyle='#7d8751';ctx.fillRect(0,0,w,h);
    const r=rand(71437);
    for(let i=0;i<49000;i++){
      const x=r()*w,y=r()*h;
      const tone=r();
      ctx.strokeStyle=tone<.3?'rgba(43,69,39,.48)':
        tone<.65?'rgba(171,165,93,.50)':'rgba(109,135,69,.63)';
      ctx.lineWidth=.35+r()*.6;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+(r()-.5)*2.5,y-1-r()*2.3);ctx.stroke();
    }
  });
  const materials={
    oldWall:plastic('Old featureless siding','#839b84',{gloss:.33,coat:0,texture:false,ao:false}),
    oldTrim:plastic('Old sharp window trim','#c9bda5',{gloss:.36,coat:0,texture:false,ao:false}),
    oldRoof:plastic('Old straight box roofing','#555e5b',{gloss:.23,coat:0,texture:false,ao:false}),
    styrene:plastic('Satin sage pigmented plastic house','#839b84',{gloss:.41,coat:.045}),
    sidingEdge:plastic('Molded sage-satin clapboard lips','#819982',{gloss:.36,coat:.035}),
    offwhite:plastic('Cream weathered injection-molded window trim','#cfc6ae',{gloss:.46,coat:.09}),
    roofing:plastic('Molded charcoal gray roof','#505c59',{gloss:.27,coat:.015}),
    roofRaised:plastic('Alternating gray plastic shingles','#47534f',{gloss:.25,coat:.01}),
    roofHighlight:plastic('Molded shingle color variation','#5d6862',{gloss:.28,coat:.015}),
    groove:plastic('Shadowed recessed manufacturing seams','#52645a',{gloss:.20,coat:0}),
    glass:plastic('Deep smoked acrylic plastic glazing','#2d4f57',{gloss:.76,coat:.26,texture:false,ao:false}),
    shutter:plastic('Deep forest green satin shutters','#405f55',{gloss:.45,coat:.07}),
    concrete:plastic('Scored weathered model pavement','#999b8d',{gloss:.10,coat:0,texture:false,ao:false}),
    turf:plastic('Matte handmade grass model railway scenery','#7e8759',{gloss:.03,coat:0,texture:false,ao:false}),
    base:plastic('Natural painted timber display board','#947a60',{gloss:.15,coat:0,texture:false,ao:false}),
    wallBack:plastic('Window recess and garage aperture','#28342f',{gloss:.13,coat:0,texture:false,ao:false}),
    sill:plastic('Pale cast trim inserts','#dad0b7',{gloss:.46,coat:.09}),
    plant:plastic('Dark model tree scenic foliage','#405744',{gloss:.10,coat:0,texture:false,ao:false}),
    plantLight:plastic('Light green HO scenic clusters','#637958',{gloss:.08,coat:0,texture:false,ao:false}),
    soil:plastic('Scenic earth and bark ballast','#625747',{gloss:.05,coat:0,texture:false,ao:false}),
    metal:plastic('Little silver downspout and fixtures','#8a9690',{gloss:.58,coat:.20,metal:.25,texture:false,ao:false}),
    warmLight:plastic('Amber plastic porch light','#b79a65',{gloss:.60,coat:.08}),
  };
  materials.turf.diffuseMap=grassTex;
  materials.turf.diffuseMapTiling=new pc.Vec2(7,6);
  materials.turf.diffuse=color('#a8ad87');
  materials.turf.update();
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
  // Scenic foliage uses one batched mesh per pigment rather than hundreds
  // of little box/sphere draw calls. These are fake glued-on 1:87 fibers.
  function flockMesh(group){
    const rnd=rand(74320);
    const batches=Array.from({length:3},()=>({p:[],n:[],uv:[],ix:[]}));
    for(let i=0;i<2350;i++){
      const x=-8.05+rnd()*16.10,z=-5.25+rnd()*9.45;
      if(x>1.0&&z>.65)continue;
      if(x>-2.42&&x<-.68&&z>.50)continue;
      if(x>-6.98&&x<-5.18&&z>-.30&&z<1.43)continue;
      const batch=batches[i%3],height=.065+rnd()*.15;
      const dx=(rnd()-.5)*.10,dz=(rnd()-.5)*.11;
      const b=batch.p.length/3;
      batch.p.push(x-.023,.126,z-.015,x+dx,.126+height,z+dz,x+.025,.126,z+.024);
      batch.n.push(0,0,1,0,0,1,0,0,1);
      batch.uv.push(0,0,.5,1,1,0);
      batch.ix.push(b,b+1,b+2);
    }
    for(let i=0;i<batches.length;i++){
      const b=batches[i],geom=new pc.Geometry();
      geom.positions=b.p;geom.normals=b.n;geom.uvs=b.uv;geom.indices=b.ix;
      const mat=i===0?materials.plant:i===1?materials.plantLight:materials.turf;
      mat.cull=pc.CULLFACE_NONE;mat.update();
      const node=new pc.Entity('Batched HO static grass fibers');
      node.addComponent('render',{meshInstances:[
        new pc.MeshInstance(pc.Mesh.fromGeometry(device,geom),mat)
      ]});
      node.render.castShadows=false;node.render.receiveShadows=true;
      group.addChild(node);
    }
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
    // Flush the wall shell to the facade. Previously its front face was
    // nearly a full scene unit behind the trim and roofing, producing
    // the "floating roof and applied stickers" effect on a phone.
    p('Main house deep structural enclosure',molded?materials.styrene:materials.oldWall,
      [-3.66,3.20,-2.75],[8.1,5.40,5.6],.065);
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
          p('Snap-molded rounded clapboard edge',materials.sidingEdge,
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
    // Physically connected gable roofs, not offset rectangular prisms.
    // A roof's eave meets the walls, its triangular gable fills the
    // formerly open gap, and shingle rows follow the actual roof slope.
    function gable(name,xc,halfWidth,eave,ridge,z,isFront){
      const points=[
        [xc-halfWidth,eave,z],[xc+halfWidth,eave,z],[xc,ridge,z]
      ];
      const normals=isFront?[0,0,1]:[0,0,-1];
      const order=isFront?[0,1,2]:[0,2,1];
      const geom=new pc.Geometry();
      geom.positions=points.flat();
      geom.normals=[...normals,...normals,...normals];
      geom.uvs=[0,0,1,0,.5,1];
      geom.indices=order;
      geom.tangents=pc.calculateTangents(geom.positions,geom.normals,geom.uvs,geom.indices);
      const entity=new pc.Entity(name);
      const mesh=pc.Mesh.fromGeometry(device,geom);
      entity.addComponent('render',{meshInstances:[
        new pc.MeshInstance(mesh,molded?materials.styrene:materials.oldWall)
      ]});
      entity.render.castShadows=true;
      entity.render.receiveShadows=true;
      group.addChild(entity);
    }
    function pitchedRoof(name,xc,centerZ,halfWidth,eave,ridge,depth,rows,columns){
      const angle=Math.atan2(ridge-eave,halfWidth);
      const degrees=angle*180/Math.PI;
      const slopedLength=Math.hypot(halfWidth,ridge-eave);
      const front=centerZ+depth/2,back=centerZ-depth/2;
      gable(name+' front cast plastic gable',xc,halfWidth-.12,eave+.06,ridge-.1,
        front-.54,true);
      gable(name+' back cast plastic gable',xc,halfWidth-.12,eave+.06,ridge-.1,
        back+.54,false);
      for(const side of [-1,1]){
        const panelX=xc+side*halfWidth*.50;
        const panelY=(eave+ridge)/2;
        const rot=[0,0,-side*degrees];
        p(name+' continuous pitched roof shell',
          molded?materials.roofing:materials.oldRoof,
          [panelX,panelY,centerZ],[slopedLength+.14,.19,depth],.045,rot);
        // A vertical edge fascia and front sloping face trim make the roof
        // visibly one manufactured casting instead of a free-floating plane.
        p(name+' timber-cast eave fascia',
          molded?materials.offwhite:materials.oldTrim,
          [xc+side*halfWidth,eave-.075,centerZ],[.18,.22,depth+.12],
          .055);
        p(name+' gable fascia at front edge',
          molded?materials.offwhite:materials.oldTrim,
          [panelX,panelY,front+.07],[slopedLength+.19,.17,.18],
          .06,rot);
        if(molded){
          for(let row=0;row<rows;row++){
            const f=(row+.51)/rows;
            const roofX=xc+side*halfWidth*f;
            const roofY=ridge+(eave-ridge)*f+.13;
            const tileWidth=slopedLength/rows+.10;
            for(let column=0;column<columns;column++){
              const stagger=(row%2)*.12;
              const z=back+(column+.5)*depth/columns+stagger;
              p(name+' overlapping molded shingle',
                (row+column)%8===0?materials.roofHighlight:
                (row+column)%3===0?materials.roofRaised:materials.roofing,
                [roofX,roofY,z],
                [tileWidth,.072,depth/columns+.06],.024,rot);
              counts.panels++;
            }
          }
        }
      }
      p(name+' continuous ridge cap',
        molded?materials.roofing:materials.oldRoof,
        [xc,ridge-.015,centerZ],[.33,.26,depth+.13],.10);
      if(molded){
        for(let column=0;column<columns;column++){
          const z=back+(column+.5)*depth/columns;
          p(name+' stamped ridge shingle cap',materials.roofRaised,
            [xc,ridge+.135,z],[.37,.08,depth/columns+.03],.036);
          counts.panels++;
        }
      }
    }
    // Main wall reaches y=5.90, main roof eaves are y=5.83.
    // Garage wall reaches y=4.245, garage eaves are y=4.20.
    pitchedRoof('Main house',-3.66,-2.75,4.35,5.83,8.10,6.75,6,8);
    pitchedRoof('Attached garage',3.80,-2.83,3.58,4.20,5.82,6.60,4,7);
    if(molded){
      // Real assembly-line details: a covered entrance, support posts,
      // gutters and drains, cast foundations and edge contact shadows.
      p('Front entrance overhanging veranda canopy',materials.roofing,
        [-1.52,3.80,1.03],[2.87,.22,1.65],.09);
      for(const x of [-2.70,-.34]){
        p('Molded veranda support column',materials.offwhite,
          [x,2.17,1.65],[.17,3.23,.18],.065);
        p('Column socket footing',materials.offwhite,
          [x,.61,1.65],[.33,.20,.33],.065);
      }
      p('House foundation separate molded stone strip',materials.concrete,
        [-3.66,.43,-2.75],[8.25,.53,5.74],.05);
      p('Garage foundation lower molded plinth',materials.concrete,
        [3.80,.40,-2.83],[6.86,.48,5.85],.035);
      p('Molded end cap of porch roof',materials.offwhite,
        [-1.52,3.72,1.84],[2.9,.14,.19],.06);
      p('Plastic exterior porch lamp body',materials.metal,
        [-.35,3.20,.52],[.19,.38,.19],.05);
      p('Amber light diffuser',materials.warmLight,
        [-.35,3.20,.65],[.13,.23,.04],.018);
      for(const x of [-7.99,.7,7.41]){
        const gutterY=x===7.41?4.1:5.73;
        p('Vacuum-plated molded rain downspout',materials.metal,
          [x,2.9,x===7.41?-.05:-.12],[.11,4.6,.12],.045);
        p('Rain downspout bend',materials.metal,
          [x,.67,.14],[.17,.11,.40],.04);
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
    if(molded){
      flockMesh(group);
      // Physical model-railway scenery makes the object sit on a surface:
      // dark ballast under low plants, warm raised curbs and scale details.
      for(const [x,w] of [[-6.74,1.7],[-3.12,1.40],[.15,.8]]){
        p('Actual inset gravel planting bed',materials.soil,
          [x,.17,.69],[w,.11,.78],.075);
        p('Tiny molded garden retaining lip',materials.concrete,
          [x,.20,1.13],[w+.14,.13,.13],.035);
      }
      function plantedCluster(x,z,scale){
        const anchor=new pc.Entity('Commercial HO scenic shrub insert');
        group.addChild(anchor);
        const centers=[
          [-.22,0,-.12,.54],[.25,.07,.08,.56],[0,.27,0,.62],
          [-.04,.12,.26,.43]
        ];
        for(let i=0;i<centers.length;i++){
          const [dx,dy,dz,r]=centers[i];
          const part=new pc.Entity('Glued-on textured scenery clump');
          part.addComponent('render',{type:'sphere',
            material:i%2===0?materials.plant:materials.plantLight});
          part.setLocalPosition(x+dx*scale,.43+(dy+r*.22)*scale,z+dz*scale);
          part.setLocalScale(r*scale,(r*.76)*scale,r*.87*scale);
          part.render.castShadows=true;part.render.receiveShadows=true;
          anchor.addChild(part);
        }
      }
      for(const [x,z,scale] of [[-7.2,.67,.76],[-3.2,.70,.57],
        [.15,.73,.46],[7.42,.38,.62],[6.90,-3.82,.76]]){
        plantedCluster(x,z,scale);
      }
      for(const z of [1.75,3.35,4.94]){
        p('Miniature scored driveway expansion seam',materials.groove,
          [3.88,.205,z],[5.6,.016,.025],.005);
      }
      p('1:87 painted curb by frontage',materials.concrete,
        [0,.20,5.88],[16.4,.20,.19],.045);
      p('Cast model mailbox post',materials.offwhite,
        [-7.7,.76,3.62],[.15,1.25,.13],.038);
      p('Dark injection-molded mini mailbox',materials.shutter,
        [-7.7,1.41,3.70],[.64,.27,.38],.09);
      p('Mailbox stamped opening',materials.wallBack,
        [-7.7,1.42,3.91],[.49,.12,.025],.012);
    }
    return group;
  }
  const old=specimen(-10.55,false);
  const improved=specimen(10.55,true);
  // A continuous tabletop and warm backdrop make the camera read as a
  // photographed physical object on a workbench, not a CAD void.
  const stageMaterial=plastic('Warm photographic workbench','#a19484',
    {gloss:.09,coat:0,texture:false,ao:false});
  const backdropMaterial=plastic('Warm neutral photographic paper sweep','#908f81',
    {gloss:.04,coat:0,texture:false,ao:false});
  const bench=new pc.Entity('Physical workbench surface');
  bench.addComponent('render',{type:'box',material:stageMaterial});
  bench.setLocalPosition(0,-1.17,-2.8);
  bench.setLocalScale(62,.25,43);
  bench.render.receiveShadows=true;app.root.addChild(bench);
  const backdrop=new pc.Entity('Photographic workshop sweep');
  backdrop.addComponent('render',{type:'box',material:backdropMaterial});
  backdrop.setLocalPosition(0,10,-19.5);
  backdrop.setLocalScale(66,28,.24);
  backdrop.render.receiveShadows=false;app.root.addChild(backdrop);
  const divider=new pc.Entity('Independent comparison gap');app.root.addChild(divider);
  function camera(){
    const phone=window.innerWidth<780;
    if(phone){
      state.mode=state.mode==='both'?'improved':state.mode;
      // A phone displays ONE physical specimen, never part of the other
      // house clipping the screen edge. Compose the selected building by
      // its actual width and the canvas horizontal field of view.
      old.enabled=state.mode==='before';
      improved.enabled=state.mode==='improved';
      const specimenRoot=state.mode==='before'?-10.55:10.55;
      const selectedX=state.region==='garage'?3.80:-3.65;
      const canvasAspect=Math.max(.54,canvas.clientWidth/Math.max(canvas.clientHeight,1));
      const horizontalHalfTan=Math.tan(cam.camera.fov*Math.PI/360)*canvasAspect;
      const regionWidth=state.region==='garage'?8.9:11.8;
      const fitDistance=regionWidth/(2*horizontalHalfTan);
      state.target.set(specimenRoot+selectedX,
        state.region==='garage'?3.15:3.85,-2.2);
      state.zoom=Math.min(43,Math.max(18,fitDistance*1.16));
      state.pitch=.245;state.turn=.13;
    }else{
      // Both specimens, exactly matching camera and shared light.
      old.enabled=true;
      improved.enabled=true;
      state.target.set(0,3.25,-1.50);
      state.zoom=37.8;state.pitch=.26;state.turn=.035;
    }
    renderCamera();
    document.body.dataset.fidelityMobileMode=state.mode;
    document.body.dataset.fidelityRegion=state.region;
    document.body.dataset.fidelityCameraDistance=state.zoom.toFixed(2);
    document.body.dataset.fidelityIsolation=phone?'single-specimen':'paired';
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
