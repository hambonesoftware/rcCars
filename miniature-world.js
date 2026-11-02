/**
 * Micro Mayhem — handcrafted HO-scale model railway scenery kit.
 * All measurements use the race world's visual "model units", not physical
 * 1:87 dimensions. Cars are deliberately exaggerated to remain readable.
 *
 * Instanced architecture, lamp posts, figures, rail sleepers, road furniture
 * and train cars avoid hundreds of WebGL draw calls on mobile devices.
 * No network textures, GLTF downloads or postprocess render passes.
 */
export const MODEL_TOWN_PLANS=Object.freeze({
  backyard:{
    districts:[
      {at:.095,side:1,type:'residential',title:'ELM STREET'},
      {at:.305,side:-1,type:'mainstreet',title:'HAMBONE VILLAGE'},
      {at:.545,side:1,type:'station',title:'OAK JUNCTION'},
      {at:.803,side:-1,type:'park',title:'MILL POND'}
    ],
    railway:[{start:.475,end:.635,side:1},{start:.17,end:.25,side:-1}],
    palette:['wallIvory','wallSage','wallRose','wallBlue']
  },
  creek:{
    districts:[
      {at:.105,side:1,type:'station',title:'CREEKSIDE DEPOT'},
      {at:.315,side:-1,type:'residential',title:'MAPLE FALLS'},
      {at:.56,side:1,type:'park',title:'WILLOW LANDING'},
      {at:.805,side:-1,type:'mainstreet',title:'RIVER MARKET'}
    ],
    railway:[{start:.04,end:.225,side:1},{start:.69,end:.85,side:-1}],
    palette:['wallSage','wallIvory','wallBlue','wallRose']
  },
  garage:{
    districts:[
      {at:.115,side:1,type:'industrial',title:'REPAIR ROW'},
      {at:.340,side:-1,type:'mainstreet',title:'BRICKYARD'},
      {at:.575,side:1,type:'station',title:'SWITCHING YARD'},
      {at:.822,side:-1,type:'industrial',title:'FREIGHT WORKS'}
    ],
    railway:[{start:.45,end:.675,side:1},{start:.755,end:.88,side:-1}],
    palette:['wallBrick','wallOchre','wallIvory','wallSage']
  },
  quarry:{
    districts:[
      {at:.105,side:1,type:'residential',title:'MINERS COTTAGES'},
      {at:.345,side:-1,type:'industrial',title:'STONE WORKS'},
      {at:.595,side:1,type:'station',title:'QUARRY BRANCH'},
      {at:.830,side:-1,type:'mainstreet',title:'HIGH RIDGE'}
    ],
    railway:[{start:.49,end:.705,side:1},{start:.24,end:.36,side:-1}],
    palette:['wallOchre','wallBrick','wallIvory','wallRose']
  }
});
const STANDARD_PALETTE={
  wallIvory:'#e5d8b8',wallSage:'#98b5a0',wallRose:'#c78978',
  wallBlue:'#9cbdce',wallBrick:'#ad7060',wallOchre:'#c7ad7b',
  trimCream:'#f2e9d8',trimDark:'#494e53',foundation:'#807b72',
  roofSlate:'#526775',roofTerracotta:'#a85e52',roofOlive:'#677365',
  roofCopper:'#548984',roofBlack:'#4c5152',glass:'#73979f',
  windows:'#ebf0d9',door:'#594f4a',porch:'#bba989',sidewalk:'#b8b2a2',
  fence:'#e0d8bb',signal:'#db3e3d',signalAmber:'#e4b85e',
  flag:'#d4a65b',rail:'#6e7070',ballast:'#887e74',tie:'#5e4c43',
  roadPaint:'#ebdfb4',railPlatform:'#b5ad96',black:'#303334',
  humanHead:'#dfaf8c',shirtRed:'#ce7557',shirtBlue:'#6d9bae',
  shirtGreen:'#94a26e',shirtYellow:'#e5be69',pants:'#545a5f',
  grassHill:'#73906c',ochreHill:'#aa8966',windowGlow:'#efdca4',
  trainRed:'#b55e4d',trainCream:'#e5cc8b',trainGreen:'#53776c',
  wheels:'#343637',streetlight:'#667478',wallLamp:'#dccb94',
  townSign:'#284b55',woodRim:'#855a3a',tableEdge:'#b98a5a',
  waterTower:'#a2aeb2',doorBlue:'#557388'
};

