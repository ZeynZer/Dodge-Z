'use strict';
/* ================= DODGE ZERO — moteur : état, FX, entrées, tirs, rendu ================= */
let W=360,H=640,GROUND=430,SCALE=1,DPR=1;
const cv=$('#c'),ctx=cv.getContext('2d');
const PX0=62,PX1=186,EX=296;
const DIRS=['up','down','left','right'];
const OPP={up:'down',down:'up',left:'right',right:'left'};
const GLYPH={up:'↑',down:'↓',left:'←',right:'→'};
const LANE={up:-20,down:-114,left:-80,right:-50,mid:-78};

const G={mode:'boot',gen:0,ts:1,tsT:1,slowEnd:0,paused:false,level:1,lives:3,streak:0,kills:0,prog:0,need:4,sup:0,
  runCoins:0,runGems:0,runXP:0,bosses:0,shot:null,lastShot:null,arrowFade:0,arena:'void',wantSuper:false,cine:null,time:0,
  train:null,boss:null,hint:null,banner:null,flashA:0,flashCol:'#fff',dark:0,darkCol:'#000',inv:0,hudA:1,lvlLabel:'',
  hp:3,hpMax:3,tr:{dodges:0,hits:0,kills:0,best:0},skip:false,canSkip:false,fightKind:'normal',menu:{gy:330,sc:1.5,as:1},
  dodges:0,best:0,superOK:false,vig:0};
const cam={fx:180,fy:320,z:1,shake:0};
function resetCam(){cam.fx=W/2;cam.fy=H/2;cam.z=1;cam.shake=0;}

/* ---------- redimensionnement ---------- */
let bgPat=null;
function resize(){
  const vw=innerWidth,vh=innerHeight;
  const aw=Math.min(vw,vh*.64),ah=vh;
  const app=$('#app');app.style.width=aw+'px';app.style.height=ah+'px';
  SCALE=aw/360;W=360;H=ah/SCALE;
  DPR=Math.min(window.devicePixelRatio||1,2.5);
  cv.width=Math.round(aw*DPR);cv.height=Math.round(ah*DPR);
  cv.style.width=aw+'px';cv.style.height=ah+'px';
  GROUND=Math.max(430,H*.69);
  if(typeof applyMenuLayout==='function')applyMenuLayout();
  if(!G.cine&&G.mode!=='play'&&G.mode!=='train')resetCam();
  const p=document.createElement('canvas');p.width=p.height=16;const pc=p.getContext('2d');
  pc.strokeStyle='rgba(255,255,255,.035)';pc.lineWidth=1;pc.beginPath();pc.moveTo(0,16);pc.lineTo(16,0);pc.stroke();
  bgPat=ctx.createPattern(p,'repeat');
}

/* ---------- combattants ---------- */
function mkF(o){return Object.assign({x:0,y:0,face:1,cur:clonePose(PO.idle),from:clonePose(PO.idle),to:PO.idle,k:1,dur:.1,q:[],hold:0,holdT:0,
  v:'classic',pal:PALS[0],epal:EPAL,fem:false,enemy:false,boss:null,alpha:1,flash:0,scale:1,sy:1,gun:false,tx:null,sp:9,
  phys:false,vx:0,vy:0,g:1500,spin:0,spinV:0,hidden:false,aura:null,noShadow:false},o);}
const P=mkF({face:1}),E=mkF({face:-1,enemy:true,gun:true});
function setPose(f,name,dur=.1){f.from=clonePose(f.cur);f.to=typeof name==='string'?PO[name]:name;f.k=0;f.dur=Math.max(.001,dur);f.q=[];}
function nextQ(f){const s=f.q.shift();if(!s)return;f.from=clonePose(f.cur);f.to=typeof s[0]==='string'?PO[s[0]]:s[0];f.k=0;f.dur=Math.max(.001,s[1]);f.hold=s[2]||0;f.holdT=0;}
function seq(f,list){f.q=list.slice();nextQ(f);}
function updF(f,dt){
  if(f.k<1){f.k=Math.min(1,f.k+dt/f.dur);f.cur=mixPose(f.from,f.to,easeIO(f.k));}
  else if(f.q.length){f.holdT+=dt;if(f.holdT>=f.hold)nextQ(f);}
  if(f.tx!=null)f.x+=(f.tx-f.x)*Math.min(1,dt*f.sp);
  if(f.phys){f.vy+=f.g*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;
    if(f.y>GROUND){f.y=GROUND;if(Math.abs(f.vy)>200)f.vy*=-.3;else f.vy=0;f.vx*=.9;f.spinV*=.85;}
    f.spin+=f.spinV*dt;}
  if(f.flash>0)f.flash=Math.max(0,f.flash-dt*4.5);
}
function loadPlayer(){
  const v=SV.selV,s=SV.selS[v]||0;
  P.v=v;P.pal=skinPal(s);P.fem=skinFem(s);P.enemy=false;P.gun=false;
}
function resetPlayerPos(x=PX0){
  P.x=x;P.tx=null;P.y=GROUND;P.face=1;P.alpha=1;P.flash=0;P.scale=1;P.sy=1;P.phys=false;P.spin=0;P.spinV=0;P.vx=P.vy=0;P.hidden=false;P.aura=null;P.gun=false;
  P.cur=clonePose(PO.idle);P.from=clonePose(PO.idle);P.to=PO.idle;P.k=1;P.q=[];
}
function setupEnemy(v,boss){
  E.v=v;E.boss=boss||null;E.enemy=true;E.fem=Math.random()<.3;E.face=-1;E.x=EX;E.y=GROUND;E.alpha=1;E.flash=0;
  E.scale=boss?1.26:1;E.sy=1;E.gun=true;E.phys=false;E.vx=E.vy=0;E.spin=0;E.spinV=0;E.hidden=false;E.tx=null;E.aura=null;
  E.epal=Object.assign({},EPAL,{sec:pick(['#c9ccd3','#e4e4e8','#a6a9b2'])});
  E.cur=clonePose(PO.eIdle);E.from=clonePose(PO.eIdle);E.to=PO.eIdle;E.k=1;E.q=[];
}

