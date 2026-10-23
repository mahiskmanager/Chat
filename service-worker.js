// service-worker.js — Service Worker real para PWA (cache de activos estáticos)
const CACHE_NAME = "inside-v5";
const STATIC_ASSETS = [
  "/", "/index.html", "/register.html", "/home.html",
  "/css/style.css", "/js/firebase-config.js", "/js/auth.js", "/js/app.js",
  "/js/utils.js", "/js/constants.js", "/js/sound.js", "/js/validators.js",
  "/js/formatters.js", "/js/notif.js", "/js/state.js", "/js/router.js",
  "/js/components.js", "/js/emoji-picker.js", "/manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if(request.method !== "GET") return;
  // Estrategia: network first para datos, cache first para estáticos
  if(request.url.includes("firebase") || request.url.includes("firestore") || request.url.includes("firebaseio")){
    return; // datos en tiempo real: siempre red
  }
  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match("/index.html")))
  );
});

self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : { title: "Inside", body: "Nueva notificación" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "inside"
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients => {
      if(clients.length){ clients[0].focus(); }
      else { self.clients.openWindow("/home.html"); }
    })
  );
});
