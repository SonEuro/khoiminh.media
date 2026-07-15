const API = import.meta.env.VITE_API_URL || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const token = localStorage.getItem('km_token');
  if (!token) return;

  try {
    const keyRes = await fetch(`${API}/api/push/vapid-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { key } = await keyRes.json();
    if (!key) return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    await fetch(`${API}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch (e) {
    console.warn('[push] subscribe failed:', e.message);
  }
}
