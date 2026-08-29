const CACHE_VERSION = "firemap-v25-0-11-native-google-places";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const APP_SHELL = [
  "./",
  "index.html",
  "firemap-boot.js",
  "google-maps-adapter.js",
  "google-maps-config.js",
  "styles.css",
  "app.js",
  "preplans.js",
  "prevention.js",
  "assistant.js",
  "navigation.js",
  "vehicle-accounts.js",
  "vehicles.js",
  "vehicle-usage.js",
  "command-center.js",
  "firebase-config.js",
  "firebase-sync.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "hydrant-mask.png"
];

const LOCAL_DATA = new Set([
  "louiseville_adresses.json",
  "firemap-2026-07-30%202.geojson",
  "firemap-2026-07-30 2.geojson"
]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => ![STATIC_CACHE, DATA_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || network || new Response("Données indisponibles hors ligne.", { status: 503 });
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put("index.html", response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match("index.html")) || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && LOCAL_DATA.has(url.pathname.split("/").pop())) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:"no-store"});
        if(response.ok){
          const cache=await caches.open(STATIC_CACHE);
          cache.put(request,response.clone());
        }
        return response;
      }catch(_){
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  // Ressources externes Google Maps : utilisation réseau avec repli cache si disponible.
  event.respondWith(cacheFirst(request).catch(() => Response.error()));
});
