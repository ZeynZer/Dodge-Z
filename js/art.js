'use strict';
/* ================= DODGE ZERO — art : personnages, poses, arènes ================= */

/* ---------- couleurs ---------- */
const _hx={};
function rgb(h){if(_hx[h])return _hx[h];let s=h.slice(1);if(s.length===3)s=s.split('').map(x=>x+x).join('');const n=parseInt(s,16);return _hx[h]=[n>>16&255,n>>8&255,n&255];}
function mix(a,b,k){const A=rgb(a),B=rgb(b);return`rgb(${(A[0]+(B[0]-A[0])*k)|0},${(A[1]+(B[1]-A[1])*k)|0},${(A[2]+(B[2]-A[2])*k)|0})`;}
function hexMix(a,b,k){const A=rgb(a),B=rgb(b);const h=i=>('0'+((A[i]+(B[i]-A[i])*k)|0).toString(16)).slice(-2);return'#'+h(0)+h(1)+h(2);}

/* ---------- données : variantes, skins ---------- */
const RAR=['COMMUN','RARE','ÉPIQUE','LÉGENDAIRE'];
const RCOL=['#9aa0aa','#3aa0ff','#b45cff','#ffb020'];
const VARIANTS=[
  {id:'classic',name:'ZÉRO',title:'Le Cyborg Classique',sup:'ÉCLAIR ZÉRO',rar:0,desc:'Pas méchant pour un sou, mais toujours dans les ennuis. Un monstre de l\'esquive.'},
  {id:'hoops',name:'DUNK',title:'Le Basketteur',sup:'SLAM DUNK',rar:1,desc:'Dribble, saute, écrase. Son super atterrit du ciel.'},
  {id:'prof',name:'PROF. VOLT',title:'Le Professeur',sup:'THÉORÈME FINAL',rar:1,desc:'Il calcule la trajectoire de chaque balle. Et de chaque adversaire.'},
  {id:'agent',name:'AGENT 00',title:'L\'Agent Secret',sup:'TIR FANTÔME',rar:2,desc:'Costume noir, sang-froid, une seule balle.'},
  {id:'boxer',name:'KO-RUSH',title:'Le Boxeur',sup:'COMBO KO',rar:2,desc:'Il n\'esquive pas, il danse. Puis il frappe huit fois.'}
];
const VID=VARIANTS.map(v=>v.id);
const vOf=id=>VARIANTS.find(v=>v.id===id);
const PALS=[
  {n:'Carbone',main:'#2b2e35',sec:'#ff2a44',metal:'#a8b0ba',glow:'#35e0ff',hair:'#c9ccd2',r:0},
  {n:'Ivoire',main:'#e6e4dc',sec:'#1d1f24',metal:'#9aa0a8',glow:'#4dffb0',hair:'#2a2a2e',r:0},
  {n:'Rouille',main:'#8a3b1e',sec:'#f2a23a',metal:'#8d8379',glow:'#ffd24a',hair:'#f2a23a',r:0},
  {n:'Néon Cyan',main:'#0c3d4a',sec:'#37f0ff',metal:'#7fa9b5',glow:'#37f0ff',hair:'#37f0ff',r:1},
  {n:'Toxique',main:'#3a1d6b',sec:'#b36bff',metal:'#9a8fb8',glow:'#e08aff',hair:'#b36bff',r:1},
  {n:'Vert Acide',main:'#1d4a1f',sec:'#9bff3a',metal:'#8aa88a',glow:'#caff5a',hair:'#9bff3a',r:1},
  {n:'Sang Royal',main:'#5a0c18',sec:'#ff3b55',metal:'#b9959a',glow:'#ffa04d',hair:'#ff3b55',r:2},
  {n:'Acier Bleu',main:'#1f3552',sec:'#7fc4ff',metal:'#b4c3d4',glow:'#9fe8ff',hair:'#7fc4ff',r:2},
  {n:'Rose Néon',main:'#4a1038',sec:'#ff5fd2',metal:'#c9a3c0',glow:'#ff8ae6',hair:'#ff5fd2',r:2},
  {n:'Or Chromé',main:'#c79a2b',sec:'#16130b',metal:'#fff0b0',glow:'#fff2a0',hair:'#fff0b0',r:3}
];
const skinPal=i=>PALS[i>>1];
const skinFem=i=>!!(i&1);
const skinName=i=>PALS[i>>1].n+(i&1?' ♀':'');
const skinRar=i=>PALS[i>>1].r;
const EPAL={main:'#2c2e34',sec:'#c9ccd3',metal:'#70747d',glow:'#ff1a2e',hair:'#999'};

