'use strict';

/**
 * Geometry-only acceptance tests for whole-footprint building placement.
 * No WebGL/browser required. These tests check street curves, branches,
 * model railway tracks, board edges and complete roof overhangs.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.join(__dirname,'..');
const placementSource=fs.readFileSync(
  path.join(ROOT,'scenery-placement.js'),'utf8')
  .replace(/^export /gm,'');
const splineSource=fs.readFileSync(
  path.join(ROOT,'track-layouts.js'),'utf8')
  .replace(/^export /gm,'');
const factory=new Function(
  placementSource+splineSource+
  '\nreturn {buildSceneryClearance,buildCourseLoop};'
)();
const {buildSceneryClearance,buildCourseLoop}=factory;

const straight=(s,d)=>({x:d,z:s,angle:0});
const straightIndex=buildSceneryClearance({
  position:straight,length:100,halfWidth:9.1,
  junctions:[50],branchLength:29,
  branchHalfWidth:6.7,
  railway:[{start:.2,end:.65,side:1}],railDistance:47,
  minX:-90,maxX:90,minZ:-10,maxZ:110
});
assert.ok(straightIndex.clearance(8,20,4).margin<0,
  'Building extends into driveable race road');
assert.ok(straightIndex.clearance(25,50,5).margin<0,
  'Building extends into industrial cross street');
assert.ok(straightIndex.clearance(47,35,5).margin<0,
  'Building extends onto model railway siding');
assert.ok(straightIndex.clearance(86,20,6).margin<0,
  'Building extends beyond the tabletop edge');
assert.ok(straightIndex.clearance(-39,13,8).margin>1.65,
  'Unobstructed lot should remain available');
const clearFromRoad=straightIndex.findBuildingPlot({
  s:40,d:17,side:-1,radius:8.3,minMargin:1.65
});
assert.ok(clearFromRoad,'Nearby road must have a safe outer building lot');
assert.ok(straightIndex.clearance(
  clearFromRoad.x,clearFromRoad.z,8.3
).margin>=1.65,'Building placement failed safety margin');

// Actual authored racing centerlines, not generic artificial loops.
for(const id of ['garage','creek','quarry']){
  const loop=buildCourseLoop(id);
  const position=(s,d=0)=>{
    const p=loop.point(s);
    return {
      x:p.x+Math.cos(p.angle)*d,
      z:p.z-Math.sin(p.angle)*d,
      angle:p.angle
    };
  };
  const junctions=id==='garage'?
    [.115,.34,.575,.822].map(f=>f*loop.length):[];
  const tracks=id==='garage'?
    [{start:.45,end:.675,side:1},{start:.755,end:.88,side:-1}]:
    id==='creek'?
      [{start:.04,end:.225,side:1},{start:.69,end:.85,side:-1}]:
      [{start:.49,end:.705,side:1},{start:.24,end:.36,side:-1}];
  const index=buildSceneryClearance({
    position,length:loop.length,halfWidth:9.1,
    junctions,branchLength:29,branchHalfWidth:6.7,
    railway:tracks,railDistance:id==='garage'?47.1:52.1,
    minX:-125,maxX:620,minZ:-220,maxZ:460
  });
  assert.ok(index.segments.length>400,id+' collision index is too sparse');
  let successes=0;
  for(let i=0;i<42;i++){
    const s=18+(loop.length-45)*i/41;
    const side=i%2===0?1:-1;
    const plot=index.findBuildingPlot({
      s,d:side*26,side,radius:11.2,minMargin:1.65
    });
    if(!plot)continue;
    const safe=index.clearance(plot.x,plot.z,11.2);
    assert.ok(safe.margin>=1.65,id+' roof/porch intrudes into '+safe.source);
    successes++;
  }
  assert.ok(successes>=14,id+' should have enough safe building lots; '+successes);
  console.log('PASS safe model building footprints on '+id+
    ': '+successes+'/42 sampled lots, road and railway clear');
}
console.log('PASS footprint, junction, rail, and board clearance regression');
