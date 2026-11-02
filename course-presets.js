export const COURSE_PRESETS={
  backyard:{
    id:'backyard',title:'Backyard Grand Prix',subtitle:'HO SUBURBAN SHOWCASE · MAIN STREET · DEPOT',
    description:'Race through Elm Street houses, a tiny Main Street, a landscaped park and Oak Junction station on a lovingly detailed model railroad table.',
    ground:'#577f4b',grass:'#3d7350',road:'#72736c',sky:'#9bb9aa',fog:'#9bb9aa',
    sun:'#fff0d5',sunPower:3.15,ambient:1.10,exposure:1.065,
    shoulder:'#887f68',hazard:'cones',feature:'backyard',
    start:85,r1:64,exit1:82,s2Straight:36,r2Left:54,s2North:45,r2Right:45,
    s2Exit:42,s3East:48,r3Right:65,r3Hairpin:60,r4Return:58,s4North:62,
    rampScale:1,roughness:1,laps:2
  },
  creek:{
    id:'creek',title:'Creekside Scramble',subtitle:'SCENIC TRAIN-TABLE VALLEY · CREEKSIDE DEPOT',
    description:'Wind through Maple Falls cottages, scenic streams, the Creekside Depot, and a tiny riverside market beside a miniature rail line.',
    ground:'#4d835a',grass:'#3d7754',road:'#626b65',sky:'#9ecbd1',fog:'#a2c9bd',
    sun:'#f6f5df',sunPower:2.7,ambient:1.25,exposure:1.07,
    shoulder:'#777764',hazard:'logs',feature:'creek',
    start:74,r1:50,exit1:60,s2Straight:28,r2Left:45,s2North:38,r2Right:42,
    s2Exit:30,s3East:35,r3Right:55,r3Hairpin:52,r4Return:48,s4North:70,
    rampScale:.83,roughness:1.12,laps:2
  },
  garage:{
    id:'garage',title:'Garage Gauntlet',subtitle:'BRICK INDUSTRIAL TOWN · FREIGHT SIDINGS',
    description:'Drift through Brickyard brick storefronts, Repair Row, freight sidings and the Switching Yard model railway district.',
    ground:'#6d7470',grass:'#626b67',road:'#686c6a',sky:'#b0c7c4',fog:'#b0c4c2',
    sun:'#eef4f1',sunPower:2.65,ambient:1.16,exposure:1.02,
    shoulder:'#888579',hazard:'barrels',feature:'garage',
    start:77,r1:42,exit1:48,s2Straight:28,r2Left:30,s2North:28,r2Right:35,
    s2Exit:26,s3East:42,r3Right:45,r3Hairpin:42,r4Return:34,s4North:52,
    rampScale:.75,roughness:.80,laps:2
  },
  quarry:{
    id:'quarry',title:'Sunset Quarry',subtitle:'MINING VILLAGE · QUARRY BRANCH RAILWAY',
    description:'Race through a miniature mining settlement with miners' cottages, Stone Works, a rugged quarry branch railroad and High Ridge village.',
    ground:'#ab7951',grass:'#92734e',road:'#937769',sky:'#e5b68e',fog:'#dbad87',
    sun:'#ffd1a1',sunPower:3.55,ambient:1.0,exposure:1.07,
    shoulder:'#b4936e',hazard:'rocks',feature:'quarry',
    start:110,r1:85,exit1:110,s2Straight:42,r2Left:75,s2North:65,r2Right:70,
    s2Exit:50,s3East:68,r3Right:90,r3Hairpin:85,r4Return:75,s4North:90,
    rampScale:1.32,roughness:1.3,laps:2
  }
};

export function getCourse(id){return COURSE_PRESETS[id]||COURSE_PRESETS.backyard;}