/* ---------- tweens, attentes ---------- */
const TW=[],SL=[];
function tw(obj,props,dur,ease=easeIO,delay=0){
  return new Promise(res=>{const from={};for(const k in props)from[k]=obj[k];TW.push({obj,props,from,dur:Math.max(.001,dur),t:-delay,ease,res});});
}
function wait(s){return new Promise(res=>SL.push({t:s,res}));}
function updTW(dt){
  for(let i=TW.length-1;i>=0;i--){const w=TW[i];w.t+=dt;if(w.t<0)continue;const k=Math.min(1,w.t/w.dur),e=w.ease(k);
    for(const key in w.props)w.obj[key]=lerp(w.from[key],w.props[key],e);if(k>=1){TW.splice(i,1);w.res();}}
  for(let i=SL.length-1;i>=0;i--){const w=SL[i];w.t-=dt;if(w.t<=0){SL.splice(i,1);w.res();}}
}
function abortAll(){G.gen++;TW.length=0;SL.length=0;G.shot=null;G.lastShot=null;BUL.length=0;clearFX();G.cine=null;G.wantSuper=false;
  G.dark=0;G.inv=0;G.flashA=0;G.hudA=1;G.tsT=1;G.ts=1;G.banner=null;G.hint=null;G.skip=false;G.canSkip=false;}
function slowmo(scale,realSec){G.tsT=scale;G.slowEnd=performance.now()+realSec*1000;}
function hitstop(realSec){G.ts=.02;G.tsT=.02;G.slowEnd=performance.now()+realSec*1000;}
function shake(n){cam.shake=Math.max(cam.shake,n);}
function flashScr(col,a){G.flashCol=col;G.flashA=Math.max(G.flashA,a*(SV.set.flash?1:.35));}
function banner(text,sub,dur=1.4,col='#fff'){G.banner={text,sub,t:0,dur,col};}
function hint(text,dur=2){G.hint={text,t:0,dur};}

/* ---------- effets ---------- */
const FX={p:[],t:[],r:[],l:[],pr:[],gh:[]};
function clearFX(){for(const k in FX)FX[k].length=0;}
function burst(x,y,n,cols,spd=220,sz=4,life=.7,grav=420,shape='sq'){
  for(let i=0;i<n;i++){const a=rand(0,6.283),s=rand(.2,1)*spd;
    FX.p.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-spd*.2,g:grav,life:rand(.5,1)*life,max:life,sz:rand(.5,1)*sz,col:Array.isArray(cols)?pick(cols):cols,shape,rot:rand(0,6),vr:rand(-8,8)});}
}
function chars(x,y,n,list,col='#fff',size=18){
  for(let i=0;i<n;i++){const a=rand(0,6.283),s=rand(60,260);FX.p.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-120,g:200,life:rand(.7,1.2),max:1.2,sz:size*rand(.7,1.2),col,shape:'txt',ch:pick(list),rot:0,vr:rand(-2,2)});}
}
function popup(txt,x,y,col='#fff',size=22,life=.9,vy=-45){FX.t.push({txt,x,y,col,size,life,max:life,vy});}
function ring(x,y,r0,r1,life=.5,col='#fff',w=5){FX.r.push({x,y,r0,r1,life,max:life,col,w});}
function slash(x1,y1,x2,y2,life=.25,col='#fff',w=6){FX.l.push({x1,y1,x2,y2,life,max:life,col,w});}
function prop(o){const p=Object.assign({life:9,t:0,x:0,y:0,vx:0,vy:0,g:0,rot:0,vr:0,draw:null,z:1},o);FX.pr.push(p);return p;}
function ghost(f,col){FX.gh.push({x:f.x,y:f.y,face:f.face,pose:clonePose(f.cur),v:f.v,pal:f.pal,fem:f.fem,enemy:f.enemy,epal:f.epal,scale:f.scale,dx:0,life:.3,max:.3,col:col||(f.enemy?'#ff3050':'#66eeff')});}
function dissolve(f){
  const bp=bodyPos(f,.5);
  for(let i=0;i<70;i++){const x=bp[0]+rand(-24,24),y=bp[1]+rand(-60,60);
    FX.p.push({x,y,vx:rand(-120,160),vy:rand(-220,60),g:260,life:rand(.5,1.1),max:1.1,sz:rand(3,7),col:pick(['#e6e6ea','#8a8d96','#ff2a44','#2c2e34','#fff']),shape:'sq',rot:0,vr:rand(-4,4)});}
  f.hidden=true;f.phys=false;
}
function updFX(dt){
  for(let i=FX.p.length-1;i>=0;i--){const p=FX.p[i];p.life-=dt;if(p.life<=0){FX.p.splice(i,1);continue;}p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;}
  for(let i=FX.t.length-1;i>=0;i--){const p=FX.t[i];p.life-=dt;if(p.life<=0){FX.t.splice(i,1);continue;}p.y+=p.vy*dt;}
  for(const k of['r','l','gh'])for(let i=FX[k].length-1;i>=0;i--){const p=FX[k][i];p.life-=dt;if(p.life<=0)FX[k].splice(i,1);}
  for(let i=FX.pr.length-1;i>=0;i--){const p=FX.pr[i];p.t+=dt;p.life-=dt;if(p.life<=0){if(p.end)p.end(p);FX.pr.splice(i,1);continue;}p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;if(p.upd)p.upd(p,dt);}
}

