'use strict';
const COLS=6,ROWS=5,MOVE_TIME=6000;
const $=id=>document.getElementById(id);

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=n=>Math.random()*n|0;
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let G,grid,busy=true,drag=null,sound=true,ac=null,best=+store.get('orbSpireBest')||0;

/* ---------- saved progress: gold, owned heroes, levels, team, stage stars ---------- */
const SAVE_KEY='orbSpireSave',MAXLV=30;
const sumCost=()=>6000+2000*((SV&&SV.sum)|0);   /* summon price rises with every summon: 6000, 8000, 10000... */
let SV=(function(){
  let o=null;try{o=JSON.parse(store.get(SAVE_KEY))}catch(e){}
  if(!o||typeof o!=='object')o={};
  const core=['ember','tide','briar','sol','vex'],old=!(o.v>=3);
  const sv={v:3,gold:Math.max(0,+o.gold||0),own:{summoner:1},lv:{},team:['summoner'],stars:{},seenHelp:!!o.seenHelp,seen:{},sum:Math.max(0,Math.floor(+o.sum)||0)};
  if(o.lv&&typeof o.lv==='object'&&!Array.isArray(o.lv))HEROES.forEach(h=>{const l=Math.floor(+o.lv[h.id]);if(l>=1)sv.lv[h.id]=Math.min(MAXLV,l)});
  if(o.own&&typeof o.own==='object')HEROES.forEach(h=>{if(o.own[h.id]&&!(old&&core.includes(h.id)))sv.own[h.id]=1});
  if(!old&&Array.isArray(o.team)&&o.team.length<=5&&new Set(o.team).size===o.team.length&&o.team.every(id=>sv.own[id])&&o.team[0]==='summoner')sv.team=o.team.slice();
  else if(old)HEROES.forEach(h=>{if(sv.own[h.id]&&h.id!=='summoner'&&sv.team.length<5)sv.team.push(h.id)});
  if(o.stars&&typeof o.stars==='object')Object.keys(o.stars).forEach(k=>{const v=Math.min(3,Math.floor(+o.stars[k]));if(v>0)sv.stars[k]=v});
  if(!old&&o.seen&&typeof o.seen==='object')Object.keys(o.seen).forEach(k=>{if(o.seen[k])sv.seen[k]=1});
  return sv;
})();
const save=()=>store.set(SAVE_KEY,JSON.stringify(SV));
const heroById=id=>HEROES.find(h=>h.id===id);
const lvOf=h=>SV.lv[h.id]||1;
const atkAt=(h,lv)=>h.atk*(1+.06*(lv-1))*(lv>=20?1.2:1);
const cdAt=(h,lv)=>Math.max(2,h.cd-(lv>=15?1:0));
let TEAM=[];
function syncTeam(){TEAM=SV.team.map(heroById)}
syncTeam();
const atkOf=i=>atkAt(TEAM[i],lvOf(TEAM[i]));
const cdOf=i=>cdAt(TEAM[i],lvOf(TEAM[i]));
const costAt=lv=>Math.round(90*Math.pow(1.22,lv-1));
const maxHp=()=>2400+25*TEAM.reduce((a,h)=>a+lvOf(h)-1,0);
function drawGold(gain){const p=$('goldPill');p.innerHTML='<i class="coin"></i>'+SV.gold.toLocaleString();if(gain)flash(p,'gain')}

/* ---------- music ---------- */
const MUSIC={menu:'snd/menu.mp3',battle:'snd/battle.mp3',bt1:'snd/bt1.mp3',bt2:'snd/bt2.mp3',bt3:'snd/bt3.mp3',bt5:'snd/bt5.mp3',boss:'snd/boss.mp3'},MV={menu:.5,battle:.36,bt1:.38,bt2:.38,bt3:.38,bt5:.30,boss:.48};
/* battle music rotates: neon drive, chase, war march, orchestral. By chapter in story, random per Spire climb */
const BATTLE_TRACKS=['bt1','bt2','bt3','battle'];
const battleKey=(mode,c)=>mode==='stage'&&c===4?'bt5':BATTLE_TRACKS[mode==='stage'?(c||0)%BATTLE_TRACKS.length:Math.floor(Math.random()*BATTLE_TRACKS.length)];   /* chapter 5 (Hollow Throne) has its own theme */
let mbuf={},mcur=null,mwant=null,mnode=null,gest=false;
function mload(k){
  if(!mbuf[k])mbuf[k]=fetch(MUSIC[k]).then(r=>r.arrayBuffer()).then(a=>new Promise((ok,no)=>ac.decodeAudioData(a,ok,no))).catch(()=>null);
  return mbuf[k];
}
function mfade(n,to,sec){if(!n)return;const t=ac.currentTime;n.g.gain.cancelScheduledValues(t);n.g.gain.setValueAtTime(n.g.gain.value,t);n.g.gain.linearRampToValueAtTime(to,t+sec)}
function music(k,blast){
  mwant=k;
  if(!gest)return;
  if(!sound||!k){if(mnode&&ac){mfade(mnode,0,.4);const o=mnode;setTimeout(()=>{try{o.s.stop()}catch(e){}},500);mnode=null;mcur=null}return}
  try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch(e){return}
  if(mcur===k&&mnode){mfade(mnode,MV[k],.5);return}
  mcur=k;
  mload(k).then(buf=>{
    if(!buf||mwant!==k||!sound)return;
    if(mnode&&mnode.k===k)return;
    if(mnode){mfade(mnode,0,.7);const o=mnode;setTimeout(()=>{try{o.s.stop()}catch(e){}},800)}
    const src=ac.createBufferSource(),g=ac.createGain();src.buffer=buf;src.loop=true;g.gain.value=0;src.connect(g).connect(ac.destination);src.start();
    mnode={s:src,g,k,v:MV[k]};if(blast)g.gain.value=MV[k];else mfade(mnode,MV[k],.9);
  });
}
const musicDuck=v=>{if(mnode&&ac)mfade(mnode,mnode.v*v,.6)};
addEventListener('pointerdown',()=>{if(gest)return;gest=true;if(mwant)music(mwant);setTimeout(()=>{try{preloadAudio()}catch(e){}},400)},{capture:true});
document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend();else ac.resume()});
/* ---------- sound ---------- */
function beep(f,len=.09,type='triangle',vol=.12){
  if(!sound)return;
  try{
    ac=ac||new (window.AudioContext||window.webkitAudioContext)();
    if(ac.state==='suspended')ac.resume();
    const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);
    o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len);
  }catch(e){}
}

/* sound effects (synth, no files) */
let nbuf=null;
function sctx(){if(!sound)return null;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();return ac}catch(e){return null}}
function sout(c,g,pan){if(pan&&c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;g.connect(p).connect(c.destination)}else g.connect(c.destination)}
function tone(f0,f1,dur,vol,delay=0,pan=0,type='sine',lpf=0){
  const c=sctx();if(!c)return;const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  let n=o;if(lpf){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=lpf;o.connect(f);n=f}
  n.connect(g);sout(c,g,pan);o.start(t);o.stop(t+dur+.02);
}
function nz(dur,hpf,vol,delay=0,pan=0,lpf=0){
  const c=sctx();if(!c)return;
  if(!nbuf){nbuf=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=nbuf;f.type='highpass';f.frequency.value=hpf;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  let n=s.connect(f);if(lpf){const l=c.createBiquadFilter();l.type='lowpass';l.frequency.value=lpf;n=n.connect(l)}
  n.connect(g);sout(c,g,pan);s.start(t);s.stop(t+dur+.02);
}
/* noise through a band that glides from f0 to f1 (whooshes, splashes) */
function swn(dur,f0,f1,vol,delay=0,pan=0,q=1.2){
  const c=sctx();if(!c)return;
  if(!nbuf){nbuf=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=nbuf;f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(vol,t+dur*.4);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  s.connect(f).connect(g);sout(c,g,pan);s.start(t);s.stop(t+dur+.02);
}
const mhz=m=>440*Math.pow(2,(m-69)/12);
function bellS(f,dur,vol,delay=0,pan=0){tone(f,f,dur,vol,delay,pan);tone(f*2.01,f*2.01,dur*.6,vol*.5,delay,pan)}
/* attack sounds per element: 0 fire 1 water 2 wood 3 light 4 dark */
const lastShot={};
function sShot(el){
  const now=performance.now();if(now-(lastShot[el]||0)<70)return;lastShot[el]=now;
  if(el===0)swn(.26,500,2600,.22,0,-.3,.9);
  else if(el===1){tone(500,1100,.26,.17,0,-.3);swn(.26,1200,3500,.07,0,-.3,.8)}
  else if(el===2)swn(.2,6000,1800,.22,0,-.3,1);
  else if(el===3)[84,88,91,96].forEach((m,i)=>bellS(mhz(m),.25,.12,i*.055,-.3));
  else if(el===4){tone(330,70,.3,.24,0,-.3,'sawtooth',1400);tone(332,70,.3,.17,0,-.3,'sine')}
}
function sHit(el,weak){
  if(el===0){tone(160,45,.35,.32,0,.25);nz(.5,200,.2,0,.25,3500);for(let i=0;i<6;i++)nz(.012,2500,.1,Math.random()*.35,.25)}
  else if(el===1){swn(.45,3500,1400,.28,0,.25,.8);tone(220,90,.2,.18,0,.25);[[.06,700],[.13,950],[.2,1250],[.27,820]].forEach(([d,f])=>tone(f,f*1.8,.07,.07,d,.25))}
  else if(el===2){tone(300,120,.1,.3,0,.25);nz(.015,1500,.2,0,.25);nz(.35,3500,.1,0,.25,9000)}
  else if(el===3){tone(2400,5200,.2,.09,0,.25);bellS(mhz(96),.7,.1,0,.25);nz(.08,5000,.14,0,.25);for(let i=0;i<5;i++)bellS(mhz(100+i*3),.25,.035,.03+i*.05,.25)}
  else if(el===4){tone(110,40,.7,.32,0,.25);tone(98,98,.9,.05,0,.25);tone(138,138,.9,.05,0,.25);nz(.6,100,.14,0,.25,1200)}
  if(weak){tone(120,50,.3,.2,0,.25);bellS(mhz(88),.5,.08,0,.25)}
}
const PENT=[0,2,4,7,9,12,14,16];
const sPick=()=>tone(240,420,.09,.14);
const sTick=k=>{const f=440*Math.pow(2,(72+PENT[k%8]-69)/12);tone(f,f*.98,.07,.1,0,k%2?-.2:.2);nz(.02,2500,.05)};
const sRelease=()=>tone(150,70,.12,.2);
const GEMN=[0,2,4,7,9,12,14,16,19,21];
/* orb break: one pentatonic bell per orb, climbing with the combo */
function sGem(c,i,delay,pan){bellS(mhz(76+GEMN[Math.min(GEMN.length-1,Math.max(0,c)+Math.min(i,4))]),.55,.16,delay,pan);nz(.015,4000,.07,delay,pan)}
function sPop(p,delay,pan){nz(.035,1800,.1,delay,pan);tone(1100*p,320*p,.16,.13,delay,pan);tone(2200*p,3100*p,.22,.035,delay,pan)}
function sSiren(){tone(520,780,.4,.1,0,0,'square',1400);tone(780,520,.4,.1,.42,0,'square',1400)}
function sStep(k){tone(95,55,.07,.14,0,k%2?-.2:.2);nz(.03,500,.05,0,k%2?-.2:.2,900)}
function sBoom(){tone(90,38,.9,.3);nz(.9,300,.12)}

/* ---------- board drawing ---------- */
const cv=$('board'),cx=cv.getContext('2d',{alpha:false});
let lite=store.get('orbLite')==='1',bg=null,slow=0,slowN=0;
function setLite(v,save_){lite=v;if(save_!==false)store.set('orbLite',v?'1':'0');$('app').classList.toggle('lite',v);resize(true)}
let S=60,dpr=1,sprites=[],frame=0,last=0;
function symbol(c,i,r){
  c.beginPath();
  if(i===0){c.moveTo(0,-r);c.bezierCurveTo(r*.2,-r*.4,r,-r*.1,r*.7,r*.5);c.bezierCurveTo(r*.4,r*1.1,-r*.4,r*1.1,-r*.7,r*.5);c.bezierCurveTo(-r,0,-r*.5,-r*.2,-r*.4,-r*.5);c.quadraticCurveTo(-r*.1,-r*.3,0,-r)}
  else if(i===1){c.moveTo(0,-r);c.bezierCurveTo(r*.3,-r*.5,r*.75,0,r*.75,r*.35);c.arc(0,r*.35,r*.75,0,Math.PI);c.bezierCurveTo(-r*.75,0,-r*.3,-r*.5,0,-r)}
  else if(i===2){c.moveTo(r*.85,-r*.85);c.quadraticCurveTo(r*.9,r*.8,-r*.65,r*.65);c.quadraticCurveTo(-r*.8,-r*.9,r*.85,-r*.85)}
  else if(i===3){for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2,q=k%2?r*.45:r;c.lineTo(Math.cos(a)*q,Math.sin(a)*q)}}
  else if(i===4){c.arc(0,0,r*.9,.35*Math.PI,1.65*Math.PI);c.bezierCurveTo(-r*.35,-r*.4,-r*.35,r*.4,r*.41,r*.8)}
  else{c.moveTo(0,r*.85);c.bezierCurveTo(-r*1.4,-r*.1,-r*.6,-r*1.15,0,-r*.4);c.bezierCurveTo(r*.6,-r*1.15,r*1.4,-r*.1,0,r*.85)}
  c.closePath();c.fill();
}
function makeSprites(){
  sprites=EL.map((e,i)=>{
    const s=document.createElement('canvas');s.width=s.height=Math.ceil(S*dpr);
    const c=s.getContext('2d');c.scale(dpr,dpr);c.translate(S/2,S/2);
    const r=S*.465,rb=r*.93;
    let g=c.createLinearGradient(0,-r,0,r);g.addColorStop(0,e.c);g.addColorStop(1,'#000');   /* dark rim */
    c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,7);c.fill();
    g=c.createRadialGradient(-rb*.35,-rb*.4,rb*.05,0,rb*.1,rb*1.05);   /* glossy body */
    g.addColorStop(0,'#fff');g.addColorStop(.25,e.c);g.addColorStop(.78,e.d);g.addColorStop(1,'rgba(0,0,0,.45)');
    c.fillStyle=g;c.beginPath();c.arc(0,0,rb,0,7);c.fill();
    g=c.createRadialGradient(0,rb*.95,0,0,rb*.95,rb*.8);g.addColorStop(0,e.c+'aa');g.addColorStop(1,e.c+'00');   /* bounce light */
    c.save();c.beginPath();c.arc(0,0,rb,0,7);c.clip();c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.restore();
    c.save();c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=3*dpr;c.shadowOffsetY=1.5*dpr;c.fillStyle='rgba(255,255,255,.96)';symbol(c,i,S*.22);c.restore();   /* embossed symbol */
    c.save();c.rotate(-.7);g=c.createLinearGradient(0,-rb*.9,0,-rb*.35);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');   /* shine */
    c.fillStyle=g;c.beginPath();c.ellipse(0,-rb*.62,rb*.5,rb*.26,0,0,7);c.fill();c.restore();
    c.fillStyle='rgba(255,255,255,.95)';c.beginPath();c.arc(-rb*.45,-rb*.5,rb*.07,0,7);c.fill();
    return s;
  });
}
function resize(force){
  const w=Math.min($('app').clientWidth,Math.floor(innerHeight*.48*COLS/ROWS)),nS=Math.floor(w/COLS),nd=lite?1:Math.min(devicePixelRatio||1,2);
  if(force!==true&&nS===S&&nd===dpr&&sprites.length)return;   /* browser bar moving up/down must not rebuild the board */
  boardRect=null;S=nS;dpr=lite?1:Math.min(devicePixelRatio||1,2);
  cv.style.width=S*COLS+'px';cv.style.height=S*ROWS+'px';
  cv.width=S*COLS*dpr;cv.height=S*ROWS*dpr;
  makeSprites();makeBg();redraw();
}
function makeBg(){
  bg=document.createElement('canvas');bg.width=cv.width;bg.height=cv.height;const c=bg.getContext('2d');c.scale(dpr,dpr);
  c.fillStyle='#120c20';c.fillRect(0,0,S*COLS,S*ROWS);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const g=c.createLinearGradient(0,y*S,0,y*S+S),o=(x+y)%2;g.addColorStop(0,o?'#33274f':'#2a2043');g.addColorStop(1,o?'#241b3a':'#1c1530');
    c.fillStyle=g;c.beginPath();if(c.roundRect)c.roundRect(x*S+1.5,y*S+1.5,S-3,S-3,7);else c.rect(x*S+1.5,y*S+1.5,S-3,S-3);c.fill();
    c.strokeStyle='rgba(255,255,255,.07)';c.lineWidth=1;c.beginPath();c.moveTo(x*S+6,y*S+2);c.lineTo(x*S+S-6,y*S+2);c.stroke();
  }
  const v=c.createRadialGradient(S*COLS/2,S*ROWS/2,S*2,S*COLS/2,S*ROWS/2,S*4.2);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.4)');c.fillStyle=v;c.fillRect(0,0,S*COLS,S*ROWS);
}
/* Android can drop canvas memory while the tab sits in the background; rebuild + repaint when coming back */
function repaintBoard(){try{resize(true)}catch(e){try{redraw()}catch(_){}}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){repaintBoard();setTimeout(repaintBoard,250)}});
addEventListener('pageshow',repaintBoard);addEventListener('focus',()=>setTimeout(repaintBoard,100));
function redraw(){if(!frame){last=performance.now();frame=requestAnimationFrame(tick)}}
function tick(now){
  frame=0;const dt=Math.min(50,Math.max(0,now-last));last=now;let moving=false;
  cx.setTransform(1,0,0,1,0,0);cx.drawImage(bg,0,0);cx.setTransform(dpr,0,0,dpr,0,0);
  if(drag&&dt>0){slow=slow*.9+dt*.1;if(++slowN>40&&slow>26&&!lite){setLite(true);toast('Smooth mode on')}}
  if(grid)for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const o=grid[y][x];if(!o)continue;
    const k=Math.min(1,dt/55);
    o.dx-=o.dx*k;o.dy-=o.dy*k;
    if(Math.abs(o.dx)<.01)o.dx=0;if(Math.abs(o.dy)<.01)o.dy=0;
    if(o.fade){o.a=Math.max(0,o.a-dt/220);if(o.a>0)moving=true}
    if(o.pin){o.a=Math.min(1,o.a+dt/240);moving=true;if(o.a>=1)delete o.pin}
    if(o.dx||o.dy)moving=true;
    const al=Math.max(0,o.a),pz=o.pin?.55+.45*al:1;
    cx.globalAlpha=drag&&drag.o===o?.3:al;
    cx.drawImage(sprites[o.t],(x+o.dx+.5-pz/2)*S,(y+o.dy+.5-pz/2)*S,S*pz,S*pz);
    if(o.lock){const px=(x+o.dx+.5)*S,py=(y+o.dy+.5)*S;cx.globalAlpha=al;cx.fillStyle='rgba(10,6,20,.5)';cx.beginPath();cx.arc(px,py,S*.475,0,7);cx.fill();cx.strokeStyle='#cfd4ea';cx.lineWidth=2;cx.stroke();cx.fillStyle='#fff';cx.font='800 '+Math.round(S*.2)+'px system-ui';cx.textAlign='center';cx.fillText(o.lock,px+S*.3,py+S*.36);cx.save();cx.translate(px,py);cx.scale(S*.42/24,S*.42/24);cx.translate(-12,-12);cx.fillStyle='#e6e9f8';cx.fill(LOCKP);cx.restore()}
  }
  cx.globalAlpha=1;
  if(drag){
    const z=S*1.18;cx.drawImage(sprites[drag.o.t],drag.px-z/2,drag.py-z/2,z,z);
    if(drag.start){
      const left=Math.max(0,1-(now-drag.start)/drag.limit);
      const t=$('timer').firstChild;t.style.transform='scaleX('+left+')';const low=left<.3;if(low!==drag.low){drag.low=low;t.classList.toggle('low',low)}
      if(left<=0)endDrag();else moving=true;
    }
  }
  if(moving)redraw();
}

