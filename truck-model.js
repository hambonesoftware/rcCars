/**
 * Micro Mayhem - RC mini monster truck.
 * Procedural Three.js model based on the user's four-truck racing reference:
 * squat single-cab pickup, functional open bed, big knobby tires, raised chassis.
 * This is real geometry, not a billboard / sprite / generated image.
 *
 * +Z = forward; X = width; Y = up.
 */
export function makeRCTrophyTruck(THREE, paint = '#ebcb40') {
  const car = new THREE.Group();
  car.name = 'Micro Mayhem / Short Bed Monster Truck';

  const c = {
    paint: new THREE.MeshPhysicalMaterial({color:paint, metalness:.22, roughness:.36, clearcoat:1, clearcoatRoughness:.23}),
    darker: new THREE.MeshStandardMaterial({color: new THREE.Color(paint).multiplyScalar(.76), metalness:.15, roughness:.58}),
    highlight: new THREE.MeshStandardMaterial({color: new THREE.Color(paint).multiplyScalar(1.12), metalness:.25, roughness:.31}),
    trim: new THREE.MeshStandardMaterial({color:'#22292b', roughness:.78}),
    chassis: new THREE.MeshStandardMaterial({color:'#353737', metalness:.42, roughness:.62}),
    glass: new THREE.MeshPhysicalMaterial({color:'#203a45',metalness:.08,roughness:.18,clearcoat:1,clearcoatRoughness:.08}),
    glassShine: new THREE.MeshBasicMaterial({color:'#8aa8aa',transparent:true,opacity:.29,depthWrite:false}),
    rubber: new THREE.MeshStandardMaterial({color:'#252321',roughness:1}),
    tread: new THREE.MeshStandardMaterial({color:'#3c3831',roughness:1}),
    mud: new THREE.MeshStandardMaterial({color:'#796c50',roughness:1}),
    rim: new THREE.MeshStandardMaterial({color:'#8c9090',metalness:.74,roughness:.34}),
    rimDark: new THREE.MeshStandardMaterial({color:'#363b3c',metalness:.54,roughness:.5}),
    light: new THREE.MeshStandardMaterial({color:'#f5ead1',emissive:'#aea177',emissiveIntensity:.17,roughness:.22}),
    orange: new THREE.MeshStandardMaterial({color:'#efae62',roughness:.35}),
    red: new THREE.MeshStandardMaterial({color:'#c7443c',roughness:.35}),
    silver: new THREE.MeshStandardMaterial({color:'#a3acaf',metalness:.74,roughness:.33}),
  };
  const boxGeo = new THREE.BoxGeometry(1,1,1);
  function box(parent,material,x,y,z,w,h,d) {
    const m = new THREE.Mesh(boxGeo, material);
    m.position.set(x,y,z);
    m.scale.set(w,h,d);
    m.castShadow=true;
    m.receiveShadow=true;
    parent.add(m);
    return m;
  }
  function torus(parent,material,x,y,z,r,t,axis='z'){
    const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,7,30),material);
    o.position.set(x,y,z);
    if(axis==='x')o.rotation.y=Math.PI/2;
    o.castShadow=true;
    parent.add(o);
    return o;
  }
  function cylinder(parent,material,x,y,z,r1,r2,h,segments=14,axis='y'){
    const obj=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);
    obj.position.set(x,y,z);
    if(axis==='x')obj.rotation.z=Math.PI/2;
    if(axis==='z')obj.rotation.x=Math.PI/2;
    obj.castShadow=true;
    obj.receiveShadow=true;
    parent.add(obj);
    return obj;
  }
  function link(parent,a,b,r,material){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
    const vector=end.clone().sub(start);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,vector.length(),7),material);
    m.position.copy(start.clone().add(end).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());
    m.castShadow=true;
    parent.add(m);
    return m;
  }
  // Painted side panels: layer geometry so bodywork reads as one pickup.
  box(car,c.chassis,0,.94,0,1.33,.21,3.65);
  box(car,c.chassis,0,.73,0,1.12,.22,2.74);
  for (const side of [-1,1]){
    box(car,c.chassis,side*.51,.69,0,.12,.27,3.45);
    box(car,c.chassis,side*.62,.88,0,.14,.16,2.8);
  }
  // Axles and dark under-truck mechanical shapes.
  for(const z of [-1.05,1.08]){
    cylinder(car,c.chassis,0,.67,z,.12,.12,2.0,10,'x');
    cylinder(car,c.chassis,0,.73,z,.31,.31,.33,12,'x');
    for(const side of [-1,1]){
      link(car,[side*.33,.85,z-.22],[side*.88,.63,z],.065,c.silver);
      link(car,[side*.33,.82,z+.22],[side*.88,.63,z],.065,c.silver);
      link(car,[side*.62,.99,z-.11],[side*.89,.57,z+.09],.09,c.chassis);
      const spring=cylinder(car,c.silver,side*.72,.85,z,.13,.13,.37,9);
      spring.rotation.z=side*.47;
    }
  }
  // Deliberately large exposed 4x4 tires. Diameter ~1.52 versus 3.9 length.
  const wheels=[];
  function makeWheel(x,z,side){
    const tireRoot=new THREE.Group();
    tireRoot.position.set(x,.72,z);
    car.add(tireRoot);
    wheels.push(tireRoot);
    const tire=cylinder(tireRoot,c.rubber,0,0,0,.73,.73,.56,28,'x');
    tire.rotation.x=.06;
    // Deep chunky lugs around the circumference, staggered to read in overhead view.
    const treadGeometry=new THREE.BoxGeometry(.195,.16,.31);
    const lugs=new THREE.InstancedMesh(treadGeometry,c.tread,24*3);
    const treadMatrix=new THREE.Object3D();
    let treadIndex=0;
    for(let i=0;i<24;i++){
      const angle=(i/24)*Math.PI*2;
      for(let band=-1;band<=1;band++){
        treadMatrix.position.set(band*.18,Math.sin(angle)*.735,Math.cos(angle)*.735);
        treadMatrix.rotation.set(angle,band*.1,0);
        treadMatrix.updateMatrix();
        lugs.setMatrixAt(treadIndex++,treadMatrix.matrix);
      }
    }
    lugs.instanceMatrix.needsUpdate=true;
    lugs.castShadow=true;
    tireRoot.add(lugs);
    // Tire sidewalls and thick metal rims on the visible outward side.
    const outside=side*.305;
    cylinder(tireRoot,c.rubber,outside,0,0,.66,.66,.075,28,'x');
    torus(tireRoot,c.rimDark,side*.359,0,0,.41,.075,'x');
    cylinder(tireRoot,c.rim,side*.372,0,0,.32,.32,.06,14,'x');
    cylinder(tireRoot,c.rimDark,side*.414,0,0,.235,.235,.065,10,'x');
    for(let n=0;n<6;n++){
      const a=n*Math.PI/3;
      cylinder(tireRoot,c.rim,side*.455,Math.sin(a)*.19,Math.cos(a)*.19,
        .055,.055,.017,7,'x');
    }
    cylinder(tireRoot,c.silver,side*.476,0,0,.075,.075,.035,9,'x');
    // Outboard sidewall ring makes the wheel substantial at camera height.
    torus(tireRoot,c.rubber,side*.334,0,0,.575,.11,'x');
    return tireRoot;
  }
  // Wheels below body, spaced wide like the reference.
  for(const z of [-1.05,1.08]){
    makeWheel(-1.01,z,-1);
    makeWheel(1.01,z,1);
  }
  // Main body: short snub nose at +Z and squared pickup bed to the rear.
  box(car,c.paint,0,1.44,.89,1.91,.37,1.76);
  const bonnet=box(car,c.highlight,0,1.665,1.28,1.86,.06,.82);
  bonnet.rotation.x=-.045;
  box(car,c.paint,0,1.37,1.80,1.92,.39,.21);
  // Raised grille, bumpers and front protective details.
  box(car,c.trim,0,1.36,1.916,1.30,.32,.074);
  for(let j=0;j<6;j++)box(car,c.silver,-.5+j*.2,1.34,1.962,.067,.2,.037);
  for(const side of [-1,1]){
    box(car,c.light,side*.76,1.50,1.924,.34,.20,.055);
    box(car,c.orange,side*.93,1.44,1.93,.07,.15,.05);
  }
  box(car,c.chassis,0,1.05,1.99,2.14,.17,.24);
  box(car,c.silver,0,.96,1.982,1.35,.12,.13);

  // Cab: a solid, slanted single-cab profile, carefully shaped in actual 3D.
  const contour=[
    [-.80,1.62],[.94,1.62],[.49,2.48],[-.43,2.48]
  ]; // [z,y]
  const verts=[],faces=[];
  for(const x of [-.82,.82]){
    for(const [z,y] of contour)verts.push(x,y,z);
  }
  for(let i=1;i<3;i++)faces.push(0,i,i+1);
  for(let i=1;i<3;i++)faces.push(4,4+i+1,4+i);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    faces.push(i,j,j+4,i,j+4,i+4);
  }
  const shape=new THREE.BufferGeometry();
  shape.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  shape.setIndex(faces);shape.computeVertexNormals();
  const cab=new THREE.Mesh(shape,c.paint);
  cab.castShadow=true;cab.receiveShadow=true;car.add(cab);
  box(car,c.highlight,0,2.51,.025,1.75,.105,1.07);
  // Actual side window polygons with front and quarter windows.
  function flatQuad(points, material) {
    const g=new THREE.BufferGeometry();
    const pointsFlat=[];
    for(const p of points)pointsFlat.push(...p);
    g.setAttribute('position',new THREE.Float32BufferAttribute(pointsFlat,3));
    g.setIndex([0,1,2,0,2,3]);
    g.computeVertexNormals();
    const mm=material.clone();mm.side=THREE.DoubleSide;
    const mesh=new THREE.Mesh(g,mm);car.add(mesh);return mesh;
  }
  for(const side of [-1,1]){
    const x=side*.836;
    // Cab side windows separated by an actual B-pillar.
    flatQuad([[x,1.82,.50],[x,2.34,.35],[x,2.34,-.16],[x,1.84,-.14]],c.glass);
    flatQuad([[x,1.83,-.21],[x,2.34,-.23],[x,2.34,-.34],[x,1.84,-.56]],c.glass);
    // Thick window beltline, door crease, handle and side mirror.
    box(car,c.darker,side*.845,1.75,-.08,.04,.055,1.17);
    box(car,c.trim,side*.857,1.77,-.48,.05,.065,.22);
    box(car,c.chassis,side*.90,2.02,.77,.25,.16,.22);
    box(car,c.trim,side*1.02,2.02,.78,.29,.24,.18);
    box(car,c.silver,side*.87,1.45,.05,.045,.064,.33);
    // Front and rear rounded-over fenders, rendered as exposed black arch lips.
    for(const z of [-1.05,1.08]){
      const points=[];
      for(let i=0;i<=18;i++){
        const a=i*Math.PI/18;
        points.push(new THREE.Vector3(side*.967,.72+.81*Math.sin(a),z+.81*Math.cos(a)));
      }
      const curve=new THREE.CatmullRomCurve3(points);
      const arch=new THREE.Mesh(new THREE.TubeGeometry(curve,30,.075,5,false),c.trim);
      arch.castShadow=true;car.add(arch);
    }
    // Door seam - discreet and not cartoonish.
    box(car,c.darker,side*.856,1.36,.39,.024,.41,.025);
  }
  // Windshield as an angled solid plane with narrow central reflection.
  flatQuad([[-.76,1.76,.916],[.76,1.76,.916],[.73,2.395,.455],[-.73,2.395,.455]],c.glass);
  flatQuad([[-.60,2.36,.477],[-.25,2.36,.477],[-.31,1.88,.815],[-.66,1.88,.815]],c.glassShine);
  // Rear glass slightly above open cargo bed.
  flatQuad([[-.69,1.85,-.761],[.69,1.85,-.761],[.70,2.36,-.433],[-.70,2.36,-.433]],c.glass);
  // Open pickup bed: black textured floor and painted sidewalls / tailgate.
  box(car,c.trim,0,1.28,-1.3,1.60,.085,1.28);
  for(let i=-3;i<=3;i++)box(car,c.chassis,i*.22,1.34,-1.29,.044,.035,1.12);
  for(const side of [-1,1]){
    box(car,c.paint,side*.83,1.50,-1.35,.24,.47,1.35);
    box(car,c.highlight,side*.83,1.76,-1.36,.26,.07,1.35);
    box(car,c.darker,side*.69,1.48,-1.39,.05,.28,1.2);
  }
  box(car,c.paint,0,1.52,-2.01,1.91,.42,.22);
  box(car,c.highlight,0,1.76,-2.005,1.91,.07,.25);
  for(const side of [-1,1]){
    box(car,c.red,side*.82,1.53,-2.149,.25,.24,.045);
    box(car,c.chassis,side*.78,1.27,-2.21,.44,.10,.16);
  }
  box(car,c.chassis,0,1.08,-2.23,2.12,.18,.21);
  box(car,c.silver,0,.96,-2.26,1.1,.14,.16);
  // Raised door shell and chunky bed corners.
  for(const side of [-1,1]){
    box(car,c.paint,side*.75,1.45,.17,.29,.40,.80);
    box(car,c.highlight,side*.83,1.67,1.16,.13,.095,.83);
    box(car,c.paint,side*.8,1.38,-.85,.27,.35,.54);
  }
  car.userData.wheels=wheels;
  car.userData.paintMaterial=c.paint;
  car.userData.paintMaterials=[c.paint,c.darker,c.highlight];
  car.userData.palette=c;
  car.userData.height=2.6;
  car.userData.length=4.4;
  car.userData.width=2.8;
  car.userData.setPaint=(hex)=>{
    const base=new THREE.Color(hex);
    c.paint.color.copy(base);
    c.darker.color.copy(base).multiplyScalar(.76);
    c.highlight.color.copy(base).multiplyScalar(1.12);
  };
  return car;
}
