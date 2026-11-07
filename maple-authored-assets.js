/**
 * Exported Maple Junction GLB kit -> populated model-railway town.
 * Four unique binary models are fetched once; shared real mesh geometry is
 * instantiated across residential architecture, trees and parked diecasts.
 * The procedural world remains visible until its authored replacement loads.
 */
export function loadAuthoredMapleAssets(app,world,car){
  const base='./assets/maple/glb/';
  const mobile=window.matchMedia('(max-width:800px)').matches;
  let instances=0;
  const sourceStatus={total:4,loaded:0,failed:0};
  document.body.dataset.mapleAuthoredAssets='loading';
  document.body.dataset.mapleTownAssetInstances='0';

  function installTownAsset(resource,oldName,{scale=1,yaw=0}={}){
    const old=world.root.findByName(oldName);
    if(!old)throw Error('Missing miniature town placeholder: '+oldName);
    const model=resource.instantiateRenderEntity();
    const p=old.getLocalPosition();
    model.name='Authored HO miniature / '+oldName;
    model.setLocalPosition(p.x,p.y,p.z);
    model.setLocalEulerAngles(0,yaw,0);
    model.setLocalScale(scale,scale,scale);
    world.root.addChild(model);
    old.enabled=false;
    instances++;
    return model;
  }
  function parkedCoupe(resource,name,x,z,yaw,scale=.74){
    if(world.road.nearest(x,z).dist<7.0)return;
    const model=resource.instantiateRenderEntity();
    model.name='Parked diecast in Maple Junction / '+name;
    model.setLocalPosition(x,world.groundHeight(x,z)+.04,z);
    model.setLocalEulerAngles(0,yaw,0);
    model.setLocalScale(scale,scale,scale);
    world.root.addChild(model);
    instances++;
  }
  const sources=[
    {
      key:'car',file:'maple_cherry_coupe.glb',
      install(resource){
        const legacy=[...car.children];
        const model=resource.instantiateRenderEntity();
        model.name='Rebuilt Maple Cherry Coupe GT | actual GLB geometry';
        // Drivable entity sits at ground + .51; GLB tires reach y=0.
        model.setLocalPosition(0,-.51,0);
        car.addChild(model);
        for(const child of legacy)child.enabled=false;
        instances++;
        if(!mobile){
          parkedCoupe(resource,'Pharmacy visitor',19,-16.5,-88,.72);
          parkedCoupe(resource,'Maple resident',-33,-15,165,.70);
        }
      }
    },
    {
      key:'hardware',file:'maple_mainstreet_hardware.glb',
      install(resource){
        installTownAsset(resource,'HO-scale cast building / HARDWARE',
          {scale:.83,yaw:0});
      }
    },
    {
      key:'cottage',file:'maple_craftsman_house.glb',
      install(resource){
        for(const [name,scale,yaw] of [
          ['MAPLE BUNGALOW',.80,180],
          ['CEDAR COTTAGE',.79,180],
          ['OAK STREET HOUSE',.76,180],
          ['PINE STREET HOUSE',.72,180]
        ])installTownAsset(resource,'HO-scale cast building / '+name,{scale,yaw});
      }
    },
    {
      key:'scenic-tree',file:'maple_scenic_tree.glb',
      install(resource){
        const trees=mobile?[[2,.77],[8,.85],[19,.69]]:[
          [2,.79],[6,.84],[8,.72],[15,.89],[19,.72],[28,.84],[32,.70]
        ];
        for(const [index,scale] of trees)
          installTownAsset(resource,'HO scenery tree / '+index,
            {scale,yaw:index*39%360});
      }
    }
  ];
  const requests=sources.map(source=>new Promise(resolve=>{
    app.assets.loadFromUrlAndFilename(base+source.file,source.file,'container',(err,asset)=>{
      if(err||!asset?.resource){
        console.warn('Using procedural town fallback for',source.key,err);
        sourceStatus.failed++;
        document.body.dataset.mapleAuthoredAssets='partial';
        resolve({key:source.key,ok:false,error:String(err)});
        return;
      }
      try{
        source.install(asset.resource);
        sourceStatus.loaded++;
        document.body.dataset['mapleAuthored'+source.key.replace(/(^|-)([a-z])/g,
          (_match,_prefix,letter)=>letter.toUpperCase())]='loaded';
        resolve({key:source.key,ok:true});
      }catch(error){
        console.warn('Keeping procedural scenery after authored import failure',
          source.key,error);
        sourceStatus.failed++;
        resolve({key:source.key,ok:false,error:String(error)});
      }
      document.body.dataset.mapleTownAssetInstances=String(instances);
      document.body.dataset.mapleAuthoredLoaded=String(sourceStatus.loaded);
      document.body.dataset.mapleAuthoredFailed=String(sourceStatus.failed);
    });
  }));
  return Promise.all(requests).then(result=>{
    document.body.dataset.mapleAuthoredAssets=sourceStatus.failed?
      'fallbacks-active':'all-four-loaded';
    document.body.dataset.mapleAuthoredLoaded=String(sourceStatus.loaded);
    document.body.dataset.mapleAuthoredFailed=String(sourceStatus.failed);
    document.body.dataset.mapleTownAssetInstances=String(instances);
    return result;
  });
}
