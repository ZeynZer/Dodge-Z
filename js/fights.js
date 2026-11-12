'use strict';
/* ================= DODGE ZERO — combats, boss, finishers, supers, réflexe ================= */
const ROM=['',' II',' III',' IV',' V',' VI',' VII'];
const BOSSES=[
  {id:'kronos',name:'KRONOS',sub:'Le gardien du temps',mech:['seq'],v:'agent',arena:'b_kronos',epal:{main:'#17181d',sec:'#ff2a44',metal:'#6a6e78',glow:'#ff1a2e',hair:'#999'}},
  {id:'mirage',name:'MIRAGE',sub:'Rien n\'est réel',mech:['seq','fake'],v:'prof',arena:'b_mirage',epal:{main:'#d8d8de',sec:'#222',metal:'#9a9aa4',glow:'#ff1a2e',hair:'#999'}},
  {id:'gemini',name:'GÉMEAUX',sub:'Deux tirs, un seul souffle',mech:['seq','double'],v:'boxer',arena:'b_gemini',epal:{main:'#3a3b42',sec:'#ffffff',metal:'#8a8d96',glow:'#ff1a2e',hair:'#999'}},
  {id:'revers',name:'REVERS',sub:'Tout est à l\'envers',mech:['seq','reverse'],v:'hoops',arena:'b_revers',epal:{main:'#ececf0',sec:'#111',metal:'#aaaab4',glow:'#a040ff',hair:'#999'}},
  {id:'omega',name:'OMÉGA-0',sub:'La fin de tout',mech:['seq','fake','double','reverse'],v:'classic',arena:'b_omega',epal:{main:'#120408',sec:'#ffb020',metal:'#5a3a3a',glow:'#ff3a2a',hair:'#999'}}
];

function diff(L){
  const bosses=Math.floor((L-1)/5),inC=(L-1)%5;
  return{
    react:Math.max(.34,1.2-.05*bosses-.006*G.kills),
    interval:clamp(1.0-.13*Math.min(inC,3)-.012*bosses,.36,1.05),
    need:Math.min(6,4+Math.floor(bosses/2)),bosses,inC
  };
}
function randDir(prev){let d;do{d=pick(DIRS);}while(prev&&d===prev.a&&prev.n>=2);return d;}
async function waitI(sec){let t=0;while(t<sec){if(G.wantSuper)return'super';const s=Math.min(.05,sec-t);await wait(s);t+=s;}return G.wantSuper?'super':null;}
async function waitSkip(sec){let t=0;while(t<sec&&!G.skip){const s=Math.min(.05,sec-t);await wait(s);t+=s;}G.skip=false;}

/* ---------- gestion des coups reçus ---------- */
function takeHit(){
  const train=G.mode==='train';
  if(!train)G.lives=Math.max(0,G.lives-1);
  G.hits=(G.hits||0)+1;SV.stats.hits++;if(train)G.tr.hits++;
  G.streak=0;G.prog=0;
  setPose(P,'hit',.07);P.flash=1;P.tx=null;
  const b=bodyPos(P,.6);
  burst(b[0],b[1],28,['#ff2a44','#fff','#ffb0b8'],320,5,.6);ring(b[0],b[1],6,78,.35,'#ff2a44');
  shake(18);flashScr('#ff0030',.5);G.vig=.5;tw(G,{vig:0},.9);Au.hit();vib([90,40,90]);
  popup('TOUCHÉ !',P.x,P.y-155,'#ff2a44',26);
  slowmo(.28,1.5);
  return!train&&G.lives<=0;
}
async function recoverAfterHit(){
  await wait(.45);
  P.tx=PX0;P.sp=4;setPose(P,'idle',.3);
  await wait(.3);
}

