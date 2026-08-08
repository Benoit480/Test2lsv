const CACHE_VERSION = "firemap-v24-1-0-hybrid-address";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const APP_SHELL = [
  "./","index.html","styles.css","app.js","preplans.js","prevention.js","assistant.js",
  "navigation.js","vehicle-accounts.js","vehicles.js","vehicle-usage.js","command-center.js",
  "event-manager.js","google-maps-config.js","google-address-search.js","firebase-config.js","firebase-sync.js",
  "manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png","hydrant-mask.png",
  "louiseville_adresses.json"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("firemap-")&&!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response&&response.ok){
      const cache=await caches.open(STATIC_CACHE);
      cache.put(request,response.clone());
    }
    return response;
  }catch(_){
    return (await caches.match(request,{ignoreSearch:true})) || Response.error();
  }
}

async function localData(request){
  const cache=await caches.open(DATA_CACHE);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response.ok)cache.put(request,response.clone());
    return response;
  }catch(_){
    return (await cache.match(request,{ignoreSearch:true})) || (await caches.match("louiseville_adresses.json")) || new Response("[]",{headers:{"Content-Type":"application/json"}});
  }
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);

  if(request.mode==="navigate"){ event.respondWith(networkFirst(request)); return; }

  if(url.origin===self.location.origin && url.pathname.endsWith("/louiseville_adresses.json")){
    event.respondWith(localData(request)); return;
  }

  if(url.origin===self.location.origin){ event.respondWith(networkFirst(request)); return; }

  // External resources are used online only. We do not persist Google Places data offline.
  event.respondWith(fetch(request).catch(()=>Response.error()));
});
