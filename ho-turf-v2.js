/**
 * Micro Mayhem · HO Hero Diorama v2 · fake static-grass flocking.
 *
 * Visible upright, extremely fine triangular fibers, rather than giant
 * cartoon cones. One InstancedMesh renders the entire patch in one call.
 * Randomized lengths and muted shades imitate HO static-grass fibers.
 */
export function createHOFlocking(THREE,root,{
  random,detail=true,area={
    minX:-21,maxX:21,minZ:-18.7,maxZ:20.2
  }
}={}){
  if(typeof random!=='function'){
    throw new Error('createHOFlocking requires a seeded RNG');
  }
  const meshMaterial=new THREE.MeshLambertMaterial({
    color:0xffffff,
    side:THREE.DoubleSide,
    vertexColors:false,
    depthWrite:true
  });
  // A three-blade cross section. Each tapered fiber uses only one triangle:
  // clear enough to break the grass silhouette, thin enough to evoke flock.
  const points=new Float32Array([
    -.028,0,0, .028,0,0, .005,1,.04,
    0,0,-.027, 0,0,.028, .055,1,0,
    -.02,0,-.02, .02,0,.02, 0,1,-.038
  ]);
  const base=new THREE.BufferGeometry();
  base.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  base.computeVertexNormals();
  const amount=detail?18000:7900;
  const fibers=new THREE.InstancedMesh(base,meshMaterial,amount);
  fibers.name='fine vertical HO static grass fibers';
  fibers.castShadow=false;
  fibers.receiveShadow=true;
  fibers.frustumCulled=false;
  const dummy=new THREE.Object3D();
  const tint=new THREE.Color();
  const shades=[
    0x637b42,0x6d8850,0x809b56,0x97ad68,
    0x587343,0x77915a,0x9aaa6c
  ];
  let made=0,tries=0;
  while(made<amount&&tries<amount*12){
    tries++;
    const x=area.minX+random()*(area.maxX-area.minX);
    const z=area.minZ+random()*(area.maxZ-area.minZ);
    // Keep fibers off garage concrete, sidewalks, house and paths.
    if(x>4.45&&x<14.85&&z>3.7&&z<21.7)continue;
    if(x>-6.25&&x<-3.47&&z>3&&z<22.0)continue;
    if(x>-14.60&&x<4.4&&z>-13.5&&z<5.4)continue;
    if(x>4.5&&x<15.45&&z>-12.8&&z<5.4)continue;
    if((x<-14.3&&Math.abs(z-3.9)<2.4)||
       (x>15.5&&Math.abs(z-3)<2.4))continue;
    // Fibers in a hobby layout are mostly 1–3 mm at 1:87. Relative to
    // this deliberately exaggerated house, keep them very short.
    const height=.16+random()*.26;
    const thickness=.44+random()*.58;
    dummy.position.set(x,.18,z);
    dummy.rotation.set(0,random()*Math.PI*2,(random()-.5)*.24);
    dummy.scale.set(thickness,height,thickness);
    dummy.updateMatrix();
    fibers.setMatrixAt(made,dummy.matrix);
    tint.setHex(shades[Math.floor(random()*shades.length)]);
    fibers.setColorAt(made,tint);
    made++;
  }
  fibers.count=made;
  fibers.instanceMatrix.needsUpdate=true;
  if(fibers.instanceColor)fibers.instanceColor.needsUpdate=true;
  root.add(fibers);
  return {fiberClusters:made,fiberTriangles:made*3};
}