/* ---------- input ---------- */
let boardRect=null;const LOCKP=new Path2D('M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z');
function point(e){
  const r=boardRect||(boardRect=cv.getBoundingClientRect());
  return{x:Math.max(1,Math.min(S*COLS-1,e.clientX-r.left)),y:Math.max(1,Math.min(S*ROWS-1,e.clientY-r.top))};
}
cv.addEventListener('pointerdown',e=>{
  if(busy||drag)return;e.preventDefault();
  boardRect=cv.getBoundingClientRect();$('app').classList.add('dragging');
  const p=point(e),x=p.x/S|0,y=p.y/S|0;
  if(grid[y][x].lock){tone(220,140,.12,.12,0,0,'square',900);return}
  cv.setPointerCapture(e.pointerId);
  drag={id:e.pointerId,x,y,o:grid[y][x],px:p.x,py:p.y,start:0,n:0,limit:MOVE_TIME+G.bonus};sPick();
  slow=16;slowN=0;redraw();
});
cv.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const p=point(e),ox=drag.px,oy=drag.py,steps=Math.ceil(Math.hypot(p.x-ox,p.y-oy)/(S*.15))||1;
  for(let i=1;i<=steps;i++){
    const px=ox+(p.x-ox)*i/steps,py=oy+(p.y-oy)*i/steps,x=px/S|0,y=py/S|0;
    /* round hit zone so diagonal moves don't clip side orbs */
    if((x!==drag.x||y!==drag.y)&&Math.hypot(px-(x+.5)*S,py-(y+.5)*S)<S*.46){
      while(drag.x!==x||drag.y!==y){const nx=drag.x+Math.sign(x-drag.x),ny=drag.y+Math.sign(y-drag.y);if(grid[ny][nx].lock)break;swapTo(nx,ny)}
    }
  }
  drag.px=p.x;drag.py=p.y;redraw();
});
function swapTo(x,y){
  const other=grid[y][x];
  other.dx+=x-drag.x;other.dy+=y-drag.y;
  grid[drag.y][drag.x]=other;grid[y][x]=drag.o;
  drag.x=x;drag.y=y;
  if(!drag.start)drag.start=performance.now();
  sTick(drag.n++);
}
function release(e){if(drag&&e.pointerId===drag.id)endDrag()}
cv.addEventListener('pointerup',release);
cv.addEventListener('pointercancel',release);
function endDrag(){
  sRelease();
  const moved=drag.start;drag=null;$('timer').firstChild.style.transform='scaleX(0)';$('timer').firstChild.classList.remove('low');$('app').classList.remove('dragging');redraw();
  if(moved){G.bonus=0;playTurn()}
}

/* ---------- puzzle logic ---------- */
const orb=(t,dy=0)=>({t,dx:0,dy,a:1,fade:false});
function newGrid(){
  grid=[];
  for(let y=0;y<ROWS;y++){grid[y]=[];for(let x=0;x<COLS;x++){
    let t;do t=rnd(6);while((x>1&&grid[y][x-1].t===t&&grid[y][x-2].t===t)||(y>1&&grid[y-1][x].t===t&&grid[y-2][x].t===t));
    grid[y][x]=orb(t);
  }}
  redraw();
}
function findGroups(){
  const hit=new Set();
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const t=grid[y][x].t;
    if(x<COLS-2&&grid[y][x+1].t===t&&grid[y][x+2].t===t)[0,1,2].forEach(i=>hit.add(y*COLS+x+i));
    if(y<ROWS-2&&grid[y+1][x].t===t&&grid[y+2][x].t===t)[0,1,2].forEach(i=>hit.add((y+i)*COLS+x));
  }
  const groups=[];
  while(hit.size){
    const first=hit.values().next().value,t=grid[first/COLS|0][first%COLS].t,cells=[first];hit.delete(first);
    for(let i=0;i<cells.length;i++){
      const c=cells[i],x=c%COLS,y=c/COLS|0;
      [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([a,b])=>{
        const k=b*COLS+a;
        if(a>=0&&a<COLS&&hit.has(k)&&grid[b][a].t===t){hit.delete(k);cells.push(k)}
      });
    }
    groups.push({t,cells});
  }
  return groups.sort((a,b)=>Math.max(...b.cells)-Math.max(...a.cells));
}
function drop(){
  for(let x=0;x<COLS;x++){
    const keep=[];
    for(let y=ROWS-1;y>=0;y--)if(!grid[y][x].fade)keep.push([grid[y][x],y]);
    const missing=ROWS-keep.length;
    for(let y=ROWS-1,i=0;y>=0;y--,i++){
      if(i<keep.length){const[o,from]=keep[i];o.dy+=from-y;grid[y][x]=o}
      else grid[y][x]=orb(rnd(6),-missing);
    }
  }
  redraw();
}
function convert(from,to){grid.flat().forEach(o=>{if(o.t===from){o.t=to;o.a=1;o.dy=-.25}});redraw()}