/* ---------- combat classique ---------- */
async function classicFight(T){
  const L=G.level,d=T?{react:T.react,interval:T.interval,need:4}:diff(L);
  G.fightKind=T?'train':'normal';
  const ev=T?T.v:pick(VID);
  G.arena=T?'dojo':pick(ARENAS);
  setupEnemy(ev);resetPlayerPos(PX0);
  G.prog=0;G.need=d.need;G.lvlLabel=T?'ENTRAÎNEMENT':('NIVEAU '+L);
  const first=!T&&!(SV.tuto&1);
  /* intro : dézoom sur les deux cyborgs */
  E.alpha=0;cam.z=1.9;cam.fx=EX;cam.fy=GROUND-70;
  Au.noise(.5,.3,300,4000,'bandpass');
  tw(cam,{z:1,fx:W/2,fy:H/2},.9,easeOut);
  for(let i=0;i<6;i++){E.alpha=i%2?.2:.9;await wait(.04);}
  E.alpha=1;E.flash=.7;
  if(!T)banner(G.lvlLabel,'VS '+vOf(ev).name,1.2);
  G.canSkip=!!(SV.tuto&1);G.skip=false;
  await waitSkip(first?1.1:.75);G.canSkip=false;G.skip=false;
  if(first)hint('GLISSE DANS LE SENS DE LA FLÈCHE\n↑  ↓  ←  →',2.6);
  let prev={a:null,n:0},firstShot=first;
  while(true){
    const iv=T?T.interval:d.interval*rand(.88,1.12);
    let r=await waitI(firstShot?.9:iv);
    if(!r){
      const counter=G.prog>=G.need;
      const time=firstShot?2.0:d.react*(counter?1.3:1);
      if(counter&&!(SV.tuto&2))hint('DOUBLE TAP POUR CONTRER !',2.2);
      const dir=randDir(prev);if(dir===prev.a)prev.n++;else{prev.a=dir;prev.n=1;}
      r=await fireShot(counter?{kind:'counter',time}:{kind:'swipe',dirs:[dir],time});
    }
    if(r==='super'){await superMove();return'won';}
    if(r==='ok'){
      const S=G.lastShot;firstShot=false;
      G.prog++;G.streak++;G.dodges++;SV.stats.dodges++;SV.stats.streak=Math.max(SV.stats.streak,G.streak);
      if(G.mode==='train'){G.tr.dodges++;G.tr.best=Math.max(G.tr.best,G.streak);}
      G.sup=Math.min(100,G.sup+(S.fast?11:8));
      if(!(SV.tuto&1)){SV.tuto|=1;save();}
      if(S.fast)popup('PARFAIT',P.x+12,P.y-160,'#3dff9a',17);
      setPlayerProgressX();
      continue;
    }
    if(r==='counter'){
      if(!(SV.tuto&2)){SV.tuto|=2;save();}
      await strike(true);
      await killRewards();
      return'won';
    }
    /* touché */
    const dead=takeHit();
    if(dead)return'dead';
    setPlayerProgressX();
    await recoverAfterHit();
    prev={a:null,n:0};
  }
}
async function killRewards(){
  G.kills++;SV.stats.kills++;if(G.mode==='train'){G.tr.kills++;return;}
  const mult=1+Math.min(G.streak,40)*.05,coins=Math.round(10*mult);
  G.runCoins+=coins;G.runXP+=8+Math.floor(G.level/2);
  popup('+'+coins,EX,GROUND-150,'#ffd23a',22,1.1);Au.coin();
  G.sup=Math.min(100,G.sup+20);
  await wait(.35);
}

