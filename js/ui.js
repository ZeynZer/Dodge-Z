'use strict';
/* ================= DODGE ZERO — interface, packs, réglages, PWA ================= */
const PACKS=[
  {id:'std',name:'PACK STANDARD',cost:400,cur:'coins',n:3,odds:[.70,.22,.07,.01],vch:.06,min:0,col:'linear-gradient(160deg,#d7dbe2,#7d838e)',desc:'3 cartes · surtout des skins communs, une chance de nouveau cyborg.'},
  {id:'elite',name:'PACK ÉLITE',cost:1200,cur:'coins',n:3,odds:[.30,.42,.22,.06],vch:.12,min:1,col:'linear-gradient(160deg,#8fd0ff,#2a6fd0)',desc:'3 cartes · 1 rare minimum garantie, plus de chance de cyborg.'},
  {id:'crystal',name:'PACK CRISTAL',cost:40,cur:'gems',n:5,odds:[0,.30,.46,.24],vch:.20,min:2,col:'linear-gradient(160deg,#e0b8ff,#7a2fd8)',desc:'5 cartes · 1 épique minimum garantie. Skins légendaires possibles.'}
];
const DUP=[40,120,300,800];
const vRar=v=>v.id==='classic'?0:(v.rar+1);

let prevSel={v:'classic',s:0};
let trCfg={v:'classic',r:1.2,i:.8};

/* ---------- navigation ---------- */
function uiShow(id){$$('.screen').forEach(s=>s.classList.toggle('on',s.id===id));}
function go(id){
  Au.init();Au.click();
  if(id==='home')return goHome();
  if(id==='chars'){buildChars();setMenuLayout('chars');}
  else setMenuLayout('home');
  if(id==='shop')buildShop();
  if(id==='train')buildTrain();
  if(id==='settings')buildSettings();
  uiShow(id);
}
function setMenuLayout(k){MENU.view=k;applyMenuLayout();}
function applyMenuLayout(){
  if(MENU.view==='chars'){G.menu.gy=H*.365;G.menu.sc=1.05;G.menu.as=.66;}
  else{const as=clamp((H-275)/356,.72,1),avail=H-275,top=125+Math.max(0,(avail-356*as)/2*.6);
    G.menu.as=as;G.menu.gy=top+278*as;G.menu.sc=1.5*as;}
}
function goHome(){
  abortAll();G.mode='menu';G.paused=false;document.body.classList.remove('ingame');
  $('#pause').classList.remove('on');$('#result').classList.remove('on');
  loadPlayer();prevSel={v:SV.selV,s:SV.selS[SV.selV]||0};
  resetPlayerPos(W/2);P.alpha=1;E.hidden=true;
  MENU.arena=pick(['dojo','void','hoops','lab','spy','ring']);MENU.t=1.2;MENU.ball=null;
  resetCam();setPose(P,'idle',.2);
  setMenuLayout('home');
  updateHome();uiShow('home');
  Au.music('menu');
  if(window.deferredPrompt||isIOS())$('#installBar').classList.toggle('on',!isStandalone());
}
function updateCurrencies(){
  $$('.vCoins').forEach(e=>e.textContent=SV.coins);$$('.vGems').forEach(e=>e.textContent=SV.gems);
}
function updateHome(){
  const li=lvlInfo();$('#hLvl').textContent='NIV. '+li.l;$('#hXp').style.width=(li.xp/li.need*100)+'%';
  $('#hBest').textContent=SV.best?('Record · niveau '+SV.best):'Esquive · contre · achève';
  $('#shopDot').classList.toggle('on',SV.coins>=400||SV.gems>=40);
  updateCurrencies();
}
function toast(t,ms=2200){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),ms);}

