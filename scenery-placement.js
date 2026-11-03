/**
 * Micro Mayhem: conservative, 2D footprint-based scenic placement.
 * World coordinates follow the same x/z racing spline as the Three.js road.
 * Designed to run without THREE, DOM, WebGL or network dependencies.
 *
 * A building may be positioned next to a main race street only when its
 * ENTIRE bounding footprint (including roof/porch/awning overhang) clears
 * every nearby road segment, side-street junction and railway siding.
 */
export function buildSceneryClearance({
  position,length,halfWidth,junctions=[],branchLength=29,
  branchHalfWidth=6.7,railway=[],railDistance=47,
  minX=-Infinity,maxX=Infinity,minZ=-Infinity,maxZ=Infinity,
  step=2.25
}){
  const segments=[];
  const push=(a,b,width,type)=>{
    segments.push({
      x0:a.x,z0:a.z,x1:b.x,z1:b.z,
      minX:Math.min(a.x,b.x)-width,
      maxX:Math.max(a.x,b.x)+width,
      minZ:Math.min(a.z,b.z)-width,
      maxZ:Math.max(a.z,b.z)+width,
      width,type
    });
  };
  const n=Math.max(4,Math.ceil(length/step));
  let previous=position(0,0);
  for(let i=1;i<=n;i++){
    const p=position(length*i/n,0);
    push(previous,p,halfWidth,'racing-street');
    previous=p;
  }
  for(const s of junctions){
    for(const side of [-1,1]){
      push(position(s,side*(halfWidth-.8)),
        position(s,side*(halfWidth+branchLength)),
        branchHalfWidth,'cross-street');
    }
  }
  for(const siding of railway){
    const count=Math.max(2,Math.ceil((siding.end-siding.start)*length/step));
    let last=position(length*siding.start,siding.side*railDistance);
    for(let i=1;i<=count;i++){
      const p=position(length*(siding.start+
        (siding.end-siding.start)*i/count),
        siding.side*railDistance);
      push(last,p,3.6,'model-railway');
      last=p;
    }
  }
  const distancePointSegment=(x,z,line)=>{
    const vx=line.x1-line.x0,vz=line.z1-line.z0;
    const v2=vx*vx+vz*vz;
    const t=v2>1e-12?Math.max(0,Math.min(1,
      ((x-line.x0)*vx+(z-line.z0)*vz)/v2)):0;
    return Math.hypot(x-line.x0-t*vx,z-line.z0-t*vz);
  };
  function clearance(x,z,radius=0){
    let best=Math.min(
      x-minX-radius,maxX-x-radius,
      z-minZ-radius,maxZ-z-radius
    );
    let source='table-edge';
    for(const line of segments){
      if(best>=0&&(
        x<line.minX-radius-best||x>line.maxX+radius+best||
        z<line.minZ-radius-best||z>line.maxZ+radius+best
      ))continue;
      // Conservative exact capsule clearance, including segment ends.
      const dist=distancePointSegment(x,z,line)-line.width-radius;
      if(dist<best){best=dist;source=line.type;}
    }
    return {margin:best,source};
  }
  const findBuildingPlot=({
    s,d,side,radius,minMargin=1.8,maxShift=38
  })=>{
    const requestedSide=side>0?1:-1;
    const base=Math.abs(d);
    const shiftsS=[0,-5,5,-11,11,-20,20,-32,32];
    const shiftsOut=[0,4,8,12,17,23,30,39,47];
    let fallback=null;
    for(const lateral of shiftsOut){
      if(lateral>maxShift+9)continue;
      for(const advance of shiftsS){
        const testS=Math.max(4,Math.min(length-4,s+advance));
        const testD=requestedSide*(base+lateral);
        const p=position(testS,testD);
        const test=clearance(p.x,p.z,radius);
        const candidate={
          s:testS,d:testD,x:p.x,z:p.z,angle:p.angle,
          margin:test.margin,source:test.source,
          shiftedBy:Math.hypot(advance,lateral)
        };
        if(!fallback||candidate.margin>fallback.margin)
          fallback=candidate;
        if(test.margin>=minMargin)return candidate;
      }
    }
    return null;
  };
  return {segments,clearance,findBuildingPlot};
}