/* ---------- coup de grâce (contre) ---------- */
async function strike(fatal,boss){
  const v=P.v;
  tw(G,{hudA:0},.15);
  P.gun=false;
  const hp=handPos(P);
  ring(hp[0]+12,hp[1],4,54,.3,'#fff',5);burst(hp[0]+12,hp[1],14,['#fff','#ffe08a'],260,3,.35,0);
  popup('CONTRE !',P.x+10,P.y-150,'#ffe08a',24);
  slowmo(.3,.8);
  tw(cam,{z:1.45,fx:(P.x+E.x)/2+22,fy:GROUND-70},.25,easeOut);
  await wait(.06);
  P.tx=E.x-(boss?104:70);P.sp=26;ghost(P);
  await wait(.07);ghost(P);
  const ep=bodyPos(E,.62),hd=headPos(E);
  switch(v){
    case'hoops':{setPose(P,'throwP',.05);const h=handPos(P);const b=prop({x:h[0],y:h[1],z:1,life:2,draw:c=>ballShape(c,11),vr:26});await tw(b,{x:hd[0]-6,y:hd[1]},.12,easeIn);b.life=0;break;}
    case'prof':{setPose(P,'throwP',.05);const h=handPos(P);const b=prop({x:h[0],y:h[1],z:1,life:2,vr:20,draw:c=>{c.fillStyle='#b01a2c';c.fillRect(-11,-8,22,16);c.fillStyle='#f4f4f4';c.fillRect(-10,-6,20,12);c.fillStyle='#b01a2c';c.fillRect(-11,-8,4,16);}});await tw(b,{x:hd[0]-6,y:hd[1]},.12,easeIn);b.life=0;burst(hd[0],hd[1],18,'#fff',240,6,.8,200);break;}
    case'agent':{setPose(P,'shoot',.04);P.gun=true;const m=gunTip(P);burst(m[0],m[1],8,['#ffe9a0','#fff'],180,3,.2,0);Au.shot();
      const b=prop({x:m[0],y:m[1],z:1,life:2,draw:c=>{c.fillStyle='#fff';c.fillRect(-14,-1.5,28,3);}});await tw(b,{x:hd[0],y:hd[1]},.07,easeIn);b.life=0;break;}
    case'boxer':{setPose(P,'hook',.05);await wait(.06);break;}
    default:{setPose(P,'palm',.05);await wait(.05);}
  }
  P.gun=false;
  Au.hit();shake(20);E.flash=1;hitstop(.09);
  ring(ep[0],ep[1],8,110,.4,'#fff',8);burst(ep[0],ep[1],26,['#fff','#ff2a44','#ffe08a'],340,5,.6);
  slash(ep[0]-60,ep[1]+30,ep[0]+60,ep[1]-30,.3,'#fff',9);
  await wait(.1);
  if(fatal){await enemyKO(v,!!boss);}
  else{
    setPose(E,'hit',.05);E.tx=EX+22;E.sp=18;
    await wait(.35);E.tx=EX;setPose(E,'eIdle',.3);
  }
  slowmo(1,.01);
  P.tx=boss?150:PX0;P.sp=6;setPose(P,'idle',.3);
  tw(cam,{z:1,fx:W/2,fy:H/2},.4);
  tw(G,{hudA:1},.3);
  await wait(.3);
}
async function enemyKO(v,big){
  Au.ko();shake(big?34:24);flashScr('#fff',.7);hitstop(.1);
  const bp=bodyPos(E,.6);
  ring(bp[0],bp[1],10,170,.5,'#fff',9);burst(bp[0],bp[1],big?60:36,['#fff','#ff2a44','#ffb0b8','#ffe08a'],420,6,.9);
  switch(v){
    case'classic':E.phys=true;E.vx=430;E.vy=-420;E.spinV=-11;setPose(E,'hit',.05);await wait(.55);break;
    case'hoops':await tw(E,{sy:.32},.1);ring(E.x,E.y,10,120,.4,'#ffb020',8);await wait(.25);break;
    case'prof':chars(bp[0],bp[1],22,['0','1','π','Σ','∞','÷','∫'],'#fff',20);E.phys=true;E.vx=140;E.vy=-300;E.spinV=6;setPose(E,'stun',.05);await wait(.55);break;
    case'agent':{const h=headPos(E);burst(h[0],h[1],40,['#ff2a44','#a00018','#fff'],360,6,.8);setPose(E,'ko',.3);await wait(.75);break;}
    case'boxer':E.phys=true;E.vx=250;E.vy=-560;E.spinV=15;setPose(E,'hit',.05);for(let i=0;i<5;i++)popup('★',E.x+rand(-30,30),E.y-rand(100,170),'#ffd23a',20,.9);await wait(.8);break;
  }
  dissolve(E);Au.boom();shake(16);
}