/* ---------- personnages ---------- */
function ownsV(id){return SV.ownV.includes(id);}
function ownsS(v,i){return(SV.ownS[v]||[]).includes(i);}
function setPreview(v,s,say){
  prevSel={v,s};
  P.v=v;P.pal=skinPal(s);P.fem=skinFem(s);P.alpha=ownsV(v)?1:.4;
  setPose(P,'guard',.12);setTimeout(()=>setPose(P,'idle',.25),220);
  if(say)Au.voice(vOf(v).title+'. '+skinName(s));
}
function buildChars(){
  const v=prevSel.v;
  const tabs=$('#vtabs');tabs.innerHTML='';
  VARIANTS.forEach(x=>{const b=document.createElement('button');b.className='vtab'+(x.id===v?' on':'')+(ownsV(x.id)?'':' lock');b.textContent=x.name.split(' ')[0];
    b.onclick=()=>{Au.select();const s=ownsV(x.id)?(SV.selS[x.id]||0):0;setPreview(x.id,s,true);buildChars();};tabs.appendChild(b);});
  const V=vOf(v);
  $('#pName').textContent=V.name+' — '+V.title;$('#pDesc').textContent=V.desc;$('#pSup').textContent='Super : '+V.sup;
  const g=$('#skins');g.innerHTML='';
  for(let i=0;i<20;i++){
    const owned=ownsV(v)&&ownsS(v,i),b=document.createElement('button');
    b.className='skin'+(prevSel.s===i?' sel':'')+(SV.selV===v&&(SV.selS[v]||0)===i&&owned?' eq':'');
    b.innerHTML='<canvas></canvas><span class="sn"></span><i class="rb"></i>';
    b.querySelector('.sn').textContent=owned?skinName(i):'???';
    b.querySelector('.rb').style.background=RCOL[skinRar(i)];
    b.onclick=()=>{Au.select();setPreview(v,i,true);buildChars();};
    g.appendChild(b);
    requestAnimationFrame(()=>drawThumb(b.querySelector('canvas'),v,i,!owned));
  }
  const eq=$('#equipBtn'),sel=prevSel.s,o=ownsV(v)&&ownsS(v,sel);
  if(!ownsV(v)){eq.textContent='Cyborg verrouillé · Packs';eq.className='btn block ghost';eq.onclick=()=>go('shop');}
  else if(!o){eq.textContent='Skin verrouillé · Packs';eq.className='btn block ghost';eq.onclick=()=>go('shop');}
  else if(SV.selV===v&&(SV.selS[v]||0)===sel){eq.textContent='Équipé';eq.className='btn block ghost';eq.disabled=true;eq.onclick=null;}
  else{eq.disabled=false;eq.textContent='Équiper';eq.className='btn block';eq.onclick=()=>{SV.selV=v;SV.selS[v]=sel;save();Au.select();toast(V.name+' équipé');buildChars();};}
  if(!(SV.selV===v&&(SV.selS[v]||0)===sel&&o))eq.disabled=false;
}