/* ---------- entrées ---------- */
const Inp={sx:0,sy:0,st:0,id:null,done:false,lastTap:0};
function bindInput(){
  const app=$('#app');
  app.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,.sheet,.panel,.modal,label,a'))return;
    Au.init();
    const now=performance.now();
    if(G.mode==='reflex'){reflexTap();Inp.id=null;return;}
    if(G.canSkip){G.skip=true;}
    Inp.id=e.pointerId;Inp.sx=e.clientX;Inp.sy=e.clientY;Inp.st=now;Inp.done=false;
    if(now-Inp.lastTap<340){Inp.lastTap=0;Inp.done=true;onDouble();}
  });
  app.addEventListener('pointermove',e=>{
    if(e.pointerId!==Inp.id||Inp.done)return;
    const dx=(e.clientX-Inp.sx),dy=(e.clientY-Inp.sy);
    if(Math.hypot(dx,dy)>18){Inp.done=true;onSwipe(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));}
  });
  const up=e=>{if(e.pointerId!==Inp.id)return;Inp.id=null;if(Inp.done)return;const now=performance.now();if(now-Inp.st<320)Inp.lastTap=now;};
  app.addEventListener('pointerup',up);app.addEventListener('pointercancel',()=>{Inp.id=null;});
  addEventListener('keydown',e=>{
    if(e.repeat)return;
    const m={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];
    if(m&&!e.ctrlKey){Au.init();onSwipe(m);e.preventDefault();}
    else if(e.key===' '||e.key==='Enter'){if(G.mode==='reflex')reflexTap();else{G.skip=true;onDouble();}}
    else if(e.key==='Shift'||e.key==='x'){useSuper();}
    else if(e.key==='Escape'||e.key==='p'){if(typeof togglePause==='function')togglePause();}
  });
}
function onSwipe(dir){if(G.paused||(G.mode!=='play'&&G.mode!=='train'))return;shotSwipe(dir);}
function onDouble(){if(G.paused||(G.mode!=='play'&&G.mode!=='train'))return;shotDouble();}

