/**
 * Micro Mayhem · Hero Diorama v2 · die-cast station wagon.
 *
 * A stylized 1:64-ish miniature die-cast car with real extruded silhouette,
 * glazing, bumpers, wheel wells, side trim and deep-rim wheels. Original
 * procedural geometry. No downloadable/brand-specific copyrighted model.
 */
export function createDiecastWagon(THREE, {color=0xb44631}={}){
  const root=new THREE.Group();
  root.name='HO diorama v2 / die-cast miniature station wagon';

  const paint=new THREE.MeshPhysicalMaterial({
    color,metalness:.63,roughness:.23,
    clearcoat:.95,clearcoatRoughness:.095,
    envMapIntensity:1.5
  });
  const roofPaint=new THREE.MeshPhysicalMaterial({
    color:0xd9d5c7,metalness:.24,roughness:.33,
    clearcoat:.70,clearcoatRoughness:.16,envMapIntensity:1.15
  });
  const tintedGlass=new THREE.MeshPhysicalMaterial({
    color:0x374f57,metalness:.12,roughness:.11,
    clearcoat:1,clearcoatRoughness:.07,
    transparent:true,opacity:.94,side:THREE.DoubleSide,
    envMapIntensity:1.8,depthWrite:true
  });
  const chrome=new THREE.MeshStandardMaterial({
    color:0xb4c3c3,metalness:1,roughness:.19,envMapIntensity:1.7
  });
  const black=new THREE.MeshStandardMaterial({
    color:0x202326,roughness:.68,metalness:.03
  });
  const rubber=new THREE.MeshStandardMaterial({
    color:0x181b1d,roughness:.94
  });
  const blackTrim=new THREE.MeshStandardMaterial({
    color:0x323b40,metalness:.11,roughness:.47
  });
  const lamp=new THREE.MeshPhysicalMaterial({
    color:0xf6ecc8,roughness:.15,clearcoat:.85,
    clearcoatRoughness:.11
  });
  const redLens=new THREE.MeshPhysicalMaterial({
    color:0xaf2d29,roughness:.18,
    clearcoat:.95,clearcoatRoughness:.09
  });
  const cube=new THREE.BoxGeometry(1,1,1);

  const block=(parent,mat,x,y,z,w,h,d)=>{
    const mesh=new THREE.Mesh(cube,mat);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  };
  const sphere=(parent,mat,x,y,z,w,h,d)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),mat);
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    mesh.castShadow=true;
    parent.add(mesh);
    return mesh;
  };
  // Extruding a continuous side outline yields the rounded, one-piece
  // cast-metal shell associated with a real premium 1:64 collectible.
  // Shape x is negative world-Z; depth becomes width after rotation.
  function extrudedProfile(points,width,material,bevel=.08){
    const shape=new THREE.Shape();
    points.forEach(([worldZ,y],i)=>{
      if(i===0)shape.moveTo(-worldZ,y);
      else shape.lineTo(-worldZ,y);
    });
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{
      depth:width-bevel*2,
      steps:1,bevelEnabled:true,
      bevelThickness:bevel,bevelSize:bevel,
      bevelSegments:3,curveSegments:2
    });
    geometry.rotateY(Math.PI/2);
    geometry.translate(-width/2+bevel,0,0);
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=true;mesh.receiveShadow=true;
    root.add(mesh);
    return mesh;
  }

  const lower=extrudedProfile([
    [-2.47,.48],[-2.44,1.05],[-2.06,1.33],
    [-.92,1.45],[1.63,1.36],[2.21,1.14],
    [2.47,.71],[2.38,.43]
  ],2.57,paint,.125);
  lower.name='beveled die-cast metal shell';
  // Compact raised roof sits above the hood and the trunk rather than
  // looking like a second rectangular box on a slab.
  const shell=extrudedProfile([
    [-1.56,1.35],[-1.03,2.18],[.79,2.27],
    [1.38,1.37]
  ],2.25,roofPaint,.10);
  shell.name='roof + greenhouse frame';

  // Four manually-authored glass quadrilaterals fit the pitched cabin
  // and visibly angle the windshield / rear window into the roof.
  function glassQuad(points){
    const geometry=new THREE.BufferGeometry();
    const array=[];
    for(const i of [0,1,2,0,2,3]){
      const p=points[i];
      array.push(p[0],p[1],p[2]);
    }
    geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(array,3));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,tintedGlass);
    mesh.castShadow=false;
    root.add(mesh);
  }
  glassQuad([
    [-.92,1.42,1.392],[.92,1.42,1.392],
    [.91,2.04,.68],[-.91,2.04,.68]
  ]);
  glassQuad([
    [-.89,2.02,-.87],[.89,2.02,-.87],
    [.98,1.45,-1.55],[-.98,1.45,-1.55]
  ]);
  for(const side of [-1,1]){
    const x=side*1.14;
    glassQuad([
      [x,1.47,.77],[x,2.07,.53],
      [x,2.11,-.14],[x,1.47,-.14]
    ]);
    glassQuad([
      [x,1.47,-.26],[x,2.12,-.28],
      [x,2.03,-.88],[x,1.47,-1.41]
    ]);
    block(root,chrome,side*1.185,1.45,-.22,.060,.13,2.38);
    block(root,chrome,side*1.185,1.78,-.19,.060,.055,2.21);
    block(root,blackTrim,side*1.18,1.32,-.28,.08,.09,2.67);
    block(root,chrome,side*1.295,.80,0,.05,.08,3.70);
    block(root,chrome,side*1.30,1.10,.72,.055,.09,.55);
    block(root,blackTrim,side*1.29,1.02,.78,.10,.18,.29);

    // Wheel openings, made as actual arc geometry aligned to wheel axles.
    for(const z of [-1.55,1.52]){
      const arch=new THREE.Mesh(
        new THREE.TorusGeometry(.532,.066,7,20,Math.PI),
        blackTrim
      );
      arch.rotation.y=Math.PI/2;
      arch.position.set(side*1.29,.68,z);
      root.add(arch);
      // Black hubbed wheels with a shallow tire sidewall, chrome
      // five-spoke rims, tiny center cap and visible axle.
      const tire=new THREE.Mesh(
        new THREE.CylinderGeometry(.51,.51,.34,22,1),
        rubber
      );
      tire.rotation.z=Math.PI/2;
      tire.position.set(side*1.32,.51,z);
      tire.castShadow=true;
      root.add(tire);
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(.332,.047,9,24),chrome);
      ring.rotation.y=Math.PI/2;
      ring.position.set(side*1.52,.51,z);
      root.add(ring);
      const hub=new THREE.Mesh(
        new THREE.CylinderGeometry(.265,.265,.031,20),blackTrim);
      hub.rotation.z=Math.PI/2;
      hub.position.set(side*1.54,.51,z);
      root.add(hub);
      const hubcap=new THREE.Mesh(
        new THREE.CylinderGeometry(.085,.085,.055,16),
        chrome
      );
      hubcap.rotation.z=Math.PI/2;
      hubcap.position.set(side*1.57,.51,z);
      root.add(hubcap);
      for(let spoke=0;spoke<5;spoke++){
        const a=spoke*Math.PI*2/5;
        const b=block(root,chrome,side*1.575,
          .51+Math.sin(a)*.18,z+Math.cos(a)*.18,
          .039,.085,.27);
        b.rotation.x=a;
      }
    }
  }

  // Dark injection-molded undercarriage and bright plated bumpers make
  // the scale/assembly method legible at the elevated HO-camera angle.
  block(root,black,0,.41,0,2.12,.23,4.64);
  block(root,chrome,0,.72,2.48,2.25,.18,.25);
  block(root,chrome,0,.72,-2.48,2.25,.18,.25);
  block(root,blackTrim,0,.96,2.465,1.57,.36,.060);
  for(const side of [-1,1]){
    sphere(root,lamp,side*.87,1.02,2.46,.28,.17,.093);
    block(root,redLens,side*.87,.98,-2.47,.42,.29,.070);
  }
  block(root,chrome,0,.78,2.52,1.18,.065,.065);
  block(root,chrome,0,.77,-2.52,1.35,.065,.066);
  block(root,blackTrim,0,2.22,-.27,1.88,.09,.27);

  // Small registration plate on the rear bumper. Non-brand-specific.
  block(root,roofPaint,0,.93,-2.56,.74,.29,.065);
  root.userData.materials={
    bodyMetalness:paint.metalness,
    bodyRoughness:paint.roughness,
    bodyClearcoat:paint.clearcoat
  };
  return root;
}