/* ---------- boutique & packs ---------- */
function buildShop(){
  updateCurrencies();
  const box=$('#packs');box.innerHTML='';
  PACKS.forEach(p=>{
    const d=document.createElement('div');d.className='pack';
    const can=SV[p.cur]>=p.cost;
    d.innerHTML=`<div class="pk" style="background:${p.col}">${p.name.replace('PACK ','PACK<br>')}</div><div class="pinf"><b>${p.name}</b><span>${p.desc}</span><div style="margin-top:6px"><button class="btn sm" ${can?'':'disabled'}><span class="price"><i class="${p.cur==='coins'?'coin':'gem'}"></i>${p.cost}</span></button></div></div>`;
    d.querySelector('button').onclick=()=>openPack(p);
    box.appendChild(d);
  });
  const t=document.createElement('div');t.className='demo';
  t.innerHTML=`<b>Cristaux ◆</b> : gagnés en battant des boss. Cette version n'a pas de paiement réel.<div style="margin-top:8px"><button class="btn sm ghost" id="gemDemo">+30 cristaux (démo)</button></div>`;
  box.appendChild(t);
  $('#gemDemo').onclick=()=>{SV.gems+=30;save();Au.coin();toast('Démo : +30 cristaux');buildShop();};
}
function rollRarity(odds,min){let r=Math.random(),a=0;for(let i=0;i<4;i++){a+=odds[i];if(r<a)return Math.max(i,min);}return Math.max(min,3);}
function rollItem(pack,minR){
  const un=VARIANTS.filter(v=>!ownsV(v.id));
  if(un.length&&Math.random()<pack.vch*(minR>0?1.4:1)){
    const w=[];un.forEach(v=>{const k=v.rar===1?3:1;for(let i=0;i<k;i++)w.push(v);});
    const v=pick(w);return{t:'v',v:v.id,r:vRar(v)};
  }
  const r=rollRarity(pack.odds,minR),pool=[];
  SV.ownV.forEach(id=>{for(let i=0;i<20;i++)if(skinRar(i)===r)pool.push({v:id,i,own:ownsS(id,i)});});
  if(!pool.length){SV.ownV.forEach(id=>{for(let i=0;i<20;i++)pool.push({v:id,i,own:ownsS(id,i)});});}
  const nw=pool.filter(p=>!p.own),p=pick(nw.length&&Math.random()<.85?nw:pool);
  return{t:'s',v:p.v,i:p.i,r:skinRar(p.i)};
}
function applyItem(it){
  if(it.t==='v'){SV.ownV.push(it.v);SV.ownS[it.v]=[0];it.isNew=true;return;}
  if(!SV.ownS[it.v])SV.ownS[it.v]=[];
  if(ownsS(it.v,it.i)){it.dup=DUP[it.r];SV.coins+=it.dup;}
  else{SV.ownS[it.v].push(it.i);it.isNew=true;}
}
function openPack(p){
  if(SV[p.cur]<p.cost)return;
  SV[p.cur]-=p.cost;SV.stats.packs++;
  const items=[];
  for(let k=0;k<p.n;k++){const it=rollItem(p,k===p.n-1?p.min:0);applyItem(it);items.push(it);}
  save();updateCurrencies();
  runReveal(p,items);
}
function runReveal(p,items){
  const ov=$('#reveal');ov.classList.add('on');
  let i=0;
  const stage0=()=>{
    ov.innerHTML=`<div class="pk shake" style="background:${p.col};width:120px;height:150px;font-size:15px">${p.name.replace('PACK ','PACK<br>')}</div><div class="mini">…</div>`;
    Au.pack();vib([30,30,30,30,60]);
    setTimeout(()=>showCard(),1000);
  };
  const showCard=()=>{
    const it=items[i],V=vOf(it.v),rc=RCOL[it.r];
    const nm=it.t==='v'?V.name+' · '+V.title:V.name+' — '+skinName(it.i);
    const tag=it.t==='v'?'<span class="rtag" style="background:#ff1e3c">NOUVEAU CYBORG</span>':(it.dup?`<span class="rtag" style="background:#333">DOUBLON · +${it.dup} pièces</span>`:'<span class="rtag" style="background:#3dff9a;color:#000">NOUVEAU SKIN</span>');
    ov.innerHTML=`<div class="rdots">${items.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div>
      <div class="rcard" style="--rc:${rc};box-shadow:0 0 40px ${rc}88"><canvas id="rvc"></canvas></div>
      <div><div class="rname">${nm}</div><div class="rrar" style="color:${rc}">${RAR[it.r]}</div></div>${tag}
      <button class="btn" id="rvNext">${i<items.length-1?'Suivant':'Terminer'}</button>`;
    Au.reveal(it.r);vib(it.r>=2?[40,40,80]:20);
    requestAnimationFrame(()=>drawThumb($('#rvc'),it.v,it.t==='v'?0:it.i,false));
    $('#rvNext').onclick=()=>{Au.click();i++;if(i<items.length)showCard();else{ov.classList.remove('on');ov.innerHTML='';buildShop();}};
    if(it.t==='v')Au.voice(V.title);
  };
  stage0();
}

/* ---------- entraînement ---------- */
function buildTrain(){
  const box=$('#trEnemy');box.innerHTML='';
  VARIANTS.forEach(v=>{const b=document.createElement('button');b.className='chp'+(trCfg.v===v.id?' on':'');b.textContent=v.name;b.onclick=()=>{Au.select();trCfg.v=v.id;buildTrain();};box.appendChild(b);});
  const r=$('#trR'),iv=$('#trI');
  r.value=Math.round(trCfg.r*100);iv.value=Math.round(trCfg.i*100);
  const upd=()=>{trCfg.r=r.value/100;trCfg.i=iv.value/100;$('#trRV').textContent=trCfg.r.toFixed(2)+' s';$('#trIV').textContent=trCfg.i.toFixed(2)+' s';};
  r.oninput=upd;iv.oninput=upd;upd();
}

/* ---------- réglages ---------- */
function buildSettings(){
  $$('.sw').forEach(s=>{const k=s.dataset.set;s.classList.toggle('on',!!SV.set[k]);
    s.onclick=()=>{SV.set[k]=SV.set[k]?0:1;save();s.classList.toggle('on',!!SV.set[k]);Au.apply();if(k==='music'&&SV.set.music)Au.music('menu');Au.click();};});
  const st=SV.stats,li=lvlInfo();
  const rows=[['Niveau joueur',li.l],['Record',SV.best||0],['Parties',st.runs],['Cyborgs battus',st.kills],['Esquives',st.dodges],['Touches',st.hits],['Meilleure série',st.streak],['Boss vaincus',st.bosses],['Supers lancés',st.supers],['Packs ouverts',st.packs]];
  $('#stats').innerHTML=rows.map(r=>`<div class="stat"><b>${r[1]}</b><span>${r[0]}</span></div>`).join('');
  const rb=$('#resetBtn');rb.textContent='Effacer la sauvegarde';rb.dataset.arm='';
}

