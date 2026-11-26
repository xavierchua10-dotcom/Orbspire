/* Always fetch the newest files when online (skips the browser's 10-minute cache); fall back to the saved copy when offline. */
const CACHE='orbspire-202611260904';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{
    if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}
    return res;
  }).catch(()=>caches.match(r)));
});
