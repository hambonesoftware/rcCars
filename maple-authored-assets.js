/**
 * Maple Junction authored-model drop-in layer.
 * Keeps the playable road, course physics and skyline in place while
 * replacing four high-visibility placeholder objects with genuine GLBs.
 * Each replacement is atomic: an original is only hidden after its
 * authored model has actually loaded, or it stays as the fallback.
 */
export function loadAuthoredMapleAssets(app,world,car){
  const base='./assets/maple/glb/';
  const entries=[
    {
      key:'car',file:'maple_cherry_coupe.glb',
      apply(model){
        const legacy=[...car.children];
        model.name='Authored diecast cherry coupe';
        // Maple's vehicle transform is grounded around its chassis,
        // while these glTF assets use a natural y=0 ground-origin.
        model.setLocalPosition(0,-.47,0);
        car.addChild(model);
        for(const child of legacy)child.enabled=false;
        return true;
      }
    },
    {
      key:'hardware',file:'maple_mainstreet_hardware.glb',
      apply(model){return replaceTownObject('HO-scale cast building / HARDWARE',model);}
    },
    {
      key:'cottage',file:'maple_craftsman_house.glb',
      apply(model){return replaceTownObject('HO-scale cast building / MAPLE BUNGALOW',model);}
    },
    {
      key:'scenic-tree',file:'maple_scenic_tree.glb',
      apply(model){return replaceTownObject('HO scenery tree / 2',model);}
    }
  ];
  const status={total:entries.length,loaded:0,failed:0};
  document.body.dataset.mapleAuthoredAssets='loading';
  function replaceTownObject(name,model){
    const old=world.root.findByName(name);
    if(!old)throw Error('Missing placeholder entity '+name);
    model.name='Authored GLB / '+name;
    const pose=old.getLocalPosition();
    model.setLocalPosition(pose.x,pose.y,pose.z);
    world.root.addChild(model);
    old.enabled=false;
    return true;
  }
  const requests=entries.map(entry=>new Promise(resolve=>{
    app.assets.loadFromUrlAndFilename(base+entry.file,entry.file,'container',(err,asset)=>{
      if(err||!asset?.resource){
        console.warn('Retaining Maple Junction fallback for',entry.key,err);
        status.failed++;
        document.body.dataset.mapleAuthoredAssets='partial';
        resolve({key:entry.key,ok:false,error:String(err)});
        return;
      }
      try{
        const model=asset.resource.instantiateRenderEntity();
        entry.apply(model);
        status.loaded++;
        document.body.dataset.mapleAuthoredAssets='loading';
        document.body.dataset['mapleAuthored'+entry.key.replace(/(^|-)([a-z])/g,
          (_all,p,c)=>c.toUpperCase())]='loaded';
        resolve({key:entry.key,ok:true});
      }catch(error){
        console.warn('Could not install authored model',entry.key,error);
        status.failed++;
        resolve({key:entry.key,ok:false,error:String(error)});
      }
      document.body.dataset.mapleAuthoredLoaded=String(status.loaded);
      document.body.dataset.mapleAuthoredFailed=String(status.failed);
    });
  }));
  const complete=Promise.all(requests).then(result=>{
    document.body.dataset.mapleAuthoredAssets=status.failed?
      'fallbacks-active':'all-four-loaded';
    document.body.dataset.mapleAuthoredLoaded=String(status.loaded);
    document.body.dataset.mapleAuthoredFailed=String(status.failed);
    return result;
  });
  return complete;
}