/* ---------- tirs ---------- */
const BUL=[];
function fireShot(spec){
  return new Promise(res=>{
    const kind=spec.kind||'swipe',n=kind==='counter'?1:spec.dirs.length,T=spec.time;
    const S={kind,dirs:spec.dirs||[],shown:spec.shown||spec.dirs||[],rev:!!spec.rev,fake:!!spec.fake,time:T,t:0,idx:0,res,done:false,n,bul:[],out:null,locked:false,fast:true};
    const flight=n>1?T*.6:T;
    for(let i=0;i<n;i++){const arr=n>1?T*(.6+.4*i/(n-1)):T;S.bul.push({arr,launch:arr-flight,flight,lane:kind==='counter'?'mid':(spec.fake?'mid':S.dirs[i]),obj:null,dodged:false,doomed:false});}
    G.shot=S;G.arrowFade=0;
    updShot(S,0);
  });
}
function launchBullet(S,b,flightOverride){
  const m=gunTip(E);
  const fl=flightOverride||b.flight;
  b.obj={x0:m[0],y0:m[1],x1:P.x+4,y1:GROUND+LANE[b.lane],p:0,fl,rate:1,state:'fly',fake:S.fake&&!flightOverride};
  if(S.fake&&!flightOverride){b.obj.state='blank';b.obj.p=0;}
  else BUL.push(b.obj);
  const big=E.boss?'#ffb020':'#ffe9a0';
  burst(m[0],m[1],8,[big,'#fff','#ff4a2a'],160,3,.25,0);
  FX.pr.push({x:m[0],y:m[1],life:.09,t:0,z:2,draw:(c,p)=>{c.fillStyle='#fff';c.beginPath();c.arc(0,0,14*(1-p.t/.09),0,7);c.fill();c.fillStyle='rgba(255,200,80,.9)';c.beginPath();c.moveTo(-6,-4);c.lineTo(-30,0);c.lineTo(-6,4);c.fill();},vx:0,vy:0,g:0,rot:0,vr:0});
  setPose(E,'eRecoil',.05);
  seq(E,[['eRecoil',.05,.08],['eIdle',.25]]);
  Au.shot();
  if(S.fake){Au.tone(300,.12,'triangle',.12,.5);}
}
function updShot(S,dt){
  S.t+=dt;
  for(const b of S.bul)if(!b.obj&&S.t>=b.launch)launchBullet(S,b);
  if(S.done)return;
  if(S.fake&&!S.locked){if(S.t>=S.time)finishShot(S,'ok');return;}
  const b=S.bul[S.idx];
  if(!b)return;
  if(b.obj&&!S.fake&&b.obj.state==='fly'&&b.obj.p>=1&&!b.dodged){b.obj.state='hit';finishShot(S,'hit');}
  if(S.fake&&S.locked&&b.obj&&b.obj.p>=1){b.obj.state='hit';finishShot(S,'hit');}
}
function finishShot(S,out){
  if(S.done)return;S.done=true;S.out=out;G.lastShot=S;G.arrowFade=.28;if(G.shot===S)G.shot=null;
  S.res(out);
}
function dodgePose(dir){
  const nm={up:'dUp',down:'dDown',left:'dLeft',right:'dRight'}[dir];
  if(dir==='right'){for(let i=0;i<4;i++)setTimeout(()=>ghost(P),i*28);P.alpha=.45;setTimeout(()=>{P.alpha=1;},260);}
  seq(P,[[nm,.07,dir==='up'?.22:.2],['idle',.18]]);
}
function shotSwipe(dir){
  const S=G.shot;if(!S||S.done||S.locked)return;
  Au.swipe();
  if(S.kind==='counter'||S.fake){
    S.locked=true;dodgePose(dir);
    const b=S.bul[0];if(!b.obj||b.obj.state==='blank')launchBullet(S,b,.14);else b.obj.rate=4;
    b.doomed=true;if(S.fake)S.bul[0].obj.fake=false;return;
  }
  const b=S.bul[S.idx],need=S.dirs[S.idx];
  if(dir===need){
    b.dodged=true;S.idx++;
    if(S.t>S.time*.45)S.fast=false;
    if(b.obj&&S.n===1)b.obj.rate=3;
    dodgePose(dir);
    const bp=b.obj?[b.obj.x0+(b.obj.x1-b.obj.x0)*Math.min(1,b.obj.p),b.obj.y1]:[P.x+40,GROUND-70];
    Au.dodge(G.streak+S.idx);vib(12);
    burst(P.x+16,GROUND+LANE[b.lane],6,['#fff','#9ef'],120,2.5,.25,0);
    if(S.idx>=S.n)finishShot(S,'ok');
  }else{
    S.locked=true;dodgePose(dir);b.doomed=true;
    if(!b.obj)launchBullet(S,b,.14);else b.obj.rate=4;
  }
}
function shotDouble(){
  const S=G.shot;if(!S||S.kind!=='counter'||S.done||S.locked)return;
  const b=S.bul[0];
  if(b.obj){b.obj.state='parried';}
  Au.parry();vib([20,30,20]);
  finishShot(S,'counter');
}
function updBullets(dt){
  for(let i=BUL.length-1;i>=0;i--){const o=BUL[i];
    if(o.state==='parried'){o.p-=dt*5;if(o.p<=-.05){BUL.splice(i,1);}continue;}
    if(o.state==='hit'){o.life=(o.life||0)+dt;if(o.life>.05)BUL.splice(i,1);continue;}
    o.p+=dt/o.fl*o.rate;
    if(o.state==='fly'&&o.p>=1&&!o.pass){/* géré par updShot pour le hit */}
    if(o.p>1.9)BUL.splice(i,1);
  }
}
function bulletPos(o){const p=o.state==='hit'?1:Math.max(0,o.p);const q=Math.pow(Math.min(p,1),1.15)+(p>1?p-1:0);return[o.x0+(o.x1-o.x0)*q,o.y0+(o.y1-o.y0)*Math.min(q,1.4)];}

/* ---------- boucle ---------- */
let last=performance.now();
function frame(now){
  const rdt=Math.min(.05,(now-last)/1000);last=now;
  if(G.slowEnd&&now>G.slowEnd){G.tsT=1;G.slowEnd=0;}
  G.ts+=(G.tsT-G.ts)*Math.min(1,rdt*(G.tsT<G.ts?30:9));
  const dt=G.paused?0:rdt*G.ts;
  if(!G.paused)update(dt,rdt);
  render();
  requestAnimationFrame(frame);
}
function update(dt,rdt){
  G.time+=rdt;
  updTW(dt);
  if(G.shot)updShot(G.shot,dt);
  updBullets(dt);
  updF(P,dt);updF(E,dt);
  updFX(dt);
  if(G.arrowFade>0)G.arrowFade-=rdt;
  if(G.flashA>0)G.flashA=Math.max(0,G.flashA-rdt*2.4);
  if(cam.shake>0)cam.shake=Math.max(0,cam.shake-rdt*60);
  if(G.banner){G.banner.t+=rdt;if(G.banner.t>G.banner.dur)G.banner=null;}
  if(G.hint){G.hint.t+=rdt;if(G.hint.t>G.hint.dur)G.hint=null;}
  if(G.mode==='menu')updMenu(dt,rdt);
  if(typeof updReflex==='function')updReflex(rdt);
  if(G.mode==='play'||G.mode==='train'){
    if(P.tx==null&&!G.cine&&G.mode!=='reflex'){/* position joueur selon progression */}
  }
  const sb=$('#superBtn');
  if(sb){const show=(G.mode==='play'||G.mode==='train')&&G.sup>=100&&!G.cine&&G.fightKind!=='boss'&&G.hudA>.5&&!G.paused;
    if(show!==G.superOK){G.superOK=show;sb.classList.toggle('on',show);if(show)Au.ready();}}
}
function setPlayerProgressX(){
  const f=G.need?Math.min(G.prog,G.need)/G.need:0;
  P.tx=PX0+(PX1-PX0)*f;P.sp=7;
}

