'use strict';
/* ================= DODGE ZERO — core : utilitaires, sauvegarde, audio ================= */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rand(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const easeOut=t=>1-Math.pow(1-t,3);
const easeIn=t=>t*t;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

/* ---------- sauvegarde ---------- */
const SAVE_KEY='dodgezero.save.v1';
const DEFSAVE=()=>({coins:250,gems:6,xp:0,ownV:['classic'],ownS:{classic:[0]},selV:'classic',selS:{classic:0},best:0,
  stats:{runs:0,kills:0,dodges:0,hits:0,bosses:0,streak:0,supers:0,packs:0},
  set:{sfx:1,music:1,voice:1,vib:1,flash:1},tuto:0});
function loadSave(){
  try{const r=localStorage.getItem(SAVE_KEY);
    if(r){const o=JSON.parse(r),d=DEFSAVE();
      return Object.assign(d,o,{set:Object.assign(d.set,o.set||{}),stats:Object.assign(d.stats,o.stats||{})});}
  }catch(e){}
  return DEFSAVE();
}
let SV=loadSave();
/* SHADOW FIGHTER est offert à tous les joueurs */
if(!SV.ownV.includes('shadow')){SV.ownV.push('shadow');SV.ownS.shadow=[0];}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(SV));}catch(e){}}
const xpNeed=l=>100+60*(l-1);
function lvlInfo(){let xp=SV.xp,l=1;while(xp>=xpNeed(l)){xp-=xpNeed(l);l++;}return{l,xp,need:xpNeed(l)};}
function addXP(n){const b=lvlInfo().l;SV.xp+=n;const a=lvlInfo().l;const bonus=(a-b)*50;SV.coins+=bonus;save();return{up:a-b,bonus,lvl:a};}

/* ---------- vibration / voix ---------- */
function vib(p){if(SV.set.vib&&navigator.vibrate){try{navigator.vibrate(p);}catch(e){}}}
function speak(txt){
  if(!SV.set.voice||!('speechSynthesis' in window))return;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(txt);u.lang='fr-FR';u.pitch=.35;u.rate=.92;speechSynthesis.speak(u);}catch(e){}
}