/* ---------- battle ---------- */
function advantage(a,d){
  if((a===0&&d===2)||(a===2&&d===1)||(a===1&&d===0)||(a===3&&d===4)||(a===4&&d===3))return 1.5;
  if((a===2&&d===0)||(a===1&&d===2)||(a===0&&d===1))return .5;
  return 1;
}
function log(text,cls=''){
  G.log.unshift({text:`${G.mode==='stage'?G.c+1+'-'+G.s:'F'+G.floor} · ${text}`,cls});if(G.log.length>60)G.log.pop();
}
function pop(parent,text,color,x='50%',y='45%'){
  const d=document.createElement('div');d.className='pop';d.textContent=text;
  d.style.cssText=`color:${color};left:${x};top:${y};translate:-50% 0`;
  parent.appendChild(d);setTimeout(()=>d.remove(),800);
}
function heal(v){
  v=Math.round(Math.min(v,G.max-G.hp));G.hp+=v;drawHP();
  if(v>0){pop($('stage'),'+'+v,'#6ee7a8','50%','75%');log(`Healed ${v} HP`,'you')}
}
function drawHP(){
  $('hpfill').style.width=100*G.hp/G.max+'%';$('hptext').textContent=`Team HP ${Math.ceil(G.hp)} / ${G.max}`+(G.guard>0?'  \u{1F6E1} guard':'');
}
function knight(h,mode){
  if(ART.includes(h.id)){const f=mode==='full'?'full':'head';return `<img class="kimg ${f}" src="img/${h.id}_${f}.webp" alt="" draggable="false" decoding="async">`}
  const e=elOf(h),A=e.c,D=e.d,T=h.r>=4?'#ffd35a':'#1a1d26',M=h.r>=4?'#cfd5e2':h.r===3?'#aab3c4':'#8a93a6',look=(KN[h.id]||{}).look||'great';
  let b;
  if(look==='great')b=`<path d="M50 2C44 12 46 20 50 24C54 20 56 12 50 2Z" fill="${A}"/><path d="M38 12C34 20 38 26 42 28L46 22ZM62 12C66 20 62 26 58 28L54 22Z" fill="${A}" opacity=".7"/><path d="M24 40C24 26 36 20 50 20C64 20 76 26 76 40V74C76 84 66 92 50 96C34 92 24 84 24 74Z" fill="${M}" stroke="${T}" stroke-width="3"/><path d="M24 40C24 26 36 20 50 20C64 20 76 26 76 40Z" fill="#fff" opacity=".25"/><path d="M30 48H70V56H30Z" fill="#0a0716"/><path d="M48 30H52V90H48Z" fill="#000" opacity=".25"/><circle cx="38" cy="52" r="2.6" fill="${A}"/><circle cx="62" cy="52" r="2.6" fill="${A}"/>`;
  else if(look==='fin')b=`<path d="M50 2C40 14 40 24 50 30C60 24 60 14 50 2Z" fill="${A}"/><path d="M26 40C26 26 36 20 50 20C64 20 74 26 74 40V72C74 84 64 92 50 96C36 92 26 84 26 72Z" fill="${M}" stroke="${T}" stroke-width="3"/><path d="M26 40C26 26 36 20 50 20C64 20 74 26 74 40Z" fill="#fff" opacity=".3"/><path d="M32 50H68V58H32Z" fill="#0a0716"/><path d="M22 44C14 50 14 62 22 68M78 44C86 50 86 62 78 68" stroke="${A}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="42" cy="54" r="2.6" fill="${A}"/><circle cx="58" cy="54" r="2.6" fill="${A}"/>`;
  else if(look==='hood')b=`<path d="M50 6C26 8 16 30 18 56L24 92H76L82 56C84 30 74 8 50 6Z" fill="${D}" stroke="${T}" stroke-width="3"/><path d="M50 22C34 24 30 40 32 58C40 68 60 68 68 58C70 40 66 24 50 22Z" fill="#c8a07c"/><path d="M32 40C40 30 60 30 68 40L66 34C58 26 42 26 34 34Z" fill="${D}"/><circle cx="42" cy="48" r="3" fill="#2a1a0a"/><circle cx="58" cy="48" r="3" fill="#2a1a0a"/><path d="M44 60C48 64 52 64 56 60" stroke="#6a4a2a" stroke-width="2" fill="none"/><path d="M70 14C80 14 84 22 78 28C72 26 68 20 70 14Z" fill="${A}"/>`;
  else if(look==='halo')b=`<ellipse cx="50" cy="12" rx="26" ry="7" fill="none" stroke="${A}" stroke-width="4"/><path d="M26 44C26 28 36 22 50 22C64 22 74 28 74 44V72C74 84 64 92 50 96C36 92 26 84 26 72Z" fill="#ece0b4" stroke="${T}" stroke-width="3"/><path d="M26 44C26 28 36 22 50 22C64 22 74 28 74 44Z" fill="#fff" opacity=".45"/><path d="M32 52H68V58H32Z" fill="#0a0716"/><path d="M46 30H54V50H46ZM40 38H60V44H40Z" fill="${A}"/><circle cx="42" cy="55" r="2" fill="${A}"/><circle cx="58" cy="55" r="2" fill="${A}"/>`;
  else b=`<path d="M28 34C14 28 10 14 14 4C24 10 30 20 34 28ZM72 34C86 28 90 14 86 4C76 10 70 20 66 28Z" fill="${D}" stroke="#0a0716" stroke-width="2"/><path d="M24 44C24 28 36 22 50 22C64 22 76 28 76 44V74C76 84 66 92 50 96C34 92 24 84 24 74Z" fill="#3a2d58" stroke="${T==='#1a1d26'?'#0a0716':T}" stroke-width="3"/><path d="M30 50L46 56L36 60ZM70 50L54 56L64 60Z" fill="${A}"/><path d="M40 74H60M44 80H56" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${b}</svg>`;
}
const fullName=h=>(KN[h.id]||{}).full||h.n;
const GLYPH=['\u{1F525}','\u{1F4A7}','\u{1F343}','\u2726','\u263E'];
function drawTeam(){
  $('team').innerHTML='';
  TEAM.forEach((h,i)=>{
    const b=document.createElement('button'),left=G.skill[i],e=elOf(h);
    b.className='hero'+(left?'':' ready')+(h.any?' any':'');b.style.setProperty('--c',e.c);b.style.setProperty('--d',e.d);
    b.setAttribute('aria-label',h.n+(left?', skill in '+left:', skill ready'));
    const cdv=cdOf(i);let pips='';for(let k=0;k<cdv;k++)pips+=`<i class="${k<cdv-left?'on':''}"></i>`;
    b.innerHTML=`<span class="por kn">${knight(h)}</span><strong>${h.n}</strong><span class="pips">${pips}</span>`;
    b.dataset.cd=left?'CD '+left:'';b.onclick=()=>showHero(i);$('team').appendChild(b);
  });
  for(let k=TEAM.length;k<5;k++){const b=document.createElement('div');b.className='hero empty';b.innerHTML='<span class="plus">+</span><strong>Boss reward</strong>';$('team').appendChild(b)}
}
let monId=0;
function monster(f){
  if(!f.boss&&f.el>=0&&f.el<=4)return `<img class="kimg mimg" src="img/m_${f.el}.webp" alt="" draggable="false" decoding="async">`;
  if(f.boss&&f.art&&ART.includes(f.art))return `<img class="kimg bossimg" data-a="${f.art}" src="img/${f.art}_full.webp" alt="" draggable="false" style="--c:${EL[f.el].c}">`;
  if(f.boss&&f.el>=0&&f.el<=4)return `<img class="kimg mimg bossm" src="img/m_${f.el}.webp" alt="" draggable="false" decoding="async" style="--c:${EL[f.el].c}">`;
  const e=EL[f.el],s=f.shape,id='mg'+(monId++);
  const body=['M20 90Q10 35 50 30Q90 35 80 90Z','M50 18L85 55L70 92H30L15 55Z','M15 70Q15 30 50 30Q85 30 85 70L75 92L62 80L50 93L38 80L25 92Z'][s];
  const horns=f.boss?'M24 40L8 4L40 30ZM76 40L92 4L60 30ZM42 28L50 2L58 28Z':['M30 38L22 14L44 32ZM70 38L78 14L56 32Z','M18 55L2 38L28 44ZM82 55L98 38L72 44Z','M50 34L42 10L60 22Z'][s];
  return `<svg viewBox="0 0 100 96"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${e.c}"/><stop offset="1" stop-color="${e.d}"/></radialGradient></defs><path d="${horns}" fill="${e.d}" stroke="#0007" stroke-width="1.5"/><path d="${body}" fill="url(#${id})" stroke="${e.d}" stroke-width="3"/><ellipse cx="34" cy="44" rx="8" ry="3.5" fill="#fff" opacity=".45" transform="rotate(-28 34 44)"/><path d="M29 49L45 55Q40 66 31 60ZM71 49L55 55Q60 66 69 60Z" fill="#fff"/><circle cx="39" cy="58" r="3.4" fill="#10081c"/><circle cx="61" cy="58" r="3.4" fill="#10081c"/><path d="M36 72L43 78L50 72L57 78L64 72" fill="none" stroke="#1a0f24" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
function levelN(){return G.mode==='stage'?Math.max(1,Math.round((G.c*10+G.s)*.8)+G.wave-1):G.floor}
function isBoss(){return G.mode==='stage'?G.wave===3:G.floor%5===0}
const SKD={convert:{n:'Orb Convert',s:'Convert',c:'#b45cff',every:3},lock:{n:'Orb Lock',s:'Lock',c:'#9aa0b8',every:3},strike:{n:'Big Strike',s:'Strike',c:'#ff5a5a',every:4}};
function mkSk(n,boss,big){
  const L=[],pick=()=>Math.random()<.5?'convert':'lock';
  if(boss){if(big){L.push(pick(),'strike');if(n>=12)L.push(L[0]==='convert'?'lock':'convert')}else if(n>=4)L.push(pick())}
  else if(n>=3&&Math.random()<Math.min(.4,.1+n*.02))L.push(pick());
  return L.map((k,i)=>({k,every:SKD[k].every,cd:SKD[k].every+i}));
}
function spawn(){
  if(grid)for(const r of grid)for(const o of r)if(o)delete o.lock;
  const n=levelN(),boss=isBoss(),count=boss?1:n===1?2:1+rnd(3),theme=G.mode==='stage'?CHAPTERS[G.c].el:-1;
  G.n=n;
  const st=G.mode==='stage',big=boss&&(!st||G.s===10),total=700*Math.pow(st?1.12:1.14,n-1)*(boss?(big?1.8:1.3):1),power=Math.pow(st?1.06:1.09,n-1);
  G.target=null;
  G.foes=Array.from({length:count},()=>{
    const hp=Math.round(total/count),cd=boss?(big?2:3):2+rnd(2);
    return{el:theme>=0&&(boss||Math.random()<.7)?theme:rnd(5),shape:rnd(3),boss,art:boss&&st&&G.s===10?CHAPTERS[G.c].reward:null,hp,max:hp,cd:cd+(count>2?1:0),every:cd+(count>2?1:0),sk:mkSk(n,boss,big),atk:Math.round((boss?(big?460:340):300/Math.sqrt(count))*power)};
  });
  $('floor').textContent=G.mode==='stage'?`Stage ${G.c+1}-${G.s}`:`Floor ${n}`;$('bchip').classList.toggle('on',boss);
  $('app').classList.toggle('stagemode',G.mode==='stage');document.querySelectorAll('#wp i').forEach((d,k)=>d.classList.toggle('on',k<G.wave));
  $('stage').querySelectorAll('.foe').forEach(d=>d.remove());
  G.foes.forEach((f,i)=>{
    const d=document.createElement('div');d.className='foe'+(boss?' boss':'')+(G.arrive?' arrive':'');
    d.innerHTML=`<div class="art"><span class="chip"></span><span class="skc"></span>${monster(f)}</div><div class="cd"></div><div class="bar"><i style="background:linear-gradient(90deg,${EL[f.el].d},${EL[f.el].c})"></i></div>`;
    d.onclick=()=>{if(f.hp<=0)return;G.target=G.target===f?null:f;drawFoes()};
    f.dom=d;$('stage').appendChild(d);
  });
  drawFoes();log(`${boss?'Boss':count+' enemies'} appeared`);
}

/* ---------- enemy info sheet ---------- */
const SKI={
 convert:['Converts most orbs on the board to two random colors.','Keep your matches flexible. Use the two colors you are given.'],
 lock:['Locks several orbs for 2 turns. Locked orbs cannot be moved.','Work around the locked orbs. Do not plan combos through them.'],
 strike:['A heavy hit, 2.5 times its normal attack.','Keep your HP high before the countdown ends. Heal with hearts or use Guard.']
};
function foeInfo(f){
  if(!f||drag)return;
  const e=EL[f.el],weak=EL[weakTo(f.el)];
  const name=f.boss&&G.mode==='stage'&&G.s===10?CHAPTERS[G.c].boss:f.boss?'Boss':e.n+' enemy';
  let h=`<h2 style="color:${e.c}">${name} · ${e.n}</h2><ul><li>Weak to <b style="color:${weak.c}">${weak.n}</b>. Attacks every <b>${f.every}</b> turns.</li>`;
  const q=(f.sk||[]).slice().sort((a,b)=>a.cd-b.cd);
  for(const k of q){const d=SKD[k.k],i=SKI[k.k];h+=`<li><b style="color:${d.c}">${d.n}</b> · every ${k.every} turns, next in ${k.cd}<br>${i[0]}<br><i>Counter: ${i[1]}</i></li>`}
  if(!q.length)h+='<li>No special skills.</li>';
  sheet(h+'</ul>',[['Got it',()=>beep(520,.08),'go']]);
}
$('bchip').onclick=()=>{const f=G.foes.find(f=>f.boss&&f.hp>0);if(f)foeInfo(f)};
function drawFoes(){
  G.foes.forEach(f=>{
    if(f.hp<=0&&!f.dying&&!f.boss)mobDie(f);
    f.dom.classList.toggle('dead',!!f.gone);f.dom.classList.toggle('target',G.target===f&&f.hp>0);
    const c=f.dom.querySelector('.cd');
    c.textContent=EL[f.el].n.toUpperCase();const ch=f.dom.querySelector('.chip');ch.textContent=f.cd;ch.classList.toggle('warn',f.cd<=1);ch.title='Hits in '+f.cd;
    const sc=f.dom.querySelector('.skc');
    if(f.sk&&f.sk.length&&f.hp>0){const q=f.sk.slice().sort((a,b)=>a.cd-b.cd)[0],d=SKD[q.k];sc.textContent='\u26A1 '+d.s+' '+q.cd;sc.style.setProperty('--c',d.c);sc.classList.toggle('warn',q.cd<=1);sc.title=d.n+' in '+q.cd+' turns'}
    else sc.textContent='';
    sc.onclick=e=>{e.stopPropagation();foeInfo(f)};
    f.dom.querySelector('.bar i').style.width=100*Math.max(0,f.hp)/f.max+'%';
  });
}

/* ---------- orb break effects: orbs fly to their hero, hero shoots the enemy ---------- */
const REDUCE=matchMedia('(prefers-reduced-motion:reduce)').matches;
function ctr(el){const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function heroEl(t){let l=TEAM.map((h,i)=>h.el===t?i:-1).filter(i=>i>=0);if(!l.length)l=TEAM.map((h,i)=>h.any?i:-1).filter(i=>i>=0);return l.length?$('team').children[l[rnd(l.length)]]:null}
function dot(c,size,glow){
  const d=document.createElement('i');d.style.width=d.style.height=size+'px';
  d.style.background=`radial-gradient(circle at 35% 30%,#fff,${c} 55%,${c}00 100%)`;
  if(!lite)d.style.boxShadow=`0 0 ${glow}px ${c}`;$('fx').appendChild(d);return d;
}
/* ---------- orb break effect (viewport canvas over the board) ---------- */
const OB=[];let ofx=null,og=null,obRun=false;
(function(){
  ofx=document.createElement('canvas');ofx.id='ofx';document.body.appendChild(ofx);og=ofx.getContext('2d');
  const sz=()=>{ofx.width=innerWidth;ofx.height=innerHeight};sz();addEventListener('resize',sz);
})();
function orbBreak(cells,t,combo){
  if(REDUCE||!og)return;const r=cv.getBoundingClientRect(),n=cells.length,col=EL[t].c,big=n>=5,mid=n>=4;
  cells.forEach((k,i)=>OB.push({x:r.left+(k%COLS+.5)*S,y:r.top+((k/COLS|0)+.5)*S,col,s:S,big,sh:lite?0:Math.min(10,(OB.length>24?3:5)+(mid?2:0)+(big?2:0)+Math.min(3,combo-1)),d:i*.02,t0:performance.now(),dur:.46,seed:i+k}));
  if(!obRun){obRun=true;requestAnimationFrame(obLoop)}
}
function obLoop(now){
  og.clearRect(0,0,ofx.width,ofx.height);
  for(let i=OB.length-1;i>=0;i--){
    const e=OB[i],t=(now-e.t0)/1000-e.d;if(t>e.dur){OB.splice(i,1);continue}if(t<0)continue;
    const u=t/e.dur,g=og,S0=e.s,sc=e.big?1.3:1;
    g.save();g.globalCompositeOperation='lighter';
    const gr=g.createRadialGradient(e.x,e.y,0,e.x,e.y,S0*(.55+.6*u)*sc);gr.addColorStop(0,'rgba(255,255,255,'+(.9*(1-u))+')');gr.addColorStop(.45,e.col+'aa');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.globalAlpha=Math.max(0,1-u*1.2);g.fillStyle=gr;g.beginPath();g.arc(e.x,e.y,S0*(.55+.6*u)*sc,0,7);g.fill();
    g.globalAlpha=Math.max(0,1-u);g.strokeStyle=e.col;g.lineWidth=(4*(1-u)+1)*(S0/60);g.beginPath();g.arc(e.x,e.y,S0*(.42+.55*u)*sc,0,7);g.stroke();
    if(e.big){g.globalAlpha=Math.max(0,.7-u);g.beginPath();g.arc(e.x,e.y,S0*(.3+1.0*u),0,7);g.stroke()}
    g.restore();
    for(let q=0;q<e.sh;q++){
      const an=q/e.sh*6.283+fxr(e.seed),sp=S0*(.9+fxr(q,e.seed)*1.1),ee=1-Math.pow(1-u,2),x=e.x+Math.cos(an)*sp*ee,y=e.y+Math.sin(an)*sp*ee+S0*1.3*u*u;
      const w=S0*.1,h=S0*(.16+fxr(q,2)*.1);g.save();g.translate(x,y);g.rotate(an+u*(q%2?4:-4));g.globalAlpha=Math.max(0,1-u*u);
      g.fillStyle=e.col;g.fillRect(-w/2,-h/2,w,h);g.fillStyle='#fff';g.fillRect(-w/2,-h/2,w,h*.4);g.restore();
    }
  }
  if(OB.length)requestAnimationFrame(obLoop);else{obRun=false;og.clearRect(0,0,ofx.width,ofx.height)}
}
function flyOrbs(cells,t){
  if(REDUCE)return;
  const target=t===5?$('hpwrap'):heroEl(t);if(!target)return;
  const to=ctr(target),r=cv.getBoundingClientRect(),c=EL[t].c;
  cells.forEach((k,n)=>{
    const x=r.left+(k%COLS+.5)*S,y=r.top+((k/COLS|0)+.5)*S;
    const d=dot(c,Math.round(S*.34),12),mx=(x+to.x)/2+(x<to.x?-1:1)*30,my=Math.min(y,to.y)-30;
    const a=d.animate([
      {transform:`translate(${x-8}px,${y-8}px) scale(1.3)`,opacity:1},
      {transform:`translate(${mx-8}px,${my-8}px) scale(1)`,opacity:1,offset:.45},
      {transform:`translate(${to.x-8}px,${to.y-8}px) scale(.5)`,opacity:.9}],
      {duration:360,delay:n*35,easing:'cubic-bezier(.4,0,.8,.6)',fill:'both'});
    a.onfinish=()=>{d.remove();if(n===cells.length-1)flash(target,'charge')};
  });
}
function shoot(heroIdx,f,el){
  {const h=TEAM[heroIdx],e=el!=null?el:(h&&!h.any?h.el:-1);if(e>=0)sShot(e)}
  const card=$('team').children[heroIdx];
  if(REDUCE||!card||!f.dom)return Promise.resolve();
  flash(card,'fire');
  {const h=TEAM[heroIdx],e=el!=null?el:(h&&!h.any?h.el:-1);
   if(!lite&&e>=0&&e<=4){const a0=f.dom.querySelector('.art')||f.dom;fxLaunch(e,ctr(card),ctr(a0),a0.getBoundingClientRect().height);return sleep(FX_IMP*1000)}}
  const from=ctr(card),art=f.dom.querySelector('.art')||f.dom,to=ctr(art),c=el!=null&&el>=0?EL[el].c:elOf(TEAM[heroIdx]).c;
  const d=dot(c,26,22);
  const a=d.animate([
    {transform:`translate(${from.x-13}px,${from.y-13}px) scale(.6)`,opacity:1},
    {transform:`translate(${(from.x+to.x)/2-13}px,${Math.min(from.y,to.y)-20}px) scale(1.2)`,opacity:1,offset:.5},
    {transform:`translate(${to.x-13}px,${to.y-13}px) scale(1.6)`,opacity:1}],
    {duration:260,easing:'ease-in',fill:'both'});
  return a.finished.then(()=>d.remove(),()=>d.remove());
}
function slash(f){const d=document.createElement('i');d.className='slash';f.dom.appendChild(d);setTimeout(()=>d.remove(),350)}
function buzz(ms){try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}}
function flash(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}