/* ---------- résultat / pause ---------- */
function showResult(r){
  G.mode='result';document.body.classList.remove('ingame');
  $('#rLevel').textContent=r.level;
  $('#rList').innerHTML=[['Cyborgs battus',r.kills],['Boss vaincus',r.bosses],['Pièces gagnées','+'+r.coins],['Cristaux gagnés','+'+r.gems],['XP','+'+r.xp]].map(x=>`<div class="kv"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')+`<div class="kv"><span>Record</span><b>${SV.best}</b></div>`;
  $('#rNote').textContent=r.up?`NIVEAU ${r.lvl} ! +${r.bonus} pièces`:'';
  $('#result').classList.add('on');updateCurrencies();Au.music('menu');
}
function togglePause(){
  if(!(G.mode==='play'||G.mode==='train'||G.mode==='reflex'))return;
  G.paused=!G.paused;$('#pause').classList.toggle('on',G.paused);if(G.paused)Au.click();
}
function quitRun(){
  const wasRun=G.mode==='play'&&(G.kills>0||G.level>1);
  if(wasRun)bankRun();
  goHome();
}

/* ---------- PWA ---------- */
window.deferredPrompt=null;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.deferredPrompt=e;if(G.mode==='menu')$('#installBar').classList.toggle('on',!isStandalone());});
addEventListener('appinstalled',()=>{window.deferredPrompt=null;$('#installBar').classList.remove('on');toast('Dodge Zero installé !');});
async function install(){
  if(window.deferredPrompt){window.deferredPrompt.prompt();try{await window.deferredPrompt.userChoice;}catch(e){}window.deferredPrompt=null;$('#installBar').classList.remove('on');}
  else if(isIOS())toast('Safari : Partager ▸ Sur l\'écran d\'accueil',4200);
  else toast('Menu du navigateur ▸ Installer l\'application',3600);
}

/* ---------- écran allumé / orientation ---------- */
let wl=null;
async function wake(){try{if('wakeLock' in navigator&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null;});}}catch(e){}
  try{if(screen.orientation&&screen.orientation.lock&&isStandalone())screen.orientation.lock('portrait').catch(()=>{});}catch(e){}}

/* ---------- démarrage ---------- */
function boot(){
  resize();bindInput();
  addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(resize,200));
  document.addEventListener('pointerdown',()=>{Au.init();if(G.mode==='menu')Au.music('menu');},{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&(G.mode==='play'||G.mode==='train')&&!G.paused)togglePause();});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#playZone').addEventListener('click',()=>{Au.init();Au.click();startRun();});
  $('#trGo').onclick=()=>{Au.click();startTrain({v:trCfg.v,react:trCfg.r,interval:trCfg.i});};
  $('#pauseBtn').onclick=()=>togglePause();
  $('#pResume').onclick=()=>togglePause();
  $('#pQuit').onclick=()=>{$('#pause').classList.remove('on');quitRun();};
  $('#rAgain').onclick=()=>{$('#result').classList.remove('on');startRun();};
  $('#rHome').onclick=()=>{Au.click();goHome();};
  $('#rPacks').onclick=()=>{goHome();go('shop');};
  $('#superBtn').addEventListener('pointerdown',e=>{e.stopPropagation();useSuper();});
  $('#installBtn').onclick=install;$('#installBtn2').onclick=install;
  $('#resetBtn').onclick=e=>{const b=e.currentTarget;if(b.dataset.arm){try{localStorage.removeItem(SAVE_KEY);}catch(x){}SV=DEFSAVE();save();Au.apply();toast('Sauvegarde effacée');goHome();}else{b.dataset.arm='1';b.textContent='Confirmer l\'effacement';}};
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
  requestAnimationFrame(frame);
  const bar=$('#loadbar');let p=0;
  const fontP=(document.fonts&&document.fonts.load)?Promise.race([document.fonts.load('700 20px "Chakra Petch"'),new Promise(r=>setTimeout(r,1500))]):Promise.resolve();
  const iv=setInterval(()=>{p=Math.min(90,p+rand(8,18));bar.style.width=p+'%';},180);
  Promise.all([fontP,new Promise(r=>setTimeout(r,1500))]).then(()=>{
    clearInterval(iv);bar.style.width='100%';
    setTimeout(()=>{$('#splash').classList.remove('on');goHome();},280);
  });
}
window.DZ={G,P,E,SV,startRun,startTrain,shotSwipe,shotDouble,useSuper,goHome,go,takeHit,openPack,PACKS,BOSSES};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
