import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import {makeRCTrophyTruck} from './truck-model.js';

const $=id=>document.getElementById(id);
const ui={
  viewport:$('viewport'),loading:$('loading'),intro:$('intro'),results:$('results'),
  pauseOverlay:$('pause-overlay'),start:$('start'),pause:$('pause'),resume:$('resume'),
  retry:$('retry'),restart:$('restart'),exit:$('exit'),camera:$('camera'),
  marker:$('marker'),flash:$('flash'),speed:$('speed'),time:$('time'),
  place:$('place'),sector:$('sector'),heat:$('heat'),heatLabel:$('heat-label'),
  progress:$('progress-fill'),map:$('map'),resultTime:$('result-time'),
  resultPlace:$('result-place')
};
const mobile=matchMedia('(pointer:coarse)').matches;
const R=64,STRAIGHT=85,TURN=R*Math.PI*.5,EXIT=82,END=STRAIGHT+TURN+EXIT;
const HALF=9.1,MAX_SPEED=21.6,GRAVITY=19.5;
const STARTLINE=19,FINAL_GATE=END-3;
const ramp={start:58,end:72,height:2.15};
const rollers=[{start:25,end:35,height:.44},{start:40,end:51,height:.55},
  {start:213,end:224,height:.42},{start:234,end:244,height:.58}];