async function playTurn(){
  busy=true;G.turns++;await sleep(120);
  let combos=0;const power=[0,0,0,0,0,0],wide=[];
  for(let groups=findGroups();groups.length;groups=findGroups()){
    for(const g of groups){
      combos++;power[g.t]+=1+.25*(g.cells.length-3);if(g.cells.length>=5)wide[g.t]=true;
      g.cells.forEach(k=>grid[k/COLS|0][k%COLS].fade=true);flyOrbs(g.cells,g.t);orbBreak(g.cells,g.t,combos);
      $('msg').innerHTML=combos+' COMBO!'+(combos>1?`<small>x${(1+.25*(combos-1)).toFixed(2)} DAMAGE</small>`:'');flash($('msg'),'msgpop');g.cells.forEach((_,n)=>{if(n<6)sGem(combos-1,n,n*.045,Math.max(-.6,Math.min(.6,(n%COLS-2)*.15)))});
      redraw();await sleep(REDUCE?260:320);
    }
    drop();await sleep(300);
  }
  if(combos){
    const mult=1+.25*(combos-1),grow=1+.08*(G.n-1);
    if(power[5])heal(180*power[5]*mult);
    for(let i=0;i<TEAM.length;i++){
      const h=TEAM[i],els=h.any?[0,1,2,3,4].filter(k=>power[k]):(power[h.el]?[h.el]:[]);
      if(!els.length)continue;
      if(!G.foes.some(f=>f.hp>0))break;
      const jobs=els.map(el=>{
        const alive=G.foes.filter(f=>f.hp>0);
        let targets=alive;
        if(!wide[el])targets=[G.target&&G.target.hp>0?G.target:alive.slice().sort((a,b)=>advantage(el,b.el)-advantage(el,a.el)||a.hp-b.hp)[0]];
        return{el,targets,base:atkOf(i)*grow*power[el]*mult*(h.any?SUMMONER_MULT:1)};
      });
      await Promise.all(jobs.flatMap(j=>j.targets.map(f=>shoot(i,f,j.el))));
      let sum=0;
      for(const j of jobs)for(const f of j.targets){
        if(f.hp<=0)continue;
        const a=advantage(j.el,f.el),dmg=Math.round(j.base*a);f.hp-=dmg;sum+=dmg;
        flash(f.dom,'hit');slash(f);sHit(j.el,a>1);pop(f.dom,dmg+(a>1?'!':''),EL[j.el].c);
      }
      log(`${h.n} dealt ${sum}`,'you');
      drawFoes();await sleep(300);
    }
    if(combos>=4){flash($('stage'),'shake');sBoom();buzz(25)}
    log(`${combos} combo (x${mult.toFixed(2)})`,'you');
  }else log('No match','you');
  G.skill=G.skill.map(v=>Math.max(0,v-1));drawTeam();
  for(const r of grid)for(const o of r)if(o&&o.lock&&--o.lock<=0)delete o.lock;redraw();
  await sleep(250);$('msg').textContent='';
  if(G.foes.every(f=>f.hp<=0))return waveCleared();
  for(const f of G.foes){
    if(f.hp<=0)continue;
    if(--f.cd<=0){
      f.cd=f.every;const hit=G.guard>0?Math.round(f.atk/2):f.atk;if(G.guard>0)G.guard--;G.hp=Math.max(0,G.hp-hit);drawHP();flash(f.dom,'atk');
      pop($('stage'),'-'+hit,'#ff6b6b','50%','75%');log(`${EL[f.el].n} enemy hit you for ${hit}`,'foeLog');
      beep(90,.25,'sawtooth',.14);flash($('stage'),'shake');buzz(50);drawFoes();await sleep(450);
    }
    if(G.hp>0&&f.sk)for(const q of f.sk){if(--q.cd<=0){q.cd=q.every;await foeSkill(f,q);if(G.hp<=0)break}}
    if(G.hp<=0)return gameOver();
  }
  drawFoes();busy=false;
}
function skFlash(c){const d=document.createElement('div');d.className='skfx';d.style.setProperty('--c',c);document.body.appendChild(d);setTimeout(()=>d.remove(),900)}
async function foeSkill(f,q){
  const d=SKD[q.k];let sub='';
  flash(f.dom,'atk');skFlash(d.c);
  if(q.k==='convert'){swn(.5,300,2600,.2,0,0,.9);tone(180,420,.5,.12,0,0,'sawtooth',900)}
  else if(q.k==='lock'){tone(900,300,.14,.2,0,0,'square',2400);nz(.12,3000,.15);tone(700,250,.14,.18,.12,0,'square',2400)}
  else{tone(110,420,.5,.16,0,0,'sawtooth',1200)}
  if(q.k==='convert'){
    const a=rnd(5),b=(a+1+rnd(4))%5;sub=EL[a].n+' & '+EL[b].n;const bad=(x,y,t)=>(x>1&&grid[y][x-1].t===t&&grid[y][x-2].t===t)||(y>1&&grid[y-1][x].t===t&&grid[y-2][x].t===t);
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const o=grid[y][x];if(o.lock)continue;
      let t=Math.random()<.7?(Math.random()<.5?a:b):o.t;
      for(let k=0;k<6&&bad(x,y,t);k++)t=rnd(5);
      o.t=t;o.a=-(x+y)*.06;o.pin=true;
    }
    for(let i=0;i<12;i++){const gs=findGroups();if(!gs.length)break;for(const g of gs){const c=g.cells.map(k=>grid[k/COLS|0][k%COLS]).find(o=>!o.lock);if(c)c.t=(c.t+1+rnd(4))%5}}
    redraw();
  }else if(q.k==='lock'){
    const cells=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!grid[y][x].lock)cells.push([x,y]);
    cells.sort(()=>Math.random()-.5);const have=30-cells.length,n=Math.max(0,Math.min(Math.min(9,5+Math.floor(G.n/6)),8-have));cells.slice(0,n).forEach(([x,y])=>grid[y][x].lock=2);
    for(const r of grid)for(const o of r)if(o.lock)o.lock=2;
    sub=(n||have)+' orbs locked';redraw();
  }else{
    const hit=Math.round(f.atk*2.5)*(G.guard>0?.5:1);if(G.guard>0)G.guard--;
    G.hp=Math.max(0,G.hp-Math.round(hit));drawHP();pop($('stage'),'-'+Math.round(hit),'#ff6b6b','50%','75%');log(`${EL[f.el].n} enemy used Big Strike for ${Math.round(hit)}`,'foeLog');
    sub='Heavy damage';sBoom();flash($('stage'),'shake');buzz(80);
  }
  $('msg').innerHTML=d.n+'!<small>'+sub+'</small>';flash($('msg'),'msgpop');drawFoes();await sleep(950);$('msg').textContent='';
}
async function nextFloor(){
  if(G.floor>best){best=G.floor;store.set('orbSpireBest',best);drawBest()}
  const gold=Math.round((12+G.floor*4)*(G.floor%5===0?3:1));SV.gold+=gold;G.runGold+=gold;save();drawGold(true);
  $('msg').innerHTML=`Floor cleared!<small>+${gold} \u{1FA99}</small>`;flash($('msg'),'msgpop');beep(660,.15);await sleep(150);beep(880,.25);await sleep(450);
  $('msg').textContent='';G.floor++;heal(G.max*.25);await walk(isBoss());G.arrive=true;spawn();G.arrive=false;busy=false;
}
/* ---------- 3D runner road (pseudo-3D canvas behind the enemies) ---------- */
const RD={c:null,g:null,W:0,H:0,off:0,v:0,go:false,boss:false,run:false};
function roadSize(){
  const st=$('stage');if(!RD.c||!st)return;
  const r=Math.min(window.devicePixelRatio||1,1.5),W=st.clientWidth,H=st.clientHeight;
  if(!W||!H)return;
  RD.W=W;RD.H=H;RD.c.width=Math.round(W*r);RD.c.height=Math.round(H*r);RD.g.setTransform(r,0,0,r,0,0);roadDraw();
}
function roadDraw(){
  const g=RD.g,W=RD.W,H=RD.H;if(!g||!W)return;
  const hy=H*.44,cx=W/2,f=W*.95,hh=1,Z0=f*hh/(H-hy),L=2,boss=RD.boss;
  const sx=(x,z)=>cx+f*x/z,sy=z=>hy+f*hh/z,col=boss?['#ff3a5a','#ff8a9a']:['#b58cff','#5ad1ff'];
  g.clearRect(0,0,W,H);
  /* ground under everything */
  let gr=g.createLinearGradient(0,hy,0,H);gr.addColorStop(0,boss?'#2a0d1a':'#1b1038');gr.addColorStop(1,'#07050f');g.fillStyle=gr;g.fillRect(0,hy,W,H-hy);
  /* road strips (far to near) */
  const base=Math.floor(RD.off/L),fr=RD.off-base*L;
  const n=Math.ceil(70/L);
  for(let j=n;j>=0;j--){
    const z1=Math.max(Z0*.5,j*L-fr+Z0*.2),z2=Math.max(Z0*.5,(j+1)*L-fr+Z0*.2),idx=(base+j)&1;
    if(z2<=z1)continue;
    g.fillStyle=idx?(boss?'#2c1020':'#2a1650'):(boss?'#240d1a':'#21123f');
    g.beginPath();g.moveTo(sx(-1.3,z2),sy(z2));g.lineTo(sx(1.3,z2),sy(z2));g.lineTo(sx(1.3,z1),sy(z1));g.lineTo(sx(-1.3,z1),sy(z1));g.fill();
    if(idx){ /* lane dashes */
      g.fillStyle='rgba(235,220,255,.55)';
      for(const lx of[-.43,.43]){g.beginPath();g.moveTo(sx(lx-.03,z2),sy(z2));g.lineTo(sx(lx+.03,z2),sy(z2));g.lineTo(sx(lx+.03,z1),sy(z1));g.lineTo(sx(lx-.03,z1),sy(z1));g.fill()}
    }
  }
  /* neon road edges */
  g.lineCap='round';
  for(const [ex,c] of[[-1.3,col[0]],[1.3,col[1]]]){
    g.strokeStyle=c;g.lineWidth=3;g.shadowColor=c;g.shadowBlur=lite?0:10;
    g.beginPath();g.moveTo(sx(ex,Z0*.5),sy(Z0*.5));g.lineTo(sx(ex,80),sy(80));g.stroke();g.shadowBlur=0;
  }
  /* buildings both sides (far to near) */
  const B=3,m0=Math.floor(RD.off/B),bf=RD.off-m0*B,mc=Math.ceil(66/B);
  for(let j=mc;j>=0;j--){
    const z=j*B-bf+Z0*.2,d=2.2;if(z<Z0*.4)continue;
    const k=m0+j;
    for(const side of[-1,1]){
      const rn=(((k*2+(side>0?1:0))*9301+49297)%233280)/233280,Hh=1.1+rn*2.8,xin=side*1.85,xout=side*(3.2+rn*.8);
      const yb=sy(z),yt=yb-f*Hh/z,yb2=sy(z+d),yt2=yb2-f*Hh/(z+d);
      const a=Math.min(1,Math.max(0,1.15-z/60)); /* fade into the distance */
      g.globalAlpha=a;
      g.fillStyle=boss?'#1d0a14':'#150d2c';
      g.beginPath();g.moveTo(sx(xin,z),yb);g.lineTo(sx(xin,z+d),yb2);g.lineTo(sx(xin,z+d),yt2);g.lineTo(sx(xin,z),yt);g.fill();
      g.fillStyle=boss?'#2a1020':'#221548';
      const x1=sx(xin,z),x2=sx(xout,z);g.fillRect(Math.min(x1,x2),yt,Math.abs(x2-x1),yb-yt);
      g.fillStyle=col[side>0?1:0];g.fillRect(Math.min(x1,x2),yt,Math.abs(x2-x1),Math.max(1.5,f*.05/z));
      if(rn>.35){g.fillStyle='rgba(255,230,160,.75)';const ww=Math.abs(x2-x1)*.16,hh2=(yb-yt)*.07;
        for(let q=0;q<3;q++)g.fillRect(Math.min(x1,x2)+Math.abs(x2-x1)*(.15+q*.28),yt+(yb-yt)*(.25+(q%2)*.22),ww,hh2)}
      g.globalAlpha=1;
    }
  }
  /* haze at the horizon */
  const hz=g.createLinearGradient(0,hy-H*.06,0,hy+H*.22);hz.addColorStop(0,boss?'rgba(255,60,90,0)':'rgba(190,140,255,0)');hz.addColorStop(.3,boss?'rgba(255,60,90,.35)':'rgba(190,140,255,.35)');hz.addColorStop(1,'rgba(13,10,31,0)');
  g.fillStyle=hz;g.fillRect(0,hy-H*.06,W,H*.28);
}
function roadLoop(){
  if(RD.run)return;RD.run=true;let last=performance.now();
  const step=now=>{
    const dt=Math.min(.05,(now-last)/1000);last=now;
    RD.v=RD.go?Math.min(RD.v+70*dt,RD.boss?26:20):Math.max(RD.v-60*dt,0);
    RD.off+=RD.v*dt;roadDraw();
    if(RD.go||RD.v>0)requestAnimationFrame(step);else RD.run=false;
  };
  requestAnimationFrame(step);
}
(function(){
  const sc=$('scene');if(!sc)return;
  const c=document.createElement('canvas');c.id='road';sc.insertBefore(c,sc.firstChild);
  RD.c=c;RD.g=c.getContext('2d');
  if(window.ResizeObserver)new ResizeObserver(roadSize).observe($('stage'));
  addEventListener('resize',roadSize);setTimeout(roadSize,50);
})();
/* walking transition between waves / floors */
async function walk(boss){
  const app=$('app'),sc=$('scene'),quick=REDUCE||lite,dur=quick?(boss?1800:500):boss?5200:1450;
  const t0=performance.now();let skip=false;const tap=()=>{if(!boss||performance.now()-t0>1800)skip=true};let warn=null,siren=0;
  app.classList.add('walking');if(boss)app.classList.add('walkboss');
  const ps=[];
  RD.boss=!!boss;if(!quick){RD.go=true;roadLoop()}else roadDraw();
  if(boss){music(null);if(ac)mload('boss');warn=document.createElement('div');warn.id='warn';warn.innerHTML='<b>\u26A0 WARNING \u26A0</b><small>A BOSS APPROACHES</small>';$('stage').appendChild(warn);sSiren();siren=setInterval(sSiren,900)}
  let k=0;sStep(k++);const iv=setInterval(()=>sStep(k++),330);
  $('stage').addEventListener('pointerdown',tap,{once:true});
  while(performance.now()-t0<dur&&!skip)await sleep(40);
  clearInterval(iv);clearInterval(siren);if(warn)warn.remove();$('stage').removeEventListener('pointerdown',tap);
  if(boss){sBoom();flash($('stage'),'shake');buzz(60);music('boss',true)}
  RD.go=false;app.classList.remove('walking','walkboss');setTimeout(()=>{if(!RD.go){RD.boss=false;if(!RD.run)roadDraw()}},500);
}
async function waveCleared(){
  for(const f of G.foes)if(f.boss&&f.hp<=0&&!f.gone)await bossDie(f);
  if(G.mode==='spire')return nextFloor();
  if(G.wave<3){
    $('msg').innerHTML=`Wave ${G.wave} cleared!`;flash($('msg'),'msgpop');beep(660,.15);await sleep(150);beep(880,.2);await sleep(450);
    $('msg').textContent='';G.wave++;heal(G.max*.15);await walk(isBoss());G.arrive=true;spawn();G.arrive=false;busy=false;return;
  }
  victory();
}
/* ---------- stages: stars, unlocks, rewards ---------- */
const starsOf=(c,s)=>SV.stars[c+'-'+s]||0;
const unlocked=(c,s)=>s>1?starsOf(c,s-1)>0:(c===0||starsOf(c-1,10)>0);
const totalStars=()=>Object.values(SV.stars).reduce((a,b)=>a+b,0);
const nextStage=(c,s)=>s<10?[c,s+1]:c<CHAPTERS.length-1?[c+1,1]:null;
const weakTo=el=>[1,2,0,4,3,5][el];
function frontier(){
  for(let c=0;c<CHAPTERS.length;c++)for(let s=1;s<=10;s++)if(!starsOf(c,s))return unlocked(c,s)?[c,s]:[c,Math.max(1,s-1)];
  return[CHAPTERS.length-1,10];
}
function victory(){
  musicDuck(.35);
  if(G.s===10&&!G.vdone&&!SV.seen['c'+G.c+'o']){G.vdone=1;return storyOnce('c'+G.c+'o',CHAPTERS[G.c].story.clear,victory)}
  const c=G.c,s=G.s,idx=c*10+s,old=starsOf(c,s);
  const goals=[true,G.hp>=G.max*.5,G.turns<=STAR_TURNS],stars=goals.filter(Boolean).length;
  const base=old?8+idx*2:40+idx*8,bonus=Math.max(0,stars-old)*20,gold=base+bonus;
  const nx=nextStage(c,s),newChap=!old&&s===10&&nx;
  let joined=null;const rw=CHAPTERS[c].reward;
  if(s===10&&rw&&!SV.own[rw]){SV.own[rw]=1;SV.lv[rw]=SV.lv[rw]||1;if(SV.team.length<5)SV.team.push(rw);syncTeam();joined=heroById(rw)}
  if(stars>old)SV.stars[c+'-'+s]=stars;
  SV.gold+=gold;save();drawGold(true);
  const v=$('victory'),boss=s===10;
  const STAR='<svg viewBox="0 0 24 24"><path stroke-linejoin="round" d="M12 2l2.9 6.6 7.1.7-5.3 4.8 1.5 7L12 17.5 5.8 21l1.5-7L2 9.3l7.1-.7z"/></svg>';
  const lead=TEAM[H.lead%TEAM.length]||heroById('summoner');
  v.innerHTML=`<div class="vt"><small>${boss?CHAPTERS[c].boss.toUpperCase():'STAGE '+(c+1)+'-'+s}</small><b>${boss?'BOSS DEFEATED!':'STAGE CLEAR!'}</b></div>
  <div class="vstars"><svg width="0" height="0" style="position:absolute"><defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".55" stop-color="#ffd25a"/><stop offset="1" stop-color="#e08a1a"/></linearGradient></defs></svg>${[0,1,2].map(k=>`<span class="${k<stars?'on':''}" style="--d:${.35+k*.4}s">${STAR}</span>`).join('')}</div>
  <div class="vgoals"><span class="${goals[0]?'ok':''}"><i></i>Win</span><span class="${goals[1]?'ok':''}"><i></i>Half HP left</span><span class="${goals[2]?'ok':''}"><i></i>\u2264${STAR_TURNS} turns (${G.turns})</span></div>
  ${joined?`<div class="vhero" style="--c:${elOf(joined).c}"><span class="knp">${knight(joined,"full")}</span><i class="vrune"></i></div><div class="vnk"><small>NEW KNIGHT</small><b>${fullName(joined)}</b><em>${(KN[joined.id]||{}).t||''}</em></div>`:`<div class="vhero" style="--c:${elOf(lead).c}"><span class="knp">${knight(lead,"full")}</span><i class="vrune"></i></div>`}
  <div class="vcard"><div class="vrow"><div><i class="vcoin"></i><span><b>+${base}</b><em>${old?'Replay':'First clear'}</em></span></div>${bonus?`<div><i class="vspark">\u2726</i><span><b>+${bonus}</b><em>New stars</em></span></div>`:''}</div>
  ${newChap?`<div class="vnew">Chapter ${nx[0]+1} unlocked!</div>`:''}</div>
  <div class="vbtns"><button id="vMap">Map</button><button id="vRetry">Retry</button>${nx&&unlocked(nx[0],nx[1])?'<button class="go" id="vNext">Next \u25b6</button>':''}</div>`;
  v.classList.add('on');
  if(joined)setTimeout(()=>{beep(520,.15);setTimeout(()=>beep(780,.15),140);setTimeout(()=>beep(1040,.3),280)},1700);
  const t=k=>setTimeout(()=>beep([660,880,1100][k],.18),350+k*400);
  for(let k=0;k<stars;k++)t(k);
  $('vMap').onclick=()=>{v.classList.remove('on');openHome('map',c,s)};
  $('vRetry').onclick=()=>begin('stage',c,s);
  if($('vNext'))$('vNext').onclick=()=>begin('stage',nx[0],nx[1]);
}
/* ---------- sheets ---------- */
function toast(t){pop($('stage'),t,'#9af0c4','50%','30%')}
function sheet(html,buttons){
  $('box').innerHTML=html+'<div class="row"></div>';
  const row=$('box').querySelector('.row');
  buttons.forEach(([label,fn,cls,off])=>{
    const b=document.createElement('button');b.textContent=label;b.className=cls||'';b.disabled=!!off;
    b.onclick=()=>{$('sheet').classList.remove('on');fn&&fn()};row.appendChild(b);
  });
  $('sheet').classList.add('on');
}
function showHero(i){
  if(drag)return;
  const h=TEAM[i],left=G.skill[i];
  sheet(`<h2 style="color:${elOf(h).c}">${fullName(h)} · ${elOf(h).n}</h2><p>${skillText(h)}</p><p>${left?`Ready in ${left} turn${left>1?'s':''}.`:'Ready now. Using it does not end your turn.'}</p>`,[
    ['Close'],
    ['Use skill',()=>{if(busy||G.skill[i])return;G.skill[i]=cdOf(i);runSkill(h,i);log(`${h.n} used skill`,'you');drawTeam();beep(740,.2)},'go',left||busy]]);
}
function help(buttons){
  sheet(`<h2>Orb Spire</h2><ul>
  <li><b>Drag one orb</b> around the board. Others swap out of its way. You have 6 seconds.</li>
  <li>Line up <b>3 or more</b>. More combos means more damage.</li>
  <li>Match <b>5 connected</b> to hit all enemies. Hearts heal.</li>
  <li>Fire beats Wood, Wood beats Water, Water beats Fire. Light and Dark beat each other.</li>
  <li>Tap an enemy to target it. Tap a hero for skills.</li></ul>`,buttons);
}
function gameOver(){
  musicDuck(.35);
  beep(70,.6,'sawtooth',.15);
  if(G.mode==='stage'){const c=G.c,s=G.s;sheet(`<h2>Defeated</h2><p>Stage ${c+1}-${s} \u00b7 wave ${G.wave} of 3.<br>Level up your heroes or change your team, then try again.</p>`,[['Map',()=>openHome('map',c,s)],['Retry',()=>begin('stage',c,s),'go']]);return}
  sheet(`<h2>Defeated on floor ${G.floor}</h2><p>Best floor cleared: ${best}<br>Gold earned this run: ${G.runGold} \u{1FA99}</p><p>Spend gold on heroes to climb higher.</p>`,[['Home',()=>openHome('spire')],['Play again',()=>begin('spire'),'go']]);
}
function drawBest(){$('best').textContent=best?'Best '+best:''}
function begin(mode,c,sn){
  HOME().classList.remove('on');$('victory').classList.remove('on');syncTeam();
  G={mode,c:c||0,s:sn||1,wave:1,floor:1,n:1,turns:0,guard:0,hp:maxHp(),max:maxHp(),skill:TEAM.map((h,i)=>cdOf(i)),bonus:0,log:[],foes:[],target:null,runGold:0};
  $('msg').textContent='';newGrid();spawn();drawHP();drawTeam();drawBest();drawGold();busy=true;
  const run=()=>showIntro(()=>{busy=false;if(!SV.seenHelp){SV.seenHelp=true;save();help([['Start climbing',()=>beep(520,.1),'go']])}});
  if(mode==='stage'){const st=CHAPTERS[G.c].story;
    if(G.s===1)storyOnce('c'+G.c+'i',st.intro,run);
    else if(G.s===10)storyOnce('c'+G.c+'b',st.boss,run);
    else run();}
  else run();
}
function storyOnce(key,lines,cb){
  if(SV.seen[key]||!lines||!lines.length)return cb();
  SV.seen[key]=1;save();playStory(lines,cb,key.endsWith('i')?G.c:-1);
}
function playStory(lines,cb,card){
  const el=$('story'),ch=CHAPTERS[G.c];let k=-1,t0=0;
  const speaker=w=>{
    if(w==='narr')return{name:'',art:''};
    if(w==='boss')return{name:ch.boss.toUpperCase(),art:monster({el:ch.el,shape:1,boss:true,art:ch.reward}),boss:true};
    const h=heroById(w==='you'?'summoner':w);return{name:w==='you'?'YOU':fullName(h).toUpperCase(),art:knight(h,'full'),c:elOf(h).c};
  };
  const finish=()=>{el.classList.remove('on');el.onclick=null;cb()};
  const next=()=>{
    k++;if(k>=lines.length)return finish();
    const [w,txt]=lines[k],sp=speaker(w);
    el.querySelector('.sbox').innerHTML=`${sp.name?`<span class="snm" style="${sp.c?'--c:'+sp.c:''}">${sp.name}</span>`:''}<p class="${w==='narr'?'narr':''}">${txt}</p><div class="snx">${k+1<lines.length?'TAP \u25b6':'TAP TO CONTINUE'}</div>`;
    el.querySelector('.sart').innerHTML=sp.art?`<div class="${sp.boss?'sboss':'sknight'}" style="${sp.c?'--c:'+sp.c:''}">${sp.art}</div>`:'';
    beep(sp.boss?90:300,.06,'triangle',.08);
  };
  el.innerHTML=`<div class="swall"></div><i class="torch" style="left:34px"></i><i class="torch" style="right:34px"></i><button class="sskip" id="sSkip">Skip</button>
  <div class="sart"></div><div class="sbox"></div>`;
  el.classList.add('on');$('sSkip').onclick=e=>{e.stopPropagation();finish()};
  const go=()=>{el.onclick=()=>{if(performance.now()-t0>250){t0=performance.now();next()}};t0=performance.now();next()};
  if(card>=0){
    const c=CHAPTERS[card];
    el.insertAdjacentHTML('beforeend',`<div class="scard"><div class="crest"><svg viewBox="0 0 40 48" width="44"><path d="M6 44V20h5v-6h4v6h4v-8h2V4l4 3-4 3v2h2v8h4v-6h4v6h5v24Z" fill="#ffd35a"/><path d="M17 44v-9a3 3 0 0 1 6 0v9Z" fill="#1a1030"/></svg></div><small>CHAPTER ${card+1}</small><b>${c.n.toUpperCase()}</b><span>${c.sub}</span></div>`);
    beep(110,.4,'sine',.22);
    const cardEl=el.querySelector('.scard');let moved=false;
    const adv=()=>{if(moved)return;moved=true;cardEl.remove();go()};
    el.onclick=adv;setTimeout(adv,2300);
  }else go();
}
function showIntro(cb){
  const el=$('intro'),st=G.mode==='stage',ch=CHAPTERS[G.c],weak=EL[weakTo(ch.el)],boss=st&&G.s===10;
  el.innerHTML=`<div class="iband${boss?' boss':''}"><small>${st?(boss?'BOSS \u00b7 ':'')+'CHAPTER '+(G.c+1):'ENDLESS'}</small><b>${st?'STAGE '+(G.c+1)+'-'+G.s:'THE SPIRE'}</b><span>${st?STAGE_NAMES[G.c][G.s-1]+' \u00b7 3 waves \u00b7 weak to <i style="color:'+weak.c+'">'+weak.n+'</i>':'Climb as high as you can'}</span></div><div class="igo">GO!</div>`;
  el.classList.add('on');beep(110,.3,'sine',.22);
  let done=false;const end=()=>{if(done)return;done=true;clearTimeout(t);el.classList.remove('on');beep(660,.15);cb()};
  const t=setTimeout(end,REDUCE?900:1900);el.onclick=end;
}
function runSkill(h,i){
  const s=h.sk;
  if(s.k==='convert')convert(s.a,s.b);
  else if(s.k==='heal')heal(G.max*s.p);
  else if(s.k==='delay'){G.foes.forEach(f=>{if(f.hp>0)f.cd+=s.t});drawFoes()}
  else if(s.k==='time')G.bonus=s.ms;
  else if(s.k==='guard'){G.guard=s.t;drawHP()}
  else nuke(h,i,s.m);
}
async function nuke(h,i,m){
  busy=true;const alive=G.foes.filter(f=>f.hp>0);
  await Promise.all(alive.map(f=>shoot(i,f)));
  const grow=1+.08*(G.n-1);let sum=0;
  for(const f of alive){const d=Math.round(atkOf(i)*grow*m*advantage(h.el,f.el));f.hp-=d;sum+=d;flash(f.dom,'hit');slash(f);pop(f.dom,d,elOf(h).c)}
  log(`${h.n} skill dealt ${sum}`,'you');beep(120,.3,'square',.1);flash($('stage'),'shake');drawFoes();await sleep(400);
  if(G.foes.every(f=>f.hp<=0))return waveCleared();
  busy=false;
}

