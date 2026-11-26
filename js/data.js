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
 {n:'The Broken Gate',sub:'The fields outside the fallen castle',el:0,boss:'Cinder Lord',story:{
  intro:[['narr','A hundred years ago, the Spire fell to a dark curse.'],['ember','The Order is all that is left. Tonight, we climb.'],['tide','The gate is broken. The fields are crawling with the cursed.'],['briar','Then we cut through them. One floor at a time.']],
  boss:[['boss','Turn back, knights. These ashes are all that remain of your kingdom.'],['ember','Then we will rebuild it from your ashes.']],
  clear:[['narr','The Cinder Lord falls. Beyond the gate, the flooded crypts wait.'],['sol','The first floor is ours. Keep climbing.']]}},
 {n:'The Flooded Crypts',sub:'Beneath the castle, where the dead sleep',el:1,boss:'Drowned Warden',story:{
  intro:[['narr','Beneath the castle, the old crypts have flooded.'],['tide','These waters answer to me. And to something else.'],['vex','Something is watching us from below.']],
  boss:[['boss','The drowned do not forgive the living.'],['tide','Then let the tide judge us.']],
  clear:[['narr','The Warden sinks beneath the black water. Above, the woods have turned dark.'],['briar','The woods... they were once my home.']]}},
 {n:'The Haunted Woods',sub:'The wild lands at the foot of the Spire',el:2,boss:'Thorn King',story:{
  intro:[['narr','The woods around the Spire have grown wild and cruel.'],['briar','Stay close. The trees listen.'],['sol','Light will keep the shadows away. For a while.']],
  boss:[['boss','I was king of these woods before you were born.'],['briar','And now you are only thorns.']],
  clear:[['narr','The Thorn King falls. The way to the upper Spire opens, but the curse is not finished.'],['ember','Then neither are we.']]}}];

/* knights: look = helmet style, full = display name, t = title, bio = one line of story */
const KN={
 ember:{look:'great',full:'Sir Ember',t:'The Flame Vanguard',bio:'First to draw a sword when the Spire fell. Ember has not taken off the helm since that night.'},
 tide:{look:'fin',full:'Dame Tide',t:'The Sea Warden',bio:'Keeper of the old harbour. She hears the sea even this far inland.'},
 briar:{look:'hood',full:'Briar',t:'The Forest Ranger',bio:'Raised in the woods the curse now rules. She knows every path, and every trap.'},
 sol:{look:'halo',full:'Sol',t:'The Light Paladin',bio:'Carries the last lantern of the cathedral. As long as it burns, so does the Order.'},
 vex:{look:'horn',full:'Vex',t:'The Shadow Blade',bio:'A knight from the dark side of the kingdom. Few trust him. All are glad he is here.'},
 cinder:{look:'great',full:'Sir Cinder',t:'The Ash Guard',bio:'Held the east wall alone for three nights. The wall stood. He nearly did not.'},
 mist:{look:'fin',full:'Dame Mist',t:'The Tide Scout',bio:'Moves unseen through fog and flood. She is always the first to see the enemy.'},
 thorn:{look:'hood',full:'Thorn',t:'The Bramble Knight',bio:'Armoured in living vines. The curse cannot rot what keeps growing back.'},
 dawn:{look:'halo',full:'Dame Dawn',t:'The Dawn Herald',bio:'Sounds the horn at first light. Every morning the Order lives, she is the reason.'},
 gloom:{look:'horn',full:'Gloom',t:'The Night Watcher',bio:'Never sleeps. Sees farther in the dark than anyone in the kingdom.'},
 pyre:{look:'great',full:'Sir Pyre',t:'The Inferno Champion',bio:'The strongest blade of the old guard. Where he stands, the field burns.'},
 brook:{look:'fin',full:'Brook',t:'The River Squire',bio:'The youngest knight of the Order. Quick, brave, and still learning to be afraid.'},
 moss:{look:'hood',full:'Moss',t:'The Grove Guardian',bio:'Slow to speak, slower to fall. The forest bends to protect him.'},
 halo:{look:'halo',full:'Halo',t:'The Shield Cleric',bio:'Heals the wounded and holds the line. Has never once left a knight behind.'},
 raven:{look:'horn',full:'Raven',t:'The Dusk Marshal',bio:'Commands the Order when night falls. Her orders are short. They are never wrong.'}};

const STAGE_NAMES=[
 ['Cinder Path','Ash Gate','Lava Steps','Smoke Hollow','Ember Bridge','Scorch Yard','Magma Stair','Blaze Court','Coal Throne','Cinder Lord'],
 ['Wet Gate','Drip Tunnel','Pearl Pool','Mist Hall','Reef Steps','Tide Bridge','Frost Spring','Deep Hollow','Whirl Gate','Drowned Warden'],
 ['Moss Gate','Fern Trail','Root Bridge','Thorn Path','Vine Hollow','Leaf Court','Bark Steps','Mushroom Glade','Elder Gate','Thorn King']];
const STAR_TURNS=18;   /* 3rd star: clear a stage in this many turns or fewer */

const HOME_LINES=[
 'The Spire still stands. So does the Order.',
 'Every knight you recruit brings the throne closer.',
 'Level up before the next boss. The curse does not wait.',
 'Stay sharp. The cursed hide in the dark.',
 'Steel, courage, and a good plan. Let us climb.'];
