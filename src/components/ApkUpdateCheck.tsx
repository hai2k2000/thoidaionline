"use client";

import { useState } from "react";

export default function ApkUpdateCheck() {
  const [message, setMessage] = useState("");
  return <div className="mt-3"><button type="button" className="min-h-11 rounded-lg border border-orange-300 px-4 font-semibold text-orange-800" onClick={async () => {
    const bridge = (window as Window & { flutter_inappwebview?: { callHandler: (name: string) => Promise<unknown> } }).flutter_inappwebview;
    if (!bridge) { setMessage("Hãy tải APK Android để cập nhật ứng dụng."); return; }
    try { await bridge.callHandler("tdCheckApkUpdate"); }
    catch { setMessage("Bản ứng dụng này chưa hỗ trợ kiểm tra tự động. Hãy tải APK Android."); }
  }}>Kiểm tra cập nhật</button>{message ? <p role="status" className="mt-2 text-sm text-slate-600">{message}</p> : null}</div>;
}