/* ---------- home: Map / Heroes / Spire ---------- */
const HOME=()=>$('home');
const H={tab:'home',c:0,s:1,hero:null,pick:false,lead:0};
const goldPill=()=>`<span class="pill" style="margin:0"><b class="gc"></b>${SV.gold.toLocaleString()}</span>`;
function openHome(tab,c,sn){
  if(drag)return;
  music('menu');
  H.tab=tab||'home';H.hero=null;H.pick=false;
  if(c!=null){H.c=c;H.s=sn}else{const f=frontier();H.c=f[0];H.s=f[1]}
  busy=true;H.scroll=true;$('victory').classList.remove('on');renderHome();HOME().classList.add('on');scrollSel();
}
function renderHome(){
  HOME().classList.toggle('hm',H.tab==='home');
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===H.tab));
  ({home:viewHome,map:viewMap,heroes:viewHeroes,spire:viewSpire})[H.tab]();
}
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{const was=H.tab;H.tab=b.dataset.t;H.hero=null;H.pick=false;if(H.tab==='map'&&was!=='map'){const f=frontier();H.c=f[0];H.s=f[1];H.scroll=true}renderHome()});
const NODE_X=[50,74,44,70,34,62,30,64,42,52],ROW_H=66,PATH_H=10*ROW_H+40;
function viewHome(){
  const x=TEAM[H.lead%TEAM.length]||heroById('summoner'),e=elOf(x),f=frontier(),fc=f[0],fs=f[1];
  $('hbar').innerHTML=`<div class="hlv"><div class="lvb"><div>${lvOf(heroById('summoner')||x)}</div></div><span>SUMMONER</span></div>${goldPill()}`;
  $('hbody').innerHTML=`<div class="homebox"><div class="hlogo"><h1>Orb Spire</h1><p>Climb the Spire</p></div><div class="hbub" id="hBub">${HOME_LINES[H.line|0]}</div>
  <button class="hlead" id="hLead" style="--c:${e.c};--d:${e.d}" aria-label="Change hero"><span class="knp">${knight(x,"full")}</span></button><div class="hplat"></div>
  <div class="hname"><div class="hplate"><b>${fullName(x)}</b></div><small>${x.any?'ALL ELEMENTS':e.n.toUpperCase()} \u00b7 LV ${lvOf(x)}</small></div></div>`;
  let segs='';for(let k=1;k<=10;k++)segs+=`<i${starsOf(fc,k)>0?' class="f"':''}></i>`;
  $('hfoot').innerHTML=`<div class="spanel"><small class="cap">CHAPTER ${fc+1} \u00b7 ${CHAPTERS[fc].n}</small><div class="sp1b">Stage ${fc+1}-${fs} \u00b7 ${STAGE_NAMES[fc][fs-1]}</div><div class="seg">${segs}</div><button class="up go adv" id="goBtn"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>ADVENTURE</button></div>`;
  $('goBtn').onclick=()=>begin('stage',fc,fs);
  $('hLead').onclick=()=>{H.lead=(H.lead+1)%TEAM.length;H.line=((H.line|0)+1)%HOME_LINES.length;beep(520,.08);viewHome();const b=$('hBub');if(b){b.classList.add('show');clearTimeout(H.bt);H.bt=setTimeout(()=>b.classList.remove('show'),2800)}};
}
function viewMap(){
  const ch=CHAPTERS[H.c],sel=H.s;
  $('hbar').innerHTML=`<h2><small>\u2605 ${totalStars()} / ${CHAPTERS.length*30} TOTAL</small>Map</h2>${goldPill()}`;
  let cs=0;for(let k=1;k<=10;k++)cs+=starsOf(H.c,k);
  let h=`<div class="banner" style="--c:${EL[ch.el].c};--d:${EL[ch.el].d}"><div><small>CHAPTER ${H.c+1}</small><b>${ch.n}</b></div><span>\u2605 ${cs}/30</span></div><div class="chaps">`;
  CHAPTERS.forEach((c,k)=>{const ok=unlocked(k,1);h+=`<button data-k="${k}" class="${k===H.c?'on':''}" ${ok?'':'disabled'}>${ok?k+1:'\u{1F512}'}</button>`});
  h+='</div><div class="path" style="height:'+PATH_H+'px;--c:'+EL[ch.el].c+'">';
  const pts=[];for(let s=1;s<=10;s++)pts.push(`${NODE_X[s-1]},${(10-s)*ROW_H+ROW_H/2+20}`);
  h+=`<svg viewBox="0 0 100 ${PATH_H}" preserveAspectRatio="none"><polyline vector-effect="non-scaling-stroke" points="${pts.join(' ')}"/></svg>`;
  const fr=frontier();
  for(let s=1;s<=10;s++){
    const ok=unlocked(H.c,s),st=starsOf(H.c,s),boss=s===10;
    const cur=fr[0]===H.c&&fr[1]===s&&!st&&ok;
    h+=`<button class="node${boss?' boss':''}${ok?'':' lock'}${s===sel?' sel':''}${st?' done':''}${cur?' cur':''}" data-s="${s}" style="left:${NODE_X[s-1]}%;top:${(10-s)*ROW_H+20}px">${boss&&ok?'\u2620':s}${ok?`<span class="ns">${'\u2605'.repeat(st)}${'\u2606'.repeat(3-st)}</span>`:''}${fr[0]===H.c&&fr[1]===s&&!st&&ok?'<em>NEXT</em>':''}</button>`;
  }
  h+='</div>';
  $('hbody').innerHTML=h;
  const ok=unlocked(H.c,sel),st=starsOf(H.c,sel),weak=EL[weakTo(ch.el)];
  $('hfoot').innerHTML=`<div class="spanel"><div class="sp1"><b>${sel===10?'BOSS \u00b7 ':''}STAGE ${H.c+1}-${sel}</b><span>${STAGE_NAMES[H.c][sel-1]}</span></div>
  <div class="sp2">3 waves \u00b7 boss last \u00b7 mostly ${EL[ch.el].n} \u00b7 weak to <i style="color:${weak.c}">${weak.n}</i></div>
  ${sel===10?`<div class="sp2">Boss reward: <b style="color:#ffd35a">${fullName(heroById(ch.reward))}</b>${SV.own[ch.reward]?' (owned)':''}</div>`:''}
  <div class="sp3"><span class="${st>=1?'ok':''}">\u2605 Win</span><span class="${st>=2?'ok':''}">\u2605 Half HP</span><span class="${st>=3?'ok':''}">\u2605 \u2264${STAR_TURNS} turns</span></div>
  <button class="up go" id="goBtn" ${ok?'':'disabled'}>${ok?'BATTLE':'LOCKED \u00b7 clear stage '+(sel>1?sel-1:10)+' first'}</button></div>`;
  $('hbody').querySelectorAll('.chaps button').forEach(b=>b.onclick=()=>{H.c=+b.dataset.k;const f=frontier();H.s=f[0]===H.c?f[1]:1;viewMap()});
  $('hbody').querySelectorAll('.node').forEach(b=>b.onclick=()=>{H.s=+b.dataset.s;viewMap()});
  $('goBtn').onclick=()=>{if(ok)begin('stage',H.c,sel)};
  if(H.scroll&&HOME().classList.contains('on'))scrollSel();
}
function scrollSel(){if(H.tab!=='map'||!H.scroll)return;H.scroll=false;const n=$('hbody').querySelector('.node.sel'),b=$('hbody');if(n)b.scrollTop=n.offsetTop-b.clientHeight/2+30}
function viewSpire(){
  $('hbar').innerHTML=`<h2><small>ENDLESS</small>The Spire</h2>${goldPill()}`;
  $('hbody').innerHTML=`<div class="spirebox"><small class="fl">BEST FLOOR</small><b class="bigf">${best||0}</b><img class="spmon" src="img/m_4.webp" alt="" draggable="false">
  <div class="stats3"><div class="st2"><b>5</b><small>BOSS EVERY</small></div><div class="st2"><b>+${12+4}</b><small>FLOOR 1 GOLD</small></div><div class="st2"><b>${SV.gold.toLocaleString()}</b><small>YOUR GOLD</small></div></div>
  <p>Enemies get stronger every floor. If you fall, you keep the gold you earned.</p></div>`;
  $('hfoot').innerHTML=`<div class="spanel"><button class="up go" id="goBtn">CLIMB</button></div>`;
  $('goBtn').onclick=()=>begin('spire');
}
function viewHeroes(){
  if(H.pick)return viewPick();
  if(H.hero)return viewDetail(heroById(H.hero));
  const left=HEROES.filter(h=>!SV.own[h.id]).length,total=HEROES.length-1,have=total-left,pl=HEROES.filter(h=>!SV.own[h.id]&&!BOSSKN().includes(h.id)).length;
  $('hbar').innerHTML=`<h2><small>${have} / ${total} KNIGHTS</small>The Order</h2>${goldPill()}`;
  let h='<div class="kgrid">';
  HEROES.forEach(x=>{
    if(!SV.own[x.id]){const ci=BOSSKN().indexOf(x.id),how=ci>=0?`Ch ${ci+1} boss`:'Summon';
      h+=`<div class="kcard lock r${x.r}"><div>${knight(x,"full")}<span class="lk">\u{1F512}</span><b>${x.n}</b><small>${how}</small></div></div>`;return}
    const e=elOf(x),inT=SV.team.includes(x.id);
    h+=`<button class="kcard r${x.r}${x.any?' any':''}" data-id="${x.id}" style="--c:${e.c}"><div>${knight(x)}${inT?'<em>TEAM</em>':''}<b>${x.n}</b><small>Lv ${lvOf(x)}</small></div></button>`;
  });
  $('hbody').innerHTML=h+'</div>';
  $('hbody').querySelectorAll('button.kcard').forEach(b=>b.onclick=()=>{H.hero=b.dataset.id;renderHome()});
  $('hfoot').innerHTML=`<div class="spanel slim"><button class="up go" id="sumBtn" ${pl&&SV.gold>=sumCost()?'':'disabled'}>${pl?`SUMMON KNIGHT <b class="gc"></b>${sumCost()}`:'ALL KNIGHTS OWNED'}</button></div>`;
  $('sumBtn').onclick=summon;
}
const BOSSKN=()=>CHAPTERS.map(c=>c.reward);
function summon(){
  const pool=HEROES.filter(h=>!SV.own[h.id]&&!BOSSKN().includes(h.id));
  if(!pool.length||SV.gold<sumCost())return;
  const w=pool.map(h=>5-h.r);let t=Math.random()*w.reduce((a,b)=>a+b,0),h=pool[0];
  for(let k=0;k<pool.length;k++){t-=w[k];if(t<=0){h=pool[k];break}}
  SV.gold-=sumCost();SV.sum=(SV.sum|0)+1;SV.own[h.id]=1;SV.lv[h.id]=1;save();
  [520,660,780,1040].forEach((f,k)=>setTimeout(()=>beep(f,.18),k*110));
  const e=elOf(h);
  sheet(`<div class="reveal" style="--c:${e.c}"><div class="kbig">${knight(h)}</div></div><h2 style="color:${e.c}">${fullName(h)}</h2><p>${(KN[h.id]||{}).t||''}<br>${'\u2605'.repeat(h.r)} \u00b7 ${e.n}<br>${skillText(h)}</p>`,[['Nice!',()=>{H.hero=h.id;renderHome()},'go']]);
  renderHome();
}
function viewDetail(x){
  const e=elOf(x),lv=lvOf(x),max=lv>=MAXLV,cost=costAt(lv),inT=SV.team.includes(x.id);
  const atkNow=Math.round(atkAt(x,lv)),gain=max?0:Math.round(atkAt(x,lv+1))-atkNow;
  const cdNow=cdAt(x,lv),cdNext=max?cdNow:cdAt(x,lv+1);
  $('hbar').innerHTML=`<button class="back" id="hBack" aria-label="Back">\u2039</button><h2><small>${x.any?'ALL ELEMENTS':e.n.toUpperCase()} \u00b7 ${'\u2605'.repeat(x.r)}</small>${fullName(x)}</h2>${goldPill()}`;
  $('hbody').style.setProperty('--c',e.c);
  $('hbody').innerHTML=`<div class="bigk" style="--c:${e.c}"><div class="kbig">${knight(x)}</div></div><div class="ktitle">${(KN[x.id]||{}).t||''}</div>
  <div class="lvl">LEVEL ${lv} / ${MAXLV}</div><div class="lvbar"><i style="width:${100*lv/MAXLV}%"></i></div>
  <div class="stats"><div class="st2"><small>ATTACK</small><b>${atkNow}</b>${gain?`<em>+${gain}</em>`:''}</div>
  <div class="st2"><small>SKILL TURNS</small><b>${cdNow}</b>${cdNext<cdNow?`<em>\u2192 ${cdNext}</em>`:''}</div></div>
  <div class="info"><small>STORY</small>${(KN[x.id]||{}).bio||''}</div>
  <div class="info" style="border-color:${e.c}88"><small style="color:${e.c}">SKILL</small>${skillText(x)}</div>
  <div class="info${lv>=15?'':' off'}"><small>LEVEL 15${lv>=15?' \u2713':''}</small>Skill needs 1 fewer turn.</div>
  <div class="info${lv>=20?'':' off'}"><small>LEVEL 20${lv>=20?' \u2713':''}</small>This hero hits 20% harder.</div>`;
  $('hfoot').innerHTML=`<div class="actions"><button id="tBtn" ${inT?'disabled':''}>${inT?'IN TEAM':'SET IN TEAM'}</button><button class="up" id="hUp" ${max||SV.gold<cost?'disabled':''}>${max?'MAX LEVEL':`LEVEL UP \u00b7 \u{1FA99} ${cost}`}</button></div>`;
  $('hBack').onclick=()=>{H.hero=null;renderHome()};
  $('tBtn').onclick=()=>{if(SV.team.length<5){SV.team.push(x.id);save();syncTeam();beep(600,.1);renderHome();return}H.pick=true;renderHome()};
  $('hUp').onclick=()=>{
    if(max||SV.gold<cost)return;
    SV.gold-=cost;SV.lv[x.id]=lv+1;save();beep(660,.1);setTimeout(()=>beep(880,.15),90);renderHome();
  };
}
function viewPick(){
  const x=heroById(H.hero);
  $('hbar').innerHTML=`<button class="back" id="hBack" aria-label="Back">\u2039</button><h2><small>SET ${x.n.toUpperCase()} IN TEAM</small>Replace who?</h2>${goldPill()}`;
  let h='<div class="kgrid">';
  SV.team.filter(id=>id!=='summoner').forEach(id=>{const t=heroById(id),e=elOf(t);h+=`<button class="kcard r${t.r}" data-id="${id}" style="--c:${e.c}"><div>${knight(t)}<b>${t.n}</b><small>Lv ${lvOf(t)}</small></div></button>`});
  $('hbody').innerHTML=h+'</div><p class="hint">Tap the hero to swap out.</p>';
  $('hfoot').innerHTML=`<div class="actions"><button id="cBtn">Cancel</button></div>`;
  $('hBack').onclick=$('cBtn').onclick=()=>{H.pick=false;renderHome()};
  $('hbody').querySelectorAll('.kcard').forEach(b=>b.onclick=()=>{
    SV.team[SV.team.indexOf(b.dataset.id)]=x.id;save();syncTeam();beep(600,.1);H.pick=false;renderHome();
  });
}
function showLog(){
  sheet('<h2>Battle log</h2><div id="logList"></div>',[['Close',null,'go']]);
  G.log.forEach(l=>{const d=document.createElement('div');d.className=l.cls;d.textContent=l.text;$('logList').appendChild(d)});
}
const PI={
  play:'<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/></svg>',
  snd:'<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>',
  bolt:'<svg viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
  doc:'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/></svg>',
  help:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01"/></svg>',
  home:'<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>'
};
function pauseMenu(){
  if(drag)return;
  const P=$('pause'),sub=G.mode==='stage'?`Stage ${G.c+1}-${G.s}`:`Floor ${G.floor}`;
  P.innerHTML=`<div class="pbox"><h3>Paused</h3><div class="psub">${sub}</div>
  <button class="pres" id="pRes">${PI.play}RESUME</button>
  <div class="prows">
   <div class="prow" id="pSnd">${PI.snd}<span>Sound &amp; music</span><i class="tg${sound?' on':''}"></i></div>
   <div class="prow" id="pLite">${PI.bolt}<span>Smooth mode<small>Fewer effects, faster on slow phones</small></span><i class="tg${lite?' on':''}"></i></div>
   <div class="prow" id="pLog">${PI.doc}<span>Battle log</span><b>\u203A</b></div>
   <div class="prow" id="pHelp">${PI.help}<span>How to play</span><b>\u203A</b></div>
  </div>
  <button class="pleave" id="pLeave" ${busy?'disabled':''}>${PI.home}${busy?'Leave after this turn':'Leave battle'}</button></div>`;
  P.classList.add('on');
  const close=()=>P.classList.remove('on');
  $('pRes').onclick=close;
  P.onclick=e=>{if(e.target===P)close()};
  $('pSnd').onclick=()=>{sound=!sound;P.querySelector('#pSnd .tg').classList.toggle('on',sound);music(mwant)};
  $('pLite').onclick=()=>{setLite(!lite);P.querySelector('#pLite .tg').classList.toggle('on',lite)};
  $('pLog').onclick=()=>{close();showLog()};
  $('pHelp').onclick=()=>{close();help([['Back to game',null,'go']])};
  $('pLeave').onclick=()=>{
    if(busy)return;close();
    sheet('<h2>Leave battle?</h2><p>Your progress in this fight will be lost.</p>',[['Stay'],['Leave',()=>openHome(G.mode==='spire'?'spire':'map',G.mode==='stage'?G.c:null,G.s)]]);
  };
}
$('pauseBtn').onclick=()=>{if(!drag)pauseMenu()};
addEventListener('resize',()=>{if(!drag)resize()});
G={mode:'spire',c:0,s:1,wave:1,floor:1,n:1,turns:0,guard:0,hp:1,max:1,skill:[],bonus:0,log:[],foes:[],target:null,runGold:0};
$('app').classList.toggle('lite',lite);resize(true);drawGold();drawBest();openHome('home');
(function(){
  const sp=$('splash');
  const k=(id,cls)=>`<div class="sk ${cls}" style="--c:${elOf(heroById(id)).c}"><img src="img/${id}_full.webp" alt="" draggable="false"></div>`;
  const orbs=EL.slice(0,5).map(e=>`<i style="--c:${e.c};--d:${e.d}"></i>`).join('');
  let stars='';for(let i=0;i<34;i++)stars+=`<u style="left:${(i*37%100)}%;top:${(i*53%62)}%;opacity:${.25+(i%5)*.12}"></u>`;
  sp.innerHTML=`<div class="sstars">${stars}</div><div class="smoon"></div><div class="sspire"></div>
  ${k('ember','l1')}${k('tide','l2')}${k('briar','r2')}${k('sol','r1')}${k('summoner','mid')}<div class="sfloor"></div>
  <div class="sorbs">${orbs}</div>
  <div class="slogo"><small>THE LAST ORDER</small><b>ORB<br>SPIRE</b><em>DRAG · MATCH · RISE</em></div>
  <div class="stap"><b>TAP TO ENTER</b></div><div class="sver">v1.0</div>`;
  sp.classList.add('on');
  let gone=false;
  const enter=()=>{if(gone||$('loader'))return;gone=true;[520,660,880].forEach((f,i)=>setTimeout(()=>beep(f,.14,'triangle',.09),i*90));sp.classList.add('out');setTimeout(()=>{sp.classList.remove('on','out');sp.innerHTML=''},450)};
  sp.addEventListener('pointerup',enter);
  addEventListener('keydown',e=>{if(!gone&&(e.key==='Enter'||e.key===' '))enter()});
})();

