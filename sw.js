/* Service worker: офлайн-робота інтерфейсу та кеш переглянутих тайлів карти. */
var VERSION = "v4";
var SHELL_CACHE = "zt-shell-" + VERSION;
var TILE_CACHE = "zt-tiles-v1";
var TILE_LIMIT = 800;

var SHELL = [
  "./",
  "index.html",
  "css/app.css",
  "js/theme-init.js",
  "js/places.js",
  "js/geocode.js",
  "js/app.js",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/leaflet.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/favicon-32.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("zt-shell-") === 0 && k !== SHELL_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trimTiles() {
  return caches.open(TILE_CACHE).then(function (c) {
    return c.keys().then(function (keys) {
      var extra = keys.length - TILE_LIMIT;
      for (var i = 0; i < extra; i++) c.delete(keys[i]);
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Тайли OSM: спершу кеш, потім мережа.
  if (url.hostname === "tile.openstreetmap.org") {
    event.respondWith(
      caches.open(TILE_CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res.ok) { c.put(req, res.clone()); trimTiles(); }
            return res;
          });
        });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") === 0) return;   // API — завжди напряму в мережу

  // Свої файли: мережа з резервом у кеші (оновлення підхоплюються одразу, офлайн — з кешу).
  event.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === "navigate" ? caches.match("index.html") : undefined);
      });
    })
  );
});
