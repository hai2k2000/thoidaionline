// Executed only in the top-level trusted WebView document. Cookies remain in WebView.
const pushRegistrationScript = r'''
if (window.location.origin !== expectedOrigin) return {status: 'untrusted'};
let state = window.__tdNativePush;
if (!state) {
  state = window.__tdNativePush = {token: null, lastKey: null, pending: null, loggingOut: false};
  const originalFetch = window.fetch.bind(window);
  state.fetch = (url, init = {}) => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    return originalFetch(url, {...init, signal: abort.signal}).finally(() => clearTimeout(timeout));
  };
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, expectedOrigin);
    const method = (init?.method || input?.method || 'GET').toUpperCase();
    if (url.origin === expectedOrigin && method === 'POST' &&
        ['/api/auth/logout', '/api/auth/mobile-logout'].includes(url.pathname)) {
      state.loggingOut = true;
      try {
        // Serialize unregister after an in-flight registration, before losing the cookie.
        await state.pending;
        if (state.token) await state.fetch('/api/mobile/push-token', {
          method: 'DELETE', credentials: 'include', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({token: state.token})
        });
      } catch (_) { /* Native deletion also invalidates the provider token. */ }
      try { await window.flutter_inappwebview.callHandler('tdPushLogout'); } catch (_) {}
      state.token = null;
      state.lastKey = null;
      try { return await originalFetch(input, init); }
      finally { state.loggingOut = false; }
    }
    return originalFetch(input, init);
  };
}
if (state.loggingOut) return {status: 'loggingOut'};
if (state.pending) return await state.pending;
state.token = token;
state.pending = (async () => {
  const session = await state.fetch('/api/auth/session', {credentials: 'include', cache: 'no-store'});
  if (session.status === 401) { state.lastKey = null; return {status: 'loggedOut'}; }
  if (!session.ok) return {status: 'retry'};
  const userId = (await session.json())?.user?.id;
  if (typeof userId !== 'string' || !userId) return {status: 'retry'};
  if (state.loggingOut) return {status: 'loggingOut'};
  if (priorUserId && priorUserId !== userId) return {status: 'accountChanged'};
  if (!token) return {status: 'needsToken', userId};
  const key = userId + ':' + token;
  if (state.lastKey === key) return {status: 'registered', userId};
  const response = await state.fetch('/api/mobile/push-token', {
    method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({token, platform: 'android'})
  });
  if (!response.ok) return {status: response.status === 401 ? 'loggedOut' : 'retry'};
  state.lastKey = key;
  return {status: 'registered', userId};
})();
try { return await state.pending; } finally { state.pending = null; }
''';
