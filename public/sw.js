// SERVICE WORKER: makes Benfora installable and usable offline by caching its files.
// Change VERSION (e.g. 'benfora-v2') to force every visitor to download fresh files.

/*
 * Benfora service worker: makes the app installable and usable offline.
 * Spreadsheets are analysed in the page itself, so once these files are cached,
 * Benfora works with no internet connection at all.
 */
const VERSION = 'benfora-v1';
const CORE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/samples/sample-expenses.xlsx',
  '/samples/sample-ledger.xlsx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle our own site; never touch analytics requests.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_vercel/')) return;

  // Pages: try the network first so updates show up, fall back to the cached app offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Build files never change once published: serve from cache when we have them.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (icons, samples, fonts): show the cached copy instantly, refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
