import {COURSE_PRESETS} from './course-presets.js';

const COURSES=Object.values(COURSE_PRESETS);
const accents={backyard:'#e4fd7b',creek:'#7bf2d8',garage:'#ffd17c',quarry:'#f8c889'};
const root=document.getElementById('courses');

// This overview uses the same analytic 90-degree arcs and closing lengths
// as the playable race, not a generic decoration or random squiggle.
function coursePoints(c){
  const pi=Math.PI;
  const south=c.start+c.r1+c.r2Left+c.s2North+c.r2Right-
    c.r3Right-c.r3Hairpin+c.r4Return+c.s4North;
  const west=c.r1+c.exit1+c.s2Straight+c.r2Left+c.r2Right+
    c.s2Exit+c.s3East+c.r3Right-c.r3Hairpin-c.r4Return;
  const parts=[
    {length:c.start},
    {r:c.r1,sign:1},{length:c.exit1+c.s2Straight},
    {r:c.r2Left,sign:-1},{length:c.s2North},
    {r:c.r2Right,sign:1},{length:c.s2Exit+c.s3East},
    {r:c.r3Right,sign:1},{length:south},
    {r:c.r3Hairpin,sign:1},{length:west},
    {r:c.r4Return,sign:1},{length:c.s4North}
  ];
  let x=0,z=0,angle=0;
  const pts=[[x,z]];
  for(const part of parts){
    const distance=part.r?part.r*pi/2:part.length;
    const steps=Math.max(8,Math.ceil(distance/3));
    for(let i=0;i<steps;i++){
      if(part.r){
        const k=part.sign/part.r;
        const next=angle+part.sign*pi/(2*steps);
        x+=(Math.cos(angle)-Math.cos(next))/k;
        z+=(Math.sin(next)-Math.sin(angle))/k;
        angle=next;
      }else{
        x+=Math.sin(angle)*distance/steps;
        z+=Math.cos(angle)*distance/steps;
      }
      pts.push([x,z]);
    }
  }
  return pts;
}
function drawMap(canvas,config){
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const pts=coursePoints(config);
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minZ=Math.min(...ys),maxZ=Math.max(...ys);
  const w=canvas.width,h=canvas.height,pad=29;
  const scale=Math.min((w-pad*2)/(maxX-minX+1),(h-pad*2)/(maxZ-minZ+1));
  const offsetX=(w-(maxX-minX)*scale)/2;
  const offsetY=(h-(maxZ-minZ)*scale)/2;
  const screen=p=>[
    offsetX+(p[0]-minX)*scale,
    h-offsetY-(p[1]-minZ)*scale
  ];
  const makePath=()=>{
    ctx.beginPath();
    pts.forEach((p,i)=>{const q=screen(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});
  };
  ctx.lineJoin='round';ctx.lineCap='round';
  makePath();ctx.lineWidth=30;ctx.strokeStyle='#2337379c';ctx.stroke();
  makePath();ctx.lineWidth=25;ctx.strokeStyle='#c7baa1';ctx.stroke();
  makePath();ctx.lineWidth=20;ctx.strokeStyle=config.road;ctx.stroke();
  makePath();ctx.lineWidth=1.2;ctx.setLineDash([5,10]);
  ctx.strokeStyle='#e5e2cc98';ctx.stroke();ctx.setLineDash([]);
  for(const [index,color] of [[0,'#e6fa7a'],[Math.floor(pts.length*.45),'#f3ad6a']]){
    const [x,y]=screen(pts[index]);
    ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);
    ctx.fillStyle=color;ctx.fill();
    ctx.strokeStyle='#1d363c';ctx.lineWidth=2;ctx.stroke();
  }
}
COURSES.forEach((c,i)=>{
  const card=document.createElement('a');
  card.href='./quarter-track.html?course='+encodeURIComponent(c.id);
  card.className='course';
  card.style.setProperty('--accent',accents[c.id]);
  card.style.setProperty('--land',c.ground);
  card.style.setProperty('--sky',c.sky);
  const art=document.createElement('div');
  art.className='art';
  const map=document.createElement('canvas');
  map.className='map';map.width=560;map.height=320;
  map.setAttribute('aria-hidden','true');
  art.append(map);
  const number=document.createElement('span');
  number.className='number';number.textContent=String(i+1).padStart(2,'0');
  art.append(number);
  const tag=document.createElement('span');
  tag.className='tag';tag.textContent=i===0?'ORIGINAL':'NEW COURSE';
  art.append(tag);
  const info=document.createElement('div');info.className='info';
  const subt=document.createElement('div');
  subt.className='subtitle';subt.textContent=c.subtitle;
  const name=document.createElement('h2');
  name.className='name';name.textContent=c.title;
  const desc=document.createElement('p');
  desc.className='description';desc.textContent=c.description;
  const bottom=document.createElement('div');bottom.className='bottom';
  const stat=document.createElement('span');stat.className='stat';
  stat.textContent='4 SECTORS  ·  2 LAPS  ·  4 TRUCKS';
  const action=document.createElement('span');
  action.className='action';action.textContent='RACE ↗';
  bottom.append(stat,action);
  info.append(subt,name,desc,bottom);
  card.append(art,info);root.append(card);
  drawMap(map,c);
});