/* ---------- audio synthétisé ---------- */
const Au=(()=>{
  let ac=null,master,sfx,mus,nbuf,timer=null,step=0,next=0,mode='off',inten=0;
  const NOTE=m=>440*Math.pow(2,(m-69)/12);
  const BASS=[45,0,45,0,48,0,45,0,43,0,43,0,41,0,43,0];
  const ARP=[69,72,76,72,69,72,77,72,67,71,74,71,65,69,72,76];
  function init(){
    if(ac){if(ac.state==='suspended')ac.resume();return;}
    try{ac=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
    master=ac.createGain();master.gain.value=.85;
    const comp=ac.createDynamicsCompressor();master.connect(comp);comp.connect(ac.destination);
    sfx=ac.createGain();sfx.connect(master);mus=ac.createGain();mus.connect(master);
    const n=ac.sampleRate*1.2;nbuf=ac.createBuffer(1,n,ac.sampleRate);
    const d=nbuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    apply();
    document.addEventListener('visibilitychange',()=>{if(!ac)return;document.hidden?ac.suspend():ac.resume();});
  }
  function apply(){if(!ac)return;sfx.gain.value=SV.set.sfx?1:0;mus.gain.value=SV.set.music?.5:0;}
  function tone(f,d,type='square',v=.2,slide=0,delay=0,dest){
    if(!ac||!SV.set.sfx&&!dest)return;
    const t=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+d);
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(dest||sfx);o.start(t);o.stop(t+d+.03);
  }
  function noise(d,v=.3,f0=2000,f1=500,type='lowpass',delay=0,dest){
    if(!ac)return;
    const t=ac.currentTime+delay,s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();
    s.buffer=nbuf;fl.type=type;fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+d);
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    s.connect(fl);fl.connect(g);g.connect(dest||sfx);s.start(t,Math.random()*.5);s.stop(t+d+.03);
  }
  const S={
    init,apply,tone,noise,
    click(){tone(900,.05,'square',.1,.6);},
    select(){tone(520,.07,'triangle',.2);tone(780,.1,'triangle',.18,0,.05);},
    back(){tone(500,.08,'triangle',.18,.6);},
    swipe(){noise(.16,.22,3200,500,'bandpass');},
    dodge(s=0){noise(.2,.28,3800,400,'bandpass');tone(520+Math.min(s,24)*28,.12,'triangle',.18,1.4,.02);},
    shot(){noise(.14,.5,7000,700,'highpass');tone(140,.18,'sawtooth',.3,.3);},
    hit(){noise(.45,.6,1400,90);tone(90,.35,'sine',.6,.35);tone(1200,.12,'square',.15,.3);},
    parry(){tone(1900,.18,'square',.2,.5);tone(2600,.12,'triangle',.16,.6,.02);noise(.1,.3,8000,2000,'highpass');},
    ko(){tone(62,.9,'sine',.8,.3);noise(.9,.7,900,50);tone(210,.3,'sawtooth',.2,.25);},
    boom(){tone(48,1.4,'sine',.9,.3);noise(1.2,.8,700,40);},
    coin(){tone(1200,.06,'square',.1);tone(1700,.12,'square',.1,0,.06);},
    ready(){[0,4,7,12].forEach((n,i)=>tone(NOTE(69+n),.12,'square',.14,0,i*.06));},
    charge(d=1.4){tone(90,d,'sawtooth',.18,8);noise(d,.12,300,5000,'bandpass');},
    dribble(){tone(120,.1,'sine',.6,.4);},
    tick(){tone(1400,.02,'square',.07);},
    heart(){tone(70,.12,'sine',.7,.5);tone(70,.12,'sine',.5,.5,.16);},
    boss(){tone(55,2,'sawtooth',.28,.5);[0,.25,.5,.75].forEach(d=>tone(440,.18,'square',.14,.8,d));},
    win(){[0,3,7,12,15,19].forEach((n,i)=>tone(NOTE(60+n),.18,'square',.13,0,i*.07));},
    lose(){[0,-2,-5,-9].forEach((n,i)=>tone(NOTE(57+n),.3,'sawtooth',.16,.9,i*.16));},
    pack(){noise(.8,.3,200,6000,'bandpass');tone(80,.8,'sawtooth',.2,3);},
    reveal(r=0){[0,4,7,12,16].slice(0,2+r).forEach((n,i)=>tone(NOTE(64+n),.25,'triangle',.2,0,i*.08));if(r>=2)noise(.6,.3,5000,500,'highpass');},
    voice:speak,
    music(m,i=0){mode=m;inten=i;
      if(!ac)return;
      if(m==='off'){if(timer){clearInterval(timer);timer=null;}return;}
      if(!timer){step=0;next=ac.currentTime+.05;timer=setInterval(sched,60);}
    }
  };
  function sched(){
    if(!ac||ac.state!=='running')return;
    const bpm=mode==='menu'?84:112+inten*3,sd=60/bpm/4;
    if(next<ac.currentTime)next=ac.currentTime+.05;
    while(next<ac.currentTime+.3){play(step%16,next,sd);next+=sd;step++;}
  }
  function play(s,t,sd){
    const m=mode,g=mus;
    const at=(f,d,type,v,delay,fc)=>{
      const o=ac.createOscillator(),gn=ac.createGain(),fl=ac.createBiquadFilter();
      o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=fc||1200;
      gn.gain.setValueAtTime(v,t);gn.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(fl);fl.connect(gn);gn.connect(g);o.start(t);o.stop(t+d+.03);};
    if(m==='menu'){
      if(s===0){at(NOTE(33),sd*14,'sawtooth',.28,0,260);at(NOTE(40),sd*14,'triangle',.2,0,500);}
      if(s%8===4)at(NOTE(ARP[s]-12),sd*3,'sine',.12,0,900);
      return;
    }
    if(s%4===0){const o=ac.createOscillator(),gn=ac.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+.14);gn.gain.setValueAtTime(.7,t);gn.gain.exponentialRampToValueAtTime(.001,t+.16);o.connect(gn);gn.connect(g);o.start(t);o.stop(t+.2);}
    if(BASS[s])at(NOTE(BASS[s]),sd*1.7,'sawtooth',.26,0,380+inten*40);
    if(s%2===1&&inten>=0){const sr=ac.createBufferSource(),fl=ac.createBiquadFilter(),gn=ac.createGain();sr.buffer=nbuf;fl.type='highpass';fl.frequency.value=7000;gn.gain.setValueAtTime(.08,t);gn.gain.exponentialRampToValueAtTime(.001,t+.04);sr.connect(fl);fl.connect(gn);gn.connect(g);sr.start(t,Math.random());sr.stop(t+.05);}
    if(inten>=1&&s%2===0)at(NOTE(ARP[s]),sd*1.4,'square',.07,0,1800);
    if(s===4||s===12){const sr=ac.createBufferSource(),fl=ac.createBiquadFilter(),gn=ac.createGain();sr.buffer=nbuf;fl.type='bandpass';fl.frequency.value=1800;gn.gain.setValueAtTime(.18,t);gn.gain.exponentialRampToValueAtTime(.001,t+.12);sr.connect(fl);fl.connect(gn);gn.connect(g);sr.start(t,Math.random());sr.stop(t+.14);}
  }
  return S;
})();