const controls={left:false,right:false,accel:false,brake:false,boost:false,leanBack:false,leanForward:false};
const game={mode:'intro',time:0,countdown:3.4,camera:'follow',toastUntil:0,shake:0,muted:false};
const player={
  mesh:null,x:0,y:0,z:0,s:7,d:-3.35,heading:0,speed:0,
  vy:0,grounded:true,airtime:0,pitch:0,roll:0,
  heat:0,overheated:false,collisionCooldown:0,launchConsumed:false
};
let renderer,scene,camera,sun;
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
    if(s>=b.start&&s<=b.end)h+=Math.sin(Math.PI*(s-b.start)/(b.end-b.start))*b.height;
  }
  if(s>=ramp.start&&s<ramp.end)h+=ramp.height*ease(ramp.start,ramp.end,s);
  if(s>=STRAIGHT&&s<STRAIGHT+TURN){
    const t=(s-STRAIGHT)/TURN;
    const banking=Math.pow(Math.sin(t*Math.PI),.8)*.083;
    h-=d*banking;
  }
  // The exit straight tapers back to ground level.
  return h;
}
function point(s){
  const distance=clamp(s,0,END);
  if(distance<=STRAIGHT)return {x:0,z:distance,angle:0};
  if(distance<STRAIGHT+TURN){
    const a=(distance-STRAIGHT)/R;
    return {x:R*(1-Math.cos(a)),z:STRAIGHT+R*Math.sin(a),angle:a};
  }
  return {x:R+(distance-STRAIGHT-TURN),z:STRAIGHT+R,angle:Math.PI/2};
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
  ctx.fillStyle='#72736c';
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
  ctx.fillStyle='#577f4b';ctx.fillRect(0,0,256,256);
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
  obj.receiveShadow=!mobile;
  obj.castShadow=false;
  scene.add(obj);
}
function createRoad(){
  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(800,800),
    new THREE.MeshStandardMaterial({map:createGrassTexture(),roughness:1})
  );
  ground.rotation.x=-Math.PI/2;ground.position.set(60,-.07,80);
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

  // Packed earth shoulder and verge on both sides follow the bank.
  for(const side of [-1,1]){
    createRibbon(side*(HALF+3.6),side*HALF,mats.shoulder);
  }
  // Yellow/black track edge blocks follow the exact sampled bend.
  for(let s=2,idx=0;s<END-1;s+=2.4,idx++){
    for(const side of [-1,1]){
      const p=position(s,side*(HALF-.33));
      const curb=makeBox(scene,idx%2?mats.curbBlack:mats.curbYellow,
        p.x,p.y+.095,p.z,.75,.18,2.35);
      curb.rotation.y=p.angle;
    }
  }
  // Faint broken center lane line and strong opening reference line.
  for(let s=7;s<END-4;s+=7.6){
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
  // Launch-ramp chevrons convey elevation and speed from overhead.
  for(let s=60;s<ramp.end;s+=4.4){
    const p=position(s,0);
    for(const side of [-1,1]){
      const d=side*2.4;
      const edge=position(s,d);
      const m=makeBox(scene,mats.curbYellow,edge.x,edge.y+.08,edge.z,3.4,.035,.32);
      m.rotation.y=edge.angle+side*.38;
    }
  }
  // A visible safety railing on the outside of the banked corner.
  const outer=-1;
  const lower=[],upper=[];
  for(let s=STRAIGHT+5;s<STRAIGHT+TURN-4;s+=2.5){
    const p=position(s,outer*(HALF+2.8));
    lower.push([p.x,p.y+.73,p.z]);
    upper.push([p.x,p.y+1.12,p.z]);
    if(Math.floor(s/5)%2===0){
      const post=makeBox(scene,mats.steel,p.x,p.y+.55,p.z,.12,1.1,.13);
      post.rotation.y=p.angle;
    }
  }
  tube(lower,.06,mats.rail);tube(upper,.063,mats.rail);
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
function environment(){
  // 3D hedges and layered trees sit beyond the safety verge.
  const shrubGeo=new THREE.IcosahedronGeometry(1,1);
  const tuftGeo=new THREE.ConeGeometry(.20,1.1,5);
  const leavesMaterials=[mats.darkGrass,mats.leaves,mats.leavesLight];
  const bushes=leavesMaterials.map(m=>new THREE.InstancedMesh(shrubGeo,m,145));
  const grass=new THREE.InstancedMesh(tuftGeo,mats.darkGrass,1100);
  const treeTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.28,.4,3.6,7),mats.trunk,34);
  const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),mats.leavesLight,34);
  const matrix=new THREE.Object3D(),bushIndices=[0,0,0];
  for(let i=0;i<350;i++){
    const s=rnd(1200+i)*END;
    const side=i%2?1:-1;
    const d=side*(HALF+6+rnd(2210+i)*39);
    const p=position(s,d);
    const type=i%3,idx=bushIndices[type]++;
    if(idx>=145)continue;
    const scale=1.2+rnd(3000+i)*1.9;
    matrix.position.set(p.x,.3+scale*.33,p.z);
    matrix.scale.set(scale,scale*(.47+rnd(i+322)*.15),scale*.9);
    matrix.rotation.set(0,rnd(i+333)*6.28,0);
    matrix.updateMatrix();bushes[type].setMatrixAt(idx,matrix.matrix);
  }
  for(let j=0;j<3;j++){
    bushes[j].count=bushIndices[j];
    bushes[j].instanceMatrix.needsUpdate=true;
    scene.add(bushes[j]);
  }
  for(let i=0;i<1100;i++){
    const s=rnd(4520+i)*END,side=i%2?1:-1;
    const d=side*(HALF+4+rnd(1520+i)*31);
    const p=position(s,d);
    const size=.38+rnd(7930+i)*.8;
    matrix.position.set(p.x,size*.35,p.z);
    matrix.scale.set(size,size*.8,size);
    matrix.rotation.set(0,rnd(3437+i)*6.28,0);
    matrix.updateMatrix();grass.setMatrixAt(i,matrix.matrix);
  }
  grass.instanceMatrix.needsUpdate=true;
  scene.add(grass);
  for(let i=0;i<34;i++){
    const s=15+rnd(i+888)*END;
    const side=i%2?1:-1;
    const d=side*(HALF+25+rnd(1131+i)*18);
    const p=position(s,d),scale=1.1+rnd(i+2234)*.75;
    matrix.position.set(p.x,1.8*scale,p.z);
    matrix.scale.set(scale,scale,scale);
    matrix.rotation.set(0,0,0);matrix.updateMatrix();
    treeTrunks.setMatrixAt(i,matrix.matrix);
    matrix.position.set(p.x,4.1*scale,p.z);
    matrix.scale.set(scale*2.55,scale*2.2,scale*2.45);
    matrix.updateMatrix();
    crowns.setMatrixAt(i,matrix.matrix);
  }
  treeTrunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;
  treeTrunks.castShadow=!mobile;crowns.castShadow=!mobile;
  scene.add(treeTrunks,crowns);

  // Photo-inspired gravel turnout near the start and a few maintenance props.
  for(let i=0;i<29;i++){
    const s=8+i*3.8;
    const p=position(s,-(HALF+3.9+rnd(i)*3.5));
    const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.26+rnd(i+1)*.35,0),
      i%2?mats.shoulder:mats.curbWhite);
    stone.position.set(p.x,.12,p.z);stone.rotation.set(.1,i*.4,.3);
    scene.add(stone);
  }
  // A recognizable infield scene, positioned away from the racing line.
  for(const [s,d] of [[121,HALF+29],[174,-HALF-24],[241,HALF+24]]){
    const p=position(s,d);
    const group=new THREE.Group();group.position.set(p.x,0,p.z);
    const bucket=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.15,4.2,14),mats.curbYellow);
    bucket.position.y=2.1;bucket.castShadow=!mobile;group.add(bucket);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(2.58,.14,8,24),mats.curbBlack);
    lip.rotation.x=Math.PI/2;lip.position.y=4.24;group.add(lip);
    scene.add(group);
  }
  makeGate(STARTLINE-12,'START');
  makeGate(FINAL_GATE,'SECTOR 02');
  makeBillboard(54,-HALF-11,'JUMP','KEEP IT LEVEL');
  makeBillboard(121,-HALF-15,'BERM','HOLD YOUR LINE');
  makeBillboard(226,HALF+13,'EXIT','SEND IT');
}
function makeCone(s,d){
  const p=position(s,d);
  const g=new THREE.Group();g.position.set(p.x,p.y,p.z);
  makeBox(g,mats.black,0,.05,0,.85,.09,.85);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(.37,1.2,10),mats.cone);
  cone.position.y=.62;cone.castShadow=!mobile;g.add(cone);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.205,.245,.18,10),mats.white);
  band.position.y=.55;g.add(band);
  scene.add(g);cones.push({s,d,x:p.x,z:p.z,mesh:g});
}
function createHazards(){
  for(const [s,d] of [[31,-6.7],[49,6.5],[107,6.6],[138,5.8],[167,7.2],[218,-6.8],[247,6.4]]){
    makeCone(s,d);
  }
}
function makeShadow(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');
  const gr=ctx.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,'rgba(0,0,0,.39)');
  gr.addColorStop(.65,'rgba(0,0,0,.14)');
  gr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(c);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.9,5.8),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;
  scene.add(mesh);return mesh;
}
function setup(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.4:1.8));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.35;
    renderer.shadowMap.enabled=!mobile;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setSize(innerWidth,innerHeight);
    ui.viewport.appendChild(renderer.domElement);
    scene=new THREE.Scene();
    scene.background=new THREE.Color('#a4c0b1');
    scene.fog=new THREE.Fog('#a4c0b1',110,310);
    camera=new THREE.OrthographicCamera(-70,70,45,-45,.2,700);
    scene.add(new THREE.HemisphereLight('#eaf4eb','#5b7450',2.3));
    sun=new THREE.DirectionalLight('#fff2d4',2.45);
    sun.position.set(-54,90,-12);
    sun.castShadow=!mobile;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-68;sun.shadow.camera.right=68;
    sun.shadow.camera.top=68;sun.shadow.camera.bottom=-68;
    sun.shadow.camera.near=1;sun.shadow.camera.far=220;
    sun.shadow.bias=-.0002;
    scene.add(sun);scene.add(sun.target);
    createRoad();
    environment();
    createHazards();
    player.mesh=makeRCTrophyTruck(THREE,'#f2c33e');
    player.mesh.name='Player / yellow smooth-shell truck';
    scene.add(player.mesh);
    shadow=makeShadow();
    const rivals=[
      {color:'#d95643',name:'RED',s:12,d:-3.35,cruise:13.0,seed:1.7},
      {color:'#65c654',name:'GREEN',s:12,d:3.35,cruise:13.9,seed:2.9},
      {color:'#4e83d9',name:'BLUE',s:7,d:3.35,cruise:13.5,seed:4.1}
    ];
    ai=rivals.map(data=>({...data,mesh:makeRCTrophyTruck(THREE,data.color),speed:0,done:null}));
    for(const rival of ai)scene.add(rival.mesh);
    reset(false);
    ui.loading.classList.add('hidden');
    requestAnimationFrame(frame);
  }catch(e){
    console.error('Quarter-track setup failed',e);
    ui.loading.textContent='3D track could not start. Please use a modern WebGL-capable browser.';
  }
}
function reset(start){
  const p=position(7,-3.35);
  Object.assign(player,{
    x:p.x,z:p.z,y:p.y+.025,s:7,d:-3.35,heading:0,speed:0,
    vy:0,grounded:true,airtime:0,pitch:0,roll:0,
    heat:0,overheated:false,collisionCooldown:0,launchConsumed:false
  });
  for(const a of ai){a.s=a.seed===4.1?7:12;a.speed=0;a.done=null;}
  for(const k in controls)controls[k]=false;
  document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('pressed'));
  ui.results.classList.add('hidden');
  ui.pauseOverlay.classList.add('hidden');
  ui.intro.classList.toggle('hidden',start);
  game.time=0;game.countdown=3.45;
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
  const target=(boosting?MAX_SPEED:15.4)*(offRoad?.58:1);
  const accel=throttle?8.0:5.3;
  if(throttle)player.speed=Math.min(target,player.speed+accel*dt+(boosting?5.5*dt:0));
  else player.speed=Math.max(0,player.speed-6*dt);
  if(player.speed>target)player.speed=Math.max(target,player.speed-(offRoad?10:3.5)*dt);
  if(controls.brake)player.speed=Math.max(0,player.speed-20*dt);
  if(!player.grounded)player.speed=Math.max(3,player.speed-.5*dt);
  // Free-steering world-space motion. A modest heading assist makes the
  // banked bend approachable on touch without locking the car to the spline.
  const align=modAngle(point(player.s).angle-player.heading);
  const assist=offRoad?.32:1.85;
  player.heading+=align*assist*dt;
  const steerPower=(.55+Math.min(1,player.speed/12)*.8)*(player.grounded?1:.42);
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
    player.heading=safe.angle;player.speed=6;
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
    if(lastS<=ramp.end&&player.s>ramp.end){
      player.grounded=false;
      player.vy=Math.max(6.0,player.speed*.44);
      player.airtime=.015;
      player.pitch=-.2;
      toast('↗ BIG AIR!');
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
        player.speed=Math.min(MAX_SPEED,player.speed+1.25);
        toast('CLEAN LANDING · +SPEED!');
        sound(850,.12,'triangle');
      }
      spark('#e8e9b0',10);
      player.airtime=0;
    }
  }
  player.roll=THREE.MathUtils.damp(player.roll,-steer*.08+(player.s>STRAIGHT&&player.s<STRAIGHT+TURN?.07:0),5,dt);
  if(player.s>=END-3&&Math.abs(player.d)<HALF+4)finishSector();
}
function tickAI(dt){
  for(const rival of ai){
    if(rival.done!==null)continue;
    const speed=rival.cruise+Math.sin(game.time*.42+rival.seed)*1.0;
    rival.speed=THREE.MathUtils.damp(rival.speed,speed,1.8,dt);
    rival.s=Math.min(END,rival.s+rival.speed*dt);
    if(rival.s>=END)rival.done=game.time;
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
    shadow.position.set(player.x,under.y+.035,player.z);
    shadow.rotation.z=-player.heading;
    const alt=Math.max(0,player.y-under.y);
    const factor=1+alt*.12;
    shadow.scale.set(factor,factor,factor);
    shadow.material.opacity=clamp(.33-alt*.026,.08,.33);
  }
  for(const rival of ai){
    const lane=rival.d+Math.sin(game.time*.87+rival.seed)*.25;
    const p=position(rival.s,lane);
    let air=0;
    if(rival.s>ramp.end&&rival.s<ramp.end+15){
      air=Math.sin((rival.s-ramp.end)/15*Math.PI)*1.6;
    }
    rival.mesh.position.set(p.x,p.y+.035+air,p.z);
    rival.mesh.rotation.order='YXZ';
    rival.mesh.rotation.y=p.angle+Math.sin(game.time*.7+rival.seed)*.025;
    rival.mesh.rotation.x=air>0?-.12:0;
    rival.mesh.rotation.z=rival.s>STRAIGHT&&rival.s<STRAIGHT+TURN?.07:0;
    for(const wheel of rival.mesh.userData.wheels)wheel.rotation.x+=dt*rival.speed*2.25;
  }
}
const focus=new THREE.Vector3(),target=new THREE.Vector3();
// Camera tuned for a close, elevated rear-three-quarter RC arcade view.
// Orthographic projection preserves the isometric model proportions while
// a rotating track-relative follow offset reveals the truck's back and side.
const cameraConfig={
  side:18.5,
  behind:26,
  elevation:39,
  lookAhead:9.5,
  lateralFollow:.78,
  followDamping:4.3,
  focusDamping:5.1
};
function viewport(){
  if(!camera||!renderer)return;
  const aspect=innerWidth/Math.max(1,innerHeight);
  // Closer crop than the old aerial view, but still fits the whole road
  // on portrait phones. Keep the explicit overview as a separate option.
  const height=game.camera==='overview'?
    (aspect<.65?310:aspect<1?270:210):
    (aspect<.65?61:aspect<1?54:47);
  camera.top=height*.5;camera.bottom=-height*.5;
  camera.left=-height*aspect*.5;camera.right=height*aspect*.5;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
function updateCamera(dt){
  let desire,look;
  if(game.camera==='overview'||game.mode==='intro'){
    look=new THREE.Vector3(61,1,95);
    desire=new THREE.Vector3(129,176,-12);
  }else{
    // Favor the track direction so tight steering doesn't whip the view.
    // A little vehicle heading influences the rear corner perspective.
    const road=point(player.s);
    const driverBias=clamp(modAngle(player.heading-road.angle),-.48,.48)*.16;
    const tangent=road.angle+driverBias;
    const rightX=Math.cos(tangent),rightZ=-Math.sin(tangent);
    const forwardX=Math.sin(tangent),forwardZ=Math.cos(tangent);
    const lead=Math.min(END,player.s+cameraConfig.lookAhead+player.speed*.10);
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
  sun.position.set(player.x-54,88,player.z-30);
  sun.target.position.set(player.x,0,player.z);
}
function drawMap(){
  const canvas=ui.map,ctx=canvas.getContext('2d');
  if(!ctx)return;
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#193d3a';ctx.fillRect(0,0,w,h);
  const pixel=s=>{const p=point(s);return {x:12+p.x*1.48,y:120-p.z*.69};};
  ctx.beginPath();
  for(let i=0;i<=160;i++){
    const q=pixel(END*i/160);
    if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#b3aaa0';ctx.lineWidth=13;ctx.stroke();
  ctx.strokeStyle='#727675';ctx.lineWidth=10;ctx.stroke();
  ctx.strokeStyle='#e3cf7c';ctx.lineWidth=1.0;ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
  const dot=(s,d,color,r)=>{
    const q=pixel(s),p=point(s);
    const px=q.x+Math.cos(p.angle)*d*.75;
    const py=q.y+Math.sin(p.angle)*d*.4;
    ctx.fillStyle='#142d33';ctx.beginPath();ctx.arc(px,py,r+1.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  };
  for(const rival of ai)dot(rival.s,rival.d,rival.color,3.6);
  dot(player.s,player.d,'#e5fd7c',4.5);
  ctx.fillStyle='#e5fd7c';
  ctx.font='bold 10px Arial';ctx.fillText('S',7,116);
  ctx.fillText('Q1',232,21);
}
function updateHUD(){
  ui.speed.textContent=Math.round(player.speed*5.1);
  ui.time.textContent=timeString(game.time);
  const position=1+ai.filter(a=>a.s>player.s).length;
  ui.place.textContent=position+' / 4';
  ui.progress.style.width=(clamp(player.s/END,0,1)*100).toFixed(1)+'%';
  ui.heat.style.width=(player.heat*100).toFixed(1)+'%';
  ui.heatLabel.textContent=player.overheated?'OVERHEATED':player.heat>.75?'HOT':controls.boost?'BOOSTING':'COOL';
  ui.heatLabel.style.color=player.overheated?'#ff7c62':'#e5fd7c';
  drawMap();
}
function finishSector(){
  if(game.mode!=='racing')return;
  const position=1+ai.filter(a=>a.s>player.s).length;
  game.mode='finished';
  ui.results.classList.remove('hidden');
  ui.resultTime.textContent=timeString(game.time);
  ui.resultPlace.textContent=position+' / 4';
  ui.marker.textContent='';
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
  const control=maps[e.code];
  if(control){controls[control]=isDown;e.preventDefault();}
}
function toggleView(){
  game.camera=game.camera==='follow'?'overview':'follow';
  ui.camera.textContent=game.camera==='follow'?'OVERVIEW':'REAR ISO';
  ui.camera.setAttribute('aria-label',game.camera==='follow'?'Switch to entire sector overview':'Return to close rear-quarter isometric camera');
  ui.camera.classList.toggle('active',game.camera==='overview');
  viewport();
  toast(game.camera==='overview'?'COMPLETE QUARTER OVERVIEW':'CLOSE REAR-QUARTER ISO');
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
ui.exit.addEventListener('click',()=>reset(false));
window.addEventListener('resize',viewport);
window.addEventListener('contextmenu',e=>e.preventDefault());
setup();
viewport();
