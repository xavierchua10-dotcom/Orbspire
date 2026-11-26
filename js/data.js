'use strict';
/* Orb Spire game data: elements, heroes, chapters. Edit numbers here to rebalance. */
const EL=[
 {n:'Fire', c:'#ff5a3c',d:'#8f1d0c'},
 {n:'Water',c:'#38a8ff',d:'#0b468f'},
 {n:'Wood', c:'#45cf62',d:'#11682a'},
 {n:'Light',c:'#ffd23a',d:'#8f6400'},
 {n:'Dark', c:'#b25cff',d:'#4a1389'},
 {n:'Heart',c:'#ff7fb6',d:'#a3245f'}];

/* r = rarity stars. sk = skill: convert a->b, heal p, delay t turns, time ms, nuke m x attack, guard t hits */
const HEROES=[
 {id:'ember', n:'Ember', el:0,atk:110,cd:5,r:3,sk:{k:'convert',a:5,b:0}},
 {id:'tide',  n:'Tide',  el:1,atk:100,cd:6,r:3,sk:{k:'heal',p:.35}},
 {id:'briar', n:'Briar', el:2,atk:100,cd:5,r:3,sk:{k:'convert',a:4,b:2}},
 {id:'sol',   n:'Sol',   el:3,atk:105,cd:7,r:4,sk:{k:'delay',t:2}},
 {id:'vex',   n:'Vex',   el:4,atk:115,cd:4,r:3,sk:{k:'time',ms:4000}},
 {id:'cinder',n:'Cinder',el:0,atk:98, cd:6,r:2,sk:{k:'nuke',m:2.5}},
 {id:'mist',  n:'Mist',  el:1,atk:95, cd:5,r:2,sk:{k:'convert',a:5,b:1}},
 {id:'thorn', n:'Thorn', el:2,atk:98, cd:6,r:2,sk:{k:'nuke',m:2.5}},
 {id:'dawn',  n:'Dawn',  el:3,atk:112,cd:6,r:4,sk:{k:'convert',a:4,b:3}},
 {id:'gloom', n:'Gloom', el:4,atk:96, cd:5,r:2,sk:{k:'convert',a:3,b:4}},
 {id:'pyre',  n:'Pyre',  el:0,atk:120,cd:7,r:4,sk:{k:'nuke',m:4}},
 {id:'brook', n:'Brook', el:1,atk:94, cd:4,r:2,sk:{k:'time',ms:3000}},
 {id:'moss',  n:'Moss',  el:2,atk:104,cd:6,r:3,sk:{k:'guard',t:2}},
 {id:'halo',  n:'Halo',  el:3,atk:100,cd:6,r:3,sk:{k:'guard',t:2}},
 {id:'raven', n:'Raven', el:4,atk:118,cd:7,r:4,sk:{k:'nuke',m:3.5}}];
const START_TEAM=['ember','tide','briar','sol','vex'];

function skillText(h){
  const s=h.sk;
  if(s.k==='convert')return `Turns every ${EL[s.a].n} orb into ${EL[s.b].n}.`;
  if(s.k==='heal')return `Restores ${Math.round(s.p*100)}% of team HP.`;
  if(s.k==='delay')return `Delays all enemy attacks by ${s.t} turns.`;
  if(s.k==='time')return `Gives ${s.ms/1000} extra seconds on your next move.`;
  if(s.k==='nuke')return `Hits all enemies for ${s.m}x this hero's attack.`;
  return `Halves the damage you take from the next ${s.t} enemy attacks.`;
}

/* chapters: el = element most enemies belong to; 10 stages each, stage 10 is the boss */
const CHAPTERS=[
 {n:'Ember Fields',el:0,boss:'Cinder Lord'},
 {n:'Tidal Caves', el:1,boss:'Tide Warden'},
 {n:'Briar Woods', el:2,boss:'Thorn King'}];

const STAGE_NAMES=[
 ['Cinder Path','Ash Gate','Lava Steps','Smoke Hollow','Ember Bridge','Scorch Yard','Magma Stair','Blaze Court','Coal Throne','Cinder Lord'],
 ['Wet Gate','Drip Tunnel','Pearl Pool','Mist Hall','Reef Steps','Tide Bridge','Frost Spring','Deep Hollow','Whirl Gate','Tide Warden'],
 ['Moss Gate','Fern Trail','Root Bridge','Thorn Path','Vine Hollow','Leaf Court','Bark Steps','Mushroom Glade','Elder Gate','Thorn King']];
const STAR_TURNS=18;   /* 3rd star: clear a stage in this many turns or fewer */

const HOME_LINES=[
 'The Hush is spreading. Ready to climb?',
 'Every orb you break brings a little sound back.',
 'Level up your heroes before the next boss.',
 'Quiet places hide the loudest enemies.',
 'Listen for the beat. Then move.'];