export function createMiniatureWorld({
  THREE,scene,course,position,length,halfWidth,mobile,bounds
}){
  const plan=MODEL_TOWN_PLANS[course];
  if(!plan)throw new Error('Unknown miniature town course '+course);
  const base=new THREE.Object3D();
  const axes={
    y:new THREE.Vector3(0,1,0),z:new THREE.Vector3(0,0,1)
  };
  const box=new THREE.BoxGeometry(1,1,1);
  const cylinder=new THREE.CylinderGeometry(.5,.5,1,9);
  const sphere=new THREE.SphereGeometry(.5,9,7);
  const cone=new THREE.ConeGeometry(.5,1,9);
  const mats={};
  for(const [name,color] of Object.entries(STANDARD_PALETTE)){
    mats[name]=new THREE.MeshStandardMaterial({
      color,roughness:name==='glass'?.35:name==='rail'?.38:.87,
      metalness:name==='rail'?.6:0
    });
  }
  // One material & one draw call for all boxes of the same finish.
  const batches=new Map();
  const phase=course==='quarry'?41:course==='garage'?17:course==='creek'?23:5;
  const rand=seed=>{
    const x=Math.sin((seed+phase)*146.137+24.12)*16384.312;
    return x-Math.floor(x);
  };
  const frame=(s,d)=>{
    const p=position(Math.max(1,Math.min(length-1,s)),d);
    return {x:p.x,z:p.z,angle:p.angle};
  };
  const offset=(f,x,y,z)=>({
    x:f.x+Math.cos(f.angle)*x+Math.sin(f.angle)*z,
    y,
    z:f.z-Math.sin(f.angle)*x+Math.cos(f.angle)*z
  });
  const tempQuat=new THREE.Quaternion();
  const swing=new THREE.Quaternion();
  const lean=new THREE.Quaternion();
  const matrix=new THREE.Matrix4();
  const scale=new THREE.Vector3(),translate=new THREE.Vector3();
  const add=(material,f,location,dimensions,options={})=>{
    const kind=options.shape||'box';
    const key=material+'|'+kind;
    if(!batches.has(key))batches.set(key,[]);
    const p=offset(f,location[0],location[1],location[2]);
    translate.set(p.x,p.y,p.z);
    tempQuat.setFromAxisAngle(axes.y,f.angle+(options.yaw||0));
    if(options.roll){
      lean.setFromAxisAngle(axes.z,options.roll);
      tempQuat.multiply(lean);
    }
    if(options.pitch){
      swing.setFromAxisAngle(new THREE.Vector3(1,0,0),options.pitch);
      tempQuat.multiply(swing);
    }
    scale.set(...dimensions);
    matrix.compose(translate,tempQuat,scale);
    batches.get(key).push(matrix.clone());
  };
  const stats={course,buildings:0,people:0,railTies:0,trees:0,landmarks:0,
    districts:plan.districts.map(d=>d.title),signs:0,railSections:plan.railway.length};
  // Plot-style margin instead of letting buildings clip into a second
  // part of the winding circuit. Projection uses actual road points.
  const roadSamples=[];
  for(let s=0;s<length;s+=5){
    const p=position(s,0);roadSamples.push([p.x,p.z]);
  }
  const clearance=(x,z)=>{
    let best=Infinity;
    for(let i=0;i<roadSamples.length;i++){
      const dx=x-roadSamples[i][0],dz=z-roadSamples[i][1];
      const v=dx*dx+dz*dz;
      if(v<best)best=v;
    }
    return Math.sqrt(best);
  };
  function clearFrame(s,side,d,minimum=17){
    let last=frame(s,side*d);
    for(let attempt=0;attempt<5;attempt++){
      const p=frame(s,side*(d+attempt*7));
      last=p;
      if(clearance(p.x,p.z)>minimum)return p;
    }
    return last;
  }
  function building(f,side,style,index,wallKey){
    const isWorkshop=style==='industrial';
    const isShop=style==='mainstreet';
    const isDepot=style==='station';
    const isPark=style==='park';
    const width=(isShop?7.6:isWorkshop?9.0:6.3)+rand(index)*2.1;
    const depth=(isWorkshop?10.0:7.7)+rand(index+21)*2.5;
    const height=(isShop?8.5:isWorkshop?7.5:isDepot?6.6:5.8)+rand(index+18)*2.0;
    const roof=['roofTerracotta','roofSlate','roofOlive','roofCopper'][index%4];
    const face=side>0?-1:1;
    add('foundation',f,[0,.20,0],[width+1,.40,depth+.8]);
    add(wallKey,f,[0,height*.5+.4,0],[width,height,depth]);
    add('trimCream',f,[0,height+.4,0],[width+.3,.24,depth+.3]);
    if(isShop||isWorkshop){
      add(roof,f,[0,height+.76,0],[width+1,.44,depth+1]);
      if(isShop){
        add('porch',f,[face*(width*.5+.52),3.0,0],[1.25,.16,depth+.2]);
        add('roofTerracotta',f,[face*(width*.5+.65),3.28,0],[1.0,.12,depth+.4]);
      }
      if(isWorkshop){
        for(let i=0;i<2;i++){
          add('trimDark',f,[face*(width*.5+.07),2.6,(i-.5)*depth*.54],
            [.16,3.1,2.8]);
        }
      }
    }else{
      const rise=1.75,overhang=.36;
      const pitch=Math.atan2(rise,width/2);
      const panelWidth=(width/2+overhang)/Math.cos(pitch);
      for(const sideRoof of [-1,1]){
        add(roof,f,[sideRoof*width*.25,height+.5+rise*.5,0],
          [panelWidth,.18,depth+.8],
          {roll:-sideRoof*pitch});
      }
      add('trimDark',f,[0,height+.53+rise,0],[.12,.16,depth+.9]);
      if(index%3===0){
        add('wallBrick',f,[width*.20,height+1.2,depth*.13],
          [.75,2,.75]);
      }
    }
    // Model-scale lintels, inset window glass and tiny sills on the
    // street-facing facade. The street is on the centerline side.
    const count=isWorkshop?2:3;
    for(let row=0;row<(isShop?2:1);row++){
      const y=isWorkshop?4.9:row===0?4.1:7;
      for(let i=0;i<count;i++){
        const zz=(i-(count-1)/2)*depth/(count+.5);
        if(row===0&&i===Math.floor(count/2))continue;
        add('trimCream',f,[face*(width*.5+.07),y,zz],
          [.18,1.54,1.45]);
        add('glass',f,[face*(width*.5+.17),y,zz],
          [.20,1.19,1.13]);
        add('trimDark',f,[face*(width*.5+.29),y,zz],
          [.08,.08,1.22]);
      }
    }
    add(index%3===0?'doorBlue':'door',f,
      [face*(width*.5+.09),1.52,0],[.19,2.24,1.24]);
    add('windowGlow',f,
      [face*(width*.5+.22),2.35,-.31],[.04,.24,.24]);
    add('trimCream',f,
      [face*(width*.5+.17),2.67,0],[.24,.13,1.52]);
    // Back walls carry subtle brick/stucco framing, not blank boxes.
    for(const zz of [-depth*.38,depth*.38]){
      add('trimCream',f,[-face*(width*.5+.04),height*.43,zz],
        [.10,1.22,1.22]);
      add('glass',f,[-face*(width*.5+.12),height*.43,zz],
        [.11,.98,.95]);
    }
    if(isDepot){
      add('railPlatform',f,[face*(width*.5+2),.36,0],[3.8,.3,depth+2]);
      add('fence',f,[face*(width*.5+1.5),1.2,-depth*.53],
        [.15,1.7,.15]);
    }
    if(isPark){
      add('wallIvory',f,[0,height+1.35,0],
        [.27,1.6,.27]);
    }
    if(style==='residential'){
      for(let i=-3;i<=3;i++){
        add('fence',f,[face*(width*.5+2.4),.76,i*1.35],
          [.14,1.45,.14]);
      }
      add('fence',f,[face*(width*.5+2.4),1.43,0],
        [.15,.15,8.5]);
    }
    stats.buildings++;
    return {width,depth,height};
  }
  function sign(f,caption,side){
    const canvas=document.createElement('canvas');
    canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=course==='quarry'?'#724e36':'#234a54';
    ctx.fillRect(0,0,512,128);
    ctx.strokeStyle='#d5c6a2';ctx.lineWidth=6;
    ctx.strokeRect(6,6,500,116);
    ctx.fillStyle='#f5eed8';ctx.textAlign='center';
    ctx.font='bold 47px Arial,sans-serif';
    ctx.fillText(caption,256,77,485);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    const panel=new THREE.Mesh(
      new THREE.PlaneGeometry(8.7,2.15),
      new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide})
    );
    const p=offset(f,side>0?-.24:.24,5,0);
    panel.position.set(p.x,p.y,p.z);
    // Face into the racing corridor rather than parallel to the road.
    panel.rotation.y=f.angle+(side>0?-Math.PI*.5:Math.PI*.5);
    scene.add(panel);
    add('townSign',f,[0,4,0],[9.3,2.6,.32],{
      yaw:Math.PI*.5
    });
    for(const x of [-3.85,3.85])
      add('fence',f,[x,2.2,0],[.21,4.4,.23]);
    stats.signs++;
  }
  function person(f,side,index){
    const clothes=['shirtRed','shirtBlue','shirtGreen','shirtYellow'];
    const x=rand(index+153)*4-2;
    const z=rand(index+177)*5-2.5;
    const y=rand(index+441)*.20;
    add('pants',f,[x,.55+y,z],[.40,1.0,.42]);
    add(clothes[index%4],f,[x,1.48+y,z],[.74,.92,.47]);
    add('humanHead',f,[x,2.22+y,z],[.68,.69,.68],{shape:'sphere'});
    add('humanHead',f,[x-.48,1.5+y,z],[.22,.8,.24],{roll:-.12});
    add('humanHead',f,[x+.48,1.5+y,z],[.22,.8,.24],{roll:.12});
    add('black',f,[x,2.56+y,z],[.72,.15,.7]);
    stats.people++;
  }
  function lamp(f){
    add('streetlight',f,[0,3.4,0],[.20,6.8,.20]);
    add('streetlight',f,[.65,6.65,0],[1.45,.17,.17]);
    add('wallLamp',f,[1.28,6.40,0],[.65,.30,.7]);
    add('trimDark',f,[0,.05,0],[.9,.12,.9]);
  }
  function mailbox(f){
    add('streetlight',f,[0,.75,0],[.10,1.5,.1]);
    add('trainRed',f,[0,1.47,0],[.74,.51,.60]);
    add('trimCream',f,[0,1.75,0],[.8,.10,.68]);
  }
  function parkedCar(f,index){
    const body=index%3===0?'trainRed':index%3===1?'doorBlue':'trainGreen';
    add('wheels',f,[-.83,.51,-1.0],[.65,.72,.34],{shape:'cylinder',roll:Math.PI*.5});
    add('wheels',f,[.83,.51,-1.0],[.65,.72,.34],{shape:'cylinder',roll:Math.PI*.5});
    add('wheels',f,[-.83,.51,1.0],[.65,.72,.34],{shape:'cylinder',roll:Math.PI*.5});
    add('wheels',f,[.83,.51,1.0],[.65,.72,.34],{shape:'cylinder',roll:Math.PI*.5});
    add(body,f,[0,.90,0],[2.1,.77,3.7]);
    add('glass',f,[0,1.48,-.1],[1.63,.52,1.85]);
    add('windowGlow',f,[0,1,1.90],[1.72,.17,.13]);
  }
  // Districts are concentrated into strongly readable model villages,
  // not evenly scattered generic buildings around the whole track.
  for(let district=0;district<plan.districts.length;district++){
    const area=plan.districts[district];
    const count=mobile?6:9;
    const center=area.at*length;
    const step=course==='garage'?12.4:course==='quarry'?17.8:15;
    const side=area.side;
    const centerS=center;
    const allowedStart=Math.max(25,centerS-count*step*.53);
    for(let i=0;i<count;i++){
      const s=Math.min(length-28,allowedStart+i*step);
      const isSecondaryRow=i%5===4;
      const thisSide=isSecondaryRow?-side:side;
      const distance=halfWidth+(area.type==='industrial'?20:17)+
        (i%3)*2.8+(isSecondaryRow?8:0);
      const f=clearFrame(s,thisSide,distance,halfWidth+10.5);
      const wall=plan.palette[(i+district)%plan.palette.length];
      building(f,thisSide,area.type,i+district*19,wall);
      if(i%2===0){
        // Figures and furniture stand between the houses and the road,
        // separated from the truck route by a visual sidewalk.
        const sidewalk=clearFrame(s+2,thisSide,halfWidth+12.7,halfWidth+1.6);
        lamp(sidewalk);
        person(clearFrame(s+3,thisSide,halfWidth+14.2,halfWidth+2.1),
          thisSide,i+district*21);
      }
      if(i%3===1){
        const d=clearFrame(s-2,thisSide,halfWidth+13.5,halfWidth+2);
        mailbox(d);
      }
      if(i%4===2){
        const d=clearFrame(s+3,thisSide,halfWidth+15.1,halfWidth+3);
        parkedCar(d,i+district);
      }
    }
    // Back-street shops and bungalows give each town a real two-deep
    // street plan instead of a single thin ribbon of facade boxes.
    const behindRail=plan.railway.some(rail=>rail.side===side&&
      Math.abs((rail.start+rail.end)*.5-area.at)<.12);
    if(!behindRail){
      const rearCount=mobile?3:5;
      for(let row=0;row<rearCount;row++){
        const s=Math.max(28,Math.min(length-30,
          center+(row-(rearCount-1)*.5)*step*1.3));
        const farFrame=clearFrame(s,side,halfWidth+43,halfWidth+16);
        const style=area.type==='industrial'?'industrial':
          area.type==='mainstreet'?'mainstreet':'residential';
        building(farFrame,side,style,250+row+district*10,
          plan.palette[(row+district+2)%plan.palette.length]);
      }
      for(let i=-7;i<=7;i++){
        const ss=Math.max(24,Math.min(length-25,center+i*step*.43));
        const lane=clearFrame(ss,side,halfWidth+32,halfWidth+15);
        add('sidewalk',lane,[0,.035,0],[5.5,.09,step*.46+.15]);
        if(i%3===0){
          add('roadPaint',lane,[0,.093,0],[.13,.025,1.65]);
        }
      }
    }
    sign(clearFrame(center+step*.55,side,halfWidth+15,halfWidth+3),
      area.title,side);
  }

  // Bespoke signature features keep each HO display memorable, as on
  // elaborate real model railway layouts rather than generic asset scatter.
  if(course==='backyard'){
    const a=plan.districts[3];
    const f=clearFrame(length*(a.at+.02),a.side,halfWidth+46,halfWidth+24);
    add('railPlatform',f,[0,.20,0],[10.7,.38,10.7]);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      add('trimCream',f,[Math.cos(angle)*4.3,2.9,Math.sin(angle)*4.3],
        [.28,5.2,.28]);
    }
    add('roofTerracotta',f,[0,6.1,0],[12,3.8,12],{shape:'cone'});
    add('roofCopper',f,[0,8.12,0],[2,.65,2],{shape:'cone'});
    for(const xx of [-7.4,7.4]){
      add('fence',f,[xx,.50,0],[.18,1,8.5]);
      add('porch',f,[xx,.85,0],[1.35,.17,4.5]);
    }
    stats.landmarks++;
  }else if(course==='creek'){
    const a=plan.districts[2];
    const f=clearFrame(length*(a.at+.045),a.side,halfWidth+44,halfWidth+21);
    // Weathered waterwheel beside Willow Landing's tiny mill.
    add('wallOchre',f,[4,3.25,1],[8,6.5,6]);
    add('roofSlate',f,[4,7.0,1],[9,.36,7]);
    add('woodRim',f,[-2.5,4.1,0],[.55,7,7.3],
      {shape:'cylinder',roll:Math.PI*.5});
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6;
      add('porch',f,[-2.5+Math.cos(angle)*3.8,
          4.1+Math.sin(angle)*3.8,0],[.43,.30,1.3],{roll:angle});
    }
    add('rail',f,[-2.5,4.1,0],[.38,.38,5.8],{shape:'cylinder'});
    stats.landmarks++;
  }else if(course==='garage'){
    const a=plan.districts[3];
    const f=clearFrame(length*(a.at+.03),a.side,halfWidth+64,halfWidth+34);
    for(const x of [-3.4,3.4])for(const z of [-3.4,3.4]){
      add('streetlight',f,[x,6.0,z],[.40,12,.40]);
    }
    add('waterTower',f,[0,13.2,0],[10.5,5.5,10.5],{shape:'cylinder'});
    add('roofSlate',f,[0,16.15,0],[11.3,2.0,11.3],{shape:'cone'});
    add('trainRed',f,[0,11.6,5.1],[1.2,1.0,.17]);
    add('streetlight',f,[4.3,7.2,-.2],[.17,14.4,.17]);
    stats.landmarks++;
  }else if(course==='quarry'){
    const a=plan.districts[1];
    const f=clearFrame(length*(a.at+.06),a.side,halfWidth+67,halfWidth+35);
    // Inclined ore tipple and two model grain/ore storage silos.
    add('wallBrick',f,[0,5,0],[10,10,9]);
    add('roofBlack',f,[0,10.5,0],[11,1.4,10]);
    add('trainCream',f,[-6,6.0,3],[3.8,12,3.8],{shape:'cylinder'});
    add('trainCream',f,[-12,6.0,3],[3.8,12,3.8],{shape:'cylinder'});
    add('roofTerracotta',f,[-6,12.7,3],[4.7,2,4.7],{shape:'cone'});
    add('roofTerracotta',f,[-12,12.7,3],[4.7,2,4.7],{shape:'cone'});
    add('woodRim',f,[6,6.2,0],[1.1,.85,23],{pitch:-.36});
    for(let i=0;i<6;i++){
      add('woodRim',f,[6+(i-2)*.65,3.4,i*3-8],[.3,6.8,.3]);
    }
    stats.landmarks++;
  }

  // Rails are actual modeled steel running on closely spaced HO-style ties
  // and a ballast bed. They parallel the road in scenic districts and do
  // not overlap the drivable kart surface or affect collision physics.
  for(let line=0;line<plan.railway.length;line++){
    const rail=plan.railway[line];
    const first=rail.start*length,last=rail.end*length;
    const railDistance=halfWidth+(course==='garage'?38:43);
    const n=Math.ceil((last-first)/1.75);
    for(let i=0;i<=n;i++){
      const s=first+(last-first)*i/n;
      const f=frame(s,rail.side*railDistance);
      add('ballast',f,[0,.02,0],[5.8,.14,(last-first)/n+.2]);
      add('tie',f,[0,.15,0],[5.1,.17,.55]);
      for(const side of [-1,1]){
        add('rail',f,[side*1.52,.29,0],[.18,.14,(last-first)/n+.16]);
      }
      stats.railTies++;
    }
    // Miniature railway crossing signal/gate, visible well off the road.
    const f=frame(first+(last-first)*.17,rail.side*(railDistance-8));
    add('streetlight',f,[0,3.7,0],[.19,7.4,.19]);
    for(const yy of [5.6,6.4]){
      add('fence',f,[0,yy,0],[2.6,.16,.17],{roll:yy===5.6?.70:-.70});
    }
    add('signal',f,[-.75,4.5,0],[.50,.5,.38],{shape:'sphere'});
    add('signal',f,[.75,4.5,0],[.50,.5,.38],{shape:'sphere'});
  }

  // Three-car miniature train on the first siding. Stationary in this
  // pass so no disappearing/jumping cars at siding endpoints.
  const first=plan.railway[0];
  const trainPosition=(first.start+(first.end-first.start)*.62)*length;
  for(let i=0;i<3;i++){
    const f=frame(trainPosition+i*6.9,first.side*
      (halfWidth+(course==='garage'?38:43)));
    add('wheels',f,[-1.2,.72,-1.62],[1.0,.95,.45],
      {shape:'cylinder',roll:Math.PI*.5});
    add('wheels',f,[1.2,.72,-1.62],[1.0,.95,.45],
      {shape:'cylinder',roll:Math.PI*.5});
    add('wheels',f,[-1.2,.72,1.62],[1.0,.95,.45],
      {shape:'cylinder',roll:Math.PI*.5});
    add('wheels',f,[1.2,.72,1.62],[1.0,.95,.45],
      {shape:'cylinder',roll:Math.PI*.5});
    add(i===0?'trainRed':'trainGreen',f,[0,1.82,0],
      [3.5,2.3,5.9]);
    add('trainCream',f,[0,2.64,0],[3.56,.35,5.7]);
    add('roofSlate',f,[0,3.36,0],[3.78,.29,6.12]);
    if(i===0){
      add('black',f,[0,3.9,-1.7],[.75,1.3,.75],{shape:'cylinder'});
    }
    for(const zz of [-1.7,0,1.7]){
      add('glass',f,[1.79,2.26,zz],[.14,.87,.78]);
      add('glass',f,[-1.79,2.26,zz],[.14,.87,.78]);
    }
  }

  // A slow local passenger train makes the tabletop feel alive rather than
  // like an abandoned diorama. One locomotive and two coaches shuttle
  // beside the station. Their path stays fully outside the racing road.
  const shuttle=[];
  const shuttleCount=mobile?2:3;
  const axleGeometry=new THREE.CylinderGeometry(.42,.42,.36,10);
  const vehicleGeometry=new THREE.BoxGeometry(3.5,2.4,5.9);
  const roofGeometry=new THREE.BoxGeometry(3.8,.34,6.15);
  const windowGeometry=new THREE.BoxGeometry(.11,.80,.86);
  for(let i=0;i<shuttleCount;i++){
    const car=new THREE.Group();
    const chassis=new THREE.Mesh(vehicleGeometry,
      i===0?mats.trainRed:mats.trainCream);
    chassis.position.y=1.85;
    car.add(chassis);
    const roof=new THREE.Mesh(roofGeometry,mats.roofSlate);
    roof.position.y=3.18;car.add(roof);
    for(const xx of [-1.65,1.65]){
      for(const zz of [-1.70,0,1.70]){
        const window=new THREE.Mesh(windowGeometry,mats.glass);
        window.position.set(xx,2.27,zz);car.add(window);
      }
      for(const zz of [-1.70,1.70]){
        const wheel=new THREE.Mesh(axleGeometry,mats.wheels);
        wheel.position.set(xx,0.71,zz);
        wheel.rotation.z=Math.PI*.5;
        car.add(wheel);
      }
    }
    if(i===0){
      const nose=new THREE.Mesh(
        new THREE.BoxGeometry(3.2,1.1,1.2),mats.trainRed);
      nose.position.set(0,1.35,-3.15);car.add(nose);
      const headlamp=new THREE.Mesh(
        new THREE.SphereGeometry(.32,9,7),mats.windowGlow);
      headlamp.position.set(0,1.7,-3.76);car.add(headlamp);
      const chimney=new THREE.Mesh(
        new THREE.CylinderGeometry(.36,.48,1.0,10),mats.black);
      chimney.position.set(0,3.7,-1.55);car.add(chimney);
    }
    car.castShadow=false;
    scene.add(car);
    shuttle.push(car);
  }
  const sidetrack=plan.railway[0];
  const sidingStart=sidetrack.start*length;
  const sidingEnd=sidetrack.end*length;
  const excursion=Math.max(20,sidingEnd-sidingStart-55);
  let locomotiveClock=0;
  const moveTrain=dt=>{
    locomotiveClock+=Math.max(0,Math.min(dt,.05));
    const progress=(locomotiveClock*3.7)%(excursion*2);
    const heading=progress<=excursion?1:-1;
    const lead=sidingStart+27+
      (progress<=excursion?progress:excursion*2-progress);
    for(let i=0;i<shuttle.length;i++){
      const ss=Math.max(sidingStart+2,Math.min(sidingEnd-2,
        lead-heading*i*7.6));
      const p=position(ss,sidetrack.side*
        (halfWidth+(course==='garage'?38:43)));
      shuttle[i].position.set(p.x,.30,p.z);
      shuttle[i].rotation.y=p.angle+(heading<0?Math.PI:0);
    }
  };
  moveTrain(0);

  // Miniature backdrop hills use simple repeated geometry.
  const hills=course==='garage'?8:mobile?17:29;
  for(let i=0;i<hills;i++){
    const s=(i+.37)*length/hills;
    const side=i%2?1:-1;
    const f=frame(s,side*(halfWidth+53+rand(i+313)*27));
    const radius=8+rand(i+919)*9;
    add(course==='quarry'?'ochreHill':'grassHill',f,
      [0,1.8,0],[radius,6.2+rand(i+382)*6.8,radius*.8],
      {shape:'sphere',yaw:rand(i+834)*Math.PI});
    stats.trees++;
  }

  // The plywood edge frames the scenery like a real exhibition table.
  // It is BELOW road level; racing remains unchanged.
  const board={
    minX:bounds.minX-105,maxX:bounds.maxX+105,
    minZ:bounds.minZ-105,maxZ:bounds.maxZ+105
  };
  const centerX=(board.minX+board.maxX)*.5;
  const centerZ=(board.minZ+board.maxZ)*.5;
  const width=board.maxX-board.minX;
  const depth=board.maxZ-board.minZ;
  const boardFrame={x:0,z:0,angle:0};
  const boardBox=(material,x,y,z,w,h,d)=>
    add(material,boardFrame,[x,y,z],[w,h,d]);
  boardBox('woodRim',centerX,-.95,board.minZ,width+5,1.9,3.5);
  boardBox('woodRim',centerX,-.95,board.maxZ,width+5,1.9,3.5);
  boardBox('woodRim',board.minX,-.95,centerZ,3.5,1.9,depth);
  boardBox('woodRim',board.maxX,-.95,centerZ,3.5,1.9,depth);
  boardBox('tableEdge',centerX,-.03,board.minZ,width+5,.14,3.5);
  boardBox('tableEdge',centerX,-.03,board.maxZ,width+5,.14,3.5);
  boardBox('tableEdge',board.minX,-.03,centerZ,3.5,.14,depth);
  boardBox('tableEdge',board.maxX,-.03,centerZ,3.5,.14,depth);

  for(const [key,poses] of batches){
    if(!poses.length)continue;
    const [matName,kind]=key.split('|');
    const geometry=kind==='cylinder'?cylinder:
      kind==='sphere'?sphere:kind==='cone'?cone:box;
    const mesh=new THREE.InstancedMesh(geometry,mats[matName],poses.length);
    mesh.name='HO scenery '+key;
    for(let i=0;i<poses.length;i++)mesh.setMatrixAt(i,poses[i]);
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=!mobile&&
      ['wallIvory','wallBrick','wallOchre','roofSlate','roofTerracotta',
        'woodRim'].includes(matName);
    mesh.receiveShadow=true;
    mesh.computeBoundingSphere();
    mesh.frustumCulled=true;
    scene.add(mesh);
  }
  stats.drawBatches=batches.size;
  stats.instances=Array.from(batches.values()).reduce((n,list)=>n+list.length,0);
  stats.animatedTrainCars=shuttle.length;
  return {...stats,update:moveTrain};
}
