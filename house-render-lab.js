/**
 * Micro Mayhem — HO photography rendering laboratory.
 * Three.js r164. The same procedural house geometry is used in every mode.
 * All detail maps are original data textures; no HDR download or build step.
 */
export const RENDER_PRESETS=Object.freeze({
  original:{label:'Original V3',tone:'aces',light:'original',shadows:'soft',materials:'plain',lens:'ortho',dof:false},
  room:{label:'Room light',tone:'neutral',light:'room',shadows:'detail',materials:'plain',lens:'ortho',dof:false},
  surface:{label:'Surface detail',tone:'neutral',light:'room',shadows:'detail',materials:'micro',lens:'ortho',dof:false},
  photo:{label:'Tabletop photo',tone:'neutral',light:'room',shadows:'detail',materials:'micro',lens:'perspective',dof:true}
});
export const RENDER_FACTORS=Object.freeze({
  tone:['aces','neutral'],
  light:['original','room'],
  shadows:['soft','detail'],
  materials:['plain','micro'],
  lens:['ortho','perspective'],
  dof:[false,true]
});
export function validateRenderState(next){
  return Object.keys(RENDER_FACTORS).every(k=>
    RENDER_FACTORS[k].includes(next[k]));
}

/** Procedurally authored normal and roughness maps are non-color data. */
export function createPlasticMicroMaps(THREE){
  const size=128;
  const height=new Float32Array(size*size);
  const rough=new Uint8Array(size*size*4);
  let seed=0x1f39bb;
  const rand=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  // Correlated structure is important: straight shallow mold grain plus
  // almost invisible randomized speckle, not independent TV snow.
  for(let y=0;y<size;y++){
    const rowVariation=(rand()-.5)*.16;
    for(let x=0;x<size;x++){
      const rib=Math.sin(x*.31)*.13+Math.sin(x*.85)*.03;
      const grain=(rand()-.5)*.29;
      height[y*size+x]=rib+rowVariation+grain;
      const v=Math.max(210,Math.min(250,
        Math.floor(228+height[y*size+x]*24+rand()*11)));
      const p=(y*size+x)*4;
      rough[p]=v;rough[p+1]=v;rough[p+2]=v;rough[p+3]=255;
    }
  }
  const normal=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const at=(xx,yy)=>height[((yy+size)%size)*size+
        (xx+size)%size];
      const dx=(at(x+1,y)-at(x-1,y))*.17;
      const dy=(at(x,y+1)-at(x,y-1))*.17;
      const magnitude=Math.hypot(dx,dy,1);
      const p=(y*size+x)*4;
      normal[p]=Math.round(255*(1-dx/magnitude)*.5);
      normal[p+1]=Math.round(255*(1-dy/magnitude)*.5);
      normal[p+2]=Math.round(255*(1/magnitude*.5+.5));
      normal[p+3]=255;
    }
  }
  function texture(bytes){
    const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
    t.colorSpace=THREE.NoColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.magFilter=THREE.LinearFilter;
    t.minFilter=THREE.LinearMipmapLinearFilter;
    t.generateMipmaps=true;
    t.anisotropy=2;
    t.needsUpdate=true;
    return t;
  }
  return {normal:texture(normal),roughness:texture(rough)};
}

/**
 * Recover original material references when users switch experiments.
 * This is intentionally a live adjustment, not a rebuild: geometry, seed,
 * transforms and layout must be identical across rendered comparisons.
 */
export function createMaterialExperiment(THREE){
  const maps=createPlasticMicroMaps(THREE);
  const originals=new Map();
  function apply(root,enabled){
    let adjusted=0;
    root.traverse(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?
        object.material:[object.material];
      for(const material of materials){
        if(!material||!['styrene','molded-roof','diecast'].includes(
          material.userData?.surfaceFamily))continue;
        if(!originals.has(material)){
          originals.set(material,{
            roughnessMap:material.roughnessMap||null,
            normalMap:material.normalMap||null,
            normalScale:material.normalScale?
              material.normalScale.clone():null
          });
        }
        const saved=originals.get(material);
        material.roughnessMap=enabled?maps.roughness:saved.roughnessMap;
        material.normalMap=enabled?maps.normal:saved.normalMap;
        if(material.normalScale){
          if(enabled){
            material.normalScale.set(.18,.18);
          }else if(saved.normalScale){
            material.normalScale.copy(saved.normalScale);
          }
        }
        material.needsUpdate=true;
        adjusted++;
      }
    });
    return adjusted;
  }
  return {
    apply,
    dispose(){maps.normal.dispose();maps.roughness.dispose();originals.clear();}
  };
}

/**
 * Soft transparent "baked" contact occlusion. This is deliberately
 * available without a heavyweight screen-space GTAO pass on mobile.
 * Footprints only: no floating dark discs on the roof.
 */
export function createContactPatches(THREE){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  const grad=ctx.createRadialGradient(64,64,8,64,64,63);
  grad.addColorStop(0,'rgba(27,30,23,.50)');
  grad.addColorStop(.32,'rgba(27,30,23,.30)');
  grad.addColorStop(1,'rgba(27,30,23,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.MeshBasicMaterial({
    map:tex,transparent:true,depthWrite:false,polygonOffset:true,
    polygonOffsetFactor:-1,side:THREE.DoubleSide
  });
  const geo=new THREE.PlaneGeometry(1,1);
  const group=new THREE.Group();
  group.name='baked toy-contact occlusion';
  const patches=[
    [-4.8,-6,21,17,.235],
    [9.7,-5,13,15,.235],
    [-17.4,-13.8,6,7,.235],
    [18,-13.6,7,8,.235],
    [9.7,13.4,6.8,8,.205]
  ];
  for(const [x,z,w,h,y] of patches){
    const mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,1);
    mesh.renderOrder=1;
    group.add(mesh);
  }
  return {
    group,
    setEnabled(enabled){group.visible=enabled;},
    dispose(){geo.dispose();mat.dispose();tex.dispose();}
  };
}
