'use strict';

// Validate the real track functions, without WebGL or a duplicate centerline.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','quarter-track.js'),'utf8');
function section(from,to){
  const a=src.indexOf(from),b=src.indexOf(to,a+from.length);
  assert.ok(a>=0,'Missing source marker '+from);
  assert.ok(b>a,'Missing source marker '+to);
  return src.slice(a,b);
}
const defs=section('const R=','const controls=');
const util=section('function clamp(','function makeBox(');
const geometry=section('function surfaceHeight(','function createSkyEnvironment(');
const code=[
  defs,util,geometry,
  '({END,SECTOR_1_END,SECTOR_2_LEFT_START,SECTOR_2_LEFT_END,SECTOR_2_RIGHT_START,SECTOR_2_RIGHT_END,',
  'CRUISE_SPEED,MAX_SPEED,SEGMENT_LAYOUT,ramps,point,position,project,surfaceHeight})'
].join('\n');
const t=vm.runInNewContext(code,Object.create(null),{timeout:2500});
const approx=(actual,expected,epsilon=.01,label='value')=>
  assert.ok(Math.abs(actual-expected)<epsilon,
    label+': expected '+expected+', got '+actual);

assert.ok(t.END>540 && t.END<560,'Expected half-course length, got '+t.END);
assert.ok(t.SECTOR_1_END>260 && t.SECTOR_1_END<275);
approx(t.CRUISE_SPEED,30.8,.0001,'normal speed');
approx(t.MAX_SPEED,43.2,.0001,'boost speed');
assert.equal(t.ramps.length,2,'two jump ramps');
assert.equal(t.SEGMENT_LAYOUT.length,8,'eight path primitives across two sectors');

function legacy(s){
  const L=85,r=64,C=r*Math.PI/2;
  if(s<=L)return {x:0,z:s,angle:0};
  if(s<L+C){const a=(s-L)/r;return {x:r*(1-Math.cos(a)),z:L+r*Math.sin(a),angle:a};}
  return {x:r+(s-L-C),z:L+r,angle:Math.PI/2};
}
for(let s=0;s<=t.SECTOR_1_END;s+=.5){
  const a=t.point(s),b=legacy(s);
  approx(a.x,b.x,.00001,'original first-sector X');
  approx(a.z,b.z,.00001,'original first-sector Z');
  approx(a.angle,b.angle,.00001,'original first-sector tangent');
}
for(const segment of t.SEGMENT_LAYOUT.slice(1)){
  const s=segment.startS;
  const a=t.point(s-.0001),b=t.point(s+.0001);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.001,'Path disconnect at '+s);
  assert.ok(Math.abs(a.angle-b.angle)<.0001,'Heading disconnect at '+s);
}
approx(t.point(t.SECTOR_2_LEFT_END).angle,0,.000001,'Left sweeper exits north');
approx(t.point(t.SECTOR_2_RIGHT_END).angle,Math.PI/2,.000001,'Right sweeper exits east');
for(let s=4;s<t.END-5;s+=4.3){
  for(const lane of [-5,0,5]){
    const p=t.position(s,lane);
    const q=t.project(p.x,p.z,s);
    approx(q.s,s,.11,'projected road distance at '+s);
    approx(q.d,lane,.12,'projected lane offset at '+s);
    assert.ok(Number.isFinite(p.y),'road elevation is finite');
  }
}
for(const jump of t.ramps){
  assert.ok(jump.start>=0 && jump.end<t.END);
  assert.ok(jump.height>1.5);
  assert.ok(t.surfaceHeight(jump.end-.1)>1,'ramp has height');
}
console.log('PASS: first quarter preserved, two-sector continuity, turns, jumps, road projection, 2x speeds');
