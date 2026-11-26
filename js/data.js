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
 {id:'summoner',n:'You',el:-1,any:true,atk:110,cd:6,r:3,sk:{k:'heal',p:.3}},
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
const START_TEAM=['summoner'];
const SUMMONER_MULT=.7;   /* the Summoner hits every element, at this share of a matching knight's power */
const ANYEL={n:'All',c:'#ffd35a',d:'#5a2d95'};
const ART=['summoner','ember','tide','briar','sol','vex','cinder','mist','thorn','dawn','gloom','pyre','brook','moss','halo','raven'];
const elOf=h=>h.any?ANYEL:EL[h.el];

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
 {n:'The Broken Gate',sub:'The fields outside the fallen castle',el:0,boss:'Cursed Ember',reward:'ember',story:{
  intro:[["narr", "The Spire fell a hundred years ago. Its knights became spirits, each one chained to an element. Everyone calls it a curse."], ["you", "I am a Summoner. I can hear them calling from inside the walls."], ["voice", "Then answer them. Break their chains, one by one. Start with the flame."], ["narr", "You do not know whose voice that is. But it is the only one that has ever answered you."]],
  mid:[["narr", "Among the ash you find a torn banner. The runes stitched on it match the chains on the knights."], ["you", "These are not curse marks. These are the Order's own runes."], ["voice", "Old stitching. Pay it no mind. The flame is waiting."], ["you", "Why do you keep rushing me?"]],
  boss:[["boss", "Who dares wake the Flame Vanguard? Turn back, or burn."], ["you", "I did not come to burn. I came to free you."], ["boss", "Free me? Child, you are not freeing me. You are opening a door."], ["voice", "Do not listen. He is only afraid."], ["you", "Afraid of what?"]],
  clear:[["ember", "The chains... they are gone. I am Sir Ember, first sword of the Order."], ["ember", "Summoner, listen. We were never cursed. Our own Marshal bound us here, to hold something back."], ["you", "Hold what back?"], ["ember", "I cannot remember its name. Only that it must never be let out."], ["voice", "The long dark steals memory. Lead on, Summoner. The crypts are next."], ["narr", "Sir Ember joins your team. Something in the dark is listening."]]}},
 {n:'The Flooded Crypts',sub:'Beneath the castle, where the dead sleep',el:1,boss:'Cursed Tide',reward:'tide',story:{
  intro:[["narr", "Beneath the castle the old crypts have flooded. Something sleeps in the black water."], ["ember", "The Sea Warden is down there. She never left her post."], ["you", "Ember, you said we were bound. By whom? For what?"], ["ember", "The Marshal gave one last order. I only remember pieces. Tide will remember the rest."]],
  mid:[["narr", "On the crypt wall is a mural. Five knights kneel around a figure who raises a lantern. The figure's face has been scratched out."], ["ember", "That is the Marshal. Someone erased the face."], ["you", "Someone did not want us to remember it."], ["voice", "Walls rot. Only the water matters now."]],
  boss:[["boss", "The tide takes all who enter. Even the living."], ["you", "Not today. Hear me, Warden."], ["boss", "I have held this door for a hundred years. I will not give it to a stranger."], ["you", "Which door?"]],
  clear:[["tide", "I remember the harbour. And I remember the Marshal's last order."], ["tide", "\"Hold the seal until the Summoner comes. Then the choice is theirs.\" That is you, is it not?"], ["you", "Then the voice that guided me..."], ["tide", "What voice? Summoner, who are you talking to?"], ["you", "Nobody. Nobody at all."], ["narr", "Dame Tide joins your team. Above, the woods have turned dark."]]}},
 {n:'The Haunted Woods',sub:'The wild lands at the foot of the Spire',el:2,boss:'Cursed Briar',reward:'briar',story:{
  intro:[["narr", "The woods around the Spire have grown wild and cruel."], ["tide", "The trees listen. Stay close."], ["you", "Tide, the Marshal said the choice is mine. What choice?"], ["tide", "Whether to finish what you started. I hope you will know when the time comes."]],
  mid:[["narr", "An arrow is lodged in a tree. A note is tied to it. \"Do not trust what speaks only to you.\""], ["you", "Briar."], ["voice", "A trap. Rangers lie."], ["you", "Funny. That is exactly what a liar would say."]],
  boss:[["boss", "These woods are mine. Leave, or take root."], ["you", "You were a Ranger once. Remember."], ["boss", "I remember enough. Something has been whispering in your ear since the gate. I could smell it from here."], ["voice", "Silence her."]],
  clear:[["briar", "Hmph. Took you long enough. I am Briar."], ["briar", "Listen. That voice is loudest each time a knight breaks free. Count them."], ["you", "Three, now."], ["briar", "And does the Spire feel warmer, or colder?"], ["you", "...Colder."], ["narr", "Briar joins your team. The way to the cathedral opens."]]}},
 {n:'The Cathedral of Dawn',sub:'The ruined cathedral beneath the Spire',el:3,boss:'Cursed Sol',reward:'sol',story:{
  intro:[["narr", "The great lantern of the cathedral burned for a thousand years. Now its light is blinding, and cruel."], ["briar", "I can barely look at it."], ["you", "Is it me, or is the light weaker than it was in the woods?"], ["briar", "It is. A little more with every knight we free."]],
  mid:[["narr", "At the altar hangs a lantern-shaped lock. Five rune sockets ring it. Three are dark."], ["you", "Three dark sockets. Three knights freed."], ["voice", "A coincidence."], ["you", "I do not think you have ever told me the truth."], ["voice", "...Climb, Summoner."]],
  boss:[["boss", "Mortals cannot look upon the light and live."], ["you", "Then I will be the first."], ["boss", "Then see it. The lantern is the seal's key. Every knight you free dims it. Look at what you have done."]],
  clear:[["sol", "The lantern is mine to carry again. Forgive me for fighting you, Summoner."], ["sol", "One socket left. Vex holds the last lock. If you free him, the seal breaks."], ["you", "Then why did the Marshal leave the choice to me?"], ["sol", "Because the Order believed that only a whole Order could finish what the seal started."], ["narr", "Sol joins your team. Only the dark remains."]]}},
 {n:'The Hollow Throne',sub:'The top of the Spire, where the curse began',el:4,boss:'Cursed Vex',reward:'vex',story:{
  intro:[["narr", "At the top of the Spire, the curse began. Here the dark is deepest."], ["sol", "The lantern is almost out."], ["you", "I know."], ["voice", "So close. Only one lock left."], ["you", "Tell me your name."], ["voice", "You know it. You have always known it."]],
  mid:[["narr", "A black mirror hangs in the corridor. In it the Summoner stands alone, with no knights beside them. Behind them, something opens like an eye."], ["you", "It was never a voice in my ear."], ["voice", "It was never a curse. It was a door. And you have almost opened it."]],
  boss:[["boss", "I was cast out of the light, and the dark welcomed me. Why would I leave?"], ["you", "Because the Order needs every one of its knights."], ["boss", "Then you have not understood. I was the last one the Marshal chained, and the longest. Turn back."], ["you", "You are the last lock."], ["boss", "I am the last lock. Break me, and it walks."]],
  clear:[["vex", "I had forgotten what it was like to be needed. I am Vex. The Order is whole again."], ["vex", "And the seal is gone."], ["voice", "Thank you, Summoner. A hundred years I waited for someone kind enough to open the door."], ["narr", "Above the Spire, an eye opens in the sky. The floors rise out of the dark, one after another."], ["you", "Then we climb. And we hold it back."], ["narr", "Far below, the rest of the Order stirs and answers your call. The Hollow is free, and the Spire climbs higher than anyone has gone."]]}}];

