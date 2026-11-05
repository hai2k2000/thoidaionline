import { createSign } from 'node:crypto';
const AUDIENCE = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const b64 = value => Buffer.from(value).toString('base64url');
export function createServiceAccountJwt(account, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: AUDIENCE, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(`${header}.${payload}`); signer.end();
  return `${header}.${payload}.${signer.sign(account.private_key, 'base64url')}`;
}
export function createFcmSender(account, { fetchImpl = fetch, now = () => Math.floor(Date.now() / 1000) } = {}) {
  let cached = null;
  let pendingToken = null;
  async function refreshToken(current) {
    const response = await fetchImpl(AUDIENCE, { method: 'POST', signal: AbortSignal.timeout(10000), redirect: 'error', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: createServiceAccountJwt(account, current) }) });
    if (!response.ok) throw Object.assign(new Error('FCM OAuth token unavailable'), { code: 'FCM_AUTH' });
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('FCM OAuth response invalid');
    cached = { token: data.access_token, expiresAt: current + Number(data.expires_in || 3600) }; return cached.token;
  }
  async function accessToken() {
    const current = now();
    if (cached && cached.expiresAt > current + 60) return cached.token;
    if (!pendingToken) pendingToken = refreshToken(current).finally(() => { pendingToken = null; });
    return pendingToken;
  }
  return async (subscription, payload) => {
    const token = await accessToken();
    const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, { method: 'POST', signal: AbortSignal.timeout(10000), redirect: 'error', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ message: { token: subscription.endpoint, notification: { title: payload.title, body: payload.body }, data: { url: payload.url, tag: payload.tag }, android: { ttl: '86400s', notification: { tag: payload.tag } } } }) });
    if (response.ok) return;
    if (response.status === 401) cached = null;
    const data = await response.json().catch(() => null); const code = data?.error?.details?.find?.(item => item?.errorCode)?.errorCode;
    throw Object.assign(new Error(code || `FCM send failed (${response.status})`), { statusCode: response.status, code: code || 'FCM_SEND_FAILED' });
  };
}
