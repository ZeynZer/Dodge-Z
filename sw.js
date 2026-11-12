/* Dodge Zero — service worker : jeu 100 % hors-ligne après la première visite */
const VERSION='dz-v1.1.1';
const CORE=['./','./index.html','./manifest.webmanifest','./js/core.js','./js/art.js','./js/game.js','./js/fights.js','./js/shadow.js','./js/ui.js',
  './assets/shadow/sheets/manifest.json','./assets/shadow/sheets/idle.webp','./assets/shadow/sheets/idle_power.webp','./assets/shadow/sheets/walk.webp','./assets/shadow/sheets/run.webp','./assets/shadow/sheets/dash.webp','./assets/shadow/sheets/jump.webp','./assets/shadow/sheets/combo.webp','./assets/shadow/sheets/guard.webp','./assets/shadow/sheets/hurt.webp','./assets/shadow/sheets/ko.webp','./assets/shadow/sheets/kiblast.webp','./assets/shadow/sheets/kiboom.webp','./assets/shadow/sheets/transform.webp','./assets/shadow/sheets/ultimate.webp','./assets/shadow/sheets/intro.webp','./assets/shadow/sheets/victory.webp',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    /* vidéo : lecture en streaming (requêtes Range), pas de mise en cache */
    if(u.pathname.includes('/assets/shadow/video/'))return;
    /* réseau d'abord pour la page (mises à jour), cache sinon */
    if(r.mode==='navigate'){
      e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put('./index.html',cp));return res;}).catch(()=>caches.match('./index.html')));
      return;
    }
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp));return res;})));
  }else if(u.hostname.endsWith('googleapis.com')||u.hostname.endsWith('gstatic.com')){
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp));return res;}).catch(()=>m)));
  }
});