/* knights: look = helmet style, full = display name, t = title, bio = one line of story */
const KN={
 summoner:{look:'hood',full:'The Summoner',t:'Master of All Elements',bio:'You. A summoner who can call on every element, and the only one who can wake the Order.'},
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
 ['Cinder Path','Ash Gate','Lava Steps','Smoke Hollow','Ember Bridge','Scorch Yard','Magma Stair','Blaze Court','Coal Throne','Cursed Ember'],
 ['Wet Gate','Drip Tunnel','Pearl Pool','Mist Hall','Reef Steps','Tide Bridge','Frost Spring','Deep Hollow','Whirl Gate','Cursed Tide'],
 ['Moss Gate','Fern Trail','Root Bridge','Thorn Path','Vine Hollow','Leaf Court','Bark Steps','Mushroom Glade','Elder Gate','Cursed Briar']];
STAGE_NAMES.push(['Lantern Gate','Candle Hall','Stained Glass','Pilgrim Stairs','Bell Tower','Gilded Aisle','Sun Altar','Choir Loft','Radiant Door','Cursed Sol'],
 ['Black Stairs','Whisper Hall','Shadow Bridge','Void Gallery','Night Court','Hollow Gate','Dusk Terrace','Umbra Stair','Throne Steps','Cursed Vex']);
const STAR_TURNS=18;   /* 3rd star: clear a stage in this many turns or fewer */

const HOME_LINES=[
 'The Spire still stands. So does the Order.',
 'Every knight you recruit brings the throne closer.',
 'Level up before the next boss. The curse does not wait.',
 'Stay sharp. Something in the Spire is listening.',
 'Steel, courage, and a good plan. Let us climb.'];
