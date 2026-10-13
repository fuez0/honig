/* Service Worker der Honig-Verwaltung – zeigt Push-Benachrichtigungen bei neuen Reservierungen */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Honig', body: e.data ? e.data.text() : '' }; }
  var url = d.url || new URL('admin.html#/', self.registration.scope).href;
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Neue Reservierung', {
      body: d.body || '',
      icon: 'icon-180.png',
      badge: 'icon-180.png',
      tag: d.tag || undefined,
      renotify: true,
      data: { url: url }
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      cs.forEach(function (c) { c.postMessage({ type: 'push-refresh' }); });
    })
  ]));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || new URL('admin.html#/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].url.indexOf('admin.html') > -1) {
        cs[i].postMessage({ type: 'push-open', url: url });
        return cs[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
