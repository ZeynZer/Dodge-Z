'use strict';
/* ================= SHADOW FIGHTER — personnage en spritesheets (assets/shadow) =================
   Les animations sont pré-rendues par tools/build_sheets.py. Le moteur continue de piloter des
   « poses » (setPose/seq) : on traduit chaque pose en clip + instant de départ. */
const SHADOW={ready:false,man:null,img:{},base:'assets/shadow/'};
(function(){
  fetch(SHADOW.base+'sheets/manifest.json').then(r=>r.json()).then(m=>{
    const ks=Object.keys(m.clips);let n=0;
    ks.forEach(k=>{const im=new Image();im.onload=()=>{if(++n===ks.length){SHADOW.man=m;SHADOW.ready=true;}};im.src=SHADOW.base+'sheets/'+m.clips[k].src;SHADOW.img[k]=im;});
  }).catch(()=>{});
})();
/* pose du moteur → [clip, départ en s] */
const SH_MAP={idle:['idle'],eIdle:['idle'],bounce:['idle'],look:['idle'],adjust:['idle'],stretch:['idle'],taunt:['victory'],
  guard:['guard'],crouch:['guard',.1],dDown:['guard',.1],eAim:['guard'],dUp:['jump',.1],dLeft:['dash'],dRight:['dash'],
  hit:['hurt'],stun:['hurt'],eRecoil:['hurt'],ko:['ko'],
  punch:['combo'],palm:['combo',.3],hook:['combo',.3],upper:['combo',.8],windup:['combo',.6],
  throwP:['kiblast',.45],shoot:['kiblast',.45],scope:['kiblast'],point:['kiblast'],charge:['transform'],victory:['victory'],
  dribble1:['run'],dribble2:['run'],dunkUp:['jump',.12],dunkDown:['combo',.8]};
const SH_H=140; /* hauteur affichée du perso en px logiques (≈ les cyborgs) */

function drawShadow(c,o){
  if(!SHADOW.ready)return false;
  const m=SHADOW.man;
  let k,t;
  if(o.clip){k=o.clip;t=o.clipAt||0;}                                  /* clip forcé (super, entrée) */
  else{const e=SH_MAP[o.anim]||['idle'];k=e[0];t=(e[1]||0)+(o.at||0);if(k==='idle'&&o.aura)k='idle_power';}
  const cl=m.clips[k],im=SHADOW.img[k];
  let i=Math.floor(t*cl.fps);i=cl.loop?((i%cl.n)+cl.n)%cl.n:Math.max(0,Math.min(i,cl.n-1));
  const s=SH_H/m.U*(o.scale||1),sx=(i%cl.cols)*cl.fw,sy=Math.floor(i/cl.cols)*cl.fh;
  c.save();
  c.globalAlpha*=o.alpha==null?1:o.alpha;
  c.translate(o.x,o.y);c.scale((o.face||1)*s,s*(o.sy||1));
  c.drawImage(im,sx,sy,cl.fw,cl.fh,-cl.ax,-cl.ay,cl.fw,cl.fh);
  if(o.flash>0){c.globalCompositeOperation='lighter';c.globalAlpha*=Math.min(1,o.flash)*.7;c.drawImage(im,sx,sy,cl.fw,cl.fh,-cl.ax,-cl.ay,cl.fw,cl.fh);}
  c.restore();
  return true;
}
/* joue un clip complet sur un combattant ; résout quand il est fini */
function playClip(f,k){
  if(!SHADOW.ready)return Promise.resolve();
  const cl=SHADOW.man.clips[k];f.clip=k;f.clipT0=G.time;
  return wait(cl.n/cl.fps);
}

/* ---------- cinématique vidéo (assets/shadow/video) ---------- */
function playCinematic(){
  const ov=$('#cineVid'),v=ov.querySelector('video');
  if(!v.src){
    const webm=v.canPlayType('video/webm; codecs="vp9,opus"');
    v.src=SHADOW.base+'video/shadow_fighter_cinematic.'+(webm?'webm':'mp4');
  }
  ov.classList.add('on');Au.music('off');
  v.currentTime=0;v.muted=!SV.set.sfx;
  const end=()=>{v.pause();ov.classList.remove('on');v.onended=null;Au.music('menu');};
  v.onended=end;ov.querySelector('.skip').onclick=end;
  v.play().catch(()=>{v.muted=true;v.play().catch(end);});
}
