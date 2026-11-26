'use strict';
const COLS=6,ROWS=5,MOVE_TIME=6000;
const $=id=>document.getElementById(id);

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=n=>Math.random()*n|0;
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
let G,grid,busy=true,drag=null,sound=true,ac=null,best=+store.get('orbSpireBest')||0;

/* ---------- saved progress: gold, owned heroes, levels, team, stage stars ---------- */
const SAVE_KEY='orbSpireSave',MAXLV=30,SUMMON_COST=2500;
let SV=(function(){
  let o=null;try{o=JSON.parse(store.get(SAVE_KEY))}catch(e){}
  if(!o||typeof o!=='object')o={};
  const core=['ember','tide','briar','sol','vex'],old=!(o.v>=3);
  const sv={v:3,gold:Math.max(0,+o.gold||0),own:{summoner:1},lv:{},team:['summoner'],stars:{},seenHelp:!!o.seenHelp,seen:{}};
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
function drawGold(gain){const p=$('goldPill');p.textContent='\u{1FA99} '+SV.gold.toLocaleString();if(gain)flash(p,'gain')}

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
    const r=S*.45,g=c.createRadialGradient(-r*.3,-r*.35,r*.1,0,0,r);
    g.addColorStop(0,'#fff');g.addColorStop(.25,e.c);g.addColorStop(1,e.d);
    c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,7);c.fill();
    c.fillStyle='rgba(255,255,255,.9)';c.shadowColor=e.d;c.shadowBlur=4*dpr;symbol(c,i,S*.22);
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
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){c.fillStyle=(x+y)%2?'#2b2140':'#221a33';c.fillRect(x*S,y*S,S,S)}
}
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
    if(o.dx||o.dy)moving=true;
    cx.globalAlpha=drag&&drag.o===o?.3:o.a;
    cx.drawImage(sprites[o.t],(x+o.dx)*S,(y+o.dy)*S,S,S);
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
let boardRect=null;
function point(e){
  const r=boardRect||(boardRect=cv.getBoundingClientRect());
  return{x:Math.max(1,Math.min(S*COLS-1,e.clientX-r.left)),y:Math.max(1,Math.min(S*ROWS-1,e.clientY-r.top))};
}
cv.addEventListener('pointerdown',e=>{
  if(busy||drag)return;e.preventDefault();
  boardRect=cv.getBoundingClientRect();$('app').classList.add('dragging');
  const p=point(e),x=p.x/S|0,y=p.y/S|0;
  cv.setPointerCapture(e.pointerId);
  drag={id:e.pointerId,x,y,o:grid[y][x],px:p.x,py:p.y,start:0,limit:MOVE_TIME+G.bonus};
  slow=16;slowN=0;redraw();
});
cv.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const p=point(e),ox=drag.px,oy=drag.py,steps=Math.ceil(Math.hypot(p.x-ox,p.y-oy)/(S*.15))||1;
  for(let i=1;i<=steps;i++){
    const px=ox+(p.x-ox)*i/steps,py=oy+(p.y-oy)*i/steps,x=px/S|0,y=py/S|0;
    /* round hit zone so diagonal moves don't clip side orbs */
    if((x!==drag.x||y!==drag.y)&&Math.hypot(px-(x+.5)*S,py-(y+.5)*S)<S*.46){
      while(drag.x!==x||drag.y!==y)swapTo(drag.x+Math.sign(x-drag.x),drag.y+Math.sign(y-drag.y));
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
}
function release(e){if(drag&&e.pointerId===drag.id)endDrag()}
cv.addEventListener('pointerup',release);
cv.addEventListener('pointercancel',release);
function endDrag(){
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
  if(f.boss&&f.art&&ART.includes(f.art))return `<img class="kimg bossimg" src="img/${f.art}_full.webp" alt="" draggable="false" style="--c:${EL[f.el].c}">`;
  const e=EL[f.el],s=f.shape,id='mg'+(monId++);
  const body=['M20 90Q10 35 50 30Q90 35 80 90Z','M50 18L85 55L70 92H30L15 55Z','M15 70Q15 30 50 30Q85 30 85 70L75 92L62 80L50 93L38 80L25 92Z'][s];
  const horns=f.boss?'M24 40L8 4L40 30ZM76 40L92 4L60 30ZM42 28L50 2L58 28Z':['M30 38L22 14L44 32ZM70 38L78 14L56 32Z','M18 55L2 38L28 44ZM82 55L98 38L72 44Z','M50 34L42 10L60 22Z'][s];
  return `<svg viewBox="0 0 100 96"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${e.c}"/><stop offset="1" stop-color="${e.d}"/></radialGradient></defs><path d="${horns}" fill="${e.d}" stroke="#0007" stroke-width="1.5"/><path d="${body}" fill="url(#${id})" stroke="${e.d}" stroke-width="3"/><ellipse cx="34" cy="44" rx="8" ry="3.5" fill="#fff" opacity=".45" transform="rotate(-28 34 44)"/><path d="M29 49L45 55Q40 66 31 60ZM71 49L55 55Q60 66 69 60Z" fill="#fff"/><circle cx="39" cy="58" r="3.4" fill="#10081c"/><circle cx="61" cy="58" r="3.4" fill="#10081c"/><path d="M36 72L43 78L50 72L57 78L64 72" fill="none" stroke="#1a0f24" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
function levelN(){return G.mode==='stage'?Math.max(1,Math.round((G.c*10+G.s)*.8)+G.wave-1):G.floor}
function isBoss(){return G.mode==='stage'?(G.s===10&&G.wave===3):G.floor%5===0}
function spawn(){
  const n=levelN(),boss=isBoss(),count=boss?1:n===1?2:1+rnd(3),theme=G.mode==='stage'?CHAPTERS[G.c].el:-1;
  G.n=n;
  const st=G.mode==='stage',total=700*Math.pow(st?1.12:1.14,n-1)*(boss?1.8:1),power=Math.pow(st?1.06:1.09,n-1);
  G.target=null;
  G.foes=Array.from({length:count},()=>{
    const hp=Math.round(total/count),cd=boss?2:2+rnd(2);
    return{el:theme>=0&&Math.random()<.7?theme:rnd(5),shape:rnd(3),boss,art:boss&&G.mode==='stage'?CHAPTERS[G.c].reward:null,hp,max:hp,cd:cd+(count>2?1:0),every:cd+(count>2?1:0),atk:Math.round((boss?460:300/Math.sqrt(count))*power)};
  });
  $('floor').textContent=G.mode==='stage'?`Stage ${G.c+1}-${G.s}${G.s===10&&G.wave===3?' \u00b7 BOSS':''}`:`Floor ${n}${boss?' \u00b7 BOSS':''}`;
  $('app').classList.toggle('stagemode',G.mode==='stage');document.querySelectorAll('#wp i').forEach((d,k)=>d.classList.toggle('on',k<G.wave));
  $('stage').querySelectorAll('.foe').forEach(d=>d.remove());
  G.foes.forEach((f,i)=>{
    const d=document.createElement('div');d.className='foe'+(boss?' boss':'');
    d.innerHTML=`<div class="art"><span class="chip"></span>${monster(f)}</div><div class="cd"></div><div class="bar"><i style="background:linear-gradient(90deg,${EL[f.el].d},${EL[f.el].c})"></i></div>`;
    d.onclick=()=>{if(f.hp<=0)return;G.target=G.target===f?null:f;drawFoes()};
    f.dom=d;$('stage').appendChild(d);
  });
  drawFoes();log(`${boss?'Boss':count+' enemies'} appeared`);
}
function drawFoes(){
  G.foes.forEach(f=>{
    f.dom.classList.toggle('dead',f.hp<=0);f.dom.classList.toggle('target',G.target===f&&f.hp>0);
    const c=f.dom.querySelector('.cd');
    c.textContent=EL[f.el].n.toUpperCase();const ch=f.dom.querySelector('.chip');ch.textContent=f.cd;ch.classList.toggle('warn',f.cd<=1);ch.title='Hits in '+f.cd;
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
  const card=$('team').children[heroIdx];
  if(REDUCE||!card||!f.dom)return Promise.resolve();
  flash(card,'fire');
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
      g.cells.forEach(k=>grid[k/COLS|0][k%COLS].fade=true);flyOrbs(g.cells,g.t);
      $('msg').innerHTML=combos+' COMBO!'+(combos>1?`<small>x${(1+.25*(combos-1)).toFixed(2)} DAMAGE</small>`:'');flash($('msg'),'msgpop');beep(300*Math.pow(1.09,Math.min(combos,16)),.14);
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
        flash(f.dom,'hit');slash(f);pop(f.dom,dmg+(a>1?'!':''),EL[j.el].c);
      }
      log(`${h.n} dealt ${sum}`,'you');
      beep(150+els[0]*40,.12,'square',.06);drawFoes();await sleep(300);
    }
    if(combos>=4){flash($('stage'),'shake');beep(60,.25,'sine',.2);buzz(25)}
    log(`${combos} combo (x${mult.toFixed(2)})`,'you');
  }else log('No match','you');
  G.skill=G.skill.map(v=>Math.max(0,v-1));drawTeam();
  await sleep(250);$('msg').textContent='';
  if(G.foes.every(f=>f.hp<=0))return waveCleared();
  for(const f of G.foes){
    if(f.hp<=0)continue;
    if(--f.cd<=0){
      f.cd=f.every;const hit=G.guard>0?Math.round(f.atk/2):f.atk;if(G.guard>0)G.guard--;G.hp=Math.max(0,G.hp-hit);drawHP();flash(f.dom,'atk');
      pop($('stage'),'-'+hit,'#ff6b6b','50%','75%');log(`${EL[f.el].n} enemy hit you for ${hit}`,'foeLog');
      beep(90,.25,'sawtooth',.14);flash($('stage'),'shake');buzz(50);drawFoes();await sleep(450);
    }
    if(G.hp<=0)return gameOver();
  }
  drawFoes();busy=false;
}
async function nextFloor(){
  if(G.floor>best){best=G.floor;store.set('orbSpireBest',best);drawBest()}
  const gold=Math.round((12+G.floor*4)*(G.floor%5===0?3:1));SV.gold+=gold;G.runGold+=gold;save();drawGold(true);
  $('msg').innerHTML=`Floor cleared!<small>+${gold} \u{1FA99}</small>`;flash($('msg'),'msgpop');beep(660,.15);await sleep(150);beep(880,.25);await sleep(850);
  $('msg').textContent='';G.floor++;heal(G.max*.25);spawn();busy=false;
}
async function waveCleared(){
  if(G.mode==='spire')return nextFloor();
  if(G.wave<3){
    $('msg').innerHTML=`Wave ${G.wave} cleared!`;flash($('msg'),'msgpop');beep(660,.15);await sleep(150);beep(880,.2);await sleep(750);
    $('msg').textContent='';G.wave++;heal(G.max*.15);spawn();busy=false;return;
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
  v.innerHTML=`<div class="vt"><small>${boss?CHAPTERS[c].boss.toUpperCase():'STAGE '+(c+1)+'-'+s}</small><b>${boss?'BOSS DEFEATED!':'STAGE CLEAR!'}</b></div>
  <div class="vstars">${[0,1,2].map(k=>`<span class="${k<stars?'on':''}" style="--d:${.35+k*.4}s">${k<stars?'\u2605':'\u2606'}</span>`).join('')}</div>
  <div class="vgoals"><span class="${goals[0]?'ok':''}">\u2605 Win</span><span class="${goals[1]?'ok':''}">\u2605 Half HP left</span><span class="${goals[2]?'ok':''}">\u2605 \u2264${STAR_TURNS} turns (${G.turns})</span></div>
  <div class="vcard"><small>REWARDS</small><div class="vrow"><div><i>\u{1FA99}</i><b>+${base}</b><em>${old?'Replay':'First clear!'}</em></div>${bonus?`<div><i>\u2728</i><b>+${bonus}</b><em>New stars</em></div>`:''}</div>
  ${newChap?`<div class="vnew">Chapter ${nx[0]+1} unlocked!</div>`:''}</div>
  ${joined?`<div class="vjoin" style="--c:${elOf(joined).c}"><div class="kbig">${knight(joined)}</div><div><small>NEW KNIGHT</small><b>${fullName(joined)}</b><em>${(KN[joined.id]||{}).t||''}</em></div></div>`:''}
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
const goldPill=()=>`<span class="pill" style="margin:0">\u{1FA99} ${SV.gold.toLocaleString()}</span>`;
function openHome(tab,c,sn){
  if(drag)return;
  H.tab=tab||'home';H.hero=null;H.pick=false;
  if(c!=null){H.c=c;H.s=sn}else{const f=frontier();H.c=f[0];H.s=f[1]}
  busy=true;H.scroll=true;$('victory').classList.remove('on');renderHome();HOME().classList.add('on');scrollSel();
}
function renderHome(){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===H.tab));
  ({home:viewHome,map:viewMap,heroes:viewHeroes,spire:viewSpire})[H.tab]();
}
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{const was=H.tab;H.tab=b.dataset.t;H.hero=null;H.pick=false;if(H.tab==='map'&&was!=='map'){const f=frontier();H.c=f[0];H.s=f[1];H.scroll=true}renderHome()});
const NODE_X=[50,74,44,70,34,62,30,64,42,52],ROW_H=66,PATH_H=10*ROW_H+40;
function viewHome(){
  const x=TEAM[H.lead%TEAM.length]||heroById('summoner'),e=elOf(x),f=frontier(),fc=f[0],fs=f[1];
  $('hbar').innerHTML=`<h2><small>WELCOME BACK</small>Orb Spire</h2>${goldPill()}`;
  $('hbody').innerHTML=`<div class="homebox"><div class="hbub" id="hBub">${HOME_LINES[H.line|0]}</div>
  <button class="hlead" id="hLead" style="--c:${e.c};--d:${e.d}" aria-label="Change hero"><span class="knp">${knight(x,"full")}</span></button><div class="hplat"></div>
  <div class="hname" style="color:${e.c}">${fullName(x)} \u00b7 Lv ${lvOf(x)}</div></div>`;
  $('hfoot').innerHTML=`<div class="spanel"><button class="up go adv" id="goBtn">ADVENTURE<small>CHAPTER ${fc+1} \u00b7 STAGE ${fc+1}-${fs} \u00b7 ${STAGE_NAMES[fc][fs-1]}</small></button></div>`;
  $('goBtn').onclick=()=>begin('stage',fc,fs);
  $('hLead').onclick=()=>{H.lead=(H.lead+1)%TEAM.length;H.line=((H.line|0)+1)%HOME_LINES.length;beep(520,.08);viewHome()};
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
    h+=`<button class="node${boss?' boss':''}${ok?'':' lock'}${s===sel?' sel':''}" data-s="${s}" style="left:${NODE_X[s-1]}%;top:${(10-s)*ROW_H+20}px">${ok?(boss?'\u2620':s):'\u{1F512}'}${ok?`<span class="ns">${'\u2605'.repeat(st)}${'\u2606'.repeat(3-st)}</span>`:''}${fr[0]===H.c&&fr[1]===s&&!st&&ok?'<em>NEXT</em>':''}</button>`;
  }
  h+='</div>';
  $('hbody').innerHTML=h;
  const ok=unlocked(H.c,sel),st=starsOf(H.c,sel),weak=EL[weakTo(ch.el)];
  $('hfoot').innerHTML=`<div class="spanel"><div class="sp1"><b>${sel===10?'BOSS \u00b7 ':''}STAGE ${H.c+1}-${sel}</b><span>${STAGE_NAMES[H.c][sel-1]}</span></div>
  <div class="sp2">3 waves \u00b7 mostly ${EL[ch.el].n} \u00b7 weak to <i style="color:${weak.c}">${weak.n}</i></div>
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
  $('hbody').innerHTML=`<div class="spirebox"><div class="tower">\u{1F5FC}</div><h3>Climb as high as you can</h3>
  <p>Enemies get stronger every floor. A boss waits on every 5th floor. If you fall, you keep the gold you earned.</p>
  <div class="stats"><div class="st2"><small>BEST FLOOR</small><b>${best||'-'}</b></div><div class="st2"><small>GOLD</small><b>${SV.gold.toLocaleString()}</b></div></div></div>`;
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
  $('hfoot').innerHTML=`<div class="spanel"><button class="up go" id="sumBtn" ${pl&&SV.gold>=SUMMON_COST?'':'disabled'}>${pl?`\u2728 SUMMON KNIGHT \u00b7 \u{1FA99} ${SUMMON_COST}`:'ALL SUMMONABLE KNIGHTS OWNED'}</button></div>`;
  $('sumBtn').onclick=summon;
}
const BOSSKN=()=>CHAPTERS.map(c=>c.reward);
function summon(){
  const pool=HEROES.filter(h=>!SV.own[h.id]&&!BOSSKN().includes(h.id));
  if(!pool.length||SV.gold<SUMMON_COST)return;
  const w=pool.map(h=>5-h.r);let t=Math.random()*w.reduce((a,b)=>a+b,0),h=pool[0];
  for(let k=0;k<pool.length;k++){t-=w[k];if(t<=0){h=pool[k];break}}
  SV.gold-=SUMMON_COST;SV.own[h.id]=1;SV.lv[h.id]=1;save();
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
$('heroBtn').onclick=()=>{
  if(drag||busy)return;
  sheet('<h2>Leave battle?</h2><p>Your progress in this fight will be lost.</p>',[['Stay'],['Leave',()=>openHome(G.mode==='spire'?'spire':'map',G.mode==='stage'?G.c:null,G.s)]]);
};
$('logBtn').onclick=()=>{
  if(drag)return;
  sheet('<h2>Battle log</h2><div id="logList"></div>',[[lite?'Smooth mode: On':'Smooth mode: Off',()=>setLite(!lite)],['How to play',()=>help([['Back to game',null,'go']])],['Close',null,'go']]);
  G.log.forEach(l=>{const d=document.createElement('div');d.className=l.cls;d.textContent=l.text;$('logList').appendChild(d)});
};
$('sndBtn').onclick=()=>{sound=!sound;$('sndBtn').textContent=sound?'\u{1F50A}':'\u{1F507}'};
addEventListener('resize',()=>{if(!drag)resize()});
G={mode:'spire',c:0,s:1,wave:1,floor:1,n:1,turns:0,guard:0,hp:1,max:1,skill:[],bonus:0,log:[],foes:[],target:null,runGold:0};
$('app').classList.toggle('lite',lite);resize(true);drawGold();drawBest();openHome('home');
