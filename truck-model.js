/**
 * Micro Mayhem — smooth short-bed RC monster-truck model (v2).
 *
 * The entire painted exterior, including the hood, cab, bed rails and
 * rounded body sides, is one continuous indexed and smoothed mesh.
 * Deliberately separate parts: glass, grille, lamps, chassis, wheels and
 * minor detailing. No box-built hood, cab or cargo-bed side panels.
 *
 * Local axes: +Z front, X left/right, +Y up. Designed to be readable from
 * the elevated isometric camera in vehicle-preview.html.
 */
export function makeRCTrophyTruck(THREE, paint = '#ebcb40') {
  const truck = new THREE.Group();
  truck.name = 'Micro Mayhem — Smooth-Shell Mini Monster 4x4';

  const palette = {
    paint: new THREE.MeshPhysicalMaterial({
      color: paint, metalness: .10, roughness: .32,
      clearcoat: .95, clearcoatRoughness: .21, side: THREE.DoubleSide,
      envMapIntensity: .65
    }),
    darker: new THREE.MeshStandardMaterial({
      color: new THREE.Color(paint).multiplyScalar(.78), roughness: .45
    }),
    highlight: new THREE.MeshStandardMaterial({
      color: new THREE.Color(paint).multiplyScalar(1.10), roughness: .35
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#253c42', metalness: .06, roughness: .17,
      clearcoat: 1, clearcoatRoughness: .06, side: THREE.DoubleSide
    }),
    reflection: new THREE.MeshBasicMaterial({
      color: '#9ebbbe', opacity: .21, transparent: true,
      depthWrite: false, side: THREE.DoubleSide
    }),
    tire: new THREE.MeshStandardMaterial({ color: '#252626', roughness: .94 }),
    tread: new THREE.MeshStandardMaterial({ color: '#33332f', roughness: 1 }),
    chassis: new THREE.MeshStandardMaterial({ color: '#252b2c', roughness: .8, metalness: .22 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1c2425', roughness: .88 }),
    charcoal: new THREE.MeshStandardMaterial({ color: '#333c3d', roughness: .55, metalness: .16 }),
    metal: new THREE.MeshStandardMaterial({ color: '#919b9d', roughness: .32, metalness: .68 }),
    grille: new THREE.MeshStandardMaterial({ color: '#1b272b', roughness: .58, metalness: .1 }),
    light: new THREE.MeshPhysicalMaterial({
      color: '#fcf2d7', roughness: .24, clearcoat: .8,
      emissive: '#8b7950', emissiveIntensity: .12
    }),
    amber: new THREE.MeshStandardMaterial({color:'#e6ad5b', roughness:.35}),
    brake: new THREE.MeshStandardMaterial({color:'#c84e43', roughness:.35})
  };

  const geometryUnitBox = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, material, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geometryUnitBox, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cylinder(parent, material, x, y, z, top, bottom, length, sides = 18, axis = 'y') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, length, sides), material);
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function sphere(parent, material, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function rod(parent, a, b, radius, material, segments = 8) {
    const first = new THREE.Vector3(...a);
    const second = new THREE.Vector3(...b);
    const delta = second.clone().sub(first);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), material);
    m.position.copy(first.add(second).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function tube(parent, points, radius, material, segments = 40) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segments, radius, 7, false), material
    );
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
  function smooth(a, b, x) {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // These are the body sculpting control stations, back to front.
  // z, paint skin top height, half-width. More subdivisions are interpolated
  // between them to create a unified production-like molded shell.
  const stations = [
    [-2.16, 1.40, .78],
    [-2.10, 1.59, .88],
    [-1.98, 1.71, .94],
    [-1.10, 1.73, .95],
    [-.92,  1.76, .92],
    [-.76,  1.87, .88],
    [-.50,  2.35, .83],
    [-.38,  2.43, .83],
    [ .26,  2.43, .83],
    [ .42,  2.33, .85],
    [ .82,  1.79, .93],
    [1.00,  1.75, .96],
    [1.61,  1.70, .96],
    [1.94,  1.63, .91],
    [2.10,  1.44, .85],
    [2.17,  1.28, .75]
  ];
  function profile(z) {
    const zz = clamp(z, stations[0][0], stations[stations.length-1][0]);
    let i=0;
    while(i<stations.length-2 && zz>stations[i+1][0]) i++;
    const a=stations[i], b=stations[i+1];
    // Monotonic ease avoids sharp box corners or rippled roof lines.
    const t=smooth(a[0], b[0], zz);
    return {
      top: a[1]+(b[1]-a[1])*t,
      half: a[2]+(b[2]-a[2])*t
    };
  }
  function bedFactor(z) {
    return smooth(-2.08,-1.96,z) * (1-smooth(-1.02,-.84,z));
  }
  function skinTop(z, x) {
    const {top,half}=profile(z);
    const u=clamp(Math.abs(x)/half,0,1);
    // Shoulder rounds into side panels; gentler roll-over at the cab.
    const shoulder=.11*smooth(.72,1.0,u);
    const crown=.028*u*u;
    const well=.36*bedFactor(z)*(1-smooth(.61,.83,u));
    return top-shoulder-crown-well;
  }
  function archBottom(z) {
    let bottom=1.065;
    // A real rising wheel-arch cutout, instead of floating arch decorations.
    for(const wheelZ of [-1.04,1.08]){
      const dz=z-wheelZ;
      const radius=.875;
      if(Math.abs(dz)<radius){
        const opening=.70+Math.sqrt(radius*radius-dz*dz);
        bottom=Math.max(bottom,opening);
      }
    }
    return bottom;
  }
  function makePaintedShell() {
    const vertices=[], faces=[];
    const nz=156, ntop=36, nside=9, nunder=12;
    // A circumferential loop at each z, joined into one indexed manifold.
    const rings=[];
    for(let iz=0;iz<=nz;iz++){
      const z=stations[0][0]+(stations[stations.length-1][0]-stations[0][0])*iz/nz;
      const {half}=profile(z);
      const ring=[];
      for(let j=0;j<=ntop;j++){
        const x=half*(-1+2*j/ntop);
        ring.push([x,skinTop(z,x),z]);
      }
      const rimY=skinTop(z,half);
      const bottom=archBottom(z);
      for(let j=1;j<=nside;j++){
        const t=j/nside;
        ring.push([half-.045*smooth(0,1,t),rimY+(bottom-rimY)*t,z]);
      }
      const underHalf=half-.045;
      for(let j=1;j<=nunder;j++){
        const t=j/nunder;
        ring.push([underHalf*(1-2*t),bottom-.12*Math.sin(Math.PI*t),z]);
      }
      const leftTop=skinTop(z,-half);
      for(let j=1;j<nside;j++){
        const t=j/nside;
        ring.push([-half+.045*(1-t),bottom+(leftTop-bottom)*t,z]);
      }
      rings.push(ring);
      for(const v of ring)vertices.push(...v);
    }
    const perRing=rings[0].length;
    for(let z=0;z<nz;z++){
      for(let j=0;j<perRing;j++){
        const k=(j+1)%perRing;
        const a=z*perRing+j, b=z*perRing+k;
        const c=(z+1)*perRing+j,d=(z+1)*perRing+k;
        faces.push(a,b,c,b,d,c);
      }
    }
    // The shell also closes at the grille and tail: no loose panels.
    for(const end of [0,nz]){
      const ring=rings[end];
      const p=vertices.length/3;
      vertices.push(0,1.22,ring[0][2]);
      for(let j=0;j<perRing;j++){
        const a=end*perRing+j;
        const b=end*perRing+(j+1)%perRing;
        if(end===0)faces.push(p,b,a);
        else faces.push(p,a,b);
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setIndex(faces);
    g.computeVertexNormals();
    const shell=new THREE.Mesh(g,palette.paint);
    shell.name='One-piece painted body shell';
    shell.castShadow=true;
    shell.receiveShadow=true;
    truck.add(shell);
    truck.userData.bodyShell=shell;
  }
  makePaintedShell();

  // Flush glazing follows the curved body surface — no stacked window boxes.
  function patch(material, vertices, indices, name) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m=new THREE.Mesh(g,material);
    m.name=name;
    truck.add(m);
    return m;
  }
  function roofGlass(z0,z1,halfWidth,material,name) {
    const verts=[],indices=[];
    const rows=18,columns=18;
    for(let r=0;r<=rows;r++){
      const f=r/rows;
      const z=z0+(z1-z0)*f;
      const width=halfWidth*(1-.055*Math.pow(Math.abs(2*f-1),6));
      for(let j=0;j<=columns;j++){
        const x=width*(2*j/columns-1);
        verts.push(x,skinTop(z,x)+.014,z);
      }
    }
    for(let r=0;r<rows;r++){
      for(let j=0;j<columns;j++){
        const a=r*(columns+1)+j,b=a+1,c=a+columns+1,d=c+1;
        indices.push(a,b,c,b,d,c);
      }
    }
    return patch(material,verts,indices,name);
  }
  roofGlass(.45,.815,.70,palette.glass,'Curved flush windshield');
  roofGlass(-.715,-.515,.65,palette.glass,'Curved flush rear glass');
  roofGlass(.52,.64,.13,palette.reflection,'Windshield light reflection');

  function sideWindow(side, path, name) {
    const verts=[],idx=[];
    const divisions=6;
    for(let i=0;i<path.length;i++){
      const [z,y]=path[i];
      const x=side*(profile(z).half+.012);
      verts.push(x,y,z);
    }
    for(let i=1;i<path.length-1;i++)idx.push(0,i,i+1);
    return patch(palette.glass,verts,idx,name);
  }
  for(const side of [-1,1]){
    sideWindow(side,[
      [.41,1.93],[.37,2.23],[.27,2.315],[-.20,2.315],
      [-.18,1.92]
    ],'Front side window');
    sideWindow(side,[
      [-.27,1.92],[-.28,2.315],[-.43,2.305],[-.66,1.94]
    ],'Rear quarter window');
    // Slender body-colour B pillar and simple integrated door hardware.
    rod(truck,[side*.855,1.91,-.225],[side*.855,2.33,-.225],.026,palette.darker,6);
    rod(truck,[side*.911,1.77,-.55],[side*.905,1.77,.43],.015,palette.darker,6);
    sphere(truck,palette.charcoal,side*.966,1.82,.52,.14,.10,.15);
    sphere(truck,palette.glass,side*1.046,1.83,.52,.145,.09,.11);
    sphere(truck,palette.metal,side*.957,1.58,-.16,.035,.025,.125);
    // Deep dark inner fender behind the actual tire: this recess catches
    // the bodywork/tyre occlusion visible in the photographic reference.
    // It is sunk INSIDE the shell, not layered over the wheel.
    for(const axle of [-1.04,1.08]){
      const cavity=new THREE.Mesh(
        new THREE.CircleGeometry(.835,36),
        new THREE.MeshStandardMaterial({
          color:'#141b1b',roughness:1,
          side:THREE.DoubleSide
        })
      );
      cavity.rotation.y=Math.PI/2;
      cavity.position.set(side*.877,.715,axle);
      cavity.receiveShadow=true;
      truck.add(cavity);

      const points=[];
      for(let j=0;j<=23;j++){
        const z=axle-.875+1.75*j/23;
        points.push([
          side*(profile(z).half+.018),
          archBottom(z)+.02,
          z
        ]);
      }
      tube(truck,points,.048,palette.rubber,40);
    }
  }
  // A sculpted depression in the one-piece body creates an actual open-bed
  // silhouette. This liner and the shallow strengthening ribs are detailing,
  // not boxes used to fake the sides of the pickup.
  function bedLiner(){
    const verts=[],indices=[],rows=23,cols=16;
    for(let r=0;r<=rows;r++){
      const z=-1.91+r/rows*.88;
      for(let i=0;i<=cols;i++){
        const x=-.58+i/cols*1.16;
        verts.push(x,skinTop(z,x)+.016,z);
      }
    }
    for(let r=0;r<rows;r++){
      for(let i=0;i<cols;i++){
        const a=r*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;
        indices.push(a,b,c,b,d,c);
      }
    }
    patch(palette.charcoal,verts,indices,'Inset pickup-bed liner');
    for(let i=-3;i<=3;i++){
      const x=i*.158;
      const points=[];
      for(let j=0;j<=12;j++){
        const z=-1.86+j*.064;
        points.push([x,skinTop(z,x)+.028,z]);
      }
      tube(truck,points,.012,palette.rubber,17);
    }
  }
  bedLiner();

  // Grille and lights are inlaid into the body; these alone remain separate.
  // The front shell has a tapered rounded nose, so lamps are scaled ovals.
  sphere(truck,palette.grille,0,1.405,2.174,.62,.15,.034);
  for(let i=-2;i<=2;i++){
    rod(truck,[i*.17,1.325,2.207],[i*.17,1.48,2.207],.014,palette.metal,6);
  }
  for(const side of [-1,1]){
    sphere(truck,palette.light,side*.62,1.49,2.135,.23,.125,.052);
    sphere(truck,palette.amber,side*.834,1.46,2.08,.065,.095,.045);
    sphere(truck,palette.brake,side*.72,1.45,-2.122,.17,.12,.047);
  }
  // A rounded bumper rather than the previous square-ended separate box.
  const bumperFront=tube(truck,[
    [-.96,1.10,2.22],[-.74,1.075,2.28],[0,1.06,2.34],
    [.74,1.075,2.28],[.96,1.10,2.22]
  ],.105,palette.charcoal,36);
  bumperFront.name='Front impact bar';
  tube(truck,[
    [-.93,1.095,-2.20],[0,1.075,-2.26],[.93,1.095,-2.20]
  ],.09,palette.charcoal,24);

  // Lifted RC chassis. These are visible mechanical parts, not shell pieces.
  box(truck,palette.chassis,0,.85,.02,1.34,.27,3.2);
  box(truck,palette.chassis,0,.72,.02,1.04,.22,2.85);
  for(const side of [-1,1]){
    rod(truck,[side*.46,.73,-1.44],[side*.46,.73,1.45],.074,palette.metal);
  }
  for(const wheelZ of [-1.04,1.08]){
    cylinder(truck,palette.chassis,0,.68,wheelZ,.11,.11,2.03,12,'x');
    cylinder(truck,palette.charcoal,0,.67,wheelZ,.27,.27,.4,12,'x');
    for(const side of [-1,1]){
      rod(truck,[side*.32,.84,wheelZ-.18],[side*.84,.64,wheelZ],.06,palette.metal);
      rod(truck,[side*.32,.84,wheelZ+.18],[side*.84,.64,wheelZ],.06,palette.metal);
      rod(truck,[side*.65,.99,wheelZ-.13],[side*.89,.58,wheelZ+.08],.075,palette.charcoal);
      const shock=cylinder(truck,palette.metal,side*.69,.82,wheelZ,.12,.12,.31,8);
      shock.rotation.z=side*.35;
    }
  }

  const wheels=[];
  function wheel(x,z,side) {
    const g=new THREE.Group();
    g.name='Deep knobby off-road wheel';
    g.position.set(x,.71,z);
    truck.add(g);
    wheels.push(g);
    cylinder(g,palette.tire,0,0,0,.75,.75,.58,36,'x');
    // Tire tread lugs use instancing to stay fast on phones.
    const treadGeo=new THREE.BoxGeometry(.195,.12,.27);
    const lugs=new THREE.InstancedMesh(treadGeo,palette.tread,27*3);
    const temp=new THREE.Object3D();
    let index=0;
    for(let i=0;i<27;i++){
      const angle=i/27*Math.PI*2;
      for(let band=-1;band<=1;band++){
        temp.position.set(band*.186,Math.sin(angle)*.756,Math.cos(angle)*.756);
        temp.rotation.set(angle,band*.13,0);
        temp.updateMatrix();
        lugs.setMatrixAt(index++,temp.matrix);
      }
    }
    lugs.instanceMatrix.needsUpdate=true;
    lugs.castShadow=true;
    g.add(lugs);
    // Dish-like wheels: thick black sidewalls, alloy center and visible lug nuts.
    cylinder(g,palette.rubber,side*.302,0,0,.69,.69,.066,32,'x');
    const rimRing=new THREE.Mesh(new THREE.TorusGeometry(.44,.073,8,32),palette.charcoal);
    rimRing.position.x=side*.353;rimRing.rotation.y=Math.PI/2;g.add(rimRing);
    cylinder(g,palette.metal,side*.376,0,0,.36,.36,.064,24,'x');
    cylinder(g,palette.charcoal,side*.415,0,0,.245,.245,.07,12,'x');
    for(let n=0;n<6;n++){
      const a=n*Math.PI/3;
      cylinder(g,palette.metal,side*.462,Math.sin(a)*.19,Math.cos(a)*.19,
        .043,.043,.025,7,'x');
    }
    cylinder(g,palette.metal,side*.474,0,0,.085,.085,.055,10,'x');
    return g;
  }
  for(const z of [-1.04,1.08]){
    wheel(-1.04,z,-1);
    wheel(1.04,z,1);
  }

  truck.userData.wheels=wheels;
  truck.userData.palette=palette;
  truck.userData.paintMaterial=palette.paint;
  truck.userData.paintMaterials=[palette.paint,palette.darker,palette.highlight];
  truck.userData.height=2.55;
  truck.userData.length=4.45;
  truck.userData.width=2.85;
  truck.userData.setPaint=(hex)=>{
    const newColor=new THREE.Color(hex);
    palette.paint.color.copy(newColor);
    palette.darker.color.copy(newColor).multiplyScalar(.78);
    palette.highlight.color.copy(newColor).multiplyScalar(1.10);
  };
  return truck;
}
