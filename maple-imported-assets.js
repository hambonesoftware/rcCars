import * as pc from 'playcanvas';
/**
 * Downloaded, independently authored miniature buildings and scenery.
 *
 * Source is scripts/import_maple_cc0_assets.py. Every asset is pinned to a
 * source Git blob and the imported catalog contains exact glTF scene bounds.
 * Assets load from OUR Pages origin, not third-party CDNs at game runtime.
 */
export async function loadImportedMapleTown(app,world) {
  const directory='./assets/maple/imported/';
  const status={loaded:0,failed:0,instances:0,buildings:0,trees:0};
  const mobile=window.matchMedia('(max-width:800px)').matches;
  document.body.dataset.mapleImportedAssets='loading';

  let catalog;
  try {
    const response=await fetch(directory+'catalog.json',{cache:'no-cache'});
    if(!response.ok)throw new Error('Imported asset catalog HTTP '+response.status);
    catalog=(await response.json()).models;
  } catch(error) {
    console.warn('Preserving the authored town; optional imported catalog unavailable',error);
    document.body.dataset.mapleImportedAssets='fallbacks-active';
    document.body.dataset.mapleImportedError=String(error);
    return {status,error:String(error)};
  }

  const houses=[
    {key:'house_a',plots:[[-90,-35],[-55,-19]],size:[9.0,8.8,7.5]},
    {key:'house_b',plots:[[39,-27],[-70,39]],size:[9.3,8.7,8.2]},
    {key:'house_c',plots:[[58,6],[-90,-20]],size:[9.2,8.6,7.8]},
    {key:'house_f',plots:[[18,-18],[55,39]],size:[9.3,8.7,7.8]},
    {key:'house_j',plots:[[88,18]],size:[9.0,8.5,8.0]},
    {key:'house_t',plots:[[65,36],[81,-25]],size:[9.0,8.8,8.5]},
    {key:'warehouse',plots:[[77,-35]],size:[13.7,12.0,10.2]}
  ];
  const treePlans=[
    {key:'leafy_tree',indices:[1,7,12,20,27],height:5.7},
    {key:'shade_tree',indices:[4,10,23,31],height:6.1},
    {key:'shrub',plots:[[-83,-17],[65,9],[52,-17],[-45,-22],[45,-18]],height:1.4}
  ];
  const treePlansActive=mobile?treePlans.map(p=>({
    ...p,indices:p.indices?.slice(0,3),plots:p.plots?.slice(0,3)
  })):treePlans;
  const used=[];
  const lotFootprints=(world.buildingSpecs||[]).map(spec=>({
    x:spec.x,z:spec.z,r:Math.hypot(spec.w,spec.d)*.62+1.5
  }));
  const rail=world.railSamples||[];

  function roadClear(x,z,r){
    return world.road.nearest(x,z).dist>=6.15+r;
  }
  function railClear(x,z,r){
    for(let i=0;i<rail.length;i+=3) {
      if(Math.hypot(rail[i].x-x,rail[i].z-z)<2.2+r)return false;
    }
    return true;
  }
  function buildingClear(x,z,r){
    if(Math.abs(x)+r>98||Math.abs(z)+r>48)return false;
    if(!roadClear(x,z,r)||!railClear(x,z,r))return false;
    for(const q of [...lotFootprints,...used]){
      if(Math.hypot(q.x-x,q.z-z)<q.r+r+1.3)return false;
    }
    return true;
  }

  function spawn(resource,record,x,z,requirements,{yaw=0,name='',shadows=true}={}){
    if(!record?.bounds)throw Error('Missing verified GLB bounds for '+record?.file);
    const [lower,upper]=record.bounds;
    const dims=upper.map((v,i)=>v-lower[i]);
    if(dims.some(v=>!(v>.0001)))throw Error('Degenerate GLB dimensions');
    // Authoring coordinate systems and glTF origins vary substantially.
    // Center every mesh around its actual bounds and put its lowest vertex
    // exactly on the miniature terrain. No assumed Kenney/Quaternius units.
    const [desiredW,desiredD,maximumH]=requirements;
    const scale=Math.min(desiredW/dims[0],desiredD/dims[2],maximumH/dims[1]);
    const anchor=new pc.Entity('Imported CC0 model / '+name);
    anchor.setLocalPosition(x,world.groundHeight(x,z)+.055,z);
    anchor.setLocalEulerAngles(0,yaw,0);
    const model=resource.instantiateRenderEntity();
    model.name=name+' / downloaded '+record.creator;
    model.setLocalScale(scale,scale,scale);
    model.setLocalPosition(
      -scale*(lower[0]+upper[0])/2,
      -scale*lower[1],
      -scale*(lower[2]+upper[2])/2
    );
    anchor.addChild(model);
    world.root.addChild(anchor);
    if(shadows){
      for(const render of model.findComponents('render')){
        render.castShadows=!mobile;
        render.receiveShadows=true;
      }
    }
    status.instances++;
    return anchor;
  }

  function installHouse(key,resource,record){
    const entry=houses.find(a=>a.key===key);
    if(!entry)return;
    const radius=Math.hypot(entry.size[0],entry.size[1])*.46;
    for(let i=0;i<entry.plots.length;i++){
      const [x,z]=entry.plots[i];
      if(!buildingClear(x,z,radius))continue;
      // All the downloaded houses are secondary, detailed miniature lots.
      // Retain original authored Craftsman and hardware hero buildings.
      spawn(resource,record,x,z,entry.size,{
        yaw:(i*180+(x<0?180:0))%360,
        name:key+' residential/retail lot '+(i+1)
      });
      used.push({x,z,r:radius});
      status.buildings++;
    }
  }

  function installTree(key,resource,record){
    const entry=treePlansActive.find(a=>a.key===key);
    if(!entry)return;
    const size=entry.height;
    for(const i of entry.indices||[]){
      const old=world.root.findByName('HO scenery tree / '+i);
      if(!old||!old.enabled)continue;
      const p=old.getLocalPosition();
      spawn(resource,record,p.x,p.z,[size,size,size],{
        yaw:i*57%360,name:key+' scenic railway tree '+i,
        shadows:true
      });
      old.enabled=false;
      status.trees++;
    }
    for(const [x,z] of entry.plots||[]){
      if(!roadClear(x,z,1.5)||!railClear(x,z,1.5))continue;
      spawn(resource,record,x,z,[2.2,2.3,size],{
        yaw:Math.round(x*13+z*7)%360,name:key+' molded hedge'
      });
      status.trees++;
    }
  }

  // PlayCanvas's container loader expects the GLB relative to the current
  // origin. Assets are generated and published together with this module.
  const all=[...houses,...treePlansActive];
  const unique=[...new Set(all.map(entry=>entry.key))];
  const results=await Promise.all(unique.map(key=>new Promise(resolve=>{
    const record=catalog[key];
    if(!record){
      status.failed++;
      resolve({key,ok:false,error:'Missing catalog entry'});
      return;
    }
    app.assets.loadFromUrlAndFilename(directory+record.file,record.file,
      'container',(error,asset)=>{
      if(error||!asset?.resource){
        status.failed++;
        resolve({key,ok:false,error:String(error)});
      }else{
        try {
          if(houses.some(p=>p.key===key))installHouse(key,asset.resource,record);
          else installTree(key,asset.resource,record);
          status.loaded++;
          resolve({key,ok:true});
        }catch(issue){
          status.failed++;
          console.warn('Imported miniature model did not render',key,issue);
          resolve({key,ok:false,error:String(issue)});
        }
      }
      document.body.dataset.mapleImportedLoaded=String(status.loaded);
      document.body.dataset.mapleImportedFailed=String(status.failed);
      document.body.dataset.mapleImportedBuildings=String(status.buildings);
      document.body.dataset.mapleImportedTrees=String(status.trees);
      document.body.dataset.mapleImportedInstances=String(status.instances);
    });
  })));
  document.body.dataset.mapleImportedAssets=status.failed?
    'fallbacks-active':'all-sources-loaded';
  document.body.dataset.mapleImportedLoaded=String(status.loaded);
  document.body.dataset.mapleImportedFailed=String(status.failed);
  document.body.dataset.mapleImportedBuildings=String(status.buildings);
  document.body.dataset.mapleImportedTrees=String(status.trees);
  document.body.dataset.mapleImportedInstances=String(status.instances);
  return {status,results};
}