/* ---------- squelette & poses ---------- */
const LEN={th:28,sh:28,to:40,hd:19,ua:22,la:20};
function skeleton(P){
  const f=(p,a,l)=>[p[0]+Math.sin(a)*l,p[1]+Math.cos(a)*l];
  const O=[0,0];
  const kf=f(O,P.lf[0],LEN.th),ff=f(kf,P.lf[1],LEN.sh);
  const kb=f(O,P.lb[0],LEN.th),fb=f(kb,P.lb[1],LEN.sh);
  const low=Math.max(ff[1],fb[1]);
  const hip=[0,-low-(P.air||0)];
  const sh=p=>[p[0]+hip[0],p[1]+hip[1]];
  const neck=[hip[0]+Math.sin(P.lean)*LEN.to,hip[1]-Math.cos(P.lean)*LEN.to];
  const ha=P.lean+P.head;
  const head=[neck[0]+Math.sin(ha)*LEN.hd,neck[1]-Math.cos(ha)*LEN.hd];
  const shoulder=[lerp(hip[0],neck[0],.93),lerp(hip[1],neck[1],.93)];
  const ef=f(shoulder,P.af[0],LEN.ua),hf=f(ef,P.af[1],LEN.la);
  const eb=f(shoulder,P.ab[0],LEN.ua),hb=f(eb,P.ab[1],LEN.la);
  return{hip,neck,head,ha,shoulder,kf:sh(kf),ff:sh(ff),kb:sh(kb),fb:sh(fb),ef,hf,eb,hb};
}
const BASE={lean:.12,head:0,af:[.9,2.1],ab:[.3,1.7],lf:[.5,-.1],lb:[-.5,-.2],air:0,dx:0,dy:0,rot:0};
const mk=o=>Object.assign({},BASE,o);
const PO={
  idle:mk({}),
  guard:mk({lean:.2,af:[1.1,2.4],ab:[.7,2.0],lf:[.6,-.1],lb:[-.6,-.1]}),
  bounce:mk({lean:.18,af:[1.0,2.3],ab:[.5,1.9],lf:[.62,-.2],lb:[-.55,-.2],air:5}),
  crouch:mk({lean:.45,af:[.5,1.5],ab:[.2,1.2],lf:[1.1,-.1],lb:[-1.1,.1]}),
  eIdle:mk({lean:.05,af:[1.0,1.3],ab:[.2,.3],lf:[.35,-.05],lb:[-.35,-.05]}),
  eAim:mk({lean:.12,af:[1.57,1.57],ab:[.8,2.0],lf:[.45,-.1],lb:[-.5,-.1]}),
  eRecoil:mk({lean:-.02,af:[1.28,1.35],ab:[.8,2.0],lf:[.45,-.1],lb:[-.5,-.1],dx:5}),
  dUp:mk({lean:.1,air:64,af:[1.5,1.0],ab:[-.9,-1.4],lf:[1.35,-.3],lb:[.5,-1.2]}),
  dDown:mk({lean:.65,head:.15,af:[1.2,2.0],ab:[.5,1.3],lf:[1.35,0],lb:[-1.3,.2]}),
  dLeft:mk({lean:-.8,head:-.25,af:[1.7,1.4],ab:[-.5,-1.0],lf:[.15,-.25],lb:[-.95,-.15],dx:-16}),
  dRight:mk({lean:.8,head:.1,af:[2.0,2.4],ab:[-1.2,-1.6],lf:[1.0,.2],lb:[-1.1,-.9],dx:12}),
  hit:mk({lean:-.55,head:-.5,af:[-.3,.3],ab:[.7,1.2],lf:[.2,-.3],lb:[-.7,-.4],dx:-14}),
  ko:mk({lean:0,head:-.3,af:[-.7,-.4],ab:[1.0,.6],lf:[.3,0],lb:[-.3,.2],rot:-1.52,dy:-9,dx:-18}),
  stun:mk({lean:-.1,head:.35,af:[.2,.5],ab:[.1,.4],lf:[.3,0],lb:[-.3,0],air:0}),
  windup:mk({lean:-.25,af:[-.6,.2],ab:[.9,1.9],lf:[.8,-.1],lb:[-.9,-.3]}),
  punch:mk({lean:.55,af:[1.57,1.57],ab:[.3,1.5],lf:[1.0,.2],lb:[-.9,-.3]}),
  palm:mk({lean:.45,af:[1.6,1.3],ab:[.2,1.6],lf:[.9,.1],lb:[-.8,-.3]}),
  hook:mk({lean:.5,af:[1.8,2.4],ab:[.4,1.7],lf:[.9,.1],lb:[-.8,-.3]}),
  upper:mk({lean:.3,af:[2.7,2.9],ab:[.4,1.7],lf:[.8,0],lb:[-.7,-.2]}),
  throwP:mk({lean:.4,af:[2.2,1.9],ab:[.5,1.6],lf:[.9,.1],lb:[-.8,-.3]}),
  shoot:mk({lean:.1,af:[1.57,1.57],ab:[1.2,2.1],lf:[.55,-.1],lb:[-.55,-.1]}),
  victory:mk({lean:-.08,head:-.12,af:[2.9,3.1],ab:[.4,1.4],lf:[.4,0],lb:[-.4,-.1]}),
  taunt:mk({lean:.1,af:[1.5,.8],ab:[.2,1.2],lf:[.5,-.1],lb:[-.5,-.1]}),
  stretch:mk({lean:-.05,af:[2.8,3.0],ab:[2.6,2.9],lf:[.3,0],lb:[-.3,0]}),
  look:mk({head:-.35,lean:.05}),
  adjust:mk({lean:.08,head:.1,af:[2.5,3.0],ab:[.3,1.7]}),
  charge:mk({lean:.3,head:.2,af:[.3,.9],ab:[.1,.8],lf:[.9,.1],lb:[-.9,-.1]}),
  dribble1:mk({lean:.35,af:[.9,1.0],ab:[.4,.6],lf:[.9,0],lb:[-.8,-.1]}),
  dribble2:mk({lean:.3,af:[.5,.4],ab:[.3,.5],lf:[.8,0],lb:[-.7,-.1]}),
  dunkUp:mk({lean:-.1,air:0,af:[2.9,3.1],ab:[2.6,2.9],lf:[.9,-.9],lb:[.3,-1.1]}),
  dunkDown:mk({lean:.4,af:[3.0,3.0],ab:[2.9,3.0],lf:[.4,0],lb:[-.4,0]}),
  point:mk({lean:.1,af:[2.2,2.0],ab:[.3,1.5],lf:[.5,-.1],lb:[-.5,-.1]}),
  scope:mk({lean:.2,af:[1.57,1.57],ab:[1.4,1.5],lf:[.5,-.1],lb:[-.5,-.1]})
};
function clonePose(p){return Object.assign({},p,{af:p.af.slice(),ab:p.ab.slice(),lf:p.lf.slice(),lb:p.lb.slice()});}
function mixPose(a,b,k){const o={};for(const key in a){const x=a[key],y=b[key];o[key]=Array.isArray(x)?x.map((v,i)=>lerp(v,y[i],k)):lerp(x,y,k);}return o;}

