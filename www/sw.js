const CACHE='garage-v4';
const ASSETS=['./','./index.html','./css/app.css','./js/app.js','./js/db.js','./js/archive.js','./js/backup.js','./js/destinations.js','./js/search-ai.js','./js/notes-ai.js','./js/shelf-scanner.js','./js/speech.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request))));
