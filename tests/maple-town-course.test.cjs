'use strict';
/** Geometry contracts for the actual, player-driveable HO-scale streets. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..');
const world=fs.readFileSync(path.join(ROOT,'maple-junction-world.js'),'utf8');
const drive=fs.readFileSync(path.join(ROOT,'maple-junction.js'),'utf8');
const imported=fs.readFileSync(path.join(ROOT,'maple-imported-assets.js'),'utf8');

function sourceLiteral(regex,label){
  const match=world.match(regex);
  assert.ok(match,'Cannot locate '+label+' in the actual PlayCanvas world');
  return vm.runInNewContext('('+match[1]+')');
}
const points=sourceLiteral(/export const MAPLE_WAYPOINTS=([\s\S]*?);/,'urban street waypoints');
const buildings=sourceLiteral(/const buildingSpecs=([\s\S]*?);/,'established model buildings');
const MIN_CLEARANCE=6.25; // 4.6 road half width + vehicle/building setback
const RAIL_CLEARANCE=6.25; // asphalt half width + ballast strip half width
const SAMPLES_PER_SEGMENT=16;
function createTrack(spline){
  const out=[];
  for(let i=0;i<spline.length;i++){
    const n=spline.length;
    const p0=spline[(i+n-1)%n],p1=spline[i];
    const p2=spline[(i+1)%n],p3=spline[(i+2)%n];
    for(let j=0;j<SAMPLES_PER_SEGMENT;j++){
      const t=j/SAMPLES_PER_SEGMENT;
      const cat=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+
        (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+
        (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t);
      out.push({x:cat(0),z:cat(1)});
    }
  }
  return out;
}
function magnitude(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function nearestToBox(p,b){
  const dx=Math.max(0,Math.abs(p.x-b.x)-b.w*.5);
  const dz=Math.max(0,Math.abs(p.z-b.z)-b.d*.5);
  return Math.hypot(dx,dz);
}

assert.equal(points.length,28,'Town circuit must keep the checked road layout');
assert.equal(buildings.length,13,'Existing miniature buildings should not disappear');
const samples=createTrack(points);
assert.equal(samples.length,448);
let total=0,minRadius=Infinity,minBuilding=Infinity,minRail=Infinity;
const angle=[],segmentLength=[];
for(let i=0;i<samples.length;i++){
  const p=samples[i],q=samples[(i+1)%samples.length];
  const len=magnitude(p,q);
  assert.ok(len>.05,'Degenerate road segment '+i);
  total+=len;
  segmentLength.push(len);
  angle.push(Math.atan2(q.x-p.x,q.z-p.z));
  assert.ok(Math.abs(p.x)<95&&Math.abs(p.z)<45,
    'Street has escaped the finite HO-scale table at '+i);
  for(const b of buildings)minBuilding=Math.min(minBuilding,nearestToBox(p,b));
  for(let k=0;k<264;k++){
    const a=2*Math.PI*k/264;
    minRail=Math.min(minRail,Math.hypot(p.x-86*Math.cos(a),p.z-39*Math.sin(a)));
  }
}
for(let i=0;i<samples.length;i++){
  const turn=Math.abs(wrap(angle[(i+1)%samples.length]-angle[i]));
  if(turn>1e-7)minRadius=Math.min(minRadius,segmentLength[i]/turn);
}
assert.ok(minBuilding>MIN_CLEARANCE,'Road clips a building: '+minBuilding.toFixed(2));
assert.ok(minRail>RAIL_CLEARANCE,'Race road intersects running train rails: '+minRail.toFixed(2));
assert.ok(minRadius>7.7,'Town corners are too abrupt to drive: '+minRadius.toFixed(2));
assert.ok(total>310&&total<390,'Town lap length unexpectedly changed: '+total);
assert.ok(world.includes("road.surfaceOffset=.405"),
  'Race car and rendered asphalt surface must share a common contact datum');
assert.ok(world.includes("dataset.mapleCrosswalkCount='4'"),
  'Town storefront street should contain real modelled zebra crossings');
assert.ok(world.includes('Concrete curbstone'),
  'Town road must have a built, physical-looking curb');
assert.ok(drive.includes('Number(controls.left)-Number(controls.right)'),
  'Directional arrows must be correct in the chase camera rather than reversed');
assert.ok(drive.includes('world.road.width/2-1.0'),
  'Drivable corridor must account for the scale-correct truck width');
assert.ok(imported.includes('originFrontAxis'),
  'Player vehicle must orient using its actual front-wheel nodes');
assert.ok(imported.includes('rideHeight-.51'),
  'Truck tires must not sink below the visible asphalt');
console.log('PASS Maple Junction course rebuild',JSON.stringify({
  samples:samples.length,lapLength:+total.toFixed(2),
  minimumTurnRadius:+minRadius.toFixed(2),
  buildingClearance:+minBuilding.toFixed(2),
  railClearance:+minRail.toFixed(2),
  actualBuildings:buildings.length,
  paintedZebraCrossings:4,
  asphaltContactOffset:.405
}));