/* ---------- boss ---------- */
function bossSpec(B,phase,react){
  const pool=B.mech.slice(1);
  const m=pool.length&&Math.random()<(.4+.1*phase)?pick(pool):'seq';
  const rt=Math.max(.3,react*(1-.1*phase)),rd=()=>pick(DIRS);
  if(m==='fake'){const a=rd();return{kind:'swipe',dirs:[a],time:rt,fake:true};}
  if(m==='double')return{kind:'swipe',dirs:[rd(),rd()],time:rt*1.75};
  if(m==='reverse'){const s=rd();return{kind:'swipe',dirs:[OPP[s]],shown:[s],rev:true,time:rt};}
  return{kind:'swipe',dirs:[rd()],time:rt};
}
async function bossFight(){
  const L=G.level,b=L/5-1,B=BOSSES[b%BOSSES.length],tier=Math.floor(b/BOSSES.length);
  G.fightKind='boss';G.boss={name:B.name+ROM[tier],id:B.id};G.arena=B.arena;G.lvlLabel='BOSS · NIVEAU '+L;
  setupEnemy(B.v,B.id);E.epal=B.epal;E.x=EX+170;resetPlayerPos(PX0);
  G.hp=3;G.hpMax=3;G.prog=0;
  P.tx=150;P.sp=3;
  flashScr('#ff0030',.8);Au.boss();vib([120,60,120]);
  cam.z=1.5;cam.fx=EX;cam.fy=GROUND-80;shake(14);
  banner('ALERTE BOSS',B.name+ROM[tier]+'  ·  '+B.sub,2.3,'#ff2a44');
  await tw(E,{x:EX},.9,easeOut);
  tw(cam,{z:1,fx:W/2,fy:H/2},.6);
  await wait(1.5);
  const base=Math.max(.36,diff(L).react*1.05);
  while(G.hp>0){
    const phase=3-G.hp;
    const n=Math.min(6,2+phase+(tier>0?1:0)+(tier>2?1:0)),gap=Math.max(.2,.5-.09*phase-.02*tier);
    await wait(.6);
    let ok=true;
    for(let i=0;i<n;i++){
      const r=await fireShot(bossSpec(B,phase,base));
      if(r==='hit'){ok=false;break;}
      G.dodges++;SV.stats.dodges++;G.streak++;SV.stats.streak=Math.max(SV.stats.streak,G.streak);
      if(G.lastShot&&G.lastShot.fast)popup('PARFAIT',P.x+12,P.y-160,'#3dff9a',16);
      await wait(gap);
    }
    if(ok){
      if(!(SV.tuto&2)){hint('DOUBLE TAP POUR FRAPPER !',2.2);}
      const r=await fireShot({kind:'counter',time:base*(1.35-.08*phase)});
      if(r==='counter'){
        if(!(SV.tuto&2)){SV.tuto|=2;save();}
        G.hp--;
        if(G.hp<=0){await bossKO();return'won';}
        await strike(false,true);
        banner('ACCÉLÉRATION','PHASE '+(4-G.hp),1.1,'#ff2a44');shake(10);Au.boss();
        await wait(.5);
        continue;
      }
      ok=false;
    }
    if(!ok){
      const dead=takeHit();if(dead)return'dead';
      await recoverAfterHit();
    }
  }
  return'won';
}
async function bossKO(){
  tw(G,{hudA:0},.15);
  P.gun=false;
  tw(cam,{z:1.5,fx:E.x-30,fy:GROUND-90},.3);
  slowmo(.25,2.4);
  await wait(.05);
  setPose(P,'punch',.05);P.tx=E.x-104;P.sp=26;
  await wait(.12);
  Au.hit();shake(26);E.flash=1;
  for(let i=0;i<6;i++){const b=bodyPos(E,rand(.1,.9));burst(b[0],b[1],14,['#fff','#ff2a44','#ffb020'],360,6,.7);ring(b[0],b[1],6,70,.4,'#ffb020',5);Au.noise(.3,.4,2000,100);await wait(.1);}
  G.inv=1;setTimeout(()=>{G.inv=0;},80);
  await enemyKO(E.v,true);
  banner('BOSS VAINCU',G.boss.name,2,'#3dff9a');
  slowmo(1,.01);
  tw(cam,{z:1,fx:W/2,fy:H/2},.4);
  setPose(P,'victory',.25);
  await wait(1.2);
  tw(G,{hudA:1},.3);
}
async function bossRewards(){
  const tier=Math.floor((G.level/5-1)/BOSSES.length),coins=150+60*tier,gems=2;
  G.runCoins+=coins;G.runGems+=gems;G.runXP+=40;G.bosses++;SV.stats.bosses++;
  popup('+'+coins,W/2,GROUND-160,'#ffd23a',28,1.5);popup('+'+gems+' ◆',W/2,GROUND-120,'#6ef',24,1.5);Au.win();Au.coin();
  await wait(1.4);
}

/* ---------- mini-jeu réflexe ---------- */
function reflexTap(){
  if(!RF.on||!RF.active||RF.tapped)return;
  RF.tapped=true;RF.active=false;
  const err=Math.abs(RF.t-RF.dur),pts=err<.07?2:(err<.16?1:0);
  RF.resolve(pts);
}
function updReflex(rdt){
  if(RF.on&&RF.active&&!RF.tapped){RF.t+=rdt;if(RF.t>RF.dur+.28){RF.tapped=true;RF.active=false;RF.resolve(0);}}
}
async function reflexGame(){
  G.mode='reflex';RF.on=true;RF.res=[null,null,null];RF.tr=36;RF.active=false;RF.msg='';
  tw(G,{hudA:0},.1);resetCam();Au.ready();
  for(let r=0;r<3;r++){
    RF.active=false;RF.msg='';
    await wait(r===0?1:rand(.7,1.5));
    RF.dur=[.95,.78,.62][r];RF.r0=150;RF.t=0;RF.tapped=false;RF.active=true;
    const pts=await new Promise(res=>{RF.resolve=res;});
    RF.res[r]=pts;
    RF.msg=pts===2?'PARFAIT !':(pts===1?'BIEN':'RATÉ');RF.msgCol=pts===2?'#3dff9a':(pts===1?'#ffd23a':'#ff2a44');
    if(pts)Au.coin();else Au.tone(150,.2,'sawtooth',.2,.6);
    vib(pts?18:[40,30,40]);
    await wait(.8);
  }
  const tot=RF.res.reduce((a,b)=>a+b,0);
  let msg;
  if(tot>=3){if(G.lives<3){G.lives++;msg='+1 VIE';}else{G.runCoins+=60;msg='VIES PLEINES · +60';}Au.win();}
  else msg='AUCUNE VIE GAGNÉE';
  if(tot>=6){G.runCoins+=40;msg+=' · BONUS +40';}
  RF.msg=msg;RF.msgCol=tot>=3?'#3dff9a':'#ff9aa8';
  await wait(1.6);
  RF.on=false;G.mode='play';tw(G,{hudA:1},.2);
  resetPlayerPos(PX0);
}

