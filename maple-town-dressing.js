import * as pc from 'playcanvas';

/** Decorative, non-drivable buildings, landscaping and street furniture.
 * Site selection guards road centerline clearance to keep the three-lap game intact.
 */
export function dressMapleJunction({app,root,road,groundHeight,box,buildingSpecs}) {
  const details={lawns:0,driveways:0,hedges:0,fences:0,lamps:0,shopFronts:0,signs:0};
  const color=hex=>new pc.Color(
    parseInt(hex.slice(1,3),16)/255,
    parseInt(hex.slice(3,5),16)/255,
    parseInt(hex.slice(5,7),16)/255
  );
  function material(name,hex,gloss=.18,metalness=0){
    const m=new pc.StandardMaterial();
    m.name='Maple Junction | HO '+name;
    m.diffuse=color(hex);m.useMetalness=true;m.metalness=metalness;
    m.gloss=gloss;m.update();return m;
  }
  const palette={
    lawn:material('premium miniature grass-flock','#758b65',.05),
    gravel:material('fine gray ballast','#86847a',.07),
    paving:material('weathered cement sidewalk','#c0b9a9',.16),
    brick:material('paver brick path','#9f796b',.18),
    hedge:material('matte trimmed boxwood','#49694d',.07),
    hedgeHi:material('flocked boxwood tips','#69895b',.07),
    fence:material('painted warm-white picket fence','#e5ddc9',.33),
    pole:material('dark cast-iron street lamp','#343f3d',.40,.3),
    globe:material('milk glass light','#fff2d2',.37),
    bench:material('dark varnished miniature slats','#886349',.24),
    rail:material('antique rail platform detail','#b6a58b',.29),
    sign:material('painted village sign panel','#f1e5cc',.22),
    border:material('park-planter border','#a38a75',.15)
  };
  const paint=(name,m,x,y,z,w,h,d)=>box(root,name,m,x,y,z,w,h,d);
  const surf=(x,z,raise=0)=>groundHeight(x,z)+raise;
  function roadClear(x,z,radius=1){
    if(Math.abs(x)>97||Math.abs(z)>47)return false;
    return road.nearest(x,z).dist>5.1+radius;
  }
  function placed(name,m,x,z,w,h,d,raise=0){
    if(!roadClear(x,z,Math.max(w,d)*.25))return null;
    return paint(name,m,x,surf(x,z,raise)+h/2,z,w,h,d);
  }
  function garden(spec){
    const {x,z,w,d,name}=spec;
    if(!roadClear(x,z,Math.max(w,d)*.24))return;
    placed(name+' | scale garden-lawn apron',palette.lawn,x,z,w+2,.055,d+2,.07);
    details.lawns++;
    if(spec.type==='house'){
      const towardRoad=z<0?-1:1;
      const gateZ=z+towardRoad*(d/2+2.45);
      placed(name+' | stone garden entrance',palette.paving,x,gateZ,2.05,.075,3.1,.13);
      for(const s of [-1,1]){
        for(let k=0;k<3;k++){
          const px=x+s*(2.5+k*1.32),pz=z+towardRoad*(d/2+1.15);
          if(!roadClear(px,pz,.45))continue;
          paint(name+' | picket fence post',palette.fence,px,surf(px,pz)+.54,pz,.13,1.05,.14);
          if(k<2){
            const bx=px+s*.66;
            paint(name+' | low picket fence rail',palette.fence,bx,surf(bx,pz)+.45,pz,1.28,.09,.10);
          }
          details.fences++;
        }
      }
      for(const s of [-1,1])for(let k=0;k<3;k++){
        const hx=x+s*(w*.39),hz=z+(k-1)*2.15;
        if(placed(name+' | clipped foundation shrub',k%2?palette.hedgeHi:palette.hedge,
           hx,hz,.80,.67,1.17,.09))details.hedges++;
      }
      const dx=x+w*.33,dz=z+towardRoad*(d/2+3.15);
      if(placed(name+' | private diecast driveway',palette.paving,dx,dz,2.75,.074,4.35,.09))
        details.driveways++;
    }
  }
  for(const spec of buildingSpecs)garden(spec);
  for(const x of [-30.7,-11.6,8.0,26.6,44.7]){
    placed('Main Street | shopfront flagstone sidewalk',palette.paving,x,14.9,14.7,.12,2.35,.08);
    details.shopFronts++;
  }
  function lamp(x,z){
    if(!roadClear(x,z,1.1))return;
    const y=surf(x,z);
    paint('1910s streetlight | base casting',palette.pole,x,y+.17,z,.68,.33,.68);
    paint('1910s streetlight | slender post',palette.pole,x,y+2.16,z,.16,4.1,.16);
    paint('1910s streetlight | swan neck crossarm',palette.pole,x+.36,y+4.11,z,.85,.14,.16);
    const bulb=new pc.Entity('Frosted glass miniature street-lamp');
    bulb.addComponent('render',{type:'sphere',material:palette.globe});
    bulb.setLocalPosition(x+.73,y+3.97,z);
    bulb.setLocalScale(.48,.48,.48);
    root.addChild(bulb);
    details.lamps++;
  }
  for(const [x,z] of [
    [-43,15.5],[-24,16],[-4.5,15.7],[15.2,15.6],[34.5,15.5],
    [51.4,14.6],[-41,-15],[-7,-14],[24,-14]
  ])lamp(x,z);
  function planter(x,z){
    if(!roadClear(x,z,2.2))return;
    const y=surf(x,z);
    paint('Railroad-town brick planter border',palette.border,x,y+.23,z,3.9,.46,1.9);
    paint('Railroad-town raised hedge bed',palette.hedgeHi,x,y+.64,z,3.45,.43,1.48);
    for(const s of [-1,1])
      paint('Planter masonry endcap',palette.brick,x+s*1.91,y+.41,z,.22,.78,1.96);
    details.hedges++;
  }
  for(const [x,z] of [[-44,15.1],[-21.5,15.2],[7.3,15.2],[39.0,15.2]])
    planter(x,z);
  function bench(x,z){
    if(!roadClear(x,z,1.8))return;
    const y=surf(x,z);
    for(const dx of [-1.0,1.0])
      paint('Cast park bench feet',palette.pole,x+dx,y+.31,z,.13,.60,.66);
    for(let k=0;k<3;k++)
      paint('Stained timber bench seat slat',palette.bench,x,y+.64,z+(k-1)*.25,2.6,.095,.19);
    paint('Park bench backrest',palette.bench,x,y+1.08,z-.37,2.55,.68,.10);
  }
  bench(-3.4,15.3);
  bench(29.1,15.4);
  for(const [x,z,w,d] of [[-86,20,14,2.4],[-87.6,16.7,6.6,1.65]]){
    if(placed('Maple depot | cast station platform',palette.paving,x,z,w,.22,d,.08))
      details.shopFronts++;
  }
  const sx=62,sz=37;
  if(roadClear(sx,sz,4)){
    const y=surf(sx,sz);
    for(const x of [sx-3.3,sx+3.3])
      paint('Town limits sign post',palette.pole,x,y+2.15,sz,.22,4.3,.21);
    paint('MAPLE JUNCTION | ivory enamel town marker',palette.sign,sx,y+3.88,sz,8.0,2.15,.26);
    paint('MAPLE JUNCTION | dark band',palette.hedge,sx,y+4.82,sz,8.25,.28,.35);
    details.signs++;
  }
  document.body.dataset.mapleDressedLots=String(details.lawns);
  document.body.dataset.mapleStreetlamps=String(details.lamps);
  document.body.dataset.mapleDressedTown='true';
  return details;
}
