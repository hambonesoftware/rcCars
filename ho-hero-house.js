/**
 * Micro Mayhem — HO Hero House No. 01
 * An original, fully procedural model-railroad structure and landscaped lot.
 * No imported meshes, photography, textures, dependencies beyond Three.js,
 * or private/proprietary model assets.
 *
 * World front faces +Z. One visual meter is intentionally NOT a literal
 * 1:87 scale: proportions are tuned for an elevated kart-game camera.
 */
export function createHOHouse(THREE,options={}){
  const seed=Number.isFinite(options.seed)?options.seed:1407;
  const palette=options.palette||'sage';
  const detailed=options.detail!==false;
  let state=(seed>>>0)||1;
  const random=()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  };
  const choose=values=>values[Math.floor(random()*values.length)];
  const root=new THREE.Group();
  root.name='HO 01 · Elm Street Gable House + Yard';

  const hues={
    sage:{wall:0xb0bdab,trim:0xfff4dd,door:0x385c62,roof:0x626d75,shutter:0x47635d},
    cream:{wall:0xe7d8b8,trim:0xfff5e1,door:0x9b5c4d,roof:0x61686b,shutter:0x647985},
    blue:{wall:0xa6bdc8,trim:0xffefe0,door:0x7e4b43,roof:0x555f6e,shutter:0x4d6277}
  };
  const colors=hues[palette]||hues.sage;

  function paintedTexture(kind){
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);
    const r=(a,b)=>a+random()*(b-a);
    if(kind==='siding'){
      for(let y=7;y<256;y+=12){
        ctx.fillStyle='rgba(40,50,48,.18)';ctx.fillRect(0,y,256,1.8);
        ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(0,y+2,256,1.5);
        for(let x=14;x<256;x+=59){
          ctx.fillStyle='rgba(70,70,60,.07)';
          ctx.fillRect(x+r(-4,4),y+3,1,8);
        }
      }
    }else if(kind==='shingle'){
      for(let y=0,row=0;y<256;y+=20,row++){
        ctx.fillStyle='rgba(23,31,34,.24)';ctx.fillRect(0,y,256,2);
        for(let x=(row%2?0:17)-22;x<278;x+=35){
          ctx.fillStyle='rgba(29,38,41,.19)';
          ctx.fillRect(x,y+1,1.6,18);
          ctx.fillStyle='rgba(255,255,255,.18)';
          ctx.fillRect(x+2,y+4,30,1.5);
        }
      }
    }else if(kind==='brick'){
      for(let y=0,row=0;y<256;y+=17,row++){
        ctx.fillStyle='rgba(30,26,23,.18)';ctx.fillRect(0,y,256,2);
        for(let x=(row%2?0:27)-40;x<290;x+=54){
          ctx.fillRect(x,y,1.8,17);
          ctx.fillStyle='rgba(255,255,255,.12)';
          ctx.fillRect(x+3,y+3,45,1.2);
          ctx.fillStyle='rgba(30,26,23,.18)';
        }
      }
    }else if(kind==='concrete'){
      for(let i=0;i<2200;i++){
        const v=Math.floor(r(115,215));
        ctx.fillStyle='rgba('+v+','+v+','+v+','+r(.017,.065)+')';
        const x=r(0,256),y=r(0,256);
        ctx.fillRect(x,y,r(.5,3),r(.5,3));
      }
    }else if(kind==='grass'){
      // The ground mat is fine foam flocking and fibers glued to a
      // substrate. A dense mottled tile replaces flat videogame grass.
      for(let i=0;i<26000;i++){
        const x=r(0,256),y=r(0,256);
        const variant=random();
        ctx.fillStyle=variant<.24?'rgba(39,81,37,.26)':
          variant<.61?'rgba(70,120,49,.19)':
          variant<.87?'rgba(195,202,130,.25)':
          'rgba(151,124,74,.18)';
        ctx.fillRect(x,y,r(.6,2.2),r(.5,2.5));
      }
      for(let i=0;i<1700;i++){
        const x=r(0,256),y=r(0,256);
        ctx.strokeStyle=random()<.6?
          'rgba(48,89,43,.23)':'rgba(220,204,141,.18)';
        ctx.lineWidth=.6;
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(x+r(-1.2,1.2),y-r(1,5));
        ctx.stroke();
      }
    }else if(kind==='wood'){
      for(let y=0;y<256;y+=16){
        ctx.fillStyle='rgba(54,35,25,.1)';ctx.fillRect(0,y,256,1.4);
        for(let i=0;i<12;i++){
          ctx.fillStyle='rgba(62,37,28,.035)';
          ctx.fillRect(r(0,256),y+r(1,15),r(6,20),r(.2,1));
        }
      }
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=4;
    return texture;
  }
  const sidingTex=paintedTexture('siding');
  const shinglesTex=paintedTexture('shingle');
  const brickTex=paintedTexture('brick');
  const concreteTex=paintedTexture('concrete');
  const grassTex=paintedTexture('grass');
  const woodTex=paintedTexture('wood');
  // Painted polystyrene, glossy die-cast enamel and window glazing
  // require a physically layered specular model, not universally matte
  // MeshStandardMaterial. The material is still lightweight enough for
  // Three.js 0.164.1/WebGL2 and does not require an HDR texture download.
  const mat=(color,opts={})=>new THREE.MeshPhysicalMaterial({
    color,roughness:opts.roughness??.76,
    metalness:opts.metalness??0,map:opts.map||null,
    side:opts.side||THREE.FrontSide,
    clearcoat:opts.clearcoat??0,
    clearcoatRoughness:opts.clearcoatRoughness??.25,
    opacity:opts.opacity??1,
    transparent:opts.transparent??false,
    depthWrite:opts.depthWrite??true,
    transmission:opts.transmission??0,
    thickness:opts.thickness??0,
    ior:opts.ior??1.5,
    bumpMap:opts.bumpMap||null,
    bumpScale:opts.bumpScale??.02,
    emissive:opts.emissive??0x000000,
    emissiveIntensity:opts.emissiveIntensity??0
  });
  const m={
    siding:mat(colors.wall,{map:sidingTex,roughness:.37,clearcoat:.34,clearcoatRoughness:.31,bumpMap:sidingTex,bumpScale:.014}),
    sidingLight:mat(0xe9e5d5,{map:sidingTex,roughness:.38,clearcoat:.25}),
    trim:mat(colors.trim,{roughness:.27,clearcoat:.51,clearcoatRoughness:.21}),
    trimShadow:mat(0xb5b7a8,{roughness:.37,clearcoat:.24}),
    darkTrim:mat(0x425255,{roughness:.34,clearcoat:.45}),
    roof:mat(colors.roof,{map:shinglesTex,roughness:.75,bumpMap:shinglesTex,bumpScale:.020}),
    roofEdge:mat(0x343c45,{roughness:.45,clearcoat:.20}),
    brick:mat(0xa56756,{map:brickTex,roughness:.79,bumpMap:brickTex,bumpScale:.025}),
    mortar:mat(0xd2b7a1),
    foundation:mat(0x8d8c83,{map:concreteTex}),
    steps:mat(0xc1bbac,{map:concreteTex}),
    concrete:mat(0xcac5b7,{map:concreteTex}),
    walkway:mat(0xd0cabe,{map:concreteTex}),
    wood:mat(0xa47c5e,{map:woodTex,roughness:.57,clearcoat:.09}),
    door:mat(colors.door,{roughness:.25,clearcoat:.72,clearcoatRoughness:.18}),
    garage:mat(0xddd9ca,{roughness:.35,clearcoat:.43}),
    garageShadow:mat(0xa8aaa1),
    porchRoof:mat(0x777c7b,{roughness:.50,clearcoat:.17}),
    shutter:mat(colors.shutter,{roughness:.39,clearcoat:.24}),
    windowFrame:mat(0xf4eedc,{roughness:.25,clearcoat:.50}),
    glass:mat(0x80a1a4,{roughness:.075,metalness:.03,
      clearcoat:1,clearcoatRoughness:.045,transparent:true,
      opacity:.84,depthWrite:false}),
    interior:mat(0x9b9e8c,{roughness:.88,emissive:0x282a23,emissiveIntensity:.12}),
    brass:mat(0xc6ad6e,{metalness:.86,roughness:.24}),
    lawn:mat(0x8aa16e,{map:grassTex,roughness:.99}),
    soil:mat(0x57483a),
    mulch:mat(0x614839),
    leafDark:mat(0x416942,{roughness:.73}),
    leafMid:mat(0x608754,{roughness:.72}),
    leafLight:mat(0x849b61,{roughness:.74}),
    flowerPink:mat(0xd9818d),
    flowerYellow:mat(0xf2cf64),
    flowerWhite:mat(0xf5e7d0),
    asphalt:mat(0x5a6062,{map:concreteTex,roughness:.97}),
    asphaltMark:mat(0xe6d6a0),
    curb:mat(0xbbbbb2),
    fence:mat(0xf0ece0,{roughness:.42,clearcoat:.24}),
    iron:mat(0x464d4e,{metalness:.4}),
    pot:mat(0xad775a),
    stone:mat(0xa6a49b),
    sky:mat(0x8197a4),
    wagon:mat(0xc44d3e,{roughness:.23,metalness:.38,
      clearcoat:1,clearcoatRoughness:.075}),
    tire:mat(0x22272a,{roughness:.90}),
    hubcap:mat(0xd8dedf,{metalness:.94,roughness:.17,
      clearcoat:.5,clearcoatRoughness:.13}),
    treeTrunk:mat(0x79604a,{map:woodTex}),
    grassBlade:mat(0xffffff,{roughness:.92,side:THREE.DoubleSide}),
    tableWood:mat(0x936844,{map:woodTex}),
    tableTop:mat(0xc4a67e,{map:woodTex,roughness:.58,clearcoat:.18}),
    carGlass:mat(0x617d84,{roughness:.065,metalness:.05,
      clearcoat:1,clearcoatRoughness:.05,side:THREE.DoubleSide,transparent:true,
      opacity:.96,depthWrite:false}),
    carBlack:mat(0x202427,{roughness:.48,clearcoat:.12}),
    carChrome:mat(0xe2e5e1,{metalness:.88,roughness:.16}),
    carTail:mat(0xc9302a,{roughness:.16,clearcoat:1,clearcoatRoughness:.06}),
    carLamp:mat(0xf4eada,{roughness:.12,clearcoat:1,clearcoatRoughness:.06}),
    rail:mat(0x84837a),
    accent:mat(0x789d94)
  };
  const sphereGeo=new THREE.SphereGeometry(1,12,9);
  const cubeGeo=new THREE.BoxGeometry(1,1,1);
  const cylinderGeo=new THREE.CylinderGeometry(1,1,1,12);
  const planeGeo=new THREE.PlaneGeometry(1,1);
  const shadowObjects=[];

  function solid(parent,material,x,y,z,w,h,d,options={}){
    const mesh=new THREE.Mesh(cubeGeo,material);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    mesh.rotation.set(options.rx||0,options.ry||0,options.rz||0);
    mesh.castShadow=options.castShadow!==false;
    mesh.receiveShadow=true;
    mesh.name=options.name||'kit detail';
    parent.add(mesh);
    return mesh;
  }
  function round(parent,material,x,y,z,rx,ry,rz,options={}){
    const mesh=new THREE.Mesh(sphereGeo,material);
    mesh.position.set(x,y,z);
    mesh.scale.set(rx,ry,rz);
    mesh.castShadow=options.castShadow!==false;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }
  function tube(parent,material,x,y,z,r0,r1,height,steps=10){
    const mesh=new THREE.Mesh(
      new THREE.CylinderGeometry(r0,r1,height,steps),material);
    mesh.position.set(x,y,z);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }
  function slab(parent,material,x,z,w,d,y=.08,height=.16){
    return solid(parent,material,x,y,z,w,height,d,{castShadow:false});
  }

  function triangleGable(parent,material,x,z,width,eave,rise,flip=1){
    const vertices=new Float32Array([
      x-width*.5,eave,z,
      x+width*.5,eave,z,
      x,eave+rise,z
    ]);
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',
      new THREE.BufferAttribute(vertices,3));
    geom.setIndex(flip>0?[0,1,2]:[2,1,0]);
    geom.computeVertexNormals();
    const panel=new THREE.Mesh(geom,
      new THREE.MeshPhysicalMaterial({
        color:material.color,map:sidingTex,side:THREE.DoubleSide,
        roughness:.37,clearcoat:.30,clearcoatRoughness:.3
      }));
    panel.receiveShadow=true;
    parent.add(panel);
    return panel;
  }
  function gableRoof(parent,x,z,w,d,eave,rise,options={}){
    const over=options.overhang??.60;
    const pitch=Math.atan2(rise,w*.5);
    const length=(w*.5+over)/Math.cos(pitch);
    const roofMat=options.material||m.roof;
    const roofCenterY=eave+rise*.5;
    for(const side of [-1,1]){
      solid(parent,roofMat,
        x+side*w*.25,roofCenterY,z,
        length,.23,d+over*2,{rz:-side*pitch,name:'roof / shingle field'});
      solid(parent,m.roofEdge,
        x+side*(w*.5+over*.15),eave+.02,z,
        .13,.19,d+over*2,{name:'fascia edge'});
    }
    solid(parent,m.roofEdge,x,eave+rise+.025,z,
      .23,.19,d+over*2,{name:'roof ridge'});
    triangleGable(parent,m.siding,x,z+d*.5,w,eave,rise);
    triangleGable(parent,m.siding,x,z-d*.5,w,eave,rise);
    // The painted rake boards trace the sloping gable at both ends.
    for(const front of [-1,1]){
      for(const side of [-1,1]){
        const trim=solid(parent,m.trim,
          x+side*w*.25,roofCenterY+.01,
          z+front*(d*.5+over*.35),
          length+.10,.11,.12,
          {rz:-side*pitch,name:'gable rake board'});
        trim.castShadow=false;
      }
    }
  }
  function windowAt(parent,x,y,z,w=2.0,h=2.3,orientation='front',shutters=false){
    const front=orientation==='front';
    const depth=.16;
    solid(parent,m.trim,x,y,z,w+.45,h+.40,depth+.09);
    solid(parent,m.interior,x,y,z+(front?.105:-.105),
      w+.09,h+.05,.04,{castShadow:false});
    solid(parent,m.glass,x,y,z+(front?.152:-.152),
      w,h,.045,{castShadow:false});
    // Four individually framed glazing panes and dimensional muntins.
    solid(parent,m.windowFrame,x,y,z+(front?.202:-.202),
      .12,h+.04,.09,{castShadow:false});
    solid(parent,m.windowFrame,x,y+.05,z+(front?.202:-.202),
      w+.09,.11,.09,{castShadow:false});
    solid(parent,m.windowFrame,x,y+h*.5+.10,
      z+(front?.18:-.18),w+.62,.14,.26);
    solid(parent,m.windowFrame,x,y-h*.5-.16,
      z+(front?.30:-.30),w+.63,.15,.54);
    if(shutters){
      for(const dir of [-1,1]){
        solid(parent,m.shutter,x+dir*(w*.5+.41),y,z+(front?.09:-.09),
          .39,h+.05,.20);
        for(let k=0;k<5;k++){
          solid(parent,m.trimShadow,x+dir*(w*.5+.41),
            y-.71+k*.34,z+(front?.23:-.23),
            .32,.058,.035,{castShadow:false});
        }
      }
    }
  }
  function doorAt(parent,x,y,z,w=1.55,h=3.0,material=m.door){
    solid(parent,m.windowFrame,x,y,z,w+.48,h+.27,.22);
    solid(parent,material,x,y,z+.13,w,h,.14);
    for(let yy of [-.77,.50]){
      solid(parent,m.trimShadow,x,y+yy,z+.23,w-.31,.06,.08);
      for(const xx of [-.35,.35]){
        solid(parent,m.trimShadow,x+xx,y+yy*.6,z+.23,
          .075,.72,.08);
      }
    }
    round(parent,m.brass,x+.56,y-.10,z+.30,.072,.074,.06);
    solid(parent,m.glass,x,y+.78,z+.23,.67,.55,.025,{castShadow:false});
  }

  // A recessed plywood display base. The grass and sidewalks sit on its
  // top layer, with the roadway at the front of the model railroad lot.
  solid(root,m.tableWood,0,-1.04,-1.4,48,2.10,62);
  solid(root,m.tableTop,0,-.11,-1.4,47.2,.20,61.2);
  slab(root,m.lawn,0,-4.8,44.8,48.0,.095,.15);
  slab(root,m.asphalt,0,26.45,46,10.9,.115,.12);
  slab(root,m.curb,0,21.25,46,.43,.29,.25);
  slab(root,m.concrete,0,22.20,46,1.66,.28,.18);
  // Center marks visually identify the miniature road as a piece of a
  // proper electrically operated model railway town.
  for(let x=-20;x<=20;x+=9){
    slab(root,m.asphaltMark,x,28.1,4.1,.12,.185,.018);
  }

  // House and garage are separate massing volumes with structurally
  // accurate eave heights and real pitched shingle roof planes.
  const main={x:-4.8,z:-6.05,w:17.6,d:13.6,eave:8.72,rise:3.55};
  const garage={x:9.7,z:-5.15,w:9.7,d:11.75,eave:6.35,rise:2.28};
  const frontZ=main.z+main.d*.5;
  const garageFront=garage.z+garage.d*.5;

  solid(root,m.foundation,main.x,.45,main.z,main.w+.44,.72,main.d+.30);
  solid(root,m.siding,main.x,main.eave*.5+.46,main.z,
    main.w,main.eave,main.d,{name:'HO house clapboard'});
  // Corner trim columns stop the walls reading as a plain cube.
  for(const x of [main.x-main.w*.5,main.x+main.w*.5]){
    for(const z of [main.z-main.d*.5,main.z+main.d*.5]){
      solid(root,m.trim,x,main.eave*.5+.45,z,
        .25,main.eave+.2,.25,{name:'painted corner boards'});
    }
  }
  solid(root,m.trim,main.x,main.eave+.48,main.z,
    main.w+.35,.28,main.d+.35);
  gableRoof(root,main.x,main.z,main.w,main.d,
    main.eave+.49,main.rise);
  // Chimney visibly breaches the roofline on the left rear side.
  const chimneyX=-10.85,chimneyZ=-10.0;
  solid(root,m.brick,chimneyX,10.75,chimneyZ,1.55,5.15,1.60);
  solid(root,m.mortar,chimneyX,13.4,chimneyZ,1.88,.20,1.90);
  solid(root,m.roofEdge,chimneyX,13.54,chimneyZ,1.24,.10,1.24);

  // Garage is lower and narrower, but genuinely attached; carriage-width
  // door and concrete driveway continue to the street.
  solid(root,m.foundation,garage.x,.45,garage.z,garage.w+.3,.72,garage.d+.3);
  solid(root,m.siding,garage.x,garage.eave*.5+.46,garage.z,
    garage.w,garage.eave,garage.d,{name:'attached single-car garage'});
  gableRoof(root,garage.x,garage.z,garage.w,garage.d,
    garage.eave+.45,garage.rise,{overhang:.42});
  solid(root,m.trim,garage.x,garage.eave+.38,garage.z,
    garage.w+.35,.22,garage.d+.28);
  for(const x of [garage.x-garage.w*.5,garage.x+garage.w*.5]){
    solid(root,m.trim,x,3.50,garageFront,
      .22,6.0,.29);
  }
  // Sectional door with shadowed panel seams and a row of little windows.
  const garageDoorZ=garageFront+.17;
  solid(root,m.darkTrim,garage.x,3.03,garageDoorZ,
    6.9,5.25,.16);
  solid(root,m.garage,garage.x,3.02,garageDoorZ+.15,
    6.50,4.94,.13);
  for(let row=0;row<4;row++){
    const y=1.08+row*1.17;
    solid(root,m.garageShadow,garage.x,y,garageDoorZ+.23,
      6.36,.062,.055,{castShadow:false});
    for(let k=-2;k<=2;k++){
      if(k===2)continue;
      solid(root,m.trim,garage.x+(k+.5)*1.51,y+.50,
        garageDoorZ+.24,.05,1.0,.048,{castShadow:false});
    }
  }
  for(const x of [garage.x-2.30,garage.x-.76,garage.x+.76,garage.x+2.30]){
    solid(root,m.glass,x,4.54,garageDoorZ+.29,
      1.22,.48,.06,{castShadow:false});
    solid(root,m.trim,x,4.54,garageDoorZ+.34,
      .055,.53,.068,{castShadow:false});
  }
  solid(root,m.iron,garage.x,1.15,garageDoorZ+.32,
    .14,.27,.14);

  // House front: real readable dimensions in panes, trim, front door,
  // porch posts, a roof, stairs, and a numbered miniature address plaque.
  windowAt(root,-10.65,5.45,frontZ+.16,2.2,2.45,'front',true);
  windowAt(root,.72,5.45,frontZ+.16,2.1,2.38,'front',true);
  windowAt(root,-4.85,6.40,frontZ+.16,1.6,1.78,'front',false);
  doorAt(root,-4.85,2.08,frontZ+.22,1.62,3.10);
  windowAt(root,-10.7,5.33,main.z-main.d*.5-.16,
    2.0,2.0,'rear',false);
  windowAt(root,.70,5.33,main.z-main.d*.5-.16,
    2.0,2.0,'rear',false);
  // Door light, house number plaque and hanging mail slot.
  solid(root,m.darkTrim,-2.9,3.92,frontZ+.35,
    .78,.57,.11);
  solid(root,m.brass,-2.9,3.95,frontZ+.44,
    .50,.12,.055,{castShadow:false});
  round(root,m.brass,-6.65,3.96,frontZ+.40,.18,.24,.19);

  slab(root,m.foundation,-4.85,3.22,6.75,3.95,.47,.29);
  slab(root,m.wood,-4.85,3.32,6.48,3.75,.65,.15);
  for(let z of [4.26,5.0]){
    slab(root,m.steps,-4.85,z,2.80,.66,.30-(z-4.26)*.16,.18);
  }
  // Porch posts and rails connect to the awning, not hovering in air.
  for(const x of [-7.72,-2.00]){
    solid(root,m.trim,x,2.44,5.10,.24,4.25,.25);
    solid(root,m.trim,x,4.64,5.10,.39,.23,.41);
  }
  solid(root,m.porchRoof,-4.85,4.73,4.70,6.85,.22,4.26,
    {rx:-.085,name:'entry canopy'});
  solid(root,m.roofEdge,-4.85,4.63,6.67,6.95,.25,.17);
  for(const x of [-7.60,-2.10]){
    solid(root,m.trim,x,1.37,5.40,.11,1.18,.12);
    solid(root,m.trim,x,1.98,5.40,.12,.12,1.28);
  }
  // Sidewall detail on the exposed right garage return.
  const rightWallX=garage.x+garage.w*.5+.11;
  solid(root,m.trim,rightWallX,4.0,garage.z,
    .14,1.8,1.8);
  solid(root,m.glass,rightWallX+.10,4.0,garage.z,
    .07,1.5,1.54,{castShadow:false});

  // Driveway meets the town street and the front walk meets the porch.
  slab(root,m.concrete,garage.x,13.34,7.45,16.66,.242,.13);
  for(const z of [7.1,13.2,19.55]){
    slab(root,m.trimShadow,garage.x,z,7.18,.09,.326,.025);
  }
  slab(root,m.walkway,-4.85,13.18,2.05,16.7,.25,.13);
  for(const z of [7.0,11.8,16.8,20.3]){
    slab(root,m.trimShadow,-4.85,z,1.95,.064,.327,.02);
  }
  // Front lawn cutaways and mulched flower beds.
  slab(root,m.mulch,-11.0,4.35,5.1,2.0,.24,.10);
  slab(root,m.mulch,-.0,4.35,4.65,2.0,.24,.10);
  slab(root,m.mulch,-15.6,-.60,2.1,10,.23,.10);
  slab(root,m.mulch,18.1,-.25,2.15,8.3,.23,.10);

  function shrub(x,z,radius=1.1,height=1.1){
    for(let i=0;i<4;i++){
      round(root,choose([m.leafMid,m.leafDark,m.leafLight]),
        x+(random()-.5)*radius*.75,
        .48+height*.47+random()*.22,
        z+(random()-.5)*radius*.77,
        radius*(.55+random()*.14),
        height*(.43+random()*.16),
        radius*(.52+random()*.2));
    }
  }
  for(const x of [-12.8,-11.0,-9.4,.18,1.7]){
    shrub(x,3.85,.60+random()*.13,.72);
  }
  for(let i=0;i<7;i++){
    shrub(-15.8+(random()-.5)*1.6,
      -5+i*1.65,.66+random()*.15,.72);
  }
  for(let i=0;i<6;i++){
    shrub(18.1+(random()-.5)*.9,
      -5+i*1.50,.73+random()*.13,.72);
  }
  // A deliberately small central shrub border keeps the garden scale
  // consistent with a serious HO layout (not giant game-style bushes).
  for(const z of [7.6,10.9,14.2]){
    shrub(-15.4,z,.58,.66);
  }

  function modelTree(x,z,height=8.2){
    tube(root,m.treeTrunk,x,height*.39,z,.29,.43,height*.75,9);
    for(const b of [-1,1]){
      const branch=tube(root,m.treeTrunk,
        x+b*.66,height*.67,z+.15,.14,.21,height*.48,7);
      branch.rotation.z=-b*.45;
    }
    for(let i=0;i<9;i++){
      const a=i/9*Math.PI*2;
      const r=i>5?2.1:1.6;
      round(root,
        choose([m.leafDark,m.leafMid,m.leafLight]),
        x+Math.cos(a)*r,
        height*(.85+(i%3)*.046),
        z+Math.sin(a)*r,
        1.8+random()*.47,1.47+random()*.35,
        1.75+random()*.4);
    }
    round(root,m.leafMid,x,height*1.08,z,2.5,1.90,2.35);
  }
  modelTree(-17.4,-13.8,8.0);
  modelTree(18.0,-13.6,9.5);

  function littleFlowerBed(x0,z0,count){
    for(let i=0;i<count;i++){
      const x=x0+(random()-.5)*3.45;
      const z=z0+(random()-.5)*1.15;
      tube(root,m.leafDark,x,.36,z,.08,.11,.48,5);
      const material=choose([m.flowerPink,m.flowerWhite,m.flowerYellow]);
      round(root,material,x,.66,z,.20,.17,.20);
      for(let petal=0;petal<4;petal++){
        const angle=petal/4*Math.PI*2;
        round(root,material,
          x+Math.cos(angle)*.18,.62,
          z+Math.sin(angle)*.18,.13,.12,.13);
      }
    }
  }
  littleFlowerBed(-10.25,4.18,detailed?18:8);
  littleFlowerBed(.20,4.18,detailed?15:8);

  // Low HO picket fence down left side and across rear, with a simple
  // gate opening instead of a solid barrier around the whole property.
  function fenceLine(x0,z0,x1,z1,spacing=.79){
    const len=Math.hypot(x1-x0,z1-z0);
    const n=Math.ceil(len/spacing);
    const angle=Math.atan2(z1-z0,x1-x0);
    const group=new THREE.Group();
    group.position.set(x0,.18,z0);
    group.rotation.y=-angle;
    root.add(group);
    for(let i=0;i<=n;i++){
      const cx=i*len/n;
      solid(group,m.fence,cx,.62,0,.15,1.20,.16);
      if(i%5===0){
        solid(group,m.fence,cx,.77,0,.28,1.52,.27);
      }
    }
    for(const yy of [.49,1.00]){
      solid(group,m.fence,len*.5,yy,0,len,.13,.11);
    }
  }
  fenceLine(-21.4,-19.9,-21.4,18.7);
  fenceLine(-21.4,-19.9,21.4,-19.9);
  fenceLine(21.4,-19.9,21.4,-1.2);

  // The tiny house number, mailbox, fire hydrant and a plausible vintage
  // model car make the object immediately read as a train-table diorama.
  tube(root,m.wood,-14.9,.96,20.0,.12,.13,1.65,7);
  solid(root,m.darkTrim,-14.9,1.76,20.0,.79,.51,1.12);
  solid(root,m.wood,-14.9,2.05,20.0,.83,.11,1.20);
  solid(root,m.brass,-14.57,1.84,20.0,.04,.13,.28);
  tube(root,m.brick,-18.9,.50,21.1,.42,.38,.77,12);
  tube(root,m.brick,-18.9,1.00,21.1,.28,.32,.31,12);
  solid(root,m.brass,-18.9,1.26,21.1,.84,.11,.29);
  for(const side of [-1,1]){
    tube(root,m.brass,-18.9+side*.47,.70,21.1,.13,.13,.43,7);
  }

  /**
   * The toy car is an actual low-poly die-cast body, not stacked cuboids:
   * rounded shoulder sections, tapering bonnet, a sloped glasshouse, dark
   * inset glazing, wheel-arch lips, a molded base, bumpers and chrome rims.
   * Its surfacing and scale are tuned to suggest a premium 1:87 toy rather
   * than a full-size vehicle or cartoon prop.
   */
  function modelStationWagon(x,z){
    const car=new THREE.Group();
    car.name='Die-cast 1:87-style model wagon';
    car.position.set(x,.24,z);
    root.add(car);
    const loft=(sections,material,label)=>{
      const positions=[],uv=[],faces=[];
      const ring=16;
      for(const section of sections){
        const {z:zz,w,bottom,top}=section;
        // More continuous molded shoulders at the fenders, beltline
        // and roof corners avoid the low-poly videogame vehicle profile.
        const outline=[
          [-w*.82,bottom],[-w*.4,bottom],[w*.4,bottom],[w*.82,bottom],
          [w*.96,bottom+.06],[w,bottom+.18],
          [w,top-.22],[w*.95,top-.09],
          [w*.78,top],[0,top+.012],
          [-w*.78,top],[-w*.95,top-.09],
          [-w,top-.22],[-w,bottom+.18],
          [-w*.96,bottom+.06],[-w*.82,bottom]
        ];
        for(let j=0;j<ring;j++){
          const p=outline[j];
          positions.push(p[0],p[1],zz);
          uv.push(j/15,(zz+3)/6);
        }
      }
      for(let i=0;i<sections.length-1;i++){
        for(let j=0;j<ring;j++){
          const next=(j+1)%ring;
          const aa=i*ring+j,ab=i*ring+next;
          const ba=(i+1)*ring+j,bb=(i+1)*ring+next;
          faces.push(aa,ab,ba,ab,bb,ba);
        }
      }
      for(let j=1;j<ring-1;j++){
        faces.push(0,j+1,j);
        const start=(sections.length-1)*ring;
        faces.push(start,start+j,start+j+1);
      }
      const geom=new THREE.BufferGeometry();
      geom.setAttribute('position',
        new THREE.Float32BufferAttribute(positions,3));
      geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geom.setIndex(faces);
      geom.computeVertexNormals();
      const mesh=new THREE.Mesh(geom,material);
      mesh.name=label;
      mesh.castShadow=true;
      mesh.receiveShadow=true;
      car.add(mesh);
      return mesh;
    };
    const panel=(points,material,label)=>{
      const geom=new THREE.BufferGeometry();
      const pos=[];
      for(const p of points)pos.push(...p);
      geom.setAttribute('position',
        new THREE.Float32BufferAttribute(pos,3));
      geom.setIndex([0,1,2,0,2,3]);
      geom.computeVertexNormals();
      const mesh=new THREE.Mesh(geom,material);
      mesh.name=label;
      mesh.castShadow=false;
      car.add(mesh);
      return mesh;
    };
    // Soft, shoulder-rounded cast-metal shell with a genuine front bumper.
    loft([
      {z:-2.34,w:.96,bottom:.34,top:.99},
      {z:-2.13,w:1.15,bottom:.30,top:1.14},
      {z:-1.55,w:1.24,bottom:.28,top:1.23},
      {z:-.40,w:1.27,bottom:.28,top:1.26},
      {z:.66,w:1.27,bottom:.28,top:1.25},
      {z:1.59,w:1.24,bottom:.30,top:1.20},
      {z:2.20,w:1.13,bottom:.37,top:1.03},
      {z:2.35,w:.93,bottom:.47,top:.91}
    ],m.wagon,'painted die-cast lower body');
    // A tapered, raked roof and windshield give a proper estate-car shape.
    loft([
      {z:-1.52,w:.82,bottom:1.14,top:1.34},
      {z:-1.19,w:.90,bottom:1.25,top:1.94},
      {z:-.85,w:.88,bottom:1.34,top:2.04},
      {z:.71,w:.91,bottom:1.33,top:2.08},
      {z:1.31,w:.86,bottom:1.16,top:1.37}
    ],m.wagon,'tapered wagon roof and pillars');
    panel([
      [-.81,1.36,1.333],[.81,1.36,1.333],
      [.77,1.98,.725],[-.77,1.98,.725]
    ],m.carGlass,'sloped front windshield');
    panel([
      [-.78,1.40,-1.535],[.78,1.40,-1.535],
      [.77,1.96,-1.18],[-.77,1.96,-1.18]
    ],m.carGlass,'sloped rear windshield');
    for(const side of [-1,1]){
      // Door glass lies slightly outside the body shell for visible
      // highlights, and its narrow black pillars define true windows.
      const xx=side*.935;
      panel([
        [xx,1.38,1.08],[xx,1.38,-1.30],
        [xx,1.98,-1.08],[xx,2.01,.60]
      ],m.carGlass,'tinted side greenhouse');
      solid(car,m.carBlack,xx,1.68,-.12,.075,.65,.082);
      solid(car,m.carBlack,xx,1.37,.10,.075,.09,2.18);
      solid(car,m.carBlack,xx,2.04,-.10,.07,.095,1.72);
      // Two cast door handles and subtle side molding.
      for(const zz of [-.74,.69]){
        solid(car,m.carChrome,side*1.28,1.15,zz,
          .057,.075,.34,{castShadow:false});
      }
      solid(car,m.carChrome,side*1.25,.81,0,
        .05,.062,3.22,{castShadow:false});
      // Side mirrors are two separate black-plastic housings with bright
      // molded glass inserts.
      solid(car,m.carBlack,side*1.09,1.40,1.00,
        .55,.22,.42);
      solid(car,m.carChrome,side*1.35,1.40,1.00,
        .055,.15,.30,{castShadow:false});
      for(const zz of [-1.51,1.45]){
        // A dark wheel-opening lip frames a real rolling tire,
        // not a dark square pasted onto the model.
        const arch=new THREE.Mesh(
          new THREE.TorusGeometry(.53,.067,6,24,Math.PI),m.carBlack);
        arch.position.set(side*1.256,.50,zz);
        arch.rotation.y=Math.PI*.5;
        car.add(arch);
        const tire=new THREE.Mesh(
          new THREE.CylinderGeometry(.46,.46,.34,24),m.tire);
        tire.rotation.z=Math.PI*.5;
        tire.position.set(side*1.30,.47,zz);
        tire.name='black rubber toy wheel';
        tire.castShadow=true;
        car.add(tire);
        const face=new THREE.Mesh(
          new THREE.CylinderGeometry(.305,.305,.35,24),m.hubcap);
        face.rotation.z=Math.PI*.5;
        face.position.set(side*1.32,.47,zz);
        face.name='metallic chrome wheel';
        car.add(face);
        const axleX=side*1.49;
        for(let spoke=0;spoke<5;spoke++){
          const theta=spoke*2*Math.PI/5;
          const spokeMesh=solid(car,m.carChrome,
            axleX,.47+Math.sin(theta)*.16,
            zz+Math.cos(theta)*.16,
            .065,.068,.30,{castShadow:false});
          spokeMesh.rotation.x=-theta;
        }
        const cap=new THREE.Mesh(
          new THREE.CylinderGeometry(.104,.104,.39,14),m.carChrome);
        cap.rotation.z=Math.PI*.5;
        cap.position.set(axleX,.47,zz);
        car.add(cap);
      }
    }
    // Underbody, fascia, grille, registration plate and separate lenses.
    solid(car,m.carBlack,0,.21,0,2.31,.25,4.20);
    solid(car,m.carChrome,0,.52,2.34,2.02,.12,.115);
    solid(car,m.carBlack,0,.80,2.355,1.30,.25,.08);
    for(let i=-3;i<=3;i++)
      solid(car,m.carChrome,i*.163,.80,2.407,
        .049,.20,.035,{castShadow:false});
    solid(car,m.carChrome,0,.44,2.405,.68,.17,.035);
    solid(car,m.carChrome,0,.52,-2.385,2.06,.12,.08);
    solid(car,m.carBlack,0,.44,-2.410,.71,.21,.045);
    for(const side of [-1,1]){
      solid(car,m.carLamp,side*.79,.91,2.325,
        .48,.21,.08,{castShadow:false});
      solid(car,m.carTail,side*.79,.87,-2.390,
        .42,.30,.06,{castShadow:false});
      solid(car,m.carChrome,side*.80,.61,2.39,
        .35,.07,.055,{castShadow:false});
    }
    // Molded plastic model-car display base remains distinct from
    // its glossy painted shell.
    solid(car,m.carBlack,0,.18,0,2.38,.12,4.08);
    car.userData.diecast=true;
    return car;
  }
  modelStationWagon(9.7,13.4);

  /**
   * Flocked artificial grass for a model railroad display. Cone plants
   * looked like tiny weeds; hobby grass is a dense carpet of straight,
   * short, mixed-green nylon fibers. Thousands of single-triangle filaments
   * are packed into ONE BufferGeometry and ONE draw call. The colored ground
   * texture supplies the fine flocking that stays visible at a distance.
   */
  const grassTufts=detailed?32000:11000;
  const grassPositions=[];
  const grassColors=[];
  let produced=0,tries=0;
  const fibers=[
    new THREE.Color('#4b703b'),
    new THREE.Color('#6e9150'),
    new THREE.Color('#8fa96c'),
    new THREE.Color('#a1a25f'),
    new THREE.Color('#b1a17b')
  ];
  while(produced<grassTufts&&tries<grassTufts*9){
    tries++;
    const x=-21.0+random()*42;
    const z=-18.7+random()*38.9;
    // Paths, garage slab, flower beds and house footprints do not receive
    // floating grass fibers. This is static turf on exposed layout scenery.
    if(x>4.8&&x<14.3&&z>4&&z<22.1)continue;
    if(x>-6.2&&x<-3.5&&z>3&&z<22.3)continue;
    if(x>-14.6&&x<4.0&&z>-12.8&&z<5.4)continue;
    if(x>4.8&&x<15.1&&z>-12.3&&z<5.1)continue;
    if((x<-14.3&&Math.abs(z-3.9)<2.1)||
      (x>16.0&&Math.abs(z-3)<2.0))continue;
    const tint=fibers[Math.min(fibers.length-1,
      Math.floor(random()*fibers.length))];
    const width=.011+random()*.016;
    const length=.068+random()*.106;
    const theta=random()*Math.PI*2;
    const bend=(random()-.5)*length*.32;
    const dx=Math.cos(theta)*width;
    const dz=Math.sin(theta)*width;
    const tipX=x+Math.cos(theta)*bend;
    const tipZ=z+Math.sin(theta)*bend;
    grassPositions.push(
      x-dx,.172,z-dz,
      x+dx,.172,z+dz,
      tipX,.172+length,tipZ
    );
    const bottom=tint.clone().multiplyScalar(.77+random()*.10);
    const upper=tint.clone().multiplyScalar(.98+random()*.18);
    grassColors.push(
      bottom.r,bottom.g,bottom.b,
      bottom.r,bottom.g,bottom.b,
      upper.r,upper.g,upper.b
    );
    produced++;
  }
  const flocking=new THREE.BufferGeometry();
  flocking.setAttribute('position',
    new THREE.Float32BufferAttribute(grassPositions,3));
  flocking.setAttribute('color',
    new THREE.Float32BufferAttribute(grassColors,3));
  flocking.computeVertexNormals();
  flocking.computeBoundingSphere();
  const flockMat=new THREE.MeshStandardMaterial({
    color:0xffffff,vertexColors:true,
    side:THREE.DoubleSide,roughness:1,metalness:0
  });
  const flockMesh=new THREE.Mesh(flocking,flockMat);
  flockMesh.castShadow=false;
  flockMesh.receiveShadow=true;
  flockMesh.name='HO model railroad cut static-grass fibers';
  flockMesh.userData.staticGrassFibers=produced;
  root.add(flockMesh);

  // A single timber-framed exhibition plaque makes the whole asset read
  // like a high-quality electric-train-set model, not real-size terrain.
  solid(root,m.tableWood,0,-1.04,29.40,16,.55,.60);
  solid(root,m.tableTop,0,-.68,29.72,15.5,.26,.16);

  const stats={
    kind:'HO hero house',seed,palette,
    textures:6,grassTufts:produced,
    flockingFibers:produced,
    diecastCars:1,
    realismPass:'physically layered molded plastic, cut nylon static grass and die-cast enamel',
    geometrySource:'procedural Three.js',
    architecture:'painted plastic siding / molded glazing / attached garage',
    yard:'flocked model railroad lawn, driveway, garden, fences, miniature die-cast car'
  };
  return {root,stats};
}
