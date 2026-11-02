/**
 * Three authored, independently shaped closed-loop courses.
 *
 * The Backyard Grand Prix keeps its original analytic sector geometry.
 * Other courses use arc-length-parametrized Catmull-Rom splines through
 * deliberately distinct level-design waypoints. No Three.js dependency.
 * World convention: +Z north, +X east, heading=atan2(dx,dz).
 */
export const COURSE_WAYPOINTS=Object.freeze({
  creek:[
    [0,0],[0,65],[16,122],[46,163],[85,198],[135,215],
    [183,189],[205,148],[224,114],[272,105],[311,83],
    [320,32],[303,-14],[263,-42],[213,-48],[164,-35],
    [133,-68],[94,-104],[56,-115],[14,-92],[-10,-53]
  ],
  garage:[
    [0,0],[0,55],[9,99],[36,129],[66,133],[88,109],
    [82,76],[100,53],[137,53],[157,77],[154,110],
    [182,142],[226,148],[264,127],[270,84],[260,39],
    [229,14],[210,-25],[173,-45],[140,-25],[119,-55],
    [75,-76],[28,-76],[0,-51]
  ],
  quarry:[
    [0,0],[0,105],[18,200],[70,283],[160,329],
    [264,339],[373,305],[440,239],[473,150],[457,79],
    [408,33],[345,33],[310,60],[259,80],[211,45],
    [181,-27],[119,-76],[45,-90],[0,-63]
  ]
});

function splinePoint(points,i,t){
  const count=points.length;
  const a=points[(i-1+count)%count];
  const b=points[i%count];
  const c=points[(i+1)%count];
  const d=points[(i+2)%count];
  const t2=t*t,t3=t2*t;
  const coord=k=>.5*((2*b[k])+(-a[k]+c[k])*t+
    (2*a[k]-5*b[k]+4*c[k]-d[k])*t2+
    (-a[k]+3*b[k]-3*c[k]+d[k])*t3);
  const derivative=k=>.5*((-a[k]+c[k])+
    2*(2*a[k]-5*b[k]+4*c[k]-d[k])*t+
    3*(-a[k]+3*b[k]-3*c[k]+d[k])*t2);
  const dx=derivative(0),dz=derivative(1);
  return {x:coord(0),z:coord(1),angle:Math.atan2(dx,dz)};
}

function wrapAngle(a){
  return Math.atan2(Math.sin(a),Math.cos(a));
}

/**
 * Build once on startup, then sample a road point in O(log N).
 * The closing point has the same position and tangent as the start.
 */
export function buildCourseLoop(courseId){
  const waypoints=COURSE_WAYPOINTS[courseId];
  if(!waypoints)return null;
  const samples=[];
  const beginning=splinePoint(waypoints,0,0);
  samples.push({...beginning,s:0});
  let length=0;
  for(let i=0;i<waypoints.length;i++){
    const p=waypoints[i],q=waypoints[(i+1)%waypoints.length];
    const distance=Math.hypot(q[0]-p[0],q[1]-p[1]);
    // Dense centerline stations reduce normal-offset projection errors in
    // the tighter garage hairpins while keeping O(log N) road lookups.
    const steps=Math.max(22,Math.ceil(distance/.38));
    for(let j=1;j<=steps;j++){
      const next=splinePoint(waypoints,i,j/steps);
      const previous=samples[samples.length-1];
      const delta=Math.hypot(next.x-previous.x,next.z-previous.z);
      if(delta<1e-9)continue;
      length+=delta;
      samples.push({...next,s:length});
    }
  }
  const closing=samples[samples.length-1];
  if(Math.hypot(closing.x-beginning.x,closing.z-beginning.z)>.001){
    throw Error('Track loop does not close: '+courseId);
  }
  const sample=distance=>{
    const s=Math.max(0,Math.min(length,distance));
    let low=0,high=samples.length-1;
    while(low+1<high){
      const mid=(low+high)>>1;
      if(samples[mid].s<s)low=mid;
      else high=mid;
    }
    const left=samples[low],right=samples[high];
    const t=Math.max(0,Math.min(1,(s-left.s)/(right.s-left.s||1)));
    return {
      x:left.x+(right.x-left.x)*t,
      z:left.z+(right.z-left.z)*t,
      angle:left.angle+wrapAngle(right.angle-left.angle)*t
    };
  };
  return {
    id:courseId,
    length,
    waypoints,
    point:sample,
    // Checkpoints are placed by real measured distance along each loop.
    sectorFractions:[.24,.49,.75]
  };
}