/* ---------- menu : animations d'attente par variante ---------- */
const MENU={t:2,ball:null,view:'home'};
function idleAnim(v){
  const A={
    classic:[[['stretch',.5,.6],['idle',.4]],[['guard',.2,.1],['punch',.1,.15],['guard',.15,.05],['palm',.1,.15],['idle',.3]],[['look',.4,.5],['taunt',.3,.6],['idle',.4]]],
    hoops:[[['dribble1',.25,0],['dribble2',.25,0],['dribble1',.25,0],['dribble2',.25,0],['dribble1',.25,0],['dribble2',.25,0],['idle',.3]],[['look',.35,.5],['bounce',.25,.2],['bounce',.25,.2],['idle',.3]]],
    prof:[[['adjust',.35,.8],['idle',.35]],[['look',.4,.4],['point',.3,.7],['idle',.4]]],
    agent:[[['adjust',.3,.6],['look',.3,.5],['idle',.3]],[['look',.3,.6],['scope',.2,.7],['idle',.3]]],
    boxer:[[['guard',.1,.05],['punch',.08,.1],['guard',.08,.03],['hook',.08,.1],['guard',.1,.04],['upper',.1,.2],['bounce',.15,.1],['idle',.3]],[['bounce',.15,.15],['bounce',.15,.15],['bounce',.15,.15],['idle',.2]]]
  };
  return pick(A[v]||A.classic);
}
function updMenu(dt,rdt){
  P.x=W/2;P.y=G.menu.gy;P.scale=G.menu.sc;P.face=1;P.tx=null;
  MENU.t-=dt;
  if(MENU.t<=0&&P.k>=1&&!P.q.length){
    const a=idleAnim(P.v);seq(P,a);MENU.t=rand(3,5.5);
    if(P.v==='hoops'&&a[0][0]==='dribble1'){MENU.ball={t:0};}
  }
  if(MENU.ball){MENU.ball.t+=dt;if(MENU.ball.t>1.6)MENU.ball=null;}
}

/* ---------- rendu ---------- */
function rr(c,x,y,w,h,r){rrect(c,x,y,w,h,r);}
function drawArrow(c,x,y,dir,s,fill,stroke,lw=3){
  c.save();c.translate(x,y);c.rotate({up:-Math.PI/2,right:0,down:Math.PI/2,left:Math.PI}[dir]);
  c.beginPath();c.moveTo(s*.55,0);c.lineTo(s*.02,-s*.52);c.lineTo(s*.02,-s*.22);c.lineTo(-s*.5,-s*.22);c.lineTo(-s*.5,s*.22);c.lineTo(s*.02,s*.22);c.lineTo(s*.02,s*.52);c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.lineJoin='round';c.stroke();}
  c.restore();
}
function heart(c,x,y,s){c.beginPath();c.moveTo(x,y+s*.9);c.bezierCurveTo(x-s*1.4,y-s*.1,x-s*.6,y-s*1.1,x,y-s*.35);c.bezierCurveTo(x+s*.6,y-s*1.1,x+s*1.4,y-s*.1,x,y+s*.9);c.closePath();}
const font=(w,s)=>`${w} ${s}px "Chakra Petch","Arial Narrow",Impact,sans-serif`;

