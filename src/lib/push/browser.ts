let activeUserId: string | null = null;
let pendingRegistration: Promise<void> | null = null;
export function beginBrowserPushSession(userId: string) { activeUserId = userId; }
export async function registerBrowserSubscription(subscription: PushSubscription, userId: string) {
  if (activeUserId !== userId) throw new Error("Phiên thông báo đã kết thúc.");
  if (pendingRegistration) await pendingRegistration.catch(() => {});
  if (activeUserId !== userId) throw new Error("Phiên thông báo đã kết thúc.");
  const task = (async () => {
    const response = await fetch("/api/push/subscribe", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Không thể lưu đăng ký thông báo. Vui lòng thử lại.");
  })();
  pendingRegistration = task;
  try { await task; } finally { if (pendingRegistration === task) pendingRegistration = null; }
}
export async function stopBrowserPush() {
  activeUserId = null;
  if (!("serviceWorker" in navigator) || /ThoidaiWorkApp/i.test(navigator.userAgent)) return;
  await pendingRegistration?.catch(() => {});
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  // Serialize after registration and revoke locally even when the API is offline.
  try {
    await fetch("/api/push/unsubscribe", { method: "POST", credentials: "include",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }),
      signal: AbortSignal.timeout(5000),
    });
  } finally { await subscription.unsubscribe(); }
}
