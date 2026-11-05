const blockedHosts = new Set(['localhost', '127.0.0.1', '::1']);
const endpointHosts = /(^|\.)((fcm\.googleapis\.com)|(push\.services\.mozilla\.com)|(push\.apple\.com)|(notify\.windows\.com))$/i;
export function parseWebPushSubscription(value) {
  if (!value || typeof value !== 'object' || typeof value.endpoint !== 'string' || value.endpoint.length > 4096) return null;
  let url;
  try { url = new URL(value.endpoint); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || blockedHosts.has(url.hostname) || !endpointHosts.test(url.hostname)) return null;
  const keys = value.keys;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || !/^[A-Za-z0-9_-]{87}=?$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(keys.auth)) return null;
  try {
    const p256dh = Buffer.from(keys.p256dh, 'base64url'); const auth = Buffer.from(keys.auth, 'base64url');
    if (p256dh.length !== 65 || p256dh[0] !== 4 || auth.length < 16 || auth.length > 32) return null;
  } catch { return null; }
  return { endpoint: url.toString(), keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
