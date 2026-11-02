/**
 * Micro Mayhem — miniature town street construction, first playable pass.
 *
 * The existing closed racing spline is the main town street. Asphalt,
 * sidewalks, streetside curbs, lane markings, pedestrian crossings and
 * perpendicular side streets are generated from that same physical spline.
 * Side streets are scenic connections only in this pass; the lap route, AI
 * navigation and collision boundaries deliberately remain unchanged.
 *
 * Geometry is batched or instanced to keep mobile rendering predictable.
 */
export const TOWN_STREET_PLANS=Object.freeze({
  garage:{
    title:'Garage Gauntlet — Industrial Streets',
    junctionFractions:[.115,.34,.575,.822],
    names:['REPAIR ROW','BRICKYARD','SWITCHING YARD','FREIGHT WORKS'],
    sidewalkWidth:5.8,
    branchLength:29,
    crossingHalfLength:6.7,
    parkingLane:2.3
  }
});

export function getTownStreetPlan(course){
  return TOWN_STREET_PLANS[course]||null;
}
export function getTownJunctions(course,length){
  const plan=getTownStreetPlan(course);
  return plan?plan.junctionFractions.map(f=>f*length):[];
}
export function createTownStreets({THREE,scene,course,position,length,halfWidth,mobile}){
  const plan=getTownStreetPlan(course);
  if(!plan)return {course,enabled:false,junctions:0,sidewalkSegments:0,
    markings:0,signals:0,branchStreets:0};
  const junctions=getTownJunctions(course,length);
  const turn=THREE.MathUtils.clamp;
  const materials={
    concrete:new THREE.MeshStandardMaterial({
      color:'#b9b4a5',roughness:.96,metalness:0,side:THREE.DoubleSide
    }),
    curb:new THREE.MeshStandardMaterial({
      color:'#d7d0be',roughness:.91,side:THREE.DoubleSide
    }),
    street:new THREE.MeshStandardMaterial({
      color:'#606b70',roughness:.94,side:THREE.DoubleSide
    }),
    streetDark:new THREE.MeshStandardMaterial({
      color:'#525b60',roughness:.97,side:THREE.DoubleSide
    }),
    parking:new THREE.MeshStandardMaterial({
      color:'#959c98',roughness:.97,side:THREE.DoubleSide
    }),
    white:new THREE.MeshBasicMaterial({color:'#ebe9d7'}),
    yellow:new THREE.MeshBasicMaterial({color:'#f0cc69'}),
    dark:new THREE.MeshStandardMaterial({color:'#3d4a4d',roughness:.75}),
    pole:new THREE.MeshStandardMaterial({
      color:'#737f82',roughness:.56,metalness:.42
    }),
    signalRed:new THREE.MeshStandardMaterial({
      color:'#e85d50',roughness:.24,
      emissive:'#a12a1f',emissiveIntensity:.46
    }),
    signalAmber:new THREE.MeshStandardMaterial({
      color:'#eabf69',roughness:.28,
      emissive:'#70501b',emissiveIntensity:.32
    }),
    signalGreen:new THREE.MeshStandardMaterial({
      color:'#57c19e',roughness:.28,
      emissive:'#215d4e',emissiveIntensity:.25
    }),
    hazard:new THREE.MeshStandardMaterial({
      color:'#e0a451',roughness:.82
    })
  };
  const stats={
    course,enabled:true,junctions:junctions.length,
    sidewalkSegments:0,markings:0,signals:0,branchStreets:0,
    curbBlocks:0,drivableMainStreet:true,branchRoutesDrivable:false
  };
  const divider=2;
  const at=(s,d)=>position(turn(s,0,length),d);

  /**
   * Sample a ribbon on the same tangent frame as the existing road mesh,
   * with a small relative vertical offset. Underlying road banking and
   * ramp elevations are respected by the material seams.
   */
  function ribbon(s0,s1,d0,d1,height,material,step=1.35){
    if(s1-s0<.1)return null;
    const count=Math.max(2,Math.ceil((s1-s0)/step));
    const vertices=[],uvs=[],indices=[];
    for(let i=0;i<=count;i++){
      const s=s0+(s1-s0)*i/count;
      for(const d of [d0,d1]){
        const p=at(s,d);
        vertices.push(p.x,p.y+height,p.z);
        uvs.push(d/7,s/13);
      }
    }
    for(let i=0;i<count;i++){
      const a=i*2;
      indices.push(a,a+2,a+1,a+1,a+2,a+3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',
      new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name='Garage street / '+material.name;
    mesh.receiveShadow=true;
    scene.add(mesh);
    return mesh;
  }

  const boxes=new Map();
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  const tmp=new THREE.Object3D();
  function stamp(key,s,d,y,width,height,depth,headingOffset=0){
    const p=at(s,d);
    tmp.position.set(p.x,p.y+y,p.z);
    tmp.rotation.set(0,p.angle+headingOffset,0);
    tmp.scale.set(width,height,depth);
    tmp.updateMatrix();
    if(!boxes.has(key))boxes.set(key,[]);
    boxes.get(key).push(tmp.matrix.clone());
    stats.markings++;
  }
  function inJunction(s,pad=plan.crossingHalfLength+1){
    return junctions.some(x=>Math.abs(s-x)<pad);
  }
  // Concrete pavements follow the genuine road, not a second displaced
  // rectangular piece. Crossing side arms intentionally interrupt them.
  const opening=plan.crossingHalfLength+2;
  const breaks=[0];
  for(const s of junctions)breaks.push(Math.max(0,s-opening),Math.min(length,s+opening));
  breaks.push(length);
  for(let i=0;i<breaks.length-1;i+=2){
    const from=breaks[i],to=breaks[i+1];
    if(to-from<.2)continue;
    for(const side of [-1,1]){
      // Gutter, raised concrete sidewalk, and outer trim form a coherent
      // street section to support buildings oriented toward the road.
      ribbon(from,to,side*(halfWidth+.13),
        side*(halfWidth+1.12),.068,materials.streetDark);
      ribbon(from,to,side*(halfWidth+1.12),
        side*(halfWidth+plan.sidewalkWidth),.155,materials.concrete);
      ribbon(from,to,side*(halfWidth+plan.sidewalkWidth-.38),
        side*(halfWidth+plan.sidewalkWidth+.17),.178,materials.curb);
      stats.sidewalkSegments++;
    }
  }
  // Little curb stones follow all the bends but stop at real junctions.
  for(let s=2;s<length-2;s+=2.6){
    if(inJunction(s,opening))continue;
    for(const side of [-1,1]){
      stamp('curb',s,side*(halfWidth+.62),.152,.45,.23,2.5);
      stats.curbBlocks++;
    }
  }

  // Main-street center divider + edge markings.
  // Preserve the established race-centerline physics and jump surfaces.
  for(let s=21;s<length-8;s+=5.0){
    if(inJunction(s,opening+1.8))continue;
    stamp('yellow',s,-.19,.099,.12,.019,3.2);
    stamp('yellow',s,.19,.099,.12,.019,3.2);
    if(Math.floor(s/10)%2===0){
      for(const side of [-1,1])
        stamp('white',s,side*(halfWidth-1.05),.098,.12,.019,2.8);
    }
  }

  for(let index=0;index<junctions.length;index++){
    const center=junctions[index];
    // Industrial cross streets open from BOTH sides and continue under the
    // buildings, but are intentionally not accepted as alternate race paths.
    // They cannot silently change lap distances or make AI leave the road.
    for(const side of [-1,1]){
      const outer=side*(halfWidth+plan.branchLength);
      ribbon(center-plan.crossingHalfLength,center+plan.crossingHalfLength,
        side*(halfWidth-.75),outer,.070,materials.street,.9);
      stats.branchStreets++;
      // Continuation of the concrete sidewalk at the far end of the
      // little side street reinforces the full urban block layout.
      ribbon(center-plan.crossingHalfLength-1.4,
        center-plan.crossingHalfLength-.65,
        side*(halfWidth+1.1),outer,.14,materials.concrete,.9);
      ribbon(center+plan.crossingHalfLength+.65,
        center+plan.crossingHalfLength+1.4,
        side*(halfWidth+1.1),outer,.14,materials.concrete,.9);
      // Paint visible road shoulders and a side-street stop bar.
      for(const edge of [-1,1]){
        stamp('white',center+edge*(plan.crossingHalfLength-.48),
          side*(halfWidth+plan.branchLength*.48),
          .101,.12,.022,plan.branchLength*.85,Math.PI*.5);
      }
      stamp('white',center,side*(halfWidth+7.5),
        .103,.14,.021,plan.crossingHalfLength*1.53,Math.PI*.5);
      // Industrial no-parking hatch marks at the corner apron.
      for(let r=0;r<3;r++){
        stamp('yellow',center+(r-1)*2.3,
          side*(halfWidth+12.8),.105,.11,.019,2.2,Math.PI*.25);
      }
    }
    // Zebra crossings are embedded in the *drivable* main road. Short
    // striped marks are still clear in the rear 3/4 miniature camera.
    for(const crossingS of [center-10.0,center+10.0]){
      if(crossingS<5||crossingS>length-5)continue;
      for(let i=-6;i<=6;i++){
        stamp('white',crossingS,i*1.14,
          .112,.68,.019,2.9);
      }
    }
    // Traffic lights, street furniture and signals are outside the
    // vehicle corridor and use two batched materials.
    for(const side of [-1,1]){
      const s=center+side*11.4;
      const d=side*(halfWidth+6.5);
      stamp('pole',s,d,3.35,.18,6.7,.19);
      stamp('dark',s,d,6.65,.56,1.65,.63);
      stamp('signalRed',s,d,7.10,.20,.20,.70);
      stamp('signalAmber',s,d,6.64,.20,.20,.70);
      stamp('signalGreen',s,d,6.22,.20,.20,.70);
      stats.signals++;
    }
  }

  // Urban parking spaces frame the racing route, with parked model cars
  // provided by miniature-world.js. Painted bay marks stay outside the
  // driveable road so that high-speed overtakes remain possible.
  for(let s=28;s<length-15;s+=15){
    if(inJunction(s,16))continue;
    for(const side of [-1,1]){
      stamp('parking',s,side*(halfWidth+3.3),.180,
        4.2,.015,.12);
      stamp('white',s,side*(halfWidth+4.7),.180,
        .10,.015,3.2);
    }
  }

  // Restricted construction area: chevrons and contrasting safety blocks
  // dress the existing obstacle zones without adding invisible collisions.
  for(const centerFraction of [.265,.665]){
    const center=centerFraction*length;
    for(let k=0;k<8;k++){
      const s=center+(k-4)*2.65;
      const d=(k%2?1:-1)*(halfWidth+7.8);
      stamp('hazard',s,d,.55,1.0,1.1,.58);
      stamp('yellow',s,d,.99,1.03,.035,.64,Math.PI*.22);
    }
  }

  for(const [key,transforms] of boxes){
    if(!transforms.length)continue;
    const m=new THREE.InstancedMesh(
      boxGeometry,materials[key],transforms.length);
    m.name='Garage town street / '+key;
    for(let i=0;i<transforms.length;i++)
      m.setMatrixAt(i,transforms[i]);
    m.instanceMatrix.needsUpdate=true;
    m.computeBoundingSphere();
    m.castShadow=false;
    m.receiveShadow=true;
    scene.add(m);
  }
  stats.drawBatches=boxes.size;
  return stats;
}
