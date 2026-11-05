import webpush from 'web-push';
import { readFileSync } from 'node:fs';
import { createFcmSender } from './fcm.mjs';
import { parseWebPushSubscription } from './subscription.mjs';

export function notificationPayload(row) {
  const href = typeof row.href === 'string' && /^\/(tasks|projects)\/[A-Za-z0-9_-]+$/.test(row.href) ? row.href : '/my-tasks';
  return { title: 'Th\u1eddi \u0110\u1ea1i Work', body: String(row.message ?? '').slice(0, 500), url: href, tag: String(row.id) };
}
export function makeRepository(client) {
  const checked = async query => { const result = await (query.abortSignal?.(AbortSignal.timeout(10000)) ?? query); if (result.error) throw new Error('Push database operation failed'); return result.data; };
  return {
    async claim(kinds) { return (await checked(client.rpc('claim_push_notifications', { p_kinds: kinds }))) ?? []; },
    async subscriptions(userId) { return (await checked(client.from('push_subscriptions').select('id,user_id,kind,endpoint,p256dh,auth,failed_count,last_seen_at').eq('user_id', userId).is('disabled_at', null))) ?? []; },
    async complete(row) { await checked(client.from('notifications').update({ push_sent_at: new Date().toISOString(), push_claimed_at: null, push_claim_token: null }).eq('id', row.id).eq('push_claim_token', row.push_claim_token)); },
    async release(row) { await checked(client.from('notifications').update({ push_claimed_at: null, push_claim_token: null }).eq('id', row.id).eq('push_claim_token', row.push_claim_token)); },
    async subscriptionFailed(id, disable, sub) {
      await checked(client.from('push_subscriptions').update({ failed_count: (sub.failed_count ?? 0) + 1, ...(disable ? { disabled_at: new Date().toISOString() } : {}) })
        .eq('id', id).eq('user_id', sub.user_id).eq('last_seen_at', sub.last_seen_at));
    },
  };
}
export async function dispatchOnce({ repository, senders, logger = console } = {}) {
  const kinds = Object.keys(senders ?? {}).filter(kind => typeof senders[kind] === 'function');
  if (!kinds.length) return { claimed: 0, sent: 0 };
  const rows = await repository.claim(kinds); let sent = 0;
  // Batches are bounded by SQL; parallel sends plus provider timeouts finish well
  // inside the five-minute lease, including a slow or unavailable provider.
  await Promise.all(rows.map(async row => {
    let retry = false;
    try {
      const subscriptions = await repository.subscriptions(row.recipient_id ?? row.user_id);
      await Promise.all(subscriptions.filter(sub => !sub.disabled_at && senders[sub.kind]).map(async sub => {
        try { await senders[sub.kind](sub, notificationPayload(row)); sent++; }
        catch (error) {
          const gone = sub.kind === 'webpush' ? [404, 410].includes(error?.statusCode) : error?.code === 'UNREGISTERED';
          await repository.subscriptionFailed(sub.id, gone, sub);
          if (!gone) retry = true;
        }
      }));
      if (retry) await repository.release(row); else await repository.complete(row);
    } catch {
      logger.warn?.('Push notification delivery deferred.');
      // A failed release is safe: the database lease expires and is reclaimable.
      try { await repository.release(row); } catch { logger.warn?.('Push claim will retry after lease expiry.'); }
    }
  }));
  return { claimed: rows.length, sent };
}
const logged = new Set();
function disabledOnce(channel) {
  if (!logged.has(channel)) { logged.add(channel); console.warn(`${channel} push disabled: missing or invalid configuration.`); }
}
export function createConfiguredSenders(env = process.env) {
  const senders = {};
  if (env.WEB_PUSH_VAPID_PUBLIC_KEY && env.WEB_PUSH_VAPID_PRIVATE_KEY && /^(mailto:|https:\/\/)/.test(env.WEB_PUSH_SUBJECT ?? '')) {
    try {
      webpush.setVapidDetails(env.WEB_PUSH_SUBJECT, env.WEB_PUSH_VAPID_PUBLIC_KEY, env.WEB_PUSH_VAPID_PRIVATE_KEY);
      senders.webpush = (sub, payload) => {
        const subscription = parseWebPushSubscription({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
        if (!subscription) throw Object.assign(new Error('Invalid push subscription'), { statusCode: 410 });
        return webpush.sendNotification(subscription, JSON.stringify(payload), { timeout: 10000, TTL: 86400 });
      };
    } catch { disabledOnce('Web Push'); }
  } else disabledOnce('Web Push');
  if (env.FCM_SERVICE_ACCOUNT_FILE) {
    try {
      const account = JSON.parse(readFileSync(env.FCM_SERVICE_ACCOUNT_FILE, 'utf8'));
      if (!account.private_key || !account.client_email || !/^[a-z0-9-]+$/.test(account.project_id ?? '')) throw new Error('Invalid configuration');
      senders.fcm = createFcmSender(account);
    } catch { disabledOnce('FCM'); }
  } else disabledOnce('FCM');
  return senders;
}
export function createDispatcher(client, env = process.env) {
  const repository = makeRepository(client); const senders = createConfiguredSenders(env);
  return () => dispatchOnce({ repository, senders });
}