/* ---------- supers ---------- */
function useSuper(){
  if(!(G.mode==='play'||G.mode==='train')||G.sup<100||G.cine||G.fightKind==='boss'||G.paused)return;
  Au.init();G.wantSuper=true;
  const S=G.shot;if(S&&!S.done){S.done=true;S.out='super';G.shot=null;BUL.length=0;S.res('super');}
}
async function superMove(){
  G.sup=0;G.wantSuper=false;SV.stats.supers++;
  const v=P.v;G.cine={};P.tx=null;
  BUL.length=0;setPose(E,'eIdle',.1);
  tw(G,{hudA:0},.2);
  banner(vOf(v).sup,'SUPER · '+vOf(v).name,1.5,'#ff1e3c');
  await CINE[v]();
  await cineEnd();
  await killRewards();
}
async function cineEnd(){
  G.cine=null;
  P.tx=null;P.alpha=1;P.face=1;P.spin=0;P.y=GROUND;P.gun=false;P.aura=null;P.phys=false;P.sy=1;P.flash=0;P.clip=null;
  setPose(P,'idle',.2);
  tw(cam,{z:1,fx:W/2,fy:H/2},.4);
  await tw(G,{dark:0,hudA:1},.35);
  G.inv=0;
  P.x=PX0;
}
const CINE={
  async shadow(){ /* ÉCLIPSE ÉCARLATE : clip « ultimate » (charge 1,25 s puis rayon) */
    tw(G,{dark:.8},.3);await tw(P,{x:66},.3);tw(cam,{z:1.06,fx:W/2,fy:GROUND-90},.5,easeOut);
    const done=playClip(P,'ultimate');Au.charge(1.25);
    await wait(1.25);
    flashScr('#fff',.9);Au.boom();shake(30);hitstop(.08);
    const ey=GROUND-70;
    for(let i=0;i<6;i++){E.flash=i%2?1:.4;setPose(E,i%2?'hit':'stun',.04);Au.hit();shake(14);
      burst(E.x,ey,12,['#fff','#ff2a44','#ff6bd0'],340,4,.45);await wait(.2);}
    await done;
    flashScr('#fff',1);Au.boom();shake(36);ring(E.x,ey,10,220,.6,'#ff1e3c',12);ring(E.x,ey,10,150,.45,'#fff',8);
    dissolve(E);burst(E.x,ey,60,['#fff','#ff2a44'],520,6,.9);
    P.clip=null;setPose(P,'victory',.2);
    await wait(.9);
  },
  async classic(){
    tw(G,{dark:.8},.3);tw(P,{x:140},.4);tw(cam,{z:1.6,fx:150,fy:GROUND-70},.5,easeOut);
    setPose(P,'charge',.3);P.aura='#ff1e3c';Au.charge(1.3);
    for(let i=0;i<15;i++){const b=bodyPos(P,.6),a=rand(0,6.28),r=rand(70,120);
      FX.p.push({x:b[0]+Math.cos(a)*r,y:b[1]+Math.sin(a)*r,vx:-Math.cos(a)*r*2.4,vy:-Math.sin(a)*r*2.4,g:0,life:.45,max:.45,sz:4,col:'#ff3a55',shape:'sq',rot:0,vr:0});await wait(.085);}
    flashScr('#fff',.9);Au.boom();
    const ey=GROUND-70;
    for(let i=0;i<4;i++){
      ghost(P);const side=i%2?1:-1;P.x=E.x+side*74;P.face=side>0?-1:1;P.alpha=.95;
      setPose(P,i%2?'hook':'punch',.03);
      slash(E.x-110,ey+rand(-70,70),E.x+110,ey+rand(-70,70),.28,'#fff',11);
      G.inv=1;setTimeout(()=>{G.inv=0;},55);
      E.flash=1;setPose(E,i%2?'hit':'stun',.04);Au.hit();Au.noise(.18,.3,4000,600,'bandpass');shake(14);
      burst(E.x,ey,14,['#fff','#ff2a44'],300,4,.4);
      await wait(.3);
    }
    P.x=E.x+64;P.face=-1;setPose(P,'victory',.2);P.aura=null;
    E.aura='#ff1e3c';
    for(let i=0;i<7;i++){E.flash=i%2?.8:0;slash(E.x-30,ey-60+i*18,E.x+30,ey-50+i*18,.2,'#ff2a44',3);await wait(.09);}
    flashScr('#fff',1);Au.boom();shake(34);ring(E.x,ey,10,220,.6,'#ff1e3c',12);ring(E.x,ey,10,150,.45,'#fff',8);
    dissolve(E);E.aura=null;burst(E.x,ey,60,['#fff','#ff2a44'],520,6,.9);
    await wait(.9);
  },
  async hoops(){
    tw(G,{dark:.7},.3);await tw(P,{x:150},.3);tw(cam,{z:1.5,fx:150,fy:GROUND-70},.4,easeOut);
    const ball=prop({x:P.x+20,y:GROUND-40,z:1,life:99,draw:c=>ballShape(c,11),vr:6});
    for(let i=0;i<4;i++){
      setPose(P,i%2?'dribble2':'dribble1',.1);ball.x=handPos(P)[0]+8;
      await tw(ball,{y:GROUND-10},.16,easeIn);Au.dribble();burst(ball.x,GROUND,5,'#fff',90,2.5,.25,0);
      await tw(ball,{y:handPos(P)[1]+6},.16,easeOut);
    }
    setPose(P,'dunkUp',.2);Au.tone(180,.45,'sawtooth',.2,3);
    ball.vr=0;ball.rot=0;ball.upd=p=>{const h=handPos(P);p.x=h[0];p.y=h[1]-8;};
    ball.draw=c=>{const g=c.createRadialGradient(0,0,2,0,0,26);g.addColorStop(0,'rgba(255,200,60,.9)');g.addColorStop(1,'rgba(255,80,0,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,26,0,7);c.fill();ballShape(c,11);};
    const up=tw(P,{y:GROUND-440},.55,easeOut);tw(P,{spin:-Math.PI*2},.55);tw(cam,{fy:GROUND-250,z:1.15,fx:W/2},.55);
    for(let i=0;i<8;i++){ghost(P,'#ff9a2a');await wait(.07);}
    await up;
    P.spin=0;setPose(P,'dunkDown',.1);Au.charge(.3);
    tw(P,{x:E.x-8,y:E.y-124},.3,easeIn);tw(cam,{fy:GROUND-70,z:1.5,fx:E.x-50},.3,easeIn);
    await wait(.3);
    ball.life=0;
    Au.boom();shake(40);flashScr('#fff',.9);hitstop(.12);
    tw(E,{sy:.3},.07);
    ring(E.x,GROUND,10,260,.6,'#ffb020',14);ring(E.x,GROUND,10,170,.45,'#fff',8);
    burst(E.x,GROUND-20,50,['#ffb020','#fff','#ff4a1a'],520,6,.9);
    for(let i=0;i<7;i++){const a=-1+i*.35;slash(E.x,GROUND,E.x+Math.sin(a)*190,GROUND-Math.abs(Math.cos(a))*10+rand(-4,4),.5,'#111',5);}
    await wait(.35);
    tw(P,{y:GROUND},.14,easeIn);
    dissolve(E);burst(E.x,GROUND-40,40,['#ffb020','#222'],420,7,.9);
    await wait(.9);
  },
  async prof(){
    G.darkCol='#02030a';tw(G,{dark:.9},.4);tw(cam,{z:1.2,fx:W/2,fy:GROUND-100},.5);
    setPose(P,'point',.3);
    const lines=['E = mc²','∮ f(z) dz = 2πi · ΣRes','lim 1/x  (x→0⁺) = ∞','ENNEMI ÷ 0 = ∞'];
    const typed=[0,0,0,0];
    G.cine={draw(c){c.save();c.textAlign='left';
      lines.forEach((t,i)=>{const s=t.slice(0,typed[i]);c.font=i===3?font('700',24):'italic 19px Georgia,serif';c.fillStyle=i===3?'#ff3a4a':'rgba(255,255,255,.92)';c.shadowColor=i===3?'#ff1e3c':'#fff';c.shadowBlur=i===3?14:3;c.fillText(s,22,150+i*38);});
      c.restore();}};
    for(let i=0;i<4;i++){for(let k=1;k<=lines[i].length;k++){typed[i]=k;if(k%2)Au.tick();await wait(.034);}await wait(.18);}
    await wait(.25);
    const hole={r:0};
    const hp=prop({x:E.x,y:GROUND-80,z:-1,life:99,draw:c=>{const g=c.createRadialGradient(0,0,hole.r*.2,0,0,hole.r*1.6);g.addColorStop(0,'#000');g.addColorStop(.55,'#000');g.addColorStop(.7,'#ff1e3c');g.addColorStop(1,'rgba(255,30,60,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,hole.r*1.6,0,7);c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.ellipse(0,0,hole.r*1.5,hole.r*.4,G.time*3,0,7);c.stroke();}});
    Au.charge(1.1);
    tw(hole,{r:44},.7,easeOut);
    tw(E,{scale:.12,spin:Math.PI*5},1.1,easeIn);tw(E,{x:E.x-10,y:GROUND-80},1.1,easeIn);
    for(let i=0;i<22;i++){const a=rand(0,6.28),r=rand(70,140);const sym=pick(['0','1','π','Σ','∞','÷']);
      FX.p.push({x:E.x+Math.cos(a)*r,y:GROUND-80+Math.sin(a)*r,vx:-Math.cos(a)*r*1.8,vy:-Math.sin(a)*r*1.8,g:0,life:.55,max:.55,sz:16,col:'#fff',shape:'txt',ch:sym,rot:0,vr:0});await wait(.05);}
    await wait(.05);
    flashScr('#fff',1);Au.boom();shake(30);ring(E.x,GROUND-80,6,200,.6,'#fff',10);
    E.hidden=true;hp.life=0;
    popup('Q.E.D.',E.x-30,GROUND-120,'#fff',40,1.6,-20);
    chars(E.x,GROUND-80,26,['0','1','π','Σ','∞','÷','∫'],'#fff',22);
    await wait(1.2);
    G.cine={};
  },
  async agent(){
    tw(P,{x:80},.3);setPose(P,'scope',.3);P.gun=true;tw(G,{dark:.55},.3);
    await wait(.45);
    const sc={on:0,sway:1,txt:''};
    tw(cam,{z:2.3,fx:E.x,fy:headPos(E)[1]+4},.7,easeIO);tw(sc,{on:1},.5);
    const cs=['CIBLE VERROUILLÉE'];let ti=0;
    G.cine={draw(c){
      if(sc.on<=0.01)return;
      c.save();const R=118,cx=W/2,cy=H/2;
      c.fillStyle=`rgba(0,0,0,${.94*sc.on})`;c.beginPath();c.rect(0,0,W,H);c.moveTo(cx+R,cy);c.arc(cx,cy,R,0,7,true);c.closePath();c.fill('evenodd');
      c.strokeStyle='#0c0c0c';c.lineWidth=6;c.beginPath();c.arc(cx,cy,R,0,7);c.stroke();
      c.globalAlpha=sc.on;
      const ox=Math.sin(G.time*1.9)*14*sc.sway,oy=Math.cos(G.time*2.6)*11*sc.sway;
      c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.2;c.beginPath();c.moveTo(cx-R,cy+oy);c.lineTo(cx+R,cy+oy);c.moveTo(cx+ox,cy-R);c.lineTo(cx+ox,cy+R);c.stroke();
      c.strokeStyle='#ff1e3c';c.lineWidth=1.6;c.beginPath();c.arc(cx+ox,cy+oy,16,0,7);c.stroke();
      c.fillStyle='#ff1e3c';c.beginPath();c.arc(cx+ox,cy+oy,2.2,0,7);c.fill();
      c.font=font('700',12);c.textAlign='center';c.fillStyle='#8cffb0';c.fillText(sc.txt,cx,cy+R+26);
      c.restore();}};
    for(let i=1;i<=cs[0].length;i++){sc.txt=cs[0].slice(0,i);Au.tick();await wait(.035);}
    tw(sc,{sway:0},1.7,easeOut);
    for(let i=0;i<3;i++){Au.heart();await wait(.62);}
    /* tir */
    Au.shot();Au.boom();flashScr('#fff',.9);shake(26);
    const m=gunTip(P);burst(m[0],m[1],12,['#fff','#ffe08a'],200,3,.3,0);
    slowmo(.12,1.3);
    const hd=headPos(E);
    const bu=prop({x:E.x-200,y:hd[1],z:2,life:3,draw:c=>{const g=c.createLinearGradient(-90,0,0,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'#fff');c.fillStyle=g;c.fillRect(-90,-1.5,90,3);c.shadowColor='#fff';c.shadowBlur=10;c.fillStyle='#fff';c.beginPath();c.arc(0,0,3,0,7);c.fill();}});
    await tw(bu,{x:hd[0]-8},.11,easeIn);bu.life=0;
    G.inv=1;setTimeout(()=>{G.inv=0;},90);
    burst(hd[0],hd[1],50,['#ff2a44','#a00018','#fff'],420,6,.9);ring(hd[0],hd[1],6,140,.5,'#fff',8);Au.ko();shake(30);
    setPose(E,'ko',.5);
    tw(sc,{on:0},.3);
    await wait(.25);
    G.cine={};
    tw(cam,{z:1.3,fx:W/2,fy:GROUND-80},.5);
    banner('NEUTRALISÉ','CIBLE ÉLIMINÉE',1.5,'#8cffb0');
    await wait(.7);
    dissolve(E);P.gun=false;
    await wait(.6);
  },
  async boxer(){
    tw(G,{dark:.55},.25);P.tx=E.x-62;P.sp=18;tw(cam,{z:1.55,fx:E.x-30,fy:GROUND-70},.4);
    await wait(.4);
    let hits=0;
    G.cine={draw(c){if(hits<1)return;c.save();c.textAlign='right';c.font=font('700',42);c.lineWidth=7;c.strokeStyle='#000';c.strokeText(hits+' HITS',W-18,170);c.fillStyle='#ffd23a';c.fillText(hits+' HITS',W-18,170);c.restore();}};
    const mv=['punch','hook','punch','hook','punch','hook','punch'];
    for(let i=0;i<7;i++){
      setPose(P,mv[i],.04);setPose(E,i%2?'hit':'stun',.04);E.flash=.8;hits++;
      Au.tone(150+i*30,.12,'sawtooth',.3,.5);Au.hit();shake(10+i*2);
      const bp=bodyPos(E,.6);burst(bp[0],bp[1],12,['#fff','#ffd23a','#ff2a44'],300,4,.4);
      popup(pick(['POW','BAM','WHAM','CRACK','BOOM']),bp[0]+rand(-30,30),bp[1]-rand(0,60),'#ffd23a',26,.7);
      ring(bp[0],bp[1],4,46,.25,'#fff',4);cam.z=1.55+(i%2?.06:0);
      hitstop(.035);await wait(.11);
    }
    setPose(P,'windup',.25);Au.charge(.8);slowmo(.25,1);P.aura='#ffd23a';
    await wait(.22);
    setPose(P,'upper',.05);P.aura=null;
    Au.boom();shake(34);flashScr('#fff',.9);G.inv=1;setTimeout(()=>{G.inv=0;},70);
    ring(E.x,GROUND-90,8,200,.5,'#ffd23a',10);
    E.phys=true;E.vy=-1150;E.vx=70;E.spinV=13;setPose(E,'hit',.05);
    tw(cam,{fy:GROUND-280,z:1.15,fx:W/2},.7);
    banner('K.O.!','',1.5,'#ffd23a');
    slowmo(1,.01);
    await wait(.7);
    for(let i=0;i<4;i++){popup('★',E.x+rand(-50,50),E.y+rand(-40,40),'#ffd23a',22,.8);await wait(.08);}
    while(E.y<GROUND-4)await wait(.05);
    shake(30);ring(E.x,GROUND,8,170,.5,'#fff',8);Au.boom();
    tw(cam,{fy:GROUND-70,z:1.4,fx:E.x-40},.4);
    dissolve(E);
    await wait(.9);
  }
};

/* ---------- cycle de partie ---------- */
function resetRun(){
  Object.assign(G,{level:1,lives:3,streak:0,kills:0,prog:0,need:4,sup:0,runCoins:0,runGems:0,runXP:0,bosses:0,dodges:0,hits:0,hp:3,vig:0,fightKind:'normal',boss:null});
  G.tr={dodges:0,hits:0,kills:0,best:0};
}
function startRun(lv){
  Au.init();abortAll();resetRun();if(typeof lv==='number')G.level=lv;loadPlayer();resetPlayerPos(PX0);setPose(E,'eIdle',.01);
  if(P.v==='shadow'){playClip(P,'intro').then(()=>{if(P.clip==='intro')P.clip=null;});}
  G.mode='play';G.paused=false;resetCam();P.scale=1;
  uiShow(null);document.body.classList.add('ingame');wake();
  Au.music('play',0);
  runLoop();
}
async function runLoop(){
  const gen=G.gen;
  try{
    while(gen===G.gen){
      const L=G.level,isBoss=L%5===0;
      Au.music('play',Math.min(4,Math.floor((L-1)/5)));
      const r=isBoss?await bossFight():await classicFight();
      if(gen!==G.gen)return;
      if(r==='dead'){await deathSeq();return;}
      if(isBoss){await bossRewards();await reflexGame();}
      G.level++;await wait(.2);
    }
  }catch(e){console.error(e);}
}
async function deathSeq(){
  Au.lose();Au.music('off');tw(G,{hudA:0},.2);G.vig=.55;
  setPose(P,'ko',.4);P.phys=true;P.vx=-200;P.vy=-340;
  slowmo(.3,1.9);flashScr('#f03',.5);vib([200,80,200]);
  await wait(.5);
  const res=bankRun();
  showResult(res);
}
function bankRun(){
  SV.coins+=G.runCoins;SV.gems+=G.runGems;SV.stats.runs++;SV.best=Math.max(SV.best,G.level);
  const xp=G.runXP+G.level*5,r=addXP(xp);save();
  return{level:G.level,kills:G.kills,coins:G.runCoins,gems:G.runGems,xp,up:r.up,bonus:r.bonus,lvl:r.lvl,bosses:G.bosses,streak:SV.stats.streak};
}
function startTrain(cfg){
  Au.init();abortAll();resetRun();loadPlayer();resetPlayerPos(PX0);
  G.mode='train';G.paused=false;resetCam();P.scale=1;G.fightKind='train';
  uiShow(null);document.body.classList.add('ingame');wake();
  Au.music('play',0);
  (async()=>{try{const gen=G.gen;while(gen===G.gen){await classicFight(cfg);await wait(.25);}}catch(e){console.error(e);}})();
}