/* ---------- loading screen: "Walking to the Spire" ---------- */
const LTIPS=['Match 4 or more orbs to hit all enemies at once.','Hit the weak element for bonus damage. Look for the "!" on the number.','Longer combos hit harder. Plan your drag before you start.','Level up your heroes with gold between fights.','Defeat a chapter boss to recruit it as a knight.','Heart orbs heal your whole team.'];
function loaderDraw(g,W,H,off,tw){
  const hy=H*.46,cx=W/2,f=W*.95,hh=1,Z0=f*hh/(H-hy),L=2;
  const sx=(x,z)=>cx+f*x/z,sy=z=>hy+f*hh/z;
  g.clearRect(0,0,W,H);
  const gr=g.createLinearGradient(0,hy,0,H);gr.addColorStop(0,'#1b1038');gr.addColorStop(1,'#07050f');g.fillStyle=gr;g.fillRect(0,hy,W,H-hy);
  const th=H*.09+tw*H*.21,tw2=H*.012+tw*H*.032,bx=cx,by=hy+2;
  const gl=g.createRadialGradient(bx,by-th*.6,0,bx,by-th*.6,th*1.2);gl.addColorStop(0,'rgba(190,140,255,.55)');gl.addColorStop(1,'rgba(190,140,255,0)');g.fillStyle=gl;g.fillRect(0,by-th*2,W,th*2.4);
  g.fillStyle='#0a0716';g.strokeStyle='#b58cff';g.lineWidth=1.5;g.shadowColor='#b58cff';g.shadowBlur=lite?0:14;
  g.beginPath();g.moveTo(bx-tw2,by);g.lineTo(bx-tw2,by-th*.45);g.lineTo(bx-tw2*.55,by-th*.5);g.lineTo(bx-tw2*.55,by-th*.8);g.lineTo(bx-tw2*.25,by-th*.84);g.lineTo(bx,by-th);g.lineTo(bx+tw2*.25,by-th*.84);g.lineTo(bx+tw2*.55,by-th*.8);g.lineTo(bx+tw2*.55,by-th*.5);g.lineTo(bx+tw2,by-th*.45);g.lineTo(bx+tw2,by);g.closePath();g.fill();g.stroke();g.shadowBlur=0;
  g.fillStyle='rgba(255,224,150,.8)';for(let i=0;i<5;i++)g.fillRect(bx-2,by-th*(.2+i*.14),4,3+tw*4);
  const base=Math.floor(off/L),fr=off-base*L;
  for(let j=34;j>=0;j--){
    const z1=Math.max(Z0*.5,j*L-fr+Z0*.2),z2=Math.max(Z0*.5,(j+1)*L-fr+Z0*.2),idx=(base+j)&1;if(z2<=z1)continue;
    g.fillStyle=idx?'#2a1650':'#21123f';g.beginPath();g.moveTo(sx(-1.3,z2),sy(z2));g.lineTo(sx(1.3,z2),sy(z2));g.lineTo(sx(1.3,z1),sy(z1));g.lineTo(sx(-1.3,z1),sy(z1));g.fill();
    if(idx){g.fillStyle='rgba(235,220,255,.5)';for(const lx of[-.43,.43]){g.beginPath();g.moveTo(sx(lx-.03,z2),sy(z2));g.lineTo(sx(lx+.03,z2),sy(z2));g.lineTo(sx(lx+.03,z1),sy(z1));g.lineTo(sx(lx-.03,z1),sy(z1));g.fill()}}
  }
  for(const [ex,c] of[[-1.3,'#b58cff'],[1.3,'#5ad1ff']]){g.strokeStyle=c;g.lineWidth=3;g.shadowColor=c;g.shadowBlur=lite?0:10;g.beginPath();g.moveTo(sx(ex,Z0*.5),sy(Z0*.5));g.lineTo(sx(ex,90),sy(90));g.stroke();g.shadowBlur=0}
  const B=3,m0=Math.floor(off/B),bf=off-m0*B;
  for(let j=24;j>=0;j--){
    const z=j*B-bf+Z0*.2,d=2.2;if(z<Z0*.4)continue;
    for(const side of[-1,1]){
      const rn=(((((m0+j)*2)+(side>0?1:0))*9301+49297)%233280)/233280,Hh=1.1+rn*2.8,xin=side*1.85,xout=side*(3.2+rn*.8);
      const yb=sy(z),yt=yb-f*Hh/z,yb2=sy(z+d),yt2=yb2-f*Hh/(z+d);g.globalAlpha=Math.min(1,Math.max(0,1.15-z/60));
      g.fillStyle='#150d2c';g.beginPath();g.moveTo(sx(xin,z),yb);g.lineTo(sx(xin,z+d),yb2);g.lineTo(sx(xin,z+d),yt2);g.lineTo(sx(xin,z),yt);g.fill();
      g.fillStyle='#221548';const x1=sx(xin,z),x2=sx(xout,z);g.fillRect(Math.min(x1,x2),yt,Math.abs(x2-x1),yb-yt);
      g.fillStyle=side>0?'#5ad1ff':'#b58cff';g.fillRect(Math.min(x1,x2),yt,Math.abs(x2-x1),Math.max(1.5,f*.05/z));g.globalAlpha=1;
    }
  }
  const hz=g.createLinearGradient(0,hy-H*.05,0,hy+H*.2);hz.addColorStop(0,'rgba(190,140,255,0)');hz.addColorStop(.3,'rgba(190,140,255,.35)');hz.addColorStop(1,'rgba(13,10,31,0)');g.fillStyle=hz;g.fillRect(0,hy-H*.05,W,H*.25);
}
/* quietly load every picture + the music, so the loading screen only has to wait for what's missing */
const PRE={done:0,total:0,audio:false};
(function(){
  const urls=[];ART.forEach(id=>{urls.push(`img/${id}_full.webp`,`img/${id}_head.webp`)});for(let k=0;k<5;k++)urls.push(`img/m_${k}.webp`);
  PRE.total=urls.length;urls.forEach(u=>{const im=new Image();im.onload=im.onerror=()=>PRE.done++;im.src=u});
})();
function preloadAudio(){
  if(PRE.audio||!sound||!gest)return;PRE.audio=true;
  try{if(!sctx())return;PRE.total+=2;['menu','boss'].forEach(k=>{Promise.resolve(mload(k)).then(()=>PRE.done++,()=>PRE.done++)})}catch(e){PRE.audio=false}
}
let loading=false;
/* loading screen shown when a battle starts. work() runs once the screen has covered the game. */
function loadScreen(small,big,work,done){
  if(loading)return;loading=true;preloadAudio();music(null);
  const app=$('app'),el=document.createElement('div');el.id='loader';
  let stars='';for(let i=0;i<26;i++)stars+=`<u style="left:${(i*37)%100}%;top:${(i*53)%40}%;opacity:${.2+(i%5)*.12}"></u>`;
  el.innerHTML=`<div class="lstars">${stars}</div><div class="lmoon"></div><canvas></canvas>
  <div class="llogo"><small>${small}</small><b>${big}</b></div>
  <div class="lparty"><img class="s" src="img/tide_full.webp" alt=""><img class="m" src="img/summoner_full.webp" alt=""><img class="s" src="img/ember_full.webp" alt=""></div>
  <div class="lbot"><div class="lst"><span id="lMsg">Walking to the Spire\u2026</span><b id="lPct">0%</b></div><div class="lbar"><i id="lFill"></i><em id="lDot"></em></div><div class="ltip">Tip: ${LTIPS[Math.floor(Math.random()*LTIPS.length)]}</div></div>`;
  app.appendChild(el);void el.offsetWidth;el.classList.add('on');
  const cv=el.querySelector('canvas'),g=cv.getContext('2d'),r=Math.min(window.devicePixelRatio||1,1.5),W=app.clientWidth,H=app.clientHeight;
  cv.width=Math.round(W*r);cv.height=Math.round(H*r);g.setTransform(r,0,0,r,0,0);
  setTimeout(()=>{try{work&&work()}catch(e){console.error(e)}},300);
  const t0=performance.now(),MIN=1200,MAX=15000;let disp=0,last=t0,off=0,fin=false;
  const msg=$('lMsg'),pct=$('lPct'),fill=$('lFill'),dot=$('lDot');
  const step=now=>{
    const dt=Math.min(.05,(now-last)/1000);last=now;const t=now-t0;
    const real=PRE.total?PRE.done/PRE.total:1,target=Math.min(real,Math.min(1,t/MIN));
    disp+=(target-disp)*Math.min(1,dt*7);if(target>=1&&disp>.995)disp=1;
    off+=(6+disp*10)*dt;
    const p=Math.round(disp*100);pct.textContent=p+'%';fill.style.width=p+'%';dot.style.left=p+'%';
    msg.textContent=p<45?'Walking to the Spire\u2026':p<85?'Summoning heroes\u2026':'The gate opens\u2026';
    loaderDraw(g,W,H,off,disp*.9+.08);
    if((disp>=1&&PRE.done>=PRE.total)||t>MAX){if(!fin){fin=true;el.classList.add('out');if(done)done();setTimeout(()=>{el.remove();loading=false},500)}return}
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* every fight starts behind the loading screen */
const beginNow=begin;
begin=function(mode,c,sn){
  if(loading)return;
  const st=mode==='stage',bk=battleKey(mode,c);
  try{if(ac)mload(bk)}catch(e){}
  loadScreen(st?`STAGE ${(c||0)+1}-${sn||1}`:'ENDLESS',st?STAGE_NAMES[c||0][(sn||1)-1]:'THE SPIRE',()=>beginNow(mode,c,sn),()=>music(bk));
};

/* ---------- attack effects (canvas layer over the battle) ---------- */
const FX_IMP=.34,FXS=[];let fxc=null,fxg=null,fxW=0,fxH=0,fxRun=false;
function fxSize(){
  const st=$('stage');if(!fxc||!st)return;const r=Math.min(window.devicePixelRatio||1,1.5);
  fxW=st.clientWidth;fxH=st.clientHeight;if(!fxW||!fxH)return;
  fxc.width=Math.round(fxW*r);fxc.height=Math.round(fxH*r);fxg.setTransform(r,0,0,r,0,0);
}
(function(){
  const st=$('stage');if(!st)return;
  fxc=document.createElement('canvas');fxc.id='fxc';st.appendChild(fxc);fxg=fxc.getContext('2d');
  if(window.ResizeObserver)new ResizeObserver(fxSize).observe(st);addEventListener('resize',fxSize);setTimeout(fxSize,60);
})();
function fxLaunch(el,from,to,artH){
  const r=$('stage').getBoundingClientRect();
  FXS.push({el,S:{x:from.x-r.left,y:from.y-r.top},T:{x:to.x-r.left,y:to.y-r.top},k:Math.max(.7,Math.min(1.5,(artH||150)/150)),t0:performance.now()});
  if(!fxRun){fxRun=true;requestAnimationFrame(fxLoop)}
}
function fxLoop(now){
  fxg.clearRect(0,0,fxW,fxH);
  for(let i=FXS.length-1;i>=0;i--){const e=FXS[i],t=(now-e.t0)/1000;if(t>(e.dur||1.1)){FXS.splice(i,1);continue}if(e.kind)fxMisc(fxg,e,t);else fxDraw(fxg,e,t)}
  if(FXS.length)requestAnimationFrame(fxLoop);else{fxRun=false;fxg.clearRect(0,0,fxW,fxH)}
}
const fxr=(i,k=0)=>{const x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x)};
function fxGlow(g,x,y,r,col,a=1){const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.globalAlpha=a;g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();g.globalAlpha=1}
function fxLeaf(g,x,y,rot,sz,col){g.save();g.translate(x,y);g.rotate(rot);g.fillStyle=col;g.beginPath();g.moveTo(0,-sz);g.quadraticCurveTo(sz*.7,0,0,sz);g.quadraticCurveTo(-sz*.7,0,0,-sz);g.fill();g.restore()}
function fxStar(g,x,y,r,rot,col,a){g.save();g.translate(x,y);g.rotate(rot);g.globalAlpha=Math.max(0,a);g.fillStyle=col;g.beginPath();for(let q=0;q<8;q++){const rr=q%2?r*.18:r,an=q*Math.PI/4;g.lineTo(Math.cos(an)*rr,Math.sin(an)*rr)}g.closePath();g.fill();g.restore();g.globalAlpha=1}
function fxSpawn(kind,f,col,dur,n){
  if(!fxc||!fxW)return;const a=f.dom.querySelector('.art')||f.dom,r=$('stage').getBoundingClientRect(),c=ctr(a);
  FXS.push({kind,col,dur,n,T:{x:c.x-r.left,y:c.y-r.top},k:Math.max(.7,Math.min(1.5,a.getBoundingClientRect().height/150)),t0:performance.now()});
  if(!fxRun){fxRun=true;requestAnimationFrame(fxLoop)}
}
function fxMisc(g,e,t){
  const {T,k,col,dur,n}=e;g.save();g.globalCompositeOperation='lighter';
  if(e.kind==='mob'){
    const u=t/dur;g.strokeStyle=col;g.globalAlpha=Math.max(0,.7*(1-u));g.lineWidth=(5*(1-u)+1)*k;g.beginPath();g.arc(T.x,T.y,(14+u*70)*k,0,7);g.stroke();g.globalAlpha=1;
    for(let i=0;i<n;i++){const an=-Math.PI/2+(fxr(i)-.5)*3.4,sp=(70+fxr(i,2)*90)*k;fxGlow(g,T.x+Math.cos(an)*sp*u,T.y+Math.sin(an)*sp*u+130*k*u*u,(7*(1-u)+1.5)*k,col,1-u)}
  }else if(e.kind==='dust'){
    for(let i=0;i<n;i++){const dl=fxr(i,3)*dur*.55,u=(t-dl)/(dur*.45);if(u<0||u>1)continue;
      fxGlow(g,T.x+(fxr(i)-.5)*110*k+Math.sin(u*5+i)*8*k,T.y+36*k-u*(100+fxr(i,2)*90)*k,(3+fxr(i,4)*5)*k*2,col,Math.sin(u*Math.PI)*.9)}
  }
  g.restore();
}
function mobDie(f){
  f.dying=1;f.dom.classList.add('mobdie');if(!lite)fxSpawn('mob',f,EL[f.el].c,.6,14);
  swn(.3,2200,500,.12,.08,.2,.9);tone(520,160,.2,.1,.05,.2);
  setTimeout(()=>{f.gone=1;f.dom.classList.add('dead')},650);
}
async function bossDie(f){
  f.dying=1;const d=f.dom,art=d.querySelector('.art')||d,st=$('stage'),mk=(c)=>{const e=document.createElement('div');e.className=c;st.appendChild(e);return e};
  const ov=[];
  /* 1 final hit */
  d.classList.add('b1');ov.push(mk('bfl'));sBoom();tone(110,40,.7,.3);nz(.5,200,.2,0,0,3500);flash(st,'shake');buzz(70);await sleep(450);
  /* 2 freeze: dark edges, boss whitens and cracks */
  d.classList.remove('b1');d.classList.add('b2');ov.push(mk('bvg'));
  if(!lite){const sv=document.createElementNS('http://www.w3.org/2000/svg','svg');sv.setAttribute('class','bcr');sv.setAttribute('viewBox','0 0 100 100');sv.setAttribute('preserveAspectRatio','none');
    sv.innerHTML='<path d="M50 10L46 30L56 42L44 60L52 78L48 92"/><path d="M56 42L74 50L82 66"/><path d="M44 60L28 64L20 80"/><path d="M46 30L30 24"/>';art.appendChild(sv)}
  if(mnode&&ac)mfade(mnode,mnode.v*.15,.7);
  tone(70,48,1,.1);[0,.22,.46].forEach(t=>nz(.03,2500,.22,t));await sleep(800);
  /* 3 fades away into gold dust */
  d.classList.remove('b2');d.classList.add('b3');
  if(mnode&&ac)mfade(mnode,0,1.5);
  fxSpawn('dust',f,'#ffe08a',1.5,lite?14:42);
  [0,2,4,7,9,12,14,16,19,21].forEach((n,i)=>bellS(mhz(76+n),.6,.05,i*.13,(i%2?.2:-.2)));
  await sleep(1500);
  f.gone=1;d.classList.add('dead');ov.forEach(e=>e.remove());
  if(G.mode==='stage'){$('msg').innerHTML='STAGE CLEAR';flash($('msg'),'msgpop');beep(660,.15);await sleep(150);beep(880,.2);await sleep(650);$('msg').textContent=''}
}
function fxDraw(g,e,t){
  const {el,S,T,k}=e,a=t-FX_IMP,p=t/FX_IMP;
  const pos=(pp,w)=>{const q=Math.max(0,Math.min(1,pp));let x=S.x+(T.x-S.x)*q,y=S.y+(T.y-S.y)*q;if(w===1)x+=Math.sin(q*9)*14*k*(1-q*.3);if(w===0)x+=Math.sin(q*3.14)*22*k;return{x,y}};
  g.save();g.globalCompositeOperation='lighter';
  if(el===0){
    if(t<FX_IMP){for(let q=11;q>=0;q--){if(p-q*.045<0)continue;const o=pos(p-q*.045,0);fxGlow(g,o.x+(fxr(q)-.5)*6*k,o.y+(fxr(q,2)-.5)*6*k,(18-q*1.2)*1.6*k,q<4?'rgba(255,200,80,.9)':'rgba(255,90,30,.7)',1-q/13)}
      const o=pos(p,0);fxGlow(g,o.x,o.y,34*k,'rgba(255,140,40,.55)');fxGlow(g,o.x,o.y,16*k,'#fff2b0')}
    else if(a<.7){const f=a/.7;fxGlow(g,T.x,T.y,90*k*(1-Math.min(1,a/.35)),'rgba(255,170,60,.9)');
      g.strokeStyle=`rgba(255,120,50,${1-f})`;g.lineWidth=(10*(1-f)+1)*k;g.beginPath();g.arc(T.x,T.y,(18+f*120)*k,0,7);g.stroke();
      for(let q=0;q<22;q++){const an=q/22*6.283+fxr(q)*.4,sp=(110+fxr(q,3)*150)*k;fxGlow(g,T.x+Math.cos(an)*sp*a,T.y+Math.sin(an)*sp*a+260*k*a*a,(7*(1-f)+1)*k,q%2?'#ffd25a':'#ff6a2a',1-f)}}
  }else if(el===1){
    if(t<FX_IMP){for(let q=9;q>=0;q--){if(p-q*.05<0)continue;const o=pos(p-q*.05,1);fxGlow(g,o.x,o.y,(13-q)*k,'rgba(120,200,255,.8)',1-q/11)}
      const o=pos(p,1);fxGlow(g,o.x,o.y,30*k,'rgba(70,160,255,.5)');g.fillStyle='#bfe6ff';g.beginPath();g.arc(o.x,o.y,11*k,0,7);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(o.x-3*k,o.y-3*k,4*k,0,7);g.fill()}
    else if(a<.75){const f=a/.75;g.strokeStyle=`rgba(140,210,255,${1-f})`;g.lineWidth=(5*(1-f)+1)*k;
      for(const d of[0,.12]){const ff=Math.max(0,(a-d)/.6);if(ff>1)continue;g.beginPath();g.ellipse(T.x,T.y+20*k,(20+ff*95)*k,(8+ff*34)*k,0,0,7);g.stroke()}
      fxGlow(g,T.x,T.y,70*k*(1-Math.min(1,a/.3)),'rgba(120,200,255,.8)');
      for(let q=0;q<18;q++){const an=-Math.PI/2+(fxr(q)-.5)*2.6,sp=(140+fxr(q,5)*140)*k;fxGlow(g,T.x+Math.cos(an)*sp*a,T.y+Math.sin(an)*sp*a+380*k*a*a,(6*(1-f)+1.5)*k,'#a8dcff',1-f)}}
  }else if(el===2){
    if(t<FX_IMP){for(let q=3;q>=0;q--){if(p-q*.1<0)continue;const o=pos(p-q*.1,2);fxLeaf(g,o.x+(q-1.5)*10*k,o.y,t*28+q*1.7,(16-q*2)*k,q?'rgba(80,200,90,.8)':'#7dff8a')}
      const o=pos(p,2);fxGlow(g,o.x,o.y,26*k,'rgba(100,255,120,.35)')}
    else if(a<.7){const f=a/.7;g.lineCap='round';
      for(const [sg,dl] of[[1,0],[-1,.07]]){const pr=Math.min(1,Math.max(0,(a-dl)/.14));if(pr<=0)continue;const fade=1-Math.max(0,(a-dl-.14)/.4);
        g.strokeStyle=`rgba(150,255,150,${Math.max(0,fade)})`;g.lineWidth=(9*(1-f)+2)*k;g.shadowColor='#5fd16a';g.shadowBlur=lite?0:12;
        g.beginPath();const sx=T.x-60*k,sy=T.y-sg*60*k,ex=T.x+60*k,ey=T.y+sg*60*k;g.moveTo(sx,sy);g.quadraticCurveTo(T.x+sg*18*k,T.y-sg*10*k,sx+(ex-sx)*pr,sy+(ey-sy)*pr);g.stroke();g.shadowBlur=0}
      for(let q=0;q<12;q++)fxLeaf(g,T.x+(fxr(q)-.5)*150*k+Math.sin(a*8+q)*14*k,T.y-40*k+a*200*k*(.6+fxr(q,4)*.8),a*9+q,8*k,`rgba(110,230,120,${1-f})`)}
  }else if(el===3){
    const pr=Math.min(1,p);
    if(a<.4){const bx=S.x+(T.x-S.x)*pr,by=S.y+(T.y-S.y)*pr,fade=t<FX_IMP?1:1-a/.4;
      for(const [w,al] of[[34,.25],[18,.5],[7,1]]){g.strokeStyle=`rgba(255,${230-w},${150-w*2},${al*fade})`;g.lineWidth=w*k;g.lineCap='round';g.beginPath();g.moveTo(S.x,S.y-20*k);g.lineTo(bx,by);g.stroke()}
      fxStar(g,bx,by,30*k,t*6,'#fff6c8',fade)}
    if(a>=0&&a<.75){const f=a/.75;fxGlow(g,T.x,T.y,100*k*(1-f*.5),'rgba(255,245,200,.95)',1-f);fxStar(g,T.x,T.y,95*k*(1-f*.4),a*3,'#fff',1-f);
      for(let q=0;q<14;q++){const an=q/14*6.283+fxr(q),sp=(60+fxr(q,2)*120)*k;fxStar(g,T.x+Math.cos(an)*sp*a*1.6,T.y+Math.sin(an)*sp*a*1.6,(9*(1-f)+2)*k,a*8+q,'#ffe27a',1-f)}}
  }else if(el===4){
    if(t<FX_IMP){const o=pos(p,4);for(let q=0;q<12;q++){const an=t*14+q*.52,r=24*k*(1-q/16);fxGlow(g,o.x+Math.cos(an)*r,o.y+Math.sin(an)*r*.8,9*k,'rgba(190,100,255,.8)',.8)}
      for(let q=6;q>=1;q--){if(p-q*.05<0)continue;const o2=pos(p-q*.05,4);fxGlow(g,o2.x,o2.y,(16-q)*k,'rgba(120,40,200,.8)',1-q/8)}fxGlow(g,o.x,o.y,26*k,'rgba(60,0,110,.9)')}
    else if(a<.8){const f=a/.8;g.lineCap='round';g.shadowColor='#c06bff';g.shadowBlur=lite?0:14;
      for(let q=0;q<3;q++){const pr=Math.min(1,Math.max(0,(a-q*.045)/.14));if(pr<=0)continue;const fade=1-Math.max(0,(a-.2)/.55);
        const sx=T.x-44*k+q*30*k,sy=T.y-70*k,ex=T.x+14*k+q*30*k,ey=T.y+78*k;g.strokeStyle=`rgba(210,120,255,${Math.max(0,fade)})`;g.lineWidth=11*k*(1-f*.7);
        g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+(ex-sx)*pr,sy+(ey-sy)*pr);g.stroke()}
      g.shadowBlur=0;for(let q=0;q<10;q++){const an=q/10*6.283,rr=a*130*k;fxGlow(g,T.x+Math.cos(an)*rr*.8,T.y+Math.sin(an)*rr*.6-a*30*k,(22+a*30)*k,'rgba(100,30,170,.6)',(1-f)*.7)}}
  }
  g.restore();
}
