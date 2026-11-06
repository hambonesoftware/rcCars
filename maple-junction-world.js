import * as pc from 'playcanvas';

export const BOARD={lengthFt:20,depthFt:10,width:200,depth:100};
export const MAPLE_WAYPOINTS=[
  [-43,24],[-15,24],[15,24],[43,24],[64,23],[76,10],
  [70,-3],[52,-12],[62,-23],[59,-35],[37,-39],[17,-30],
  [-4,-22],[-27,-24],[-44,-37],[-67,-36],[-78,-23],
  [-73,-5],[-55,4],[-63,17],[-58,33]
];
export const DISTRICT_NAMES=['Main Street','Maple Homes','High Ridge','Maple Depot','Service Lane'];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function groundHeight(x,z){
  const hills=smooth(-12,-45,z); // negative orientation handled below
  const rear=1-smooth(-43,-13,z);
  const round1=Math.exp(-Math.pow((x-46)/43,2));
  const round2=Math.exp(-Math.pow((x+48)/36,2));
  return .12+.16*Math.sin(x*.064)*Math.cos(z*.081)+
    rear*(1.4+5.6*round1+3.0*round2)+
    .35*Math.exp(-Math.pow((x-57)/20,2)-Math.pow((z+18)/14,2));
}
function rgb(hex){
  return new pc.Color(
    parseInt(hex.slice(1,3),16)/255,
    parseInt(hex.slice(3,5),16)/255,
    parseInt(hex.slice(5,7),16)/255
  );
}
export function makeTrack(points,heightFn=groundHeight,samplesPerSegment=12){
  const source=points.map(p=>({x:p[0],z:p[1]}));
  const samples=[];
  const size=source.length;
  for(let i=0;i<size;i++){
    const p0=source[(i-1+size)%size],p1=source[i];
    const p2=source[(i+1)%size],p3=source[(i+2)%size];
    for(let j=0;j<samplesPerSegment;j++){
      const t=j/samplesPerSegment,t2=t*t,t3=t2*t;
      function cat(key){
        return .5*((2*p1[key])+(-p0[key]+p2[key])*t+
          (2*p0[key]-5*p1[key]+4*p2[key]-p3[key])*t2+
          (-p0[key]+3*p1[key]-3*p2[key]+p3[key])*t3);
      }
      const x=cat('x'),z=cat('z');
      samples.push({x,z,y:heightFn(x,z)+.35});
    }
  }
  let d=0;
  for(let i=0;i<samples.length;i++){
    const p=samples[i],q=samples[(i+1)%samples.length];
    const dx=q.x-p.x,dz=q.z-p.z;
    const mag=Math.hypot(dx,dz)||1;
    p.tx=dx/mag;p.tz=dz/mag;
    p.nx=-p.tz;p.nz=p.tx;
    p.s=d;
    d+=mag;
  }
  const length=d;
  const pointAt=distance=>{
    const a=((distance%length)+length)%length;
    let lo=0,hi=samples.length-1;
    while(lo<hi){const mid=(lo+hi+1)>>1;
      if(samples[mid].s<=a)lo=mid;else hi=mid-1;}
    const p=samples[lo],q=samples[(lo+1)%samples.length];
    const seg=lo===samples.length-1?length-p.s:q.s-p.s;
    const t=clamp((a-p.s)/(seg||1),0,1);
    let tx=p.tx*(1-t)+q.tx*t,tz=p.tz*(1-t)+q.tz*t;
    const inv=1/(Math.hypot(tx,tz)||1);tx*=inv;tz*=inv;
    return {x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,
      z:p.z+(q.z-p.z)*t,tx,tz,nx:-tz,nz:tx,s:a};
  };
  function nearest(x,z){
    let best=1e12,found=null;
    for(let i=0;i<samples.length;i++){
      const p=samples[i],q=samples[(i+1)%samples.length];
      const dx=q.x-p.x,dz=q.z-p.z;
      const u=clamp(((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1),0,1);
      const px=p.x+dx*u,pz=p.z+dz*u;
      const dist=(x-px)**2+(z-pz)**2;
      if(dist<best){
        const segment=i===samples.length-1?length-p.s:q.s-p.s;
        best=dist;
        found={s:(p.s+segment*u)%length,dist:Math.sqrt(dist),
          x:px,z:pz,tx:p.tx,tz:p.tz,y:p.y+(q.y-p.y)*u};
      }
    }
    return found;
  }
  return {samples,length,pointAt,nearest};
}
export function buildMapleWorld(app,device,{specular=50}={}){
  const root=new pc.Entity('Maple Junction / 20 by 10 foot HO railroad table');
  app.root.addChild(root);
  const details={buildings:0,trees:0,railTies:0,trainCars:0,roadSamples:0};
  let seed=59371;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function texture(name,paint){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=256;
    const context=canvas.getContext('2d',{alpha:false});
    paint(context,256,256);
    const t=new pc.Texture(device,{width:256,height:256,format:pc.PIXELFORMAT_RGBA8,mipmaps:true});
    t.name=name;t.setSource(canvas);
    t.addressU=pc.ADDRESS_REPEAT;t.addressV=pc.ADDRESS_REPEAT;
    t.minFilter=pc.FILTER_LINEAR_MIPMAP_LINEAR;t.anisotropy=6;
    return t;
  }
  const grain=texture('Injection-molded plastic micro-normal',(ctx,w,h)=>{
    const im=ctx.createImageData(w,h);
    for(let i=0;i<im.data.length;i+=4){
      im.data[i]=124+Math.floor(rand()*9);
      im.data[i+1]=124+Math.floor(rand()*9);
      im.data[i+2]=254;im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);
  });
  const grass=texture('Model railroad glued scenic flock',(ctx,w,h)=>{
    ctx.fillStyle='#85936a';ctx.fillRect(0,0,w,h);
    for(let i=0;i<13500;i++){
      const x=rand()*w,y=rand()*h;
      ctx.strokeStyle=rand()<.5?'#738451':'#b4aa73';
      ctx.lineWidth=.4+rand()*.8;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*2-1,y-1-rand()*2);
      ctx.stroke();
    }
  });
  const materials={};
  function matte(name,hex,gloss=.15){
    const m=new pc.StandardMaterial();
    m.name=name;m.diffuse=rgb(hex);m.useMetalness=false;
    m.specular=rgb('#343434');m.gloss=gloss;m.update();
    return m;
  }
  function plastic(name,hex,gloss=.57,coat=.06){
    const m=new pc.StandardMaterial();
    m.name=name;m.diffuse=rgb(hex);m.useMetalness=false;m.metalness=0;
    m.gloss=gloss;m.clearCoat=coat;m.clearCoatGloss=.75;
    m.specular=rgb('#777777');m.fresnelModel=pc.FRESNEL_SCHLICK;
    m.enableGGXSpecular=true;
    m.normalMap=grain;m.bumpiness=.16;
    m.normalMapTiling=new pc.Vec2(2,2);
    m.update();materials[name]=m;return m;
  }
  const g=matte('Flocked dark olive scenic plaster','#73825c',.07);
  g.diffuseMap=grass;g.diffuseMapTiling=new pc.Vec2(14,7);
  g.diffuse=rgb('#c8c9b1');g.update();
  const soil=matte('Scenic brown earth','#655544',.07);
  const wood=matte('Visible varnished train table fascia','#8b674b',.36);
  const roadMat=matte('Slightly weathered miniature asphalt','#616a67',.15);
  const shoulder=matte('Gravel railway and road shoulder','#ac9d7c',.08);
  const cream=plastic('Warm off-white diecast trim','#d8ccb1',.61,.095);
  const siding=plastic('Sage styrene model kit siding','#879d8e',.58,.065);
  const blue=plastic('Ice-blue molded storefront','#87a4ac',.60,.06);
  const rose=plastic('Muted rose molded storefront','#b98b7d',.57,.065);
  const yellow=plastic('Mustard hardware storefront','#b5a378',.57,.07);
  const red=plastic('Dark-red model depot siding','#95665d',.58,.09);
  const green=plastic('Painted dark evergreen miniature shutters','#36584e',.58,.07);
  const darkRoof=plastic('Cast charcoal shingle roofing','#505d58',.45,.025);
  const slate=plastic('Gray molded miniature slate','#687470',.43,.025);
  const glass=plastic('Smoked shiny acrylic model windows','#315962',.89,.22);
  const sign=plastic('Warm ivory sign enamel','#ded0af',.58,.07);
  const sidewalk=matte('Tiny brushed model concrete','#b4b0a2',.14);
  const railSteel=plastic('Shiny model railway rails','#c0c6bf',.90,.18);
  const tieWood=matte('Brown HO railway sleepers','#5f4b3a',.12);
  const white=matte('Model roadway thermoplastic paint','#e0dece',.12);
  const stripe=matte('Weathered miniature yellow center lines','#d7b56d',.12);
  const treeDark=matte('Green fine scenic foam','#46684c',.09);
  const treeLight=matte('Light green scenic foam','#6e8557',.08);
  const trunk=matte('Miniature tree trunk armature','#625443',.15);
  const black=plastic('Soft black rubber tires','#272c29',.28,.00);
  const carPaint=plastic('Satin cherry metallic toy car','#9d413b',.78,.22);
  const trainPaint=plastic('Dark green HO locomotive shell','#255d4d',.75,.16);
  const trainAccent=plastic('Amber metal railway stripe','#d4b76d',.82,.12);
  const dims={tableX:200,tableZ:100,roadWidth:9.2};
  const plasticMaterials=[cream,siding,blue,rose,yellow,red,green,darkRoof,
    slate,glass,sign,railSteel,carPaint,trainPaint,trainAccent];
  function applySpecular(percent){
    const x=clamp(percent/100,0,1),reflect=.035+.56*x;
    for(const m of plasticMaterials){
      m.specular.set(reflect,reflect,reflect);
      m.gloss=.39+.42*x;
      m.update();
    }
    document.body.dataset.mapleSpecular=String(Math.round(percent));
  }
  applySpecular(specular);
  // Reuse one rounded, softly lit primitive as a physical, injection-molded part.
  function box(parent,name,material,x,y,z,w,h,d,round=0){
    const entity=new pc.Entity(name);
    entity.addComponent('render',{type:'box',material});
    entity.setLocalPosition(x,y,z);entity.setLocalScale(w,h,d);
    entity.render.castShadows=true;entity.render.receiveShadows=true;
    parent.addChild(entity);return entity;
  }
  function meshEntity(name,geometry,material,parent=root){
    const mesh=pc.Mesh.fromGeometry(device,geometry);
    const entity=new pc.Entity(name);
    entity.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)]});
    entity.render.receiveShadows=true;
    entity.render.castShadows=false;
    parent.addChild(entity);return entity;
  }
  function meshFrom(pos,nor,uv,ind){
    const geometry=new pc.Geometry();
    geometry.positions=pos;geometry.normals=nor;geometry.uvs=uv;geometry.indices=ind;
    return geometry;
  }
  // The actual terrain is a raised relief on a physical hardwood-edged table.
  box(root,'Wooden scale model display table',wood,0,-1.25,0,202,2.5,102);
  box(root,'Front walnut fascia',wood,0,-1.0,50.5,202,2.5,1.4);
  box(root,'Back walnut fascia',wood,0,-1.0,-50.5,202,2.5,1.4);
  box(root,'Left walnut fascia',wood,-100.5,-1,0,1.4,2.5,101);
  box(root,'Right walnut fascia',wood,100.5,-1,0,1.4,2.5,101);
  {
    const pos=[],nor=[],uv=[],ix=[],cols=84,rows=44;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const x=-99+198*i/cols,z=-49+98*j/rows;
      pos.push(x,groundHeight(x,z),z);
      const dx=(groundHeight(x+.32,z)-groundHeight(x-.32,z))/.64;
      const dz=(groundHeight(x,z+.32)-groundHeight(x,z-.32))/.64;
      const mag=Math.hypot(dx,1,dz);
      nor.push(-dx/mag,1/mag,-dz/mag);
      uv.push(i/cols*14,j/rows*7);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;
      ix.push(a,c,b,b,c,d);
    }
    meshEntity('Carved rolling plaster hills with matte scenic flock',
      meshFrom(pos,nor,uv,ix),g);
  }

  const road=makeTrack(MAPLE_WAYPOINTS);
  details.roadSamples=road.samples.length;
  function ribbon(name,samples,width,mat,{offset=0,lift=0,followTerrain=false,loop=true}={}){
    const pos=[],norm=[],uv=[],ix=[];
    const n=samples.length;
    for(let i=0;i<n;i++){
      const p=samples[i];const y=followTerrain?groundHeight(p.x,p.z)+lift:p.y+lift;
      const nx=p.nx,nz=p.nz;
      for(const side of [-1,1]){
        pos.push(p.x+nx*(offset+side*width/2),y,p.z+nz*(offset+side*width/2));
        norm.push(0,1,0);uv.push(i/12,side===-1?0:1);
      }
    }
    for(let i=0;i<(loop?n:n-1);i++){
      const a=2*i,b=2*((i+1)%n);
      ix.push(a,b,a+1,a+1,b,b+1);
    }
    return meshEntity(name,meshFrom(pos,norm,uv,ix),mat);
  }
  ribbon('Continuous drivable road base',road.samples,12.0,shoulder,{lift:.01});
  ribbon('Actual smooth tarmac model town racing route',road.samples,9.2,roadMat,{lift:.055});
  ribbon('Left painted road edge',road.samples,.12,white,{offset:4.37,lift:.065});
  ribbon('Right painted road edge',road.samples,.12,white,{offset:-4.37,lift:.065});
  // Small centerline segments are batched into a single mesh.
  function patchQuads(quads,name,mat){
    const pos=[],nor=[],uv=[],ix=[];
    for(const q of quads){
      const b=pos.length/3;
      const p=q.p,tx=q.tx,tz=q.tz;
      const ux=-tz,uz=tx,hw=q.w/2,hl=q.l/2,y=q.y;
      for(const [a,d] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        pos.push(p.x+ux*hw*a+tx*hl*d,y,p.z+uz*hw*a+tz*hl*d);
        nor.push(0,1,0);uv.push((a+1)/2,(d+1)/2);
      }
      ix.push(b,b+1,b+2,b,b+2,b+3);
    }
    return meshEntity(name,meshFrom(pos,nor,uv,ix),mat);
  }
  const centerLines=[];
  for(let d=0;d<road.length;d+=9){
    const p=road.pointAt(d);
    centerLines.push({p,tx:p.tx,tz:p.tz,y:p.y+.11,w:.17,l:3.6});
  }
  patchQuads(centerLines,'Painted short yellow roadway center dashes',stripe);
  const finish=[];
  const initial=road.pointAt(0);
  for(let k=0;k<12;k++){
    const sign=(-1)**k;
    finish.push({p:{x:initial.x+initial.nx*((k-5.5)*.75),
      z:initial.z+initial.nz*((k-5.5)*.75)},tx:initial.tx,tz:initial.tz,
      y:initial.y+.116,w:.74,l:1.2});
  }
  patchQuads(finish,'Painted start and finish line across Maple Main Street',white);

  // Train tracks are a physically independent oval laid in gravel ballast.
  const railSamples=[];
  for(let i=0;i<264;i++){
    const t=2*Math.PI*i/264,x=86*Math.cos(t),z=39*Math.sin(t);
    const dx=-86*Math.sin(t),dz=39*Math.cos(t),mag=Math.hypot(dx,dz);
    railSamples.push({x,z,y:groundHeight(x,z)+.17,
      tx:dx/mag,tz:dz/mag,nx:-dz/mag,nz:dx/mag});
  }
  ribbon('Model train track weathered ballast',railSamples,3.35,shoulder,{lift:.028});
  const ties=[];
  for(let i=0;i<railSamples.length;i+=2){
    const p=railSamples[i];
    ties.push({p,tx:p.tx,tz:p.tz,y:p.y+.10,w:3.3,l:.47});
  }
  details.railTies=ties.length;
  patchQuads(ties,'All railroad sleepers merged into one scenic mesh',tieWood);
  ribbon('Inner steel railroad rail',railSamples,.13,railSteel,{offset:-.9,lift:.16});
  ribbon('Outer steel railroad rail',railSamples,.13,railSteel,{offset:.9,lift:.16});

  const buildingColors=[siding,blue,rose,yellow,red];
  const buildingSpecs=[
    {name:'MAPLE DINER',x:-32,z:7,w:12,d:10,h:7,type:'shop',c:2},
    {name:'HARDWARE',x:-13,z:7,w:13,d:11,h:9,type:'shop',c:3},
    {name:'PHARMACY',x:7,z:7,w:12,d:10,h:8,type:'shop',c:1},
    {name:'JUNCTION BANK',x:25,z:7,w:11,d:10,h:9,type:'shop',c:0},
    {name:'CORNER BAKERY',x:44,z:6,w:11,d:9,h:8,type:'shop',c:2},
    {name:'MAPLE BUNGALOW',x:-44,z:-10,w:12,d:10,h:8,type:'house',c:0},
    {name:'CEDAR COTTAGE',x:-21,z:-7,w:12,d:10,h:8,type:'house',c:4},
    {name:'OAK STREET HOUSE',x:8,z:-7,w:12,d:9,h:8,type:'house',c:1},
    {name:'BRICK CHAPEL',x:30,z:-7,w:11,d:11,h:11,type:'house',c:2},
    {name:'PINE STREET HOUSE',x:-83,z:11,w:10,d:10,h:7,type:'house',c:3},
    {name:'MAPLE DEPOT',x:-86,z:29,w:13,d:10,h:7,type:'depot',c:4},
    {name:'COAL AND FREIGHT',x:-9,z:-41,w:18,d:9,h:7,type:'shop',c:4},
    {name:'HILL SERVICE GARAGE',x:87,z:-9,w:11,d:12,h:7,type:'shop',c:3}
  ];
  function textSign(label,background){
    const tex=texture('Painted plastic storefront sign '+label,(ctx,w,h)=>{
      ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#eadfc7';ctx.lineWidth=12;ctx.strokeRect(7,7,w-14,h-14);
      ctx.fillStyle='#f5ebd5';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='bold '+(label.length>15?'22px':'28px')+' Arial,sans-serif';
      ctx.fillText(label,w/2,h/2,w-21);
    });
    const m=new pc.StandardMaterial();m.name='Screenprinted vintage sign: '+label;
    m.diffuse=rgb('#ffffff');m.diffuseMap=tex;
    m.useMetalness=false;m.specular=rgb('#737373');m.gloss=.48;
    m.update();return m;
  }
  function house(spec){
    const y=groundHeight(spec.x,spec.z);
    const entity=new pc.Entity('HO-scale cast building / '+spec.name);
    entity.setLocalPosition(spec.x,y,spec.z);
    root.addChild(entity);
    const wall=buildingColors[spec.c];
    box(entity,'Cast body with physical depth',wall,0,spec.h/2,0,spec.w,spec.h,spec.d);
    box(entity,'Concrete foundation edge',sidewalk,0,.36,0,spec.w+.3,.72,spec.d+.3);
    const front=spec.d/2+.075;
    const roofY=spec.h+.12;
    if(spec.type==='shop'){
      box(entity,'Molded flat storefront parapet',wall,0,roofY+.45,0,
        spec.w+.45,1.15,spec.d+.40);
      box(entity,'Capped plastic storefront cornice',cream,0,roofY+1.02,
        front-.15,spec.w+.64,.24,.57);
      box(entity,'Front framed glass display',glass,-spec.w*.20,3.35,front+.09,
        spec.w*.39,4.8,.12);
      box(entity,'Second glass storefront bay',glass,spec.w*.24,3.35,front+.09,
        spec.w*.33,4.8,.12);
      for(const x of [-spec.w*.41,-spec.w*.02,spec.w*.41]){
        box(entity,'Continuous mullion trim',cream,x,3.38,front+.19,.17,4.9,.15);
      }
      box(entity,'Awnings at miniature shop entrance',darkRoof,0,5.48,
        front+1.10,spec.w+.65,.29,2.2);
      box(entity,'Shop signage with a real printed label',
        textSign(spec.name, spec.c%2===0?'#465a4d':'#6c6351'),
        0,7.50,front+.26,spec.w-.5,1.05,.18);
    }else{
      // Connected gable-shaped HO kit roof with molded horizontal ridge.
      const rise=spec.type==='depot'?2:3;
      const angle=Math.atan2(rise,spec.w/2+.6)*180/Math.PI;
      for(const side of [-1,1]){
        const sloped=new pc.Entity('Continuous sloped roof half');
        sloped.addComponent('render',{type:'box',material:darkRoof});
        sloped.setLocalPosition(side*(spec.w/4+.15),roofY+rise/2,0);
        sloped.setLocalEulerAngles(0,0,-side*angle);
        sloped.setLocalScale(Math.hypot(spec.w/2+.6,rise),.20,spec.d+1.1);
        sloped.render.castShadows=true;
        entity.addChild(sloped);
      }
      box(entity,'Fully connected plastic roof ridge',slate,0,roofY+rise,0,
        .42,.30,spec.d+1.18);
      for(let wi=0;wi<2;wi++){
        const xx=(wi-.5)*spec.w*.48;
        box(entity,'Deep set acrylic window',glass,xx,4.20,front+.12,
          2.0,2.75,.14);
        for(const xx2 of [xx-1.04,xx+1.04])
          box(entity,'Rounded styrene window casing',cream,xx2,4.20,front+.23,
            .20,3.03,.20);
        for(const yy of [2.72,5.68])
          box(entity,'Horizontal window sill',cream,xx,yy,front+.23,
            2.36,.21,.24);
        box(entity,'Window cross mullion',cream,xx,4.18,front+.28,.12,2.71,.15);
        box(entity,'Window muntin',cream,xx,4.18,front+.28,2.03,.10,.15);
      }
      box(entity,'Front painted plastic door',green,0,1.64,front+.19,
        1.57,3.25,.13);
      box(entity,'Doorframe molded lintel',cream,0,3.44,front+.27,2.0,.17,.25);
      if(spec.type==='depot')
        box(entity,'Rail station name sign',
          textSign('MAPLE JUNCTION','#415347'),
          0,6.4,front+.24,Math.min(spec.w-1,9.0),.95,.16);
    }
    // A separate cast rain gutter provides a clean plastic silhouette.
    for(const xx of [-spec.w/2,spec.w/2]){
      box(entity,'Gutter and downpipe',cream,xx-.1,3.2,front+.18,
        .15,Math.min(spec.h-.45,6.2),.14);
    }
    details.buildings++;
    return entity;
  }
  for(const spec of buildingSpecs)house(spec);

  // Distinctive miniature landscaping: puff-foam deciduous trees and
  // pine-cone scenic trees, with no glossy finish on the foliage.
  const treePositions=[
    [-91,-36],[-82,-43],[-68,-43],[-52,-42],[-31,-42],
    [4,-43],[16,-44],[24,-40],[37,-44],[51,-43],[63,-41],
    [78,-37],[89,-29],[91,-18],[88,36],
    [-91,-12],[-88,-3],[-79,3],[-66,-11],[-50,-17],
    [-36,-15],[-10,-10],[19,-8],[37,-12],[51,-18],
    [7,-15],[31,32],[54,35],[-7,36],[-27,38],[-50,39],
    [70,36],[89,40],[-94,41],[2,40],[34,-17]
  ];
  function tree(x,z,index){
    const group=new pc.Entity('HO scenery tree / '+(index+1));
    root.addChild(group);
    const y=groundHeight(x,z);
    group.setLocalPosition(x,y,z);
    const h=3.3+rand()*2.9;
    box(group,'Small matte tree armature',trunk,0,h*.35,0,.32,h*.72,.33);
    const isPine=index%4===0;
    if(isPine){
      for(let k=0;k<3;k++){
        const crown=new pc.Entity('Miniature pine flocking cone');
        crown.addComponent('render',{type:'cone',material:k%2?treeLight:treeDark});
        crown.setLocalScale(2.3-k*.51,2.5,2.3-k*.51);
        crown.setLocalPosition(0,h*.46+k*.78,0);
        group.addChild(crown);
      }
    }else{
      for(let k=0;k<3;k++){
        const foliage=new pc.Entity('Glued matte clump foliage');
        foliage.addComponent('render',{type:'sphere',material:k%2?treeLight:treeDark});
        foliage.setLocalScale(2.6,2.0,2.3);
        foliage.setLocalPosition((k-1)*.8,h*.72+(k%2)*.6,((k+1)%3-1)*.6);
        group.addChild(foliage);
      }
    }
    details.trees++;
  }
  for(let i=0;i<treePositions.length;i++)tree(...treePositions[i],i);

  // Manufactured railroad train: one engine plus two coaches.
  function trainCar(index){
    const group=new pc.Entity('Moving HO train '+(index===0?'locomotive':'coach '+index));
    root.addChild(group);
    const m=index===0?trainPaint:blue;
    box(group,'Toy train molded shell',m,0,1.1,0,2.35,2.10,5.10);
    box(group,'Locomotive roof and window cast',darkRoof,0,2.25,0,2.54,.23,5.3);
    for(const side of [-1,1])for(const zz of [-1.55,1.55]){
      const wheel=new pc.Entity('Model railroad wheel');
      wheel.addComponent('render',{type:'cylinder',material:black});
      wheel.setLocalScale(.75,.21,.75);
      wheel.setLocalEulerAngles(0,0,90);
      wheel.setLocalPosition(side*1.09,.2,zz);
      group.addChild(wheel);
    }
    for(const zz of [-1.2,0,1.2])box(group,'Windowed carriage glazing',
      glass,-1.24,1.48,zz,.12,.65,.75);
    if(index===0)box(group,'Locomotive smokestack',trainAccent,0,2.6,-1.6,
      .55,.87,.57);
    details.trainCars++;
    return group;
  }
  const trainEntities=[trainCar(0),trainCar(1),trainCar(2)];
  let trainProgress=17;
  function updateTrain(dt){
    trainProgress=(trainProgress+dt*8)%264;
    for(let i=0;i<trainEntities.length;i++){
      const progress=((trainProgress-i*5.5/((2*Math.PI*85)/264))%264+264)%264;
      const a=Math.floor(progress),b=(a+1)%264,t=progress-a;
      const p=railSamples[a],q=railSamples[b],tx=p.tx*(1-t)+q.tx*t,
        tz=p.tz*(1-t)+q.tz*t;
      const entity=trainEntities[i];
      entity.setLocalPosition(p.x+(q.x-p.x)*t,
        p.y+(q.y-p.y)*t+.30,
        p.z+(q.z-p.z)*t);
      entity.setLocalEulerAngles(0,Math.atan2(tx,tz)*180/Math.PI,0);
    }
  }
  updateTrain(0);
  // A static railway crossing at a visible west-side road junction.
  const crossingX=-75,crossingZ=-13;
  box(root,'Railway crossing white miniature post',cream,crossingX+5,
    groundHeight(crossingX,crossingZ)+3.4,crossingZ,.27,6.6,.31);
  box(root,'Red and white miniature railroad warning arm',red,crossingX+5,
    groundHeight(crossingX,crossingZ)+5.0,crossingZ+1.75,.21,.22,3.5);
  box(root,'Tiny cast crossing signal head',black,crossingX+5,
    groundHeight(crossingX,crossingZ)+5.7,crossingZ,.75,.65,.70);
  document.body.dataset.mapleBuild='ready';
  document.body.dataset.mapleTable='20x10-feet';
  document.body.dataset.mapleBuildings=String(details.buildings);
  document.body.dataset.mapleTrees=String(details.trees);
  document.body.dataset.mapleRailTies=String(details.railTies);
  document.body.dataset.mapleTrainCars=String(details.trainCars);
  document.body.dataset.mapleRoadSamples=String(details.roadSamples);
  return {root,road,railSamples,applySpecular,updateTrain,details,
    materials:{carPaint,cream,glass,black,trainAccent},board:BOARD};
}