function render(){
  const c=ctx;
  c.setTransform(DPR*SCALE,0,0,DPR*SCALE,0,0);
  c.globalAlpha=1;c.fillStyle='#050507';c.fillRect(0,0,W,H);
  if(bgPat){c.fillStyle=bgPat;c.fillRect(0,0,W,H);}
  if(G.mode==='boot')return;
  const menuLike=G.mode==='menu';
  const inFight=G.mode==='play'||G.mode==='train';
  const reflex=G.mode==='reflex';
  /* caméra */
  c.save();
  if(inFight||reflex){
    const sx=cam.shake?rand(-cam.shake,cam.shake)*.5:0,sy=cam.shake?rand(-cam.shake,cam.shake)*.5:0;
    c.translate(W/2+sx,H/2+sy);c.scale(cam.z,cam.z);c.translate(-cam.fx,-cam.fy);
  }
  /* arène */
  c.save();
  if(menuLike){c.translate(W/2,G.menu.gy);c.scale(G.menu.as,G.menu.as);}
  else c.translate(W/2,GROUND);
  drawArena(c,menuLike?(MENU.arena||'dojo'):G.arena,G.time);
  c.restore();
  if(G.dark>0){c.globalAlpha=G.dark;c.fillStyle=G.darkCol;c.fillRect(-W*2,-H*2,W*5,H*5);c.globalAlpha=1;}
  /* fantômes + props arrière */
  for(const g of FX.gh){c.globalAlpha=g.life/g.max*.5;c.save();drawCyborg(c,{x:g.x,y:g.y,face:g.face,scale:g.scale,v:g.v,pal:g.pal,fem:g.fem,enemy:g.enemy,epal:g.epal,pose:g.pose,noShadow:true,aura:null,flash:.8});c.restore();}
  c.globalAlpha=1;
  for(const p of FX.pr)if(p.z<0)drawProp(c,p);
  /* combattants */
  const drawF=f=>{
    if(f.hidden)return;
    const breath=!G.cine&&f.k>=1;
    const pose=breath?Object.assign({},f.cur,{lean:f.cur.lean+Math.sin(G.time*2.6+(f.enemy?1.7:0))*.018,air:(f.cur.air||0)+Math.sin(G.time*5.2)*.9}):f.cur;
    let jx=0;
    if(f.enemy&&inFight&&Math.sin(G.time*3.1)>.985)jx=rand(-3,3);
    drawCyborg(c,{x:f.x+jx,y:f.y,face:f.face,scale:f.scale,sy:f.sy,v:f.v,pal:f.pal,epal:f.epal,fem:f.fem,enemy:f.enemy,boss:f.boss,pose,gun:f.gun,alpha:f.alpha,flash:f.flash,spin:f.spin,aura:f.aura,noShadow:f.noShadow});
  };
  drawF(E);drawF(P);
  if(menuLike&&MENU.ball)drawBall(c);
  /* balles */
  for(const o of BUL){
    const q=bulletPos(o),x=q[0],y=q[1];
    const dirx=Math.sign(o.x1-o.x0)||-1,rev=o.state==='parried'?-1:1;
    c.save();c.translate(x,y);c.scale(rev*(dirx<0?1:-1),1);
    const g=c.createLinearGradient(0,0,34,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,60,40,0)');
    c.fillStyle=g;c.fillRect(0,-2.2,36,4.4);
    c.shadowColor='#ff3a2a';c.shadowBlur=14;c.fillStyle='#fff';c.beginPath();c.arc(0,0,4,0,7);c.fill();
    c.restore();
  }
  for(const p of FX.pr)if(p.z>=0)drawProp(c,p);
  /* particules, anneaux, traits */
  for(const p of FX.p){const a=clamp(p.life/p.max*1.4,0,1);c.globalAlpha=a;c.fillStyle=p.col;
    if(p.shape==='txt'){c.font=font('bold',p.sz);c.textAlign='center';c.fillText(p.ch,p.x,p.y);}
    else if(p.shape==='circ'){c.beginPath();c.arc(p.x,p.y,p.sz,0,7);c.fill();}
    else{c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz);c.restore();}}
  c.globalAlpha=1;
  for(const r of FX.r){const k=1-r.life/r.max;c.globalAlpha=1-k;c.strokeStyle=r.col;c.lineWidth=r.w*(1-k*.7);c.beginPath();c.arc(r.x,r.y,lerp(r.r0,r.r1,easeOut(k)),0,7);c.stroke();}
  for(const l of FX.l){c.globalAlpha=l.life/l.max;c.strokeStyle=l.col;c.lineWidth=l.w*(l.life/l.max);c.lineCap='round';c.beginPath();c.moveTo(l.x1,l.y1);c.lineTo(l.x2,l.y2);c.stroke();}
  c.globalAlpha=1;
  c.restore();
  /* textes flottants (monde → écran) */
  if(FX.t.length){c.save();
    if(inFight||reflex){c.translate(W/2,H/2);c.scale(cam.z,cam.z);c.translate(-cam.fx,-cam.fy);}
    for(const p of FX.t){const k=p.life/p.max;c.globalAlpha=Math.min(1,k*2);c.font=font('700',p.size*(1+(1-k)*.25));c.textAlign='center';c.lineWidth=4;c.strokeStyle='rgba(0,0,0,.8)';c.strokeText(p.txt,p.x,p.y);c.fillStyle=p.col;c.fillText(p.txt,p.x,p.y);}
    c.restore();c.globalAlpha=1;}
  /* superpositions écran */
  if(G.cine&&G.cine.draw)G.cine.draw(c);
  if(G.vig>0||(inFight&&G.lives===1&&G.mode==='play')){
    const a=Math.max(G.vig,G.lives===1?.18+.08*Math.sin(G.time*5):0);
    const g=c.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.75);g.addColorStop(0,'rgba(255,0,40,0)');g.addColorStop(1,`rgba(255,0,40,${a})`);c.fillStyle=g;c.fillRect(0,0,W,H);}
  if(G.inv>0){c.globalCompositeOperation='difference';c.fillStyle='#fff';c.fillRect(0,0,W,H);c.globalCompositeOperation='source-over';}
  if(G.flashA>0){c.globalAlpha=Math.min(1,G.flashA);c.fillStyle=G.flashCol;c.fillRect(0,0,W,H);c.globalAlpha=1;}
  if(inFight)drawHUD(c);
  if(reflex)drawReflex(c);
  drawOverlayText(c);
}
function drawProp(c,p){c.save();c.translate(p.x,p.y);c.rotate(p.rot);if(p.draw)p.draw(c,p);c.restore();}
function drawBall(c){
  const t=MENU.ball.t,hp=handPos(P);
  const y=hp[1]+Math.abs(Math.sin(t*6.5))*-1*(-70)+0;
  c.save();c.translate(hp[0]+6,hp[1]+Math.min(70,Math.abs(Math.sin(t*6.5))*70));c.rotate(t*8);
  ballShape(c,11);c.restore();
}
function ballShape(c,r){
  c.fillStyle='#e8651a';c.beginPath();c.arc(0,0,r,0,7);c.fill();c.strokeStyle='#1a0a02';c.lineWidth=1.6;c.beginPath();c.arc(0,0,r,0,7);c.stroke();
  c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();c.beginPath();c.arc(-r*1.1,0,r*.9,-.9,.9);c.stroke();c.beginPath();c.arc(r*1.1,0,r*.9,Math.PI-.9,Math.PI+.9);c.stroke();
}

