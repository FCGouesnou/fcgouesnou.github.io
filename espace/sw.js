/*
  FC Gouesnou - Espace club
  Fichier : espace/sw.js (dépôt GitHub fcgouesnou.github.io)
  Rôle : service worker de l'application installable - affichage des notifications reçues,
         ouverture de l'application au toucher, page de secours hors connexion.
         Aucune donnée du club n'est mise en cache : l'application est toujours chargée en ligne.
  Version : 1.0 - 12/11/2026
*/
const CACHE = 'fcg-espace-1.0';
const SECOURS = ['./', './icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SECOURS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Page de l'application : toujours depuis le réseau ; la copie sert seulement hors connexion
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).then((r) => {
    const copie = r.clone();
    caches.open(CACHE).then((c) => c.put('./', copie));
    return r;
  }).catch(() => caches.match('./')));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Espace club FC Gouesnou', {
    body: d.corps || '',
    icon: 'icone-192.png',
    badge: 'icone-192.png',
    tag: d.tag || undefined,
    lang: 'fr',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
    for (const f of fenetres) if (f.url.includes('/espace/') && 'focus' in f) { f.postMessage('actualiser'); return f.focus(); }
    return self.clients.openWindow(url);
  }));
});