/* ---------- dessin d'un cyborg ---------- */
function seg(c,a,b,w,col,edge){
  c.lineCap='round';c.strokeStyle=edge;c.lineWidth=w+3;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();
  c.strokeStyle=col;c.lineWidth=w;c.stroke();
}
function dot(c,p,r,col,edge){c.fillStyle=edge;c.beginPath();c.arc(p[0],p[1],r+1.5,0,7);c.fill();c.fillStyle=col;c.beginPath();c.arc(p[0],p[1],r,0,7);c.fill();}
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

function drawCyborg(c,o){
  const P=o.pose,k=skeleton(P),en=!!o.enemy,fem=!!o.fem,v=o.v;
  const pal=en?o.epal:o.pal;
  const fl=o.flash||0;
  const C=h=>fl>0?mix(h,'#ffffff',fl):h;
  const EDGE=C('#09090c');
  const main=pal.main,sec=pal.sec,metal=pal.metal,glow=pal.glow;
  const dk=h=>hexMix(h,'#000000',.4);
  const sc=o.scale||1;
  if(!o.noShadow){
    c.save();c.globalAlpha=.35*(o.alpha==null?1:o.alpha)*clamp(1-(P.air||0)/160,.2,1);c.fillStyle='#000';
    c.beginPath();c.ellipse(o.x,o.y+2,34*sc*(1+Math.abs(P.rot)*.5),6*sc,0,0,7);c.fill();c.restore();
  }
  c.save();
  c.translate(o.x+(P.dx||0)*o.face*sc,o.y+(P.dy||0)*sc);
  c.scale(o.face*sc,sc*(o.sy||1));
  if(P.rot)c.rotate(P.rot);
  if(o.spin)c.rotate(o.spin);
  if(o.alpha!=null)c.globalAlpha=o.alpha;
  if(o.aura){const g=c.createRadialGradient(0,-60,5,0,-60,90);g.addColorStop(0,o.aura+'aa');g.addColorStop(1,o.aura+'00');c.fillStyle=g;c.fillRect(-100,-160,200,200);}

  /* couleurs par costume */
  let armCol=main,legCol=main,torsoCol=main,shortCol=null,handR=5,handCol=metal,footCol=hexMix(metal,'#000',.45);
  switch(v){
    case'hoops':armCol=metal;legCol=metal;shortCol=main;footCol=sec;break;
    case'prof':{const coat=hexMix(main,'#ffffff',en?.55:.8);armCol=coat;torsoCol=coat;legCol=hexMix(main,'#000',.3);footCol='#15151a';break;}
    case'agent':{const su=en?'#26272c':'#15161b';armCol=su;torsoCol=su;legCol=su;footCol='#08080a';break;}
    case'boxer':armCol=metal;torsoCol=metal;legCol=metal;shortCol=main;handR=9;handCol=sec;footCol=sec;break;
  }
  const legW=v==='hoops'||v==='boxer'?9:11;

  /* bras arrière */
  seg(c,k.shoulder,k.eb,7,C(dk(armCol)),EDGE);seg(c,k.eb,k.hb,6,C(dk(armCol)),EDGE);
  dot(c,k.hb,handR-1,C(dk(handCol)),EDGE);
  /* jambe arrière */
  const leg=(kn,ft,dark)=>{
    const cl=dark?dk(legCol):legCol;
    seg(c,k.hip,kn,legW,C(cl),EDGE);seg(c,kn,ft,legW-1,C(cl),EDGE);
    if(shortCol){seg(c,k.hip,[lerp(k.hip[0],kn[0],.78),lerp(k.hip[1],kn[1],.78)],legW+6,C(dark?dk(shortCol):shortCol),EDGE);}
    dot(c,kn,4,C(dark?dk(metal):metal),EDGE);
    c.fillStyle=EDGE;rrect(c,ft[0]-5,ft[1]-7,19,10,3);c.fill();
    c.fillStyle=C(dark?dk(footCol):footCol);rrect(c,ft[0]-4,ft[1]-6,17,8,3);c.fill();
  };
  leg(k.kb,k.fb,true);
  /* queue de blouse du prof */
  if(v==='prof'){c.fillStyle=C(dk(torsoCol));c.strokeStyle=EDGE;c.lineWidth=2;c.beginPath();
    c.moveTo(k.hip[0]-9,k.hip[1]-4);c.lineTo(k.hip[0]-12+(P.lb[0])*8,k.hip[1]+38);c.lineTo(k.hip[0]+12+(P.lf[0])*8,k.hip[1]+40);c.lineTo(k.hip[0]+9,k.hip[1]-4);c.closePath();c.fill();c.stroke();}

  /* torse */
  const dx=k.neck[0]-k.hip[0],dy=k.neck[1]-k.hip[1],L=Math.hypot(dx,dy),u=[dx/L,dy/L],n=[-u[1],u[0]];
  const pt=(t,off)=>[k.hip[0]+dx*t+n[0]*off,k.hip[1]+dy*t+n[1]*off];
  const tp=new Path2D();
  const W1=fem?[[0,-9],[0,10],[.35,6.5],[.72,10],[1,6],[1,-6],[.72,-8],[.35,-6.5]]:[[0,-9],[0,9],[.35,8],[.72,12],[1,7],[1,-8],[.72,-10],[.35,-8]];
  W1.forEach((q,i)=>{const p=pt(q[0],q[1]);i?tp.lineTo(p[0],p[1]):tp.moveTo(p[0],p[1]);});tp.closePath();
  c.lineJoin='round';c.fillStyle=C(torsoCol);c.fill(tp);
  c.save();c.clip(tp);
  if(v==='classic'){c.strokeStyle=C(sec);c.lineWidth=4;c.beginPath();const a=pt(.1,-12),b=pt(.9,12);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
  if(v==='hoops'){c.fillStyle=C(sec);const a=pt(.0,-14),b=pt(.0,14),a2=pt(.16,-14),b2=pt(.16,14);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(b2[0],b2[1]);c.lineTo(a2[0],a2[1]);c.fill();
    c.fillStyle=C(sec);c.strokeStyle='';const q=pt(.5,0);c.save();c.translate(q[0],q[1]);c.rotate(Math.atan2(u[0],-u[1]));c.scale(o.face,1);c.font='bold 13px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('0',1,0);c.restore();}
  if(v==='prof'){c.fillStyle=C(dk(main));const a=pt(1,0),b=pt(.45,2),d=pt(.9,7);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.fill();}
  if(v==='agent'){c.fillStyle=C('#e9e9ee');c.beginPath();let a=pt(1,-2),b=pt(.55,5),d=pt(1,8);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.fill();
    c.fillStyle=C(sec);a=pt(.98,3);b=pt(.62,4);d=pt(.82,5.5);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.fill();}
  if(v==='boxer'){c.strokeStyle=C(dk(metal));c.lineWidth=1.5;for(let i=0;i<3;i++){const a=pt(.45+i*.14,-1),b=pt(.45+i*.14,10);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
    c.fillStyle=C('#f1f1f1');const a=pt(0,-10),b=pt(0,10),a2=pt(.1,-10),b2=pt(.1,10);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(b2[0],b2[1]);c.lineTo(a2[0],a2[1]);c.fill();}
  if(en){c.strokeStyle='rgba(255,26,46,.85)';c.lineWidth=1.4;c.beginPath();let a=pt(.2,-8),b=pt(.4,2),d=pt(.6,-3),e=pt(.85,6);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.lineTo(e[0],e[1]);c.stroke();}
  c.restore();
  c.lineWidth=2.4;c.strokeStyle=EDGE;c.stroke(tp);
  /* noyau */
  {const q=pt(.64,fem?2:3);c.save();c.shadowColor=glow;c.shadowBlur=en?12:9;c.fillStyle=C(glow);c.beginPath();c.arc(q[0],q[1],en?3.2:3.6,0,7);c.fill();c.restore();}
  /* nœud papillon / cravate / ceinture */
  if(v==='prof'){const q=pt(1.0,5);c.fillStyle=C(sec);c.beginPath();c.moveTo(q[0],q[1]);c.lineTo(q[0]+6,q[1]-4);c.lineTo(q[0]+6,q[1]+4);c.closePath();c.fill();c.beginPath();c.moveTo(q[0],q[1]);c.lineTo(q[0]-6,q[1]-4);c.lineTo(q[0]-6,q[1]+4);c.closePath();c.fill();}
  /* épaulette classique */
  if(v==='classic'){c.fillStyle=C(sec);c.beginPath();c.arc(k.shoulder[0],k.shoulder[1],6,0,7);c.fill();c.strokeStyle=EDGE;c.lineWidth=2;c.stroke();}

  /* jambe avant */
  leg(k.kf,k.ff,false);

  /* tête */
  c.save();c.translate(k.head[0],k.head[1]);c.rotate(k.ha);
  if(fem){c.strokeStyle=EDGE;c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(-9,-6);c.quadraticCurveTo(-26,-6,-23,12);c.stroke();c.strokeStyle=C(pal.hair);c.lineWidth=5;c.stroke();}
  c.fillStyle=EDGE;c.beginPath();c.ellipse(0,0,14.5,15.5,0,0,7);c.fill();
  c.fillStyle=C(hexMix(metal,'#000',.18));c.beginPath();c.ellipse(0,0,13,14,0,0,7);c.fill();
  c.fillStyle=C(hexMix(metal,'#fff',.25));c.beginPath();c.ellipse(-3,-7,7,3,-.3,0,7);c.fill();
  c.fillStyle=C('#0a0b0f');rrect(c,-1,-6,14,13,4);c.fill();
  if(en){
    c.save();c.shadowColor=glow;c.shadowBlur=14;c.fillStyle=C(glow);
    c.beginPath();c.ellipse(7,-1.5,5.2,3,0,0,7);c.fill();c.beginPath();c.arc(11.5,2.4,1.7,0,7);c.fill();c.restore();
    c.strokeStyle='rgba(255,40,60,.9)';c.lineWidth=1.2;c.beginPath();c.moveTo(-6,-9);c.lineTo(-2,-3);c.lineTo(-6,2);c.stroke();
  }else{
    c.save();c.shadowColor=glow;c.shadowBlur=10;c.fillStyle=C(glow);rrect(c,3,-3.5,9,5,2.5);c.fill();c.restore();
  }
  if(v==='classic'){c.strokeStyle=EDGE;c.lineWidth=3;c.beginPath();c.moveTo(-5,-13);c.lineTo(-7,-22);c.stroke();c.fillStyle=C(en?glow:sec);c.beginPath();c.arc(-7,-23,2.6,0,7);c.fill();}
  if(v==='hoops'){c.strokeStyle=C(sec);c.lineWidth=4.5;c.beginPath();c.arc(0,0,13.2,-2.9,-.2);c.stroke();c.strokeStyle=EDGE;c.lineWidth=1;c.beginPath();c.arc(0,0,15.4,-2.9,-.2);c.stroke();}
  if(v==='prof'){c.strokeStyle=C('#f4f4f8');c.lineWidth=1.8;c.beginPath();c.arc(7,-1,6.2,0,7);c.stroke();c.fillStyle=C('#f4f4f8');for(let i=0;i<3;i++){c.beginPath();c.moveTo(-9+i*5,-12);c.lineTo(-8+i*5,-21-i%2*3);c.lineTo(-4+i*5,-13);c.fill();}}
  if(v==='agent'){c.fillStyle='#000';rrect(c,1,-5.5,12.5,7.5,2.5);c.fill();c.fillStyle='rgba(255,255,255,.7)';c.fillRect(3,-4,3,1.4);if(en){c.save();c.shadowColor=glow;c.shadowBlur=8;c.fillStyle=glow;c.fillRect(7,-2,5,1.6);c.restore();}
    c.strokeStyle=C(sec);c.lineWidth=1.6;c.beginPath();c.arc(-4,3,5,.5,3.4);c.stroke();}
  if(v==='boxer'){c.fillStyle=C(sec);c.fillRect(-14,-8,28,4.5);c.beginPath();c.moveTo(-13,-6);c.lineTo(-23,-2);c.lineTo(-20,-9);c.closePath();c.fill();}
  if(o.boss){
    const b=o.boss;c.fillStyle=C('#ff1a2e');
    if(b==='omega'||b==='kronos'||b==='gemini'||b==='revers'||b==='mirage'){for(let i=0;i<5;i++){c.beginPath();c.moveTo(-12+i*6,-13);c.lineTo(-10+i*6,-25-(i%2)*6);c.lineTo(-6+i*6,-13);c.fill();}}
    if(b==='gemini'){c.save();c.shadowColor=glow;c.shadowBlur=12;c.fillStyle=glow;c.beginPath();c.ellipse(-7,-1.5,4,2.5,0,0,7);c.fill();c.restore();}
  }
  c.restore();

  /* bras avant */
  seg(c,k.shoulder,k.ef,8,C(armCol),EDGE);seg(c,k.ef,k.hf,7,C(armCol),EDGE);
  if(v==='hoops'||v==='boxer'){c.save();c.translate(k.hf[0],k.hf[1]);c.fillStyle=C(sec);c.beginPath();c.arc(0,0,v==='boxer'?9.5:6.3,0,7);c.fill();c.strokeStyle=EDGE;c.lineWidth=2;c.stroke();c.restore();}
  else dot(c,k.hf,5,C(metal),EDGE);
  if(v==='boxer'){dot(c,k.hb,9.5,C(dk(sec)),EDGE);}
  /* arme */
  if(o.gun){
    const ang=P.af[1],gx=Math.sin(ang),gy=Math.cos(ang);
    const bx=k.hf[0]+gx*17,by=k.hf[1]+gy*17;
    c.strokeStyle=EDGE;c.lineWidth=9;c.lineCap='round';c.beginPath();c.moveTo(k.hf[0],k.hf[1]);c.lineTo(bx,by);c.stroke();
    c.strokeStyle=C('#3a3c44');c.lineWidth=6;c.beginPath();c.moveTo(k.hf[0],k.hf[1]);c.lineTo(bx,by);c.stroke();
    c.strokeStyle=C('#8a8d96');c.lineWidth=1.6;c.beginPath();c.moveTo(k.hf[0]+gx*3,k.hf[1]+gy*3-2);c.lineTo(bx,by-2);c.stroke();
    c.strokeStyle=EDGE;c.lineWidth=6;c.beginPath();c.moveTo(k.hf[0]-gx*1,k.hf[1]-gy*1);c.lineTo(k.hf[0]-gy*4,k.hf[1]+gx*4+3);c.stroke();
  }
  c.restore();
}
/* position du bout du canon, en coordonnées monde */
function gunTip(f){
  const k=skeleton(f.cur),a=f.cur.af[1],sc=f.scale||1;
  const lx=k.hf[0]+Math.sin(a)*22,ly=k.hf[1]+Math.cos(a)*22;
  return[f.x+((f.cur.dx||0)+lx)*f.face*sc,f.y+((f.cur.dy||0)+ly)*sc];
}
function handPos(f){
  const k=skeleton(f.cur),sc=f.scale||1;
  return[f.x+((f.cur.dx||0)+k.hf[0])*f.face*sc,f.y+((f.cur.dy||0)+k.hf[1])*sc];
}
function headPos(f){
  const k=skeleton(f.cur),sc=f.scale||1;
  return[f.x+((f.cur.dx||0)+k.head[0])*f.face*sc,f.y+((f.cur.dy||0)+k.head[1])*sc];
}
function bodyPos(f,t=.5){
  const k=skeleton(f.cur),sc=f.scale||1;
  return[f.x+((f.cur.dx||0)+lerp(k.hip[0],k.neck[0],t))*f.face*sc,f.y+((f.cur.dy||0)+lerp(k.hip[1],k.neck[1],t))*sc];
}

/* ---------- vignette de personnage ---------- */
function drawThumb(cv,vid,skin,locked){
  const d=Math.min(devicePixelRatio||1,2),w=cv.clientWidth||90,h=cv.clientHeight||112;
  cv.width=w*d;cv.height=h*d;const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const g=c.createRadialGradient(w/2,h*.55,4,w/2,h*.55,h*.7);g.addColorStop(0,'#b9b9c0');g.addColorStop(1,'#1c1c22');c.fillStyle=g;c.fillRect(0,0,w,h);
  const sc=h/175;
  drawCyborg(c,{x:w/2,y:h-8,face:1,scale:sc,v:vid,pal:skinPal(skin),fem:skinFem(skin),pose:PO.idle,noShadow:false,
    alpha:locked?.9:1,flash:0});
  if(locked){c.fillStyle='rgba(5,5,8,.78)';c.fillRect(0,0,w,h);}
}

/* ---------- arènes (coordonnées locales : sol en y=0, centre x=0) ---------- */
const ARENAS=['void','hoops','lab','spy','ring'];
const BR=178;
function drawArena(c,type,t){
  const inv=type==='b_revers',omega=type==='b_omega';
  const ink=inv?'#f2f2f6':'#101014',ink2=inv?'rgba(255,255,255,.35)':'rgba(0,0,0,.35)';
  const g=c.createRadialGradient(0,-120,6,0,-100,BR);
  if(inv){g.addColorStop(0,'#15151b');g.addColorStop(.7,'#6c6c76');g.addColorStop(1,'#e4e4ea');}
  else if(omega){g.addColorStop(0,'#2a0a10');g.addColorStop(.7,'#0f0508');g.addColorStop(1,'#000');}
  else{g.addColorStop(0,'#e8e8ec');g.addColorStop(.62,'#a4a4ac');g.addColorStop(1,'#2a2a30');}
  c.save();c.beginPath();c.arc(0,-100,BR,0,7);c.clip();
  c.fillStyle=g;c.fillRect(-BR,-100-BR,BR*2,BR*2);
  c.lineJoin='round';
  switch(type){
    case'hoops':{
      c.strokeStyle=ink;c.lineWidth=5;c.beginPath();c.moveTo(138,0);c.lineTo(138,-150);c.stroke();
      c.fillStyle='rgba(255,255,255,.85)';c.strokeStyle=ink;c.lineWidth=3;c.fillRect(112,-208,34,62);c.strokeRect(112,-208,34,62);c.strokeRect(122,-176,14,12);
      c.strokeStyle='#e01830';c.lineWidth=3.5;c.beginPath();c.ellipse(104,-146,15,4,0,0,7);c.stroke();
      c.strokeStyle=ink2;c.lineWidth=1;for(let i=0;i<5;i++){c.beginPath();c.moveTo(91+i*7,-146);c.lineTo(96+i*4,-122);c.stroke();}
      c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=2;c.beginPath();c.ellipse(-30,14,110,16,0,0,7);c.stroke();c.beginPath();c.moveTo(-30,-2);c.lineTo(-30,30);c.stroke();
      c.fillStyle=ink2;for(let i=-4;i<5;i++){c.beginPath();c.arc(i*34,-185+Math.abs(i)*4,9,0,7);c.fill();}
      break;}
    case'lab':{
      c.fillStyle='#0f0f13';c.fillRect(-150,-222,196,96);c.strokeStyle='#555';c.lineWidth=4;c.strokeRect(-150,-222,196,96);
      c.fillStyle='rgba(255,255,255,.88)';c.font='italic 21px Georgia,serif';c.fillText('E = mc²',-138,-190);c.font='italic 14px Georgia,serif';c.fillText('Σ 1/n² = π²/6',-138,-165);c.fillText('∫ f(x)dx → ∞',-138,-144);
      c.strokeStyle=ink;c.lineWidth=4;c.beginPath();c.moveTo(70,-112);c.lineTo(170,-112);c.moveTo(70,-160);c.lineTo(170,-160);c.stroke();
      c.fillStyle=ink2;[[88,-112],[116,-112],[146,-112],[96,-160],[132,-160]].forEach(([x,y],i)=>{c.beginPath();if(i%2){c.moveTo(x-8,y);c.lineTo(x+8,y);c.lineTo(x,y-22);c.closePath();}else{c.arc(x,y-9,9,0,7);}c.fill();});
      break;}
    case'spy':{
      c.fillStyle=ink2;for(let i=-8;i<9;i++){c.beginPath();c.moveTo(i*26,-290);c.lineTo(i*26+14,-290);c.lineTo(i*26-60,0);c.lineTo(i*26-74,0);c.fill();}
      c.fillStyle='#17171b';c.fillRect(-48,-188,86,188);c.strokeStyle='#000';c.lineWidth=3;c.strokeRect(-48,-188,86,188);
      c.fillStyle='#c9c9d0';c.beginPath();c.arc(28,-92,4,0,7);c.fill();
      c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.arc(120,-196,9,0,7);c.fill();c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.moveTo(120,-290);c.lineTo(120,-205);c.stroke();
      break;}
    case'ring':{
      c.fillStyle=ink2;for(let r=0;r<2;r++)for(let i=-8;i<9;i++){c.beginPath();c.arc(i*24+(r?12:0),-182-r*16,10,0,7);c.fill();c.fillRect(i*24+(r?12:0)-9,-182-r*16,18,22);}
      c.fillStyle=ink;c.fillRect(-166,-176,9,176);c.fillRect(157,-176,9,176);
      [[-60,'#e01830'],[-100,'#f4f4f4'],[-140,'#f4f4f4']].forEach(([y,col])=>{c.strokeStyle='#000';c.lineWidth=7;c.beginPath();c.moveTo(-166,y);c.lineTo(166,y);c.stroke();c.strokeStyle=col;c.lineWidth=4;c.stroke();});
      break;}
    case'dojo':{
      c.fillStyle='rgba(224,24,48,.9)';c.beginPath();c.arc(0,-150,66,0,7);c.fill();
      c.fillStyle=ink;c.fillRect(-150,-250,30,150);c.fillRect(120,-250,30,150);c.fillStyle='#e01830';c.fillRect(-142,-230,14,60);c.fillRect(128,-230,14,60);
      c.strokeStyle=ink2;c.lineWidth=1.5;for(let i=-6;i<=6;i++){c.beginPath();c.moveTo(i*30,0);c.lineTo(i*30,90);c.stroke();}
            break;}
    case'b_kronos':{
      c.strokeStyle=ink;c.lineWidth=7;c.beginPath();c.arc(0,-135,112,0,7);c.stroke();
      c.lineWidth=3;for(let i=0;i<12;i++){const a=i/12*6.283;c.beginPath();c.moveTo(Math.sin(a)*96,-135-Math.cos(a)*96);c.lineTo(Math.sin(a)*108,-135-Math.cos(a)*108);c.stroke();}
      c.strokeStyle='#e01830';c.lineWidth=6;c.lineCap='round';const a1=t*.6,a2=t*.05;c.beginPath();c.moveTo(0,-135);c.lineTo(Math.sin(a1)*92,-135-Math.cos(a1)*92);c.stroke();c.lineWidth=8;c.beginPath();c.moveTo(0,-135);c.lineTo(Math.sin(a2)*60,-135-Math.cos(a2)*60);c.stroke();
      break;}
    case'b_mirage':{
      for(let i=-3;i<4;i++){c.fillStyle='rgba(255,255,255,.45)';c.fillRect(i*52-24,-230,48,230);c.strokeStyle=ink;c.lineWidth=3;c.strokeRect(i*52-24,-230,48,230);
        c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=5;c.beginPath();const o2=(t*30+i*20)%120;c.moveTo(i*52-24,-230+o2);c.lineTo(i*52+24,-230+o2-60);c.stroke();}
      break;}
    case'b_gemini':{
      c.fillStyle='rgba(0,0,0,.55)';c.fillRect(0,-290,BR,300);
      c.fillStyle='rgba(255,255,255,.5)';c.fillRect(-BR,-290,BR,300);
      c.fillStyle=ink;c.fillRect(-130,-230,22,230);c.fillRect(108,-230,22,230);
      c.fillStyle='#e01830';c.beginPath();c.arc(-119,-246,10,0,7);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(119,-246,10,0,7);c.fill();
      c.strokeStyle='#e01830';c.lineWidth=2;c.beginPath();c.moveTo(0,-290);c.lineTo(0,0);c.stroke();
      break;}
    case'b_revers':{
      for(let i=1;i<6;i++){c.strokeStyle='rgba(255,255,255,'+(.5-i*.07)+')';c.lineWidth=3;c.beginPath();c.arc(0,-135,((t*40+i*34)%170),0,7);c.stroke();}
      c.fillStyle='#a040ff';c.font='bold 70px sans-serif';c.textAlign='center';c.globalAlpha=.4;c.fillText('⟲',0,-120);c.globalAlpha=1;c.textAlign='left';
      break;}
    case'b_omega':{
      const g2=c.createRadialGradient(0,-170,4,0,-170,86);g2.addColorStop(0,'#ff4a3a');g2.addColorStop(.8,'#b0141c');g2.addColorStop(1,'#5a0a10');
      c.fillStyle=g2;c.beginPath();c.arc(0,-170,70,0,7);c.fill();
      c.strokeStyle='rgba(0,0,0,.6)';c.lineWidth=2;c.beginPath();c.moveTo(-30,-205);c.lineTo(-8,-170);c.lineTo(-24,-140);c.moveTo(-8,-170);c.lineTo(26,-176);c.stroke();
      c.strokeStyle='rgba(255,70,60,.4)';c.lineWidth=1.5;for(let i=0;i<14;i++){const x=((i*53+t*18)%360)-180;c.beginPath();c.moveTo(x,-260+((i*37+t*50)%260));c.lineTo(x-4,-244+((i*37+t*50)%260));c.stroke();}
      break;}
    default:{ /* void */
      c.strokeStyle=ink2;c.lineWidth=1.5;for(let i=-9;i<=9;i++){c.beginPath();c.moveTo(i*8,-4);c.lineTo(i*38,90);c.stroke();}
      [8,20,38,62].forEach(y=>{c.beginPath();c.moveTo(-BR,y);c.lineTo(BR,y);c.stroke();});
      c.fillStyle='#e01830';c.beginPath();c.arc(-92,-212,15,0,7);c.fill();
      c.strokeStyle=ink;c.lineWidth=2.5;[[-110,-96,26],[96,-170,20],[130,-60,16],[-40,-232,14]].forEach(([x,y,s],i)=>{c.save();c.translate(x,y+Math.sin(t*1.2+i)*5);c.rotate(t*.5+i);c.strokeRect(-s/2,-s/2,s,s);c.restore();});
    }
  }
  /* sol */
  c.fillStyle=inv?'rgba(255,255,255,.35)':'rgba(0,0,0,.52)';c.fillRect(-BR,0,BR*2,120);
  c.strokeStyle=inv?'#fff':'#0b0b0e';c.lineWidth=3;c.beginPath();c.moveTo(-BR,0);c.lineTo(BR,0);c.stroke();
  c.restore();
  /* anneau rouge de la bulle */
  c.save();c.strokeStyle='rgba(255,30,60,.9)';c.lineWidth=2.5;c.shadowColor='#ff1e3c';c.shadowBlur=14;c.beginPath();c.arc(0,-100,BR+1,0,7);c.stroke();c.restore();
}