function drawHUD(c){
  const a=G.hudA;if(a<=0.01)return;
  c.save();c.globalAlpha=a;
  const train=G.mode==='train';
  /* cœurs */
  if(!train){for(let i=0;i<3;i++){heart(c,22+i*24,26,9);c.fillStyle=i<G.lives?'#ff2a44':'rgba(255,255,255,.08)';c.fill();c.lineWidth=2;c.strokeStyle=i<G.lives?'#ff9aa8':'rgba(255,255,255,.2)';c.stroke();}}

  /* streak */
  const mult=1+Math.min(G.streak,40)*.05;
  c.textAlign='center';c.font=font('700',15);c.fillStyle=G.streak>0?'#fff':'rgba(255,255,255,.35)';
  c.fillText(G.streak>0?`SÉRIE ${G.streak}  ·  ×${mult.toFixed(2)}`:'SÉRIE 0',W/2,30);
  c.font=font('600',11);c.fillStyle='rgba(255,255,255,.55)';
  c.fillText(train?'ENTRAÎNEMENT':G.lvlLabel,W/2,48);
  /* panneau de tir */
  drawShotPanel(c);
  /* jauge de distance / PV boss */
  const y=176;
  if(G.fightKind==='boss'){
    c.fillStyle='rgba(6,6,10,.72)';rr(c,W/2-84,y-24,168,44,10);c.fill();
    c.font=font('700',12);c.fillStyle='#ff9aa8';c.textAlign='center';c.fillText(G.boss?G.boss.name:'',W/2,y-8);
    for(let i=0;i<3;i++){const x=W/2-60+i*42;c.fillStyle=i<G.hp?'#ff1a2e':'rgba(255,255,255,.1)';rr(c,x,y,36,9,3);c.fill();c.strokeStyle=i<G.hp?'#ffb0b8':'rgba(255,255,255,.2)';c.lineWidth=1.5;c.stroke();}
  }else{
    const n=G.need,w=148,x0=W/2-w/2,gw=w/n;
    c.fillStyle='rgba(6,6,10,.72)';rr(c,x0-12,y-7,w+50,34,10);c.fill();
    for(let i=0;i<n;i++){const on=i<G.prog;c.fillStyle=on?'#fff':'rgba(255,255,255,.12)';rr(c,x0+i*gw+1.5,y,gw-3,7,2);c.fill();}
    const rdy=G.prog>=n;c.save();if(rdy){c.shadowColor='#ff1e3c';c.shadowBlur=14;}c.fillStyle=rdy?'#ff1e3c':'rgba(255,30,60,.25)';
    c.beginPath();c.arc(x0+w+16,y+3.5,6,0,7);c.fill();c.restore();
    c.font=font('600',9);c.fillStyle='rgba(255,255,255,.45)';c.textAlign='center';c.fillText(train?`ESQUIVES ${G.tr.dodges}  ·  TOUCHES ${G.tr.hits}  ·  KO ${G.tr.kills}`:'DISTANCE',W/2,y+19);
  }
  /* super */
  const by=H-58,bw=210,bx=W/2-bw/2;
  c.fillStyle='rgba(255,255,255,.1)';rr(c,bx,by,bw,10,5);c.fill();
  const full=G.sup>=100;c.save();if(full){c.shadowColor='#ff1e3c';c.shadowBlur=14;}
  c.fillStyle=full?'#ff1e3c':'#c4485a';rr(c,bx,by,Math.max(6,bw*Math.min(1,G.sup/100)),10,5);c.fill();c.restore();
  c.font=font('700',10);c.textAlign='center';c.fillStyle='rgba(255,255,255,.6)';
  c.fillText(G.fightKind==='boss'?'SUPER IMPOSSIBLE SUR BOSS':(full?'':'SUPER'),W/2,by-6);
  c.restore();
}
function drawShotPanel(c){
  const S=G.shot||(G.arrowFade>0?G.lastShot:null);
  const cx=W/2,cy=112,h=92;
  const w=S&&S.n>1?196:136,x=cx-w/2,y=cy-h/2;
  c.save();
  let border='rgba(255,255,255,.18)',fillA=.78;
  if(S&&!G.shot){border=S.out==='hit'?'#ff2a44':'#3dff9a';}
  c.fillStyle=`rgba(8,8,12,${fillA})`;rr(c,x,y,w,h,14);c.fill();c.strokeStyle=border;c.lineWidth=2;c.stroke();
  if(!S){c.fillStyle='rgba(255,255,255,.1)';c.font=font('700',11);c.textAlign='center';c.fillText('· · ·',cx,cy+4);c.restore();return;}
  const p=G.shot?clamp(S.t/S.time,0,1):1;
  const ac=p<.5?'#ffffff':(p<.8?'#ffd23a':'#ff3a4a');
  if(S.kind==='counter'){
    const pulse=1+Math.sin(G.time*14)*.06;
    c.save();c.translate(cx,cy-6);c.scale(pulse,pulse);
    c.strokeStyle='#ff1e3c';c.lineWidth=5;c.shadowColor='#ff1e3c';c.shadowBlur=16;c.beginPath();c.arc(0,0,25,0,7);c.stroke();
    c.fillStyle='#fff';c.beginPath();c.arc(0,0,9,0,7);c.fill();c.restore();
    c.font=font('700',10);c.fillStyle='#ff8a98';c.textAlign='center';c.fillText('DOUBLE TAP',cx,y+h-14);
  }else{
    const n=S.n,sh=S.shown;
    for(let i=0;i<n;i++){
      const ax=n>1?cx-44+i*88:cx,ay=cy-8,done=i<S.idx;
      const s=n>1?44:52;
      c.globalAlpha=done?.25:1;
      if(S.fake)drawArrow(c,ax,ay,sh[i],s,null,'rgba(200,200,210,.8)',3);
      else if(S.rev)drawArrow(c,ax,ay,sh[i],s,'#a040ff','#e0b8ff',2);
      else drawArrow(c,ax,ay,sh[i],s,i===S.idx?ac:'#cfd0d6','#000',2);
      c.globalAlpha=1;
    }
    c.font=font('700',9);c.textAlign='center';
    if(S.fake){c.fillStyle='#ff8a98';c.fillText('LEURRE · NE BOUGE PAS',cx,y+h-14);}
    else if(S.rev){c.fillStyle='#d9a8ff';c.fillText('INVERSÉ',cx,y+h-14);}
  }
  c.globalAlpha=1;
  /* barre de temps */
  const bw=w-28,bx=x+14,by=y+h-9;
  c.fillStyle='rgba(255,255,255,.12)';rr(c,bx,by,bw,4,2);c.fill();
  if(G.shot){c.fillStyle=ac;rr(c,bx,by,Math.max(3,bw*(1-p)),4,2);c.fill();}
  c.restore();
}
function drawOverlayText(c){
  if(G.banner){const b=G.banner,k=b.t/b.dur,a=k<.12?k/.12:(k>.8?(1-k)/.2:1),sl=easeOut(Math.min(1,b.t/.25));
    c.save();c.globalAlpha=clamp(a,0,1);c.translate(W/2,H*.3);c.transform(1,0,-.18,1,0,0);
    c.font=font('700',b.text.length>12?30:40);c.textAlign='center';c.lineWidth=7;c.strokeStyle='rgba(0,0,0,.85)';
    c.translate((1-sl)*-120,0);c.strokeText(b.text,0,0);c.fillStyle=b.col;c.fillText(b.text,0,0);
    if(b.sub){c.font=font('600',14);c.lineWidth=4;c.strokeText(b.sub,0,26);c.fillStyle='#ff9aa8';c.fillText(b.sub,0,26);}
    c.restore();}
  if(G.hint&&!G.cine){const h=G.hint,k=h.t/h.dur,a=k<.1?k/.1:(k>.85?(1-k)/.15:1);
    c.save();c.globalAlpha=clamp(a,0,1);c.font=font('700',15);c.textAlign='center';c.lineWidth=5;c.strokeStyle='rgba(0,0,0,.9)';
    const ln=h.text.split('\n');ln.forEach((t,i)=>{c.strokeText(t,W/2,GROUND+96+i*20);c.fillStyle='#fff';c.fillText(t,W/2,GROUND+96+i*20);});c.restore();}
}

