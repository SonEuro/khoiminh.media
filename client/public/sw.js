self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch (_) { data = { title: 'Thông báo', body: e.data?.text() || '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Kho Khôi Minh', {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const pu = new URL(url, self.location.origin);
      const existing = list.find(c => {
        const cu = new URL(c.url);
        return cu.pathname === pu.pathname && cu.search === pu.search;
      });
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
