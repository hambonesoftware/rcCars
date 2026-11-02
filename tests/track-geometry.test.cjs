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
const catalog=fs.readFileSync(path.join(__dirname,'..','course-presets.js'),'utf8')
  .split('export function getCourse')[0]
  .replace('export const COURSE_PRESETS','const COURSE_PRESETS');
const defs=section('const R=','const controls=');
const util=section('function clamp(','function makeBox(');
const geometry=section('function surfaceHeight(','function createSkyEnvironment(');
const code=[
  catalog,'const COURSE=COURSE_PRESETS.backyard;',defs,util,geometry,
  '({END,SECTOR_1_END,SECTOR_2_END,SECTOR_3_END,LAPS,SECTOR_2_LEFT_START,SECTOR_2_LEFT_END,SECTOR_2_RIGHT_START,SECTOR_2_RIGHT_END,',
  'CRUISE_SPEED,MAX_SPEED,SEGMENT_LAYOUT,ramps,point,position,project,surfaceHeight})'
].join('\n');
const t=vm.runInNewContext(code,Object.create(null),{timeout:2500});
const approx=(actual,expected,epsilon=.01,label='value')=>
  assert.ok(Math.abs(actual-expected)<epsilon,
    label+': expected '+expected+', got '+actual);

assert.ok(t.END>1500 && t.END<1600,'Expected full circuit length, got '+t.END);
assert.ok(t.SECTOR_2_END>530 && t.SECTOR_2_END<560);
assert.ok(t.SECTOR_3_END>1000 && t.SECTOR_3_END<1150);
assert.equal(t.LAPS,2,'two-lap race');
assert.ok(t.SECTOR_1_END>260 && t.SECTOR_1_END<275);
approx(t.CRUISE_SPEED,30.8,.0001,'normal speed');
approx(t.MAX_SPEED,43.2,.0001,'boost speed');
assert.equal(t.ramps.length,4,'four jump ramps');
assert.equal(t.SEGMENT_LAYOUT.length,15,'15 connected path primitives across four sectors');

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
const start=t.point(0),finish=t.point(t.END);
approx(finish.x,start.x,.000001,'closed-course X');
approx(finish.z,start.z,.000001,'closed-course Z');
approx(Math.cos(finish.angle),Math.cos(start.angle),.000001,'closed heading cosine');
approx(Math.sin(finish.angle),Math.sin(start.angle),.000001,'closed heading sine');
for(const lane of [-5,0,5]){
  const a=t.position(0,lane),b=t.position(t.END,lane);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.00001,
    'Road width must join at the starting line, lane '+lane);
}
const bounds=[0,t.SECTOR_1_END,t.SECTOR_2_END,t.SECTOR_3_END,t.END];
assert.ok(bounds.every((v,i)=>i===0||v>bounds[i-1]),'checkpoints sorted');
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

function evaluateCourse(id){
  const code=[
    catalog,'const COURSE=COURSE_PRESETS['+JSON.stringify(id)+'];',
    defs,util,geometry,
    '({END,SECTOR_1_END,SECTOR_2_END,SECTOR_3_END,SEGMENT_LAYOUT,ramps,point,position,project,surfaceHeight})'
  ].join('\n');
  return vm.runInNewContext(code,Object.create(null),{timeout:2500});
}
for(const id of ['backyard','creek','garage','quarry']){
  const course=evaluateCourse(id);
  const begin=course.point(0),finish=course.point(course.END);
  approx(begin.x,finish.x,.00001,id+' exact closure X');
  approx(begin.z,finish.z,.00001,id+' exact closure Z');
  approx(Math.sin(begin.angle),Math.sin(finish.angle),.00001,id+' tangent sine');
  approx(Math.cos(begin.angle),Math.cos(finish.angle),.00001,id+' tangent cosine');
  assert.equal(course.ramps.length,4,id+' has four major jumps');
  const limits=[0,course.SECTOR_1_END,course.SECTOR_2_END,course.SECTOR_3_END,course.END];
  assert.ok(limits.every((value,i)=>i===0||value>limits[i-1]),id+' sector order');
  assert.ok(course.END>700,'unexpected short route '+id);
  for(let s=4;s<course.END-5;s+=5.6){
    for(const d of [-4.4,0,4.4]){
      const p=course.position(s,d),projected=course.project(p.x,p.z,s);
      approx(projected.s,s,.15,id+' projected distance');
      approx(projected.d,d,.2,id+' projected lane');
    }
  }
  for(const seg of course.SEGMENT_LAYOUT.slice(1)){
    const p1=course.point(seg.startS-.0001),p2=course.point(seg.startS+.0001);
    assert.ok(Math.hypot(p1.x-p2.x,p1.z-p2.z)<.002,id+' continuous road');
    assert.ok(Math.abs(p1.angle-p2.angle)<.0001,id+' smooth heading');
  }
}
console.log('PASS: 4 different layouts share closed-loop race geometry and continuous lanes');

console.log('PASS: first half preserved, four-sector closed circuit, two laps, turns, jumps, lane joins, road projection, 2x speeds');
