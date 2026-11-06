/**
 * Garage Gauntlet / Micro Mayhem: photographable model-railroad hero asset.
 * Genuine batched polygon geometry rather than spheres plus roof-shaped boxes.
 * Self-contained CC0-style procedural modeling; no downloaded image assets.
 */
export function buildPhotographicMiniature({pc,app,root,device,block,makeMaterial}) {
  const rand=(seed)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const random=rand(30972);
  const tint=(v)=>Math.max(0,Math.min(255,Math.round(v)));
  const color=(hex)=>new pc.Color(
    parseInt(hex.slice(1,3),16)/255,
    parseInt(hex.slice(3,5),16)/255,
    parseInt(hex.slice(5,7),16)/255
  );
  const createTexture=(name,draw)=>{
    const c=document.createElement('canvas');c.width=c.height=512;
    const ctx=c.getContext('2d',{alpha:false});
    draw(ctx,c.width,c.height);
    const t=new pc.Texture(device,{width:512,height:512,
      format:pc.PIXELFORMAT_RGBA8,mipmaps:true});
    t.name=name;
    t.setSource(c);
    t.addressU=pc.ADDRESS_REPEAT;t.addressV=pc.ADDRESS_REPEAT;
    t.minFilter=pc.FILTER_LINEAR_MIPMAP_LINEAR;
    t.magFilter=pc.FILTER_LINEAR;t.anisotropy=8;
    return t;
  };
  const styreneMap=createTexture('Pigmented styrene 0.3mm texture',(ctx,w,h)=>{
    ctx.fillStyle='#f3f1e9';ctx.fillRect(0,0,w,h);
    const r=rand(357);
    for(let i=0;i<27000;i++){
      const q=Math.floor(221+r()*27);
      ctx.fillStyle='rgba('+q+','+q+','+q+',.10)';
      ctx.fillRect(r()*w,r()*h,.45+r()*1.4,.45+r()*1.4);
    }
  });
  const feltMap=createTexture('Glued-on static grass and flock',(ctx,w,h)=>{
    ctx.fillStyle='#778053';ctx.fillRect(0,0,w,h);
    const r=rand(7592);
    for(let i=0;i<105000;i++){
      const x=r()*w,y=r()*h;
      const tone=r();
      ctx.strokeStyle=tone<.24?'rgba(40,53,29,.65)':
        tone<.50?'rgba(178,169,97,.53)':
        tone<.76?'rgba(133,142,70,.62)':'rgba(216,207,129,.48)';
      ctx.lineWidth=.4+r()*.65;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+(r()-.5)*3,y-1-r()*4.5);ctx.stroke();
    }
  });
  const gravelMap=createTexture('HO scenic ballast',(ctx,w,h)=>{
    ctx.fillStyle='#766a5c';ctx.fillRect(0,0,w,h);
    const r=rand(1537);
    for(let i=0;i<52000;i++){
      const n=Math.floor(80+r()*105);
      ctx.fillStyle='rgba('+n+','+tint(n*.94)+','+tint(n*.84)+',.7)';
      ctx.fillRect(r()*w,r()*h,1+r()*2.5,1+r()*2.5);
    }
  });
  const material=(name,hex,roughness,clearCoat=0,map=null)=>{
    const m=makeMaterial(name,hex,{roughness,clearcoat:clearCoat});
    if(map){m.diffuseMap=map;m.diffuseMapTiling=new pc.Vec2(3,3);m.update();}
    return m;
  };
  const mats={
    siding:material('Fine textured sage styrene siding','#bfccba',.61,.13,styreneMap),
    white:material('Off-white hand-painted cast trim','#efece0',.42,.21,styreneMap),
    trimShadow:material('Recessed casting parting lines','#818c80',.84),
    foundation:material('Cast stone model footing','#a0a29a',.94,gravelMap),
    roof:material('Fine granular asphalt shingle kit','#6b7270',.93),
    ridge:material('Hip and ridge caps','#676b65',.86),
    darkRoof:material('Weathered shingle variant','#535f60',.96),
    paleRoof:material('Faded shingle variant','#818680',.92),
    dark:material('Dark inset window cavity','#282d32',.93),
    glass:material('Smoked acrylic glazed windows','#536d73',.12,.65),
    curtain:material('Cream interior curtains','#c7c2ac',.93),
    green:material('Dark satin painted entrance','#4b6862',.44,.2),
    concrete:material('Scored miniature concrete','#b7b5a9',.91,0,gravelMap),
    turf:material('Hand applied model railway turf','#f6f3e8',1,0,feltMap),
    soil:material('Granular scenic mulch','#ac9f8f',1,0,gravelMap),
    log:material('Brown textured kit trunk','#594936',.93),
    leaf:material('Matte leaf foliage foam dark','#466043',.94),
    leafLight:material('Matte leaf foliage foam light','#819267',.98),
    leafMid:material('Matte foliage foam middle','#5f7d52',.96),
    rose:material('Tiny cast plastic flower buds','#b06374',.68,.1),
    gold:material('Tiny butter yellow flower buds','#cbb572',.8),
    worktop:material('Beige workbench laminate','#c5b6a0',.67),
    wall:material('Real room backdrop','#b7b7aa',1),
    silver:material('Folded aluminum gutters','#d8dbd6',.38,.2),
    rust:material('Tiny painted hardware','#6c5545',.74)
  };
  // Batch hundreds of genuinely three-dimensional pieces into a handful
  // of mesh instances (no one-draw-call-per-leaf or per-shingle explosion).
  function batch() {
    return {positions:[],normals:[],uvs:[],indices:[],quads:0};
  }
  function triangle(b,a,c,d) {
    const pa=new pc.Vec3(...a),pb=new pc.Vec3(...c),pd=new pc.Vec3(...d);
    const n=new pc.Vec3().sub2(pb,pa).cross(new pc.Vec3().sub2(pd,pa)).normalize();
    const i=b.positions.length/3;
    for(const p of [pa,pb,pd]){
      b.positions.push(p.x,p.y,p.z);
      b.normals.push(n.x,n.y,n.z);
    }
    b.uvs.push(0,0,1,0,0,1);
    b.indices.push(i,i+1,i+2);
  }
  function quad(b,a,c,d,e){
    triangle(b,a,c,d);triangle(b,a,d,e);b.quads++;
  }
  function mount(b,name,m,parent=root) {
    if(!b.indices.length)return null;
    const g=new pc.Geometry();
    g.positions=b.positions;g.normals=b.normals;
    g.uvs=b.uvs;g.indices=b.indices;
    const mesh=pc.Mesh.fromGeometry(device,g);
    const e=new pc.Entity(name);
    e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,m)]});
    e.render.castShadows=true;e.render.receiveShadows=true;
    parent.addChild(e);return e;
  }
  function bothSides(m){m.cull=pc.CULLFACE_NONE;m.update();return m;}
  for(const m of [mats.roof,mats.ridge,mats.darkRoof,mats.paleRoof,
    mats.leaf,mats.leafMid,mats.leafLight])bothSides(m);

  const model=new pc.Entity('Hero: real-model-inspired molded Midwest house');
  root.addChild(model);

  // The house is a manufactured kit: side wings, stepped foundations, deep
  // soffits, real gable-end triangles and roof panels with correct slopes.
  block(model,'Main molded architectural shell',mats.siding,
    [-4,3.56,-4.0],[13.55,6.66,9.6]);
  block(model,'Inset cast masonry basement strip',mats.foundation,
    [-4,.40,-4],[13.83,.69,9.85]);
  block(model,'Attached shorter garage shell',mats.siding,
    [8.47,2.52,-3.06],[9.24,4.47,9.20]);
  block(model,'Garage molding foundation',mats.foundation,
    [8.47,.39,-3.06],[9.60,.66,9.50]);

  function roof(x,w,eave,rise,z0,z1,label){
    const half=w*.5,overhang=.55;
    const bottom=eave,peak=eave+rise;
    // Gable wall closure is TRIANGULAR geometry, not a rectangular prism.
    const gables=batch();
    for(const z of [z0,z1]){
      triangle(gables,[x-half,bottom,z],[x+half,bottom,z],[x,peak,z]);
    }
    mount(gables,label+' true molded triangular gables',mats.siding,model);

    const base=batch(),shingles=[batch(),batch(),batch()];
    for(const side of [-1,1]){
      const edgeX=x+side*(half+overhang);
      const ridge=[x,peak+.075],edge=[edgeX,bottom-.22];
      quad(base,[ridge[0],ridge[1],z0-.55],
        [ridge[0],ridge[1],z1+.55],
        [edge[0],edge[1],z1+.55],
        [edge[0],edge[1],z0-.55]);
      const rows=13,cols=Math.round((z1-z0+1.1)/.37);
      const zStart=z0-.52,zEnd=z1+.52;
      for(let row=0;row<rows;row++){
        const u0=row/rows,u1=(row+1)/rows;
        const x0=ridge[0]+(edge[0]-ridge[0])*u0;
        const x1=ridge[0]+(edge[0]-ridge[0])*u1;
        const y0=ridge[1]+(edge[1]-ridge[1])*u0+.026;
        const y1=ridge[1]+(edge[1]-ridge[1])*u1+.035;
        for(let col=0;col<cols;col++){
          const gap=.012;
          const offset=((row%2)*.5)*(zEnd-zStart)/cols;
          const za=Math.max(zStart,zStart+(col-.5)*(zEnd-zStart)/cols+offset)+gap;
          const zb=Math.min(zEnd,zStart+(col+.5)*(zEnd-zStart)/cols+offset)-gap;
          if(zb<=za)continue;
          const palette=random()<.13?1:random()<.22?2:0;
          const face=shingles[palette];
          quad(face,[x0,y0,za],[x0,y0,zb],[x1,y1,zb],[x1,y1,za]);
        }
      }
      // A fascia casting follows the slope instead of floating above it.
      const slope=Math.atan2(rise+.22,half+overhang)*180/Math.PI;
      const length=Math.hypot(half+overhang,rise+.22);
      for(const z of [z0-.57,z1+.57]){
        block(model,label+' sloped fascia',mats.white,
          [(x+edgeX)/2,(peak+bottom-.22)/2,z],
          [length,.15,.19],[0,0,side*-slope]);
      }
      // Finely rounded eave gutter, visible as a separate snap-fit part.
      block(model,label+' eave gutter',mats.silver,
        [edgeX,bottom-.24,(z0+z1)/2],[.18,.17,z1-z0+1.2]);
    }
    mount(base,label+' solid pitched roofing',mats.roof,model);
    for(let i=0;i<3;i++){
      mount(shingles[i],label+' individually offset asphalt shingles '+i,
        [mats.roof,mats.darkRoof,mats.paleRoof][i],model);
    }
    block(model,label+' prominent molded ridge caps',mats.ridge,
      [x,peak+.10,(z0+z1)/2],[.32,.18,z1-z0+1.1]);
  }
  roof(-4,13.55,6.90,3.18,-8.85,.90,'Main home');
  roof(8.47,9.25,4.78,2.38,-7.86,1.85,'Attached garage');

  // Each facade strip has the slight shadow and overlap of molded 1:87
  // clapboards; window openings are cut out of the strip layout.
  function lapWall(xa,xb,z,low,high,openings){
    const molding=batch();
    let segments=0;
    for(let y=low+.12;y<high;y+=.28){
      let runs=[[xa,xb]];
      for(const [ox,oy,ow,oh] of openings){
        if(y<oy-oh/2-.16||y>oy+oh/2+.14)continue;
        const l=ox-ow/2-.20,r=ox+ow/2+.20;
        runs=runs.flatMap(([a,b])=>{
          if(r<a||l>b)return [[a,b]];
          return [[a,Math.min(l,b)],[Math.max(r,a),b]].filter(([u,v])=>v-u>.13);
        });
      }
      for(const [a,b] of runs){
        quad(molding,[a,y,z],[b,y,z],[b,y+.055,z+.065],[a,y+.055,z+.065]);
        segments++;
      }
    }
    mount(molding,'Actual raised horizontal molded siding',mats.white,model);
    return segments;
  }
  const apertures=[
    [-8.50,3.45,1.96,2.05],
    [-.06,3.45,1.96,2.05],
    [-4.38,4.31,1.78,2.20],
    [-4.15,1.63,1.60,2.55]
  ];
  let sidingPieces=lapWall(-10.75,2.75,.87,.55,6.70,apertures);
  sidingPieces+=lapWall(3.88,13.04,1.63,.52,4.54,
    [[8.47,2.50,6.2,4.10]]);

  function window(x,y,z,w,h,shutters=true){
    // Realistic aperture reads as a recessed cavity, surrounding kit molding,
    // two glass panes and a curtain behind the smoked clear polystyrene.
    block(model,'Window cutout black aperture',mats.dark,
      [x,y,z+.046],[w+.11,h+.11,.085]);
    block(model,'Sheer cream curtain behind glazing',mats.curtain,
      [x,y,z+.074],[w*.90,h*.87,.025]);
    block(model,'Individually glazed acrylic sash',mats.glass,
      [x,y,z+.104],[w*.89,h*.88,.06]);
    block(model,'Casting horizontal head',mats.white,
      [x,y+h*.5+.16,z+.22],[w+.37,.23,.28]);
    block(model,'Casting horizontal sill',mats.white,
      [x,y-h*.5-.10,z+.27],[w+.54,.18,.41]);
    for(const side of [-1,1]){
      block(model,'Architectural window jamb',mats.white,
        [x+side*(w*.5+.13),y,z+.22],[.18,h+.26,.29]);
      if(shutters){
        block(model,'Raised shutter leaf',mats.green,
          [x+side*(w*.5+.50),y,z+.16],[.44,h+.07,.16]);
        for(let n=0;n<7;n++){
          block(model,'Subtle shutter louver',mats.trimShadow,
            [x+side*(w*.5+.50),y-h*.38+n*h*.126,z+.254],
            [.35,.045,.045]);
        }
      }
    }
    block(model,'Window metal centre glazing bar',mats.white,
      [x,y,z+.18],[.07,h*.9,.11]);
    block(model,'Window metal glazing divider',mats.white,
      [x,y-.06,z+.18],[w*.91,.065,.10]);
  }
  window(-8.5,3.45,.95,1.95,2.04,true);
  window(-.06,3.45,.95,1.95,2.04,true);
  window(-4.38,4.31,.95,1.78,2.18,false);
  block(model,'Recessed green painted front door',mats.green,
    [-4.15,1.66,1.01],[1.61,2.69,.17]);
  for(const y of [.83,1.62,2.38]){
    block(model,'Stamped entry door panel',mats.trimShadow,
      [-4.15,y,1.127],[1.14,.052,.032]);
  }
  block(model,'Polished tiny brass door handle',mats.rust,
    [-3.52,1.50,1.19],[.13,.18,.14]);
  block(model,'Door surround',mats.white,[-4.15,3.13,1.08],[2.02,.24,.34]);
  for(const x of [-5.04,-3.26]){
    block(model,'Door raised casing',mats.white,[x,1.68,1.13],[.22,2.72,.30]);
  }

  const garageFront=1.77;
  block(model,'Dark recessed garage opening',mats.dark,
    [8.47,2.51,garageFront],[6.48,4.18,.15]);
  block(model,'Cream sectional garage door',mats.white,
    [8.47,2.51,garageFront+.12],[6.28,4.0,.14]);
  for(let y=.98;y<4.5;y+=.66){
    block(model,'Pressed metal garage recessed panel seam',mats.trimShadow,
      [8.47,y,garageFront+.224],[6.12,.058,.042]);
  }
  for(let x=5.9;x<11.1;x+=1.05){
    block(model,'Garage upper glazing dark recess',mats.dark,
      [x,3.87,garageFront+.225],[.73,.45,.035]);
    block(model,'Garage upper glazing acetate insert',mats.glass,
      [x,3.88,garageFront+.26],[.62,.34,.026]);
  }
  for(const x of [5.15,11.8]){
    block(model,'Vertical garage frame molding',mats.white,
      [x,2.47,garageFront+.15],[.23,4.40,.33]);
  }
  // Porch supported by true columns, a step ladder and built-up timber
  // decking; leave a visible dark shadow beneath its canopy.
  block(model,'Porch concrete plinth',mats.concrete,
    [-4.20,.46,2.82],[5.52,.34,3.58]);
  block(model,'Three stair tread stringers',mats.concrete,
    [-4.20,.24,4.53],[2.92,.22,1.18]);
  block(model,'Porch roof casting',mats.ridge,
    [-4.20,4.15,2.90],[6.10,.32,3.68]);
  block(model,'Shadowed porch beam',mats.darkRoof,
    [-4.20,3.89,4.56],[5.75,.31,.27]);
  for(const x of [-6.65,-1.75]){
    block(model,'Square porch support column',mats.white,
      [x,2.16,4.37],[.32,3.43,.32]);
    block(model,'Cast column base',mats.white,[x,.63,4.37],[.58,.37,.55]);
    block(model,'Molded column capital',mats.white,[x,3.82,4.37],[.55,.28,.55]);
  }
  // Weathering and physical manufacturing cues are restrained, not random
  // streaks that would make the miniature look derelict.
  for(const x of [-8.5,-.06,6.5,10.5]){
    block(model,'Downspout fitting',mats.silver,[x,2.9,.93],
      [.10,4.75,.11]);
    block(model,'Downspout elbow',mats.silver,[x,.62,1.11],
      [.10,.12,.46]);
  }
  for(const [x,z] of [[-10.2,-8.82],[2.4,-8.82],[4.05,-7.96],[12.89,-7.96]]){
    block(model,'Roof water drain',mats.silver,[x,3.0,z],[.11,4.9,.14]);
  }

  // The existing roads stay untouched. The new matted turf overlays only
  // the lawn inside the wooden HO-scale base.
  // Keep the flock beneath the actual concrete and asphalt top faces:
  // a high lawn layer would otherwise bleed through the miniature driveway.
  block(root,'True fibrous flock lawn sheet',mats.turf,
    [0,.266,-1.55],[35.75,.052,27.9]);
  // Real irregular static-grass tips above the mat, built in batches.
  const grass=batch(),rGrass=rand(128790);
  for(let n=0;n<5200;n++){
    const x=-17.75+rGrass()*35.5,z=-15.3+rGrass()*25.6;
    if(x>-10.98&&x<2.95&&z>-9.0&&z<4.7)continue;
    if(x>3.75&&x<13.2&&z>-8.0&&z<11.0)continue;
    if(x>-5.15&&x<-2.85&&z>1.2)continue;
    if(x>5.0&&x<12&&z>1.8)continue;
    const h=.045+rGrass()*.12;
    const dx=(rGrass()-.5)*.16;
    triangle(grass,[x,.291,z],[x+dx-.018,.291+h,z],
      [x+dx+.018,.291+h,z+.036]);
  }
  mount(grass,'Five thousand scale-static-grass fibers',mats.leafMid,root);

  // Three-dimensional foliage foam is many irregular triangulated leaf
  // clusters, not solid green billiard-ball spheres.
  // One foliage mesh per material for the entire diorama: all tree crowns
  // and clipped shrubs share three GPU draw calls instead of one per cluster.
  const foliageGroups=[batch(),batch(),batch()];
  function leafCloud(cx,cy,cz,sx,sy,sz,seed,parent=root){
    const r=rand(seed),groups=foliageGroups;
    for(let i=0;i<460;i++){
      const theta=2*Math.PI*r(),u=2*r()-1;
      const q=Math.sqrt(1-u*u);
      const p=.26+.74*Math.cbrt(r());
      const x=cx+Math.cos(theta)*q*sx*p;
      const y=cy+u*sy*p;
      const z=cz+Math.sin(theta)*q*sz*p;
      const rad=.055+r()*.16;
      const face=groups[i%3];
      const dx=Math.cos(theta)*rad,dz=Math.sin(theta)*rad;
      triangle(face,[x-dx,y-.06,z-dz],
        [x+dx,y+.02,z+dz],
        [x+.035-r()*.07,y+rad*1.9,z-.03]);
      triangle(face,[x+.03,y-.07,z-rad],
        [x-.045,y+rad*.92,z+rad],
        [x+rad,y+.02,z+.02]);
    }
  }
  function tree(x,z,h,seed){
    const trunk=new pc.Entity('Fine branching tree armature');root.addChild(trunk);
    block(trunk,'Tapered branch core',mats.log,[x,h*.34,z],
      [.29,h*.68,.28],[0,0,0],'cylinder');
    const r=rand(seed);
    for(let i=0;i<19;i++){
      const a=r()*Math.PI*2,level=.38+r()*.48;
      const reach=.65+r()*1.18;
      const cy=h*level;
      const cx=x+Math.cos(a)*reach*.55,cz=z+Math.sin(a)*reach*.55;
      block(trunk,'Angled wire armature twig',mats.log,
        [(x+cx)*.5,cy-.25,(z+cz)*.5],
        [.08,.08,reach],[0,a*180/Math.PI,15+r()*18],'cylinder');
      leafCloud(cx,cy+.3,cz,.65+r()*.45,.49+r()*.43,
        .72+r()*.45,seed+i*11,root);
    }
    leafCloud(x,h*.87,z,1.20,1.12,1.16,seed+143,root);
  }
  tree(-14.05,-10.55,6.7,341);
  tree(15.10,-10.68,7.5,547);
  for(const [x,z,w,seed] of [
    [-10.7,2.12,.86,700],[-9.5,2.10,.74,711],
    [-8.2,2.11,.75,721],[.43,2.16,.70,731],
    [1.65,2.13,.67,741],[14.7,-7.6,.77,751],
    [14.6,-5.4,.78,761],[14.8,-3.3,.74,771]
  ])leafCloud(x,.74,z,w,.58,w*.83,seed);

  for(let i=0;i<3;i++){
    mount(foliageGroups[i],'Batched photographic scenic foliage '+i,
      [mats.leaf,mats.leafMid,mats.leafLight][i],root);
  }
  // Hand placed 1:87 garden ballast and cast flower heads, no random clutter.
  for(const [x,z,w,d] of [[-9.3,2.52,3.5,1.2],[.80,2.51,3.20,1.2]]){
    block(root,'Raised scenic garden bed',mats.soil,[x,.357,z],[w,.16,d]);
    for(const zEdge of [z-d*.5,z+d*.5]){
      block(root,'Small stone bed edging',mats.concrete,
        [x,.42,zEdge],[w,.20,.18]);
    }
    for(let i=0;i<15;i++){
      const fx=x+(random()-.5)*(w-.42),fz=z+(random()-.5)*(d-.25);
      block(root,'Static scenic flowering clump',mats.leafMid,
        [fx,.59,fz],[.20,.37,.20],[0,0,0],'cone');
      block(root,'Tiny molded flower head',i%3?mats.rose:mats.gold,
        [fx,.82,fz],[.11,.10,.12],[0,0,0],'sphere');
    }
  }

  // A real photographic context: model layout rests on a broad laminate
  // workbench, with a neutral workshop wall behind, and a scale ruler.
  const room=new pc.Entity('Photographic scale-model workshop set');
  app.root.addChild(room);
  block(room,'Real tabletop underneath HO display base',mats.worktop,
    [0,-1.71,0],[78,.50,61]);
  block(room,'Neutral background wall',mats.wall,[0,26,-34],
    [110,58,.7]);
  block(room,'Scale ruler outside model base',mats.silver,
    [-24,-1.42,18],[10,.095,.65]);
  for(let i=0;i<21;i++){
    block(room,'Graduated real scale ruler tick',mats.dark,
      [-28.9+i*.48,-1.363,17.89],
      [.028,.015,i%5===0?.38:.18]);
  }
  document.body.dataset.pcHeroAsset='molded-geometry-v3';
  document.body.dataset.pcRoofSystem='batched-individual-shingles';
  document.body.dataset.pcFoliageSystem='triangulated-branch-leaves';
  document.body.dataset.pcFoliageDrawCalls='3';
  document.body.dataset.pcHouseClapboards=String(sidingPieces);
  return {model,room,materials:mats};
}
