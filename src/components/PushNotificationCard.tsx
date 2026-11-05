"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { beginBrowserPushSession, registerBrowserSubscription, stopBrowserPush } from "@/lib/push/browser";

type State = { supported: boolean; iosInstall: boolean; key: string | null; subscribed: boolean; permission: NotificationPermission; dismissed: boolean };
function PushCard({ userId, banner }: { userId: string; banner: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dismissKey = `thoidai-push-banner-v1:${userId}`;
  useEffect(() => {
    let cancelled = false;
    beginBrowserPushSession(userId);
    if (/ThoidaiWorkApp/i.test(navigator.userAgent)) return;
    void (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      let dismissed = false;
      try { dismissed = localStorage.getItem(dismissKey) === "1"; } catch { /* Storage can be unavailable in private mode. */ }
      const result: State = { supported, iosInstall: ios && !standalone, key: null, subscribed: false, permission: supported ? Notification.permission : "default", dismissed };
      try {
        const response = await fetch("/api/push/config", { cache: "no-store" });
        if (response.ok) result.key = (await response.json()).publicKey;
        if (supported && result.key && result.permission === "granted") {
          const registration = await navigator.serviceWorker.getRegistration("/");
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription && !cancelled) { await registerBrowserSubscription(subscription, userId); result.subscribed = true; }
        }
      } catch { /* The enable button offers an explicit retry after connectivity returns. */ }
      if (!cancelled) setState(result);
    })();
    return () => { cancelled = true; };
  }, [dismissKey, userId]);
  const dismiss = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* Keep dismissal for this page. */ }
    setState(previous => previous ? { ...previous, dismissed: true } : previous);
  };
  const enable = async () => {
    if (!state?.key || busy) return;
    setBusy(true); setMessage("");
    beginBrowserPushSession(userId);
    try {
      // Keep permission directly on the tap, before any registration/network await (iOS).
      const permission = await Notification.requestPermission();
      setState(previous => previous ? { ...previous, permission } : previous);
      if (permission !== "granted") { setMessage("Chưa bật thông báo. Bạn có thể đổi quyền trong cài đặt trình duyệt."); return; }
      await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(atob(state.key.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await registerBrowserSubscription(subscription, userId);
      setState(previous => previous ? { ...previous, subscribed: true } : previous);
      setMessage("Đã bật thông báo trên thiết bị này.");
    } catch { setMessage("Chưa bật được thông báo. Kiểm tra kết nối, quyền trình duyệt rồi thử lại."); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try { await stopBrowserPush(); setState(previous => previous ? { ...previous, subscribed: false } : previous); setMessage("Đã tắt thông báo trên thiết bị này."); }
    catch { setMessage("Không thể tắt thông báo. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  if (!state || (banner && (state.dismissed || state.subscribed || (!state.key && !state.iosInstall)))) return null;
  return <section aria-label="Thông báo trên thiết bị" className={`rounded-xl border border-orange-200 bg-orange-50 p-4 ${banner ? "mx-3 my-3 lg:hidden" : ""}`}>
    <div className="flex items-start justify-between gap-3"><h2 className="font-bold text-orange-950">Bật thông báo</h2>{banner ? <button type="button" onClick={dismiss} aria-label="Ẩn lời nhắc thông báo" className="min-h-11 px-2 text-sm font-semibold text-orange-800">Để sau</button> : null}</div>
    <p className="mt-1 text-sm leading-6 text-slate-700">{state.iosInstall ? "Trên iPhone/iPad (iOS 16.4+), mở bằng Safari, chọn Chia sẻ → Thêm vào Màn hình chính, rồi mở ứng dụng từ biểu tượng đó để bật thông báo." : !state.supported ? "Trình duyệt này chưa hỗ trợ thông báo. Hãy dùng phiên bản trình duyệt mới nhất." : !state.key ? "Thông báo đang chờ cấu hình máy chủ." : state.subscribed ? "Thiết bị này đã nhận thông báo khi có công việc mới." : state.permission === "denied" ? "Thông báo đang bị chặn. Cho phép thông báo trong cài đặt trình duyệt rồi tải lại trang." : "Nhận thông báo khi được giao việc, kể cả khi không mở trang."}</p>
    {state.supported && !state.iosInstall && state.key ? state.subscribed ? <button type="button" disabled={busy} onClick={disable} className="mt-3 min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold">Tắt trên thiết bị này</button> : <button type="button" disabled={busy || state.permission === "denied"} onClick={enable} className="mt-3 min-h-11 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang bật..." : "Bật thông báo"}</button> : null}
    {message ? <p role="status" className="mt-2 text-sm text-slate-700">{message}</p> : null}
  </section>;
}
export default function PushNotificationCard({ banner = false }: { banner?: boolean }) {
  const { user } = useAuth(); const pathname = usePathname();
  if (!user || user.must_change_password || (banner && ["/account", "/mobile-app", "/login"].includes(pathname ?? ""))) return null;
  return <PushCard key={user.id} userId={user.id} banner={banner} />;
}
