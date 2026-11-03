/**
 * Micro Mayhem — handcrafted HO-scale model railway scenery kit.
 * All measurements use the race world's visual "model units", not physical
 * 1:87 dimensions. Cars are deliberately exaggerated to remain readable.
 *
 * Instanced architecture, lamp posts, figures, rail sleepers, road furniture
 * and train cars avoid hundreds of WebGL draw calls on mobile devices.
 * No network textures, GLTF downloads or postprocess render passes.
 */
import {getTownJunctions} from './town-streets.js';
import {buildSceneryClearance} from './scenery-placement.js';

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
  waterTower:'#a2aeb2',doorBlue:'#557388',
  doorRed:'#974a43',roofHighlight:'#8e8e89',trimWood:'#d6c7a7',
  windowFrame:'#ece5cc',glassWarm:'#a9ccd1',brass:'#cfb06b',
  awningBlue:'#5d8fa0',awningRed:'#b96e61',awningCream:'#e7d7b6',
  awningFrame:'#6a6b64',signBlack:'#33494e',mortar:'#c18f82',
  garageDoor:'#8a9da0',shutterRib:'#63757b',
  safetyYellow:'#e3bd68',ventMetal:'#71888d',pole:'#64696a',
  clockFace:'#e5d5b7'
};

export function createMiniatureWorld({
  THREE,scene,course,position,length,halfWidth,mobile,bounds
}){
  const plan=MODEL_TOWN_PLANS[course];
  if(!plan)throw new Error('Unknown miniature town course '+course);
  const streetJunctions=getTownJunctions(course,length);
  const onStreetJunction=(s,padding=11)=>
    streetJunctions.some(j=>Math.abs(j-s)<padding);
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
    return {x:p.x,z:p.z,angle:p.angle,s,d};
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
  const stats={
    course,buildings:0,people:0,railTies:0,trees:0,landmarks:0,
    districts:plan.districts.map(d=>d.title),signs:0,
    railSections:plan.railway.length,
    skippedBuildings:0,minimumBuildingRoadMargin:null,
    buildingStyles:{residential:0,mainstreet:0,industrial:0,station:0,park:0},
    buildingPlots:[]
  };
  // A real distance-to-road test uses the FULL race road, the garage's
  // intersecting side streets, and both model-railway sidings. It protects
  // the footprint of even a pitched roof overhang, not just a building's
  // origin point. Sample spacing is finer than the earlier 5-unit guess.
  const placement=buildSceneryClearance({
    position,length,halfWidth,junctions:streetJunctions,
    branchLength:29,branchHalfWidth:6.7,railway:plan.railway,
    railDistance:halfWidth+(course==='garage'?38:43),
    minX:bounds.minX-103,maxX:bounds.maxX+103,
    minZ:bounds.minZ-103,maxZ:bounds.maxZ+103,
    step:2.0
  });
  function clearFrame(s,side,d,minimum=17){
    let fallback=null;
    for(let advance=0;advance<9;advance++){
      const p=frame(s,side*(d+advance*5.5));
      const margin=placement.clearance(p.x,p.z).margin;
      if(!fallback||margin>fallback.margin)fallback={...p,margin};
      if(margin>Math.max(.9,minimum-halfWidth))return p;
    }
    // Auxiliary furniture may be omitted if no suitable space is found.
    // Building footprints are handled separately and never forced in.
    return fallback;
  }
  function dimensionsForBuilding(style,index){
    const isWorkshop=style==='industrial';
    const isShop=style==='mainstreet';
    const isDepot=style==='station';
    const width=(isShop?7.8:isWorkshop?9.3:isDepot?8.8:6.8)+rand(index)*2.1;
    const depth=(isWorkshop?10.2:isShop?9.4:isDepot?9.5:8.1)+
      rand(index+21)*2.25;
    const height=(isShop?9.5:isWorkshop?7.8:isDepot?7.6:6.1)+
      rand(index+18)*1.65;
    // Facade awnings, porches, roof extensions, sill and fence details
    // are included in this conservative bounding circle.
    // Depot platforms and station canopies project farther toward the
    // tracks than ordinary house porches or storefront awnings.
    const xOverhang=isDepot?5.8:3.6;
    const zOverhang=isDepot?2.35:2.1;
    const footprintRadius=Math.hypot(
      width*.5+xOverhang,depth*.5+zOverhang);
    return {width,depth,height,footprintRadius};
  }
  function building(f,side,style,index,wallKey){
    const isWorkshop=style==='industrial';
    const isShop=style==='mainstreet';
    const isDepot=style==='station';
    const isPark=style==='park';
    const {width,depth,height,footprintRadius}=dimensionsForBuilding(style,index);
    const safe=placement.findBuildingPlot({
      s:f.s,d:f.d,side,radius:footprintRadius,
      minMargin:1.65,maxShift:51
    });
    if(!safe){
      stats.skippedBuildings++;
      return null;
    }
    f=safe;
    const minimum=placement.clearance(f.x,f.z,footprintRadius).margin;
    stats.minimumBuildingRoadMargin=stats.minimumBuildingRoadMargin===null
      ?minimum:Math.min(stats.minimumBuildingRoadMargin,minimum);
    stats.buildingPlots.push({
      s:f.s,d:f.d,x:f.x,z:f.z,style,width,depth,
      footprintRadius,roadMargin:minimum
    });
    stats.buildingStyles[style]++;
    const roof=['roofTerracotta','roofSlate','roofOlive','roofCopper'][index%4];
    const face=side>0?-1:1;
    const xFace=face*width*.5;
    const xRear=-xFace;
    const cornice=height+.38;
    const accent=index%3===0?'wallIvory':index%3===1?'wallOchre':'trimCream';
    const variant=index%4;

    // A real model-kit base: continuous footings, plinth trim, corner
    // pilasters, wall panels and a roofline silhouette.
    add('foundation',f,[0,.22,0],[width+.64,.44,depth+.72]);
    add(wallKey,f,[0,height*.5+.44,0],[width,height,depth]);
    add('trimWood',f,[0,.56,0],[width+.17,.16,depth+.16]);
    add('trimCream',f,[0,cornice,0],[width+.34,.19,depth+.34]);
    for(const xx of [-width*.5,width*.5]){
      for(const zz of [-depth*.5,depth*.5]){
        add(accent,f,[xx,height*.50+.43,zz],[.15,height,.15]);
      }
    }
    const setWindow=(wallX,y,zz,h=1.38,w=1.30,front=true)=>{
      const outward=front?face:-face;
      const x=wallX+outward*.10;
      const frameColor=isWorkshop?'trimDark':'windowFrame';
      add(frameColor,f,[x,y,zz],[.20,h+.30,w+.29]);
      add('glassWarm',f,[x+outward*.11,y,zz],[.09,h+.07,w+.04]);
      add('trimCream',f,[x+outward*.20,y,zz],[.10,.11,w+.23]);
      add('trimCream',f,[x+outward*.20,y,zz],[.10,h+.20,.09]);
      if(w>1){
        add(frameColor,f,[x+outward*.24,y,zz],[.09,.075,w+.25]);
      }
      add('trimWood',f,[x+outward*.12,y-h*.5-.16,zz],
        [.31,.12,w+.50]);
    };
    const door=(xx,yy,zz,h=2.65,w=1.45,color='doorBlue')=>{
      add('windowFrame',f,[xx,yy,zz],[.22,h+.20,w+.19]);
      add(color,f,[xx+face*.12,yy,zz],[.17,h,w]);
      add('brass',f,[xx+face*.24,yy-.15,zz+w*.28],
        [.06,.09,.09]);
      add('trimCream',f,[xx+face*.15,yy+h*.5+.06,zz],
        [.26,.14,w+.4]);
    };
    const shingleGable=(roofColor=roof,rise=2.1)=>{
      const pitch=Math.atan2(rise,width*.5);
      const sloped=(width*.5+.51)/Math.cos(pitch);
      // Distinct pitched planes, fascia, raised ridge and painted gables.
      for(const roofSide of [-1,1]){
        add(roofColor,f,[roofSide*width*.25,
          height+.56+rise*.52,0],[sloped,.22,depth+1.15],
          {roll:-roofSide*pitch});
        for(let shingle=1;shingle<=4;shingle++){
          const part=shingle/5;
          const xx=roofSide*(width*.5*(1-part));
          const yy=height+.63+rise*part;
          add('roofHighlight',f,[xx,yy,0],[.10,.046,depth+.95],
            {roll:-roofSide*pitch});
        }
        add('trimCream',f,
          [roofSide*(width*.5+.12),height+.53,0],
          [.14,.21,depth+1.30]);
      }
      add('roofBlack',f,[0,height+.65+rise,0],
        [.28,.18,depth+1.36]);
      // Exposed gable ends give the building a model-kit silhouette.
      for(const zz of [-depth*.5-.07,depth*.5+.07]){
        add(wallKey,f,[0,height+.72,zz],
          [width*.50,1.10,.17]);
        add('trimWood',f,[0,height+1.28,zz],[width*.31,.13,.20]);
      }
      return rise;
    };

    if(isShop){
      // HO Main Street brick commercial block with a stepped parapet,
      // proper shop glazing, framed signage and striped canopy.
      add('roofBlack',f,[0,height+.64,0],
        [width+.72,.34,depth+.73]);
      for(const xx of [-width*.5,width*.5]){
        add('trimCream',f,[xx,height+1.05,0],
          [.45,1.25,depth+.60]);
      }
      add('wallBrick',f,[xFace,height+.98,0],
        [.44,1.12,depth+.73]);
      add('trimCream',f,[xFace+face*.13,height+1.57,0],
        [.28,.24,depth+.9]);
      for(let zIndex=-2;zIndex<=2;zIndex++){
        const zz=zIndex*depth*.16;
        add('trimWood',f,[xFace+face*.21,height+1.11,zz],
          [.14,.72,.10]);
      }
      // Five-foot model storefront front windows and a recess for door.
      for(const zz of [-depth*.28,depth*.28]){
        setWindow(xFace,2.56,zz,2.8,depth*.31);
        setWindow(xFace,6.42,zz,1.73,depth*.23);
        setWindow(xRear,4.2,zz,1.5,depth*.19,false);
      }
      door(xFace+face*.25,1.82,0,2.85,1.48,
        variant===0?'doorRed':'doorBlue');
      const awning=variant%2?'awningBlue':'awningRed';
      add('awningFrame',f,[xFace+face*.85,4.19,0],
        [1.70,.15,depth*.86],{roll:-face*.14});
      for(let p=-4;p<=4;p++){
        add((p+8)%2?awning:'awningCream',f,
          [xFace+face*.9,4.10,p*depth*.093],
          [1.65,.10,depth*.094],{roll:-face*.14});
      }
      add('signBlack',f,[xFace+face*.27,5.05,0],
        [.26,.88,depth*.71]);
      add('brass',f,[xFace+face*.43,5.04,0],
        [.08,.11,depth*.53]);
      for(let h=0;h<5;h++){
        add('mortar',f,[xFace+face*.035,6.45+h*.42,0],
          [.07,.042,depth+.08]);
      }
      if(variant===2){
        // Rear fire escape and metal railing on one of the larger shops.
        add('pole',f,[xRear-face*.5,4.33,0],
          [1.55,.13,depth*.68]);
        for(const zz of [-depth*.27,0,depth*.27]){
          add('pole',f,[xRear-face*1.15,5.08,zz],
            [.10,1.55,.10]);
        }
        add('pole',f,[xRear-face*1.15,5.78,0],
          [.10,.10,depth*.73]);
      }
    }else if(isWorkshop){
      // Model factory / service garage: metal roof, ventilators, rolling
      // shutters, safety stripes, loading docks and brick pilasters.
      const lowSlope=variant%2===0;
      add('roofSlate',f,[0,height+.72,0],
        [width+1.12,.34,depth+1.22],
        {roll:lowSlope?.08:-.08});
      add('roofBlack',f,[0,height+1.0,0],
        [width+1.23,.13,depth+1.31]);
      for(const sideWall of [-1,1]){
        add('wallBrick',f,[sideWall*width*.51,4.3,0],
          [.20,7.6,.12]);
      }
      // Two oversized rolled-steel garage doors and horizontal ribs.
      for(const zz of [-depth*.255,depth*.255]){
        add('garageDoor',f,[xFace+face*.16,2.75,zz],
          [.18,4.00,depth*.40]);
        add('trimDark',f,[xFace+face*.25,4.84,zz],
          [.25,.23,depth*.45]);
        for(let h=0;h<9;h++){
          add('shutterRib',f,[xFace+face*.28,1.02+h*.40,zz],
            [.10,.075,depth*.39]);
        }
        add('safetyYellow',f,[xFace+face*.28,.67,zz],
          [.10,.26,depth*.41]);
      }
      for(const zz of [-depth*.33,0,depth*.33]){
        setWindow(xFace,6.42,zz,1.0,depth*.19);
        setWindow(xRear,4.7,zz,1.28,depth*.22,false);
      }
      for(const roofZ of [-depth*.30,depth*.30]){
        add('roofBlack',f,[-width*.19,height+1.27,roofZ],
          [1.08,.83,1.35]);
        add('ventMetal',f,[-width*.19,height+1.78,roofZ],
          [1.34,.20,1.50]);
      }
      add('trimWood',f,[xFace+face*1.30,.34,0],
        [2.3,.30,depth*.92]);
      add('safetyYellow',f,[xFace+face*2.45,.18,0],
        [.13,.20,depth*.90]);
      // Utility pipe and exterior downspout.
      add('ventMetal',f,[xFace+face*.24,4.9,depth*.46],
        [.19,8.45,.19]);
    }else{
      const rise=shingleGable(roof,isDepot?2.15:1.95);
      const roofPeak=height+.65+rise;
      // Cottages have crisp paired shutters, porch decks, lintels,
      // dormers, gutters and variety in roof/chimney placement.
      for(const zz of [-depth*.27,depth*.27]){
        setWindow(xFace,4.12,zz,1.38,1.30);
        setWindow(xRear,4.13,zz,1.32,1.25,false);
        for(const shutterSide of [-1,1]){
          add(variant%2?'doorBlue':'roofOlive',f,
            [xFace+face*.27,4.12,
              zz+shutterSide*.87],[.10,1.62,.28]);
        }
      }
      door(xFace+face*.21,1.60,0,2.62,1.35,
        variant%2?'doorBlue':'doorRed');
      // Roof dormer and small paned window above the entrance.
      if(!isPark){
        add('wallIvory',f,
          [xFace-face*width*.27,height+.88,0],
          [1.48,1.65,2.05]);
        add('roofSlate',f,
          [xFace-face*width*.27,height+1.86,0],
          [1.77,.27,2.48]);
        add('glassWarm',f,
          [xFace-face*width*.27+face*.82,height+.81,0],
          [.12,.85,.94]);
      }
      if(variant%3===0){
        add('wallBrick',f,[-face*width*.17,
          roofPeak+.03,depth*.25],[.82,1.7,.80]);
        add('roofBlack',f,[-face*width*.17,
          roofPeak+.99,depth*.25],[1.01,.12,1.02]);
      }
      // Porch deck, roof, railings and two posts are the main suburban
      // miniature-scale cues; all were allowed for by safety radius.
      add('porch',f,[xFace+face*.93,.44,0],
        [1.85,.35,depth*.69]);
      for(const zz of [-depth*.30,depth*.30]){
        add('trimCream',f,[xFace+face*1.57,2.27,zz],
          [.19,3.45,.19]);
      }
      add('roofTerracotta',f,[xFace+face*1.04,4.05,0],
        [2.07,.22,depth*.75],{roll:face*.12});
      add('porch',f,[xFace+face*1.85,.18,0],
        [.62,.27,2.5]);
      if(isDepot){
        add('railPlatform',f,[xFace+face*3.4,.26,0],
          [3.65,.32,depth+2.1]);
        add('roofCopper',f,[xFace+face*3.12,4.66,0],
          [4.9,.20,depth+2.35]);
        for(const zz of [-depth*.4,depth*.4]){
          add('trimCream',f,[xFace+face*4.24,2.45,zz],
            [.20,4.6,.18]);
        }
        add('clockFace',f,[xFace+face*.38,
          roofPeak-.1,0],[.12,1.12,1.12]);
        add('windowFrame',f,[xFace+face*.49,
          roofPeak-.1,0],[.13,.08,.82]);
        add('windowFrame',f,[xFace+face*.49,
          roofPeak-.1,0],[.13,.75,.07]);
      }
      if(style==='residential'){
        // Simple front garden with picket details set farther back
        // than the carriageway; no fence or chimney intersects road.
        for(let i=-3;i<=3;i++){
          add('fence',f,[xFace+face*2.48,.75,i*1.28],
            [.11,1.45,.11]);
        }
        add('fence',f,[xFace+face*2.48,1.30,0],
          [.12,.11,8.1]);
      }
      if(isPark){
        add('flag',f,[xRear,roofPeak+1.6,0],
          [.16,3,.16]);
      }
    }
    // Corner detailing and side return windows make the architecture
    // work in 3D from the high three-quarter tilt-shift camera.
    for(const zz of [-depth*.5,depth*.5]){
      add('trimWood',f,[0,height*.46+.42,zz],
        [width+.08,.10,.13]);
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
      // The real racing street now runs through these town blocks.
      // Keep the cross-street approaches clear of large building meshes.
      if(course==='garage'&&onStreetJunction(s,10.6))continue;
      const isSecondaryRow=i%5===4;
      const thisSide=isSecondaryRow?-side:side;
      const distance=course==='garage'
        ? halfWidth+(area.type==='industrial'?17.3:15.5)+
            (i%3)*1.8+(isSecondaryRow?8:0)
        : halfWidth+(area.type==='industrial'?20:17)+
            (i%3)*2.8+(isSecondaryRow?8:0);
      const f=clearFrame(s,thisSide,distance,halfWidth+10.5);
      const wall=plan.palette[(i+district)%plan.palette.length];
      building(f,thisSide,area.type,i+district*19,wall);
      if(i%2===0){
        // Figures and furniture stand between the houses and the road,
        // separated from the truck route by a visual sidewalk.
        const verge=course==='garage'?halfWidth+9.8:halfWidth+12.7;
        lamp(clearFrame(s+2,thisSide,verge,halfWidth+1.6));
        person(clearFrame(s+3,thisSide,
          course==='garage'?halfWidth+9.8:halfWidth+14.2,
          halfWidth+2.1),
          thisSide,i+district*21);
      }
      if(i%3===1){
        const d=clearFrame(s-2,thisSide,
          course==='garage'?halfWidth+10.2:halfWidth+13.5,
          halfWidth+2);
        mailbox(d);
      }
      if(i%4===2){
        const d=clearFrame(s+3,thisSide,
          course==='garage'?halfWidth+11.8:halfWidth+15.1,
          halfWidth+3);
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
        if(course==='garage'&&onStreetJunction(s,13))continue;
        const farFrame=clearFrame(s,side,halfWidth+43,halfWidth+16);
        const style=area.type==='industrial'?'industrial':
          area.type==='mainstreet'?'mainstreet':'residential';
        building(farFrame,side,style,250+row+district*10,
          plan.palette[(row+district+2)%plan.palette.length]);
      }
      for(let i=-7;i<=7;i++){
        const ss=Math.max(24,Math.min(length-25,center+i*step*.43));
        if(course==='garage'&&onStreetJunction(ss,9))continue;
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

  // The opening grid must already feel like a town street. The usual
  // Repair Row district begins later along the lap, so populate both
  // frontages at the starting straight as an actual industrial village.
  // These lots stay outside the original racing and obstacle corridor.
  if(course==='garage'){
    const openingS=[14,30,46];
    for(let i=0;i<openingS.length;i++){
      for(const side of [-1,1]){
        const f=clearFrame(openingS[i],side,halfWidth+16.5,
          halfWidth+7.2);
        const industrial=(i+Math.max(0,side))%2===0;
        building(f,side,industrial?'industrial':'mainstreet',
          310+i+(side>0?5:0),
          industrial?'wallBrick':'wallOchre');
        const streetlamp=clearFrame(openingS[i]+5,side,
          halfWidth+10.6,halfWidth+2);
        lamp(streetlamp);
        if(i%2===0){
          const passerby=clearFrame(openingS[i]+3,side,
            halfWidth+9.8,halfWidth+3);
          person(passerby,side,450+i+(side>0?9:0));
        }
        if(i===1){
          parkedCar(clearFrame(openingS[i]-10,side,
            halfWidth+11.5,halfWidth+4),i+15);
        }
      }
    }
    sign(clearFrame(51,-1,halfWidth+18,halfWidth+7),
      'REPAIR ROW',-1);
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