/* ---------- mini-jeu réflexe (rendu) ---------- */
const RF={on:false};
function drawReflex(c){
  if(!RF.on)return;
  c.save();c.fillStyle='rgba(5,5,8,.92)';c.fillRect(0,0,W,H);
  const cx=W/2,cy=H*.46;
  c.textAlign='center';c.font=font('700',26);c.fillStyle='#fff';c.fillText('RÉFLEXE !',cx,H*.16);
  c.font=font('600',13);c.fillStyle='#ff9aa8';c.fillText('Touche quand l\'anneau se referme sur la cible',cx,H*.16+24);
  for(let i=0;i<3;i++){const r=RF.res[i];c.fillStyle=r==null?'rgba(255,255,255,.12)':(r===2?'#3dff9a':(r===1?'#ffd23a':'#ff2a44'));c.beginPath();c.arc(cx-30+i*30,H*.16+50,8,0,7);c.fill();}
  c.strokeStyle=RF.active?'#fff':'rgba(255,255,255,.35)';c.lineWidth=5;c.beginPath();c.arc(cx,cy,RF.tr,0,7);c.stroke();
  c.fillStyle='rgba(255,30,60,.25)';c.beginPath();c.arc(cx,cy,RF.tr,0,7);c.fill();
  if(RF.active){const k=clamp(RF.t/RF.dur,0,1.4),r=lerp(RF.r0,RF.tr,k);c.save();c.shadowColor='#ff1e3c';c.shadowBlur=18;c.strokeStyle='#ff1e3c';c.lineWidth=7;c.beginPath();c.arc(cx,cy,Math.max(4,r),0,7);c.stroke();c.restore();}
  if(RF.msg){c.font=font('700',34);c.fillStyle=RF.msgCol;c.lineWidth=6;c.strokeStyle='#000';c.strokeText(RF.msg,cx,cy+RF.tr+60);c.fillText(RF.msg,cx,cy+RF.tr+60);}
  c.restore();
}
