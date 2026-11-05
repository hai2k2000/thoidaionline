import { redirect } from "next/navigation";
import PushNotificationCard from "@/components/PushNotificationCard";
import AppNav from "@/components/AppNav";
import { getSessionUser } from "@/lib/serverSession";
import { readApkManifest, MOBILE_APK_NOT_FOUND } from "@/lib/mobileApk.mjs";
import { headers } from "next/headers";
import { installedApkVersion, isApkOlder } from "@/lib/mobileInstalledVersion.mjs";
import ApkUpdateCheck from "@/components/ApkUpdateCheck";

export default async function MobileAppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app");
  const userAgent = (await headers()).get("user-agent") ?? "";
  const installedVersion = installedApkVersion(userAgent);
  let apk: Awaited<ReturnType<typeof readApkManifest>> | null = null;
  let message: string = MOBILE_APK_NOT_FOUND;
  try { apk = await readApkManifest(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") message = "Thông tin APK tạm thời không khả dụng. Vui lòng thử lại sau."; }
  return <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-4"><div className="flex w-full flex-col gap-4 lg:flex-row">
    <AppNav currentPath="/app" userLabel={user.full_name} />
    <main className="min-w-0 flex-1 space-y-4">
      <header className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Thời Đại Work · Nội bộ</p>
        <h1 className="mt-2 text-2xl font-bold">Ứng dụng di động</h1>
        <p className="mt-2 text-sm text-slate-600">Sử dụng đầy đủ chức năng của hệ thống trên điện thoại bằng tài khoản công việc của bạn.</p>
      </header>
      <PushNotificationCard />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold">Android</h2><p className="mt-2 text-sm text-slate-600">Cài APK nội bộ, không cần Google Play.</p>
          {apk ? <><a href="/api/mobile/apk/download" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-orange-700 px-5 py-3 font-semibold text-white hover:bg-orange-800">Tải APK Android</a>
            {installedVersion ? <p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">Đang cài: <strong>{installedVersion.version}{installedVersion.versionCode !== null ? ` (${installedVersion.versionCode})` : ""}</strong> · Bản mới nhất: <strong>{apk.version} ({apk.versionCode})</strong>{isApkOlder(installedVersion, apk) ? " · Tải bản mới để cập nhật." : ""}</p> : null}
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="inline font-semibold">Phiên bản: </dt><dd className="inline">{apk.version} ({apk.versionCode})</dd></div>
              <div><dt className="inline font-semibold">Dung lượng: </dt><dd className="inline">{(apk.size / 1024 / 1024).toFixed(1)} MB</dd></div>
              <div><dt className="font-semibold">SHA-256</dt><dd className="mt-1 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs">{apk.sha256}</dd></div>
            </dl></> : <p role="status" className="mt-5 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">{message}</p>}
          <h3 className="mt-6 font-semibold">Cài đặt trong 3 bước</h3>
          {installedVersion ? <ApkUpdateCheck /> : null}
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
            <li>Nếu đã cài ứng dụng “Thời Đại Work” cũ, hãy gỡ ứng dụng cũ trước. Sau đó tải APK ở trên.</li>
            <li>Mở tệp APK, vào Cài đặt khi được hỏi và bật “Cho phép cài đặt từ nguồn này” cho trình duyệt hoặc trình quản lý tệp.</li>
            <li>Chọn Cài đặt, mở Thời Đại Work và đăng nhập. Có thể tắt lại quyền cài đặt từ nguồn này sau khi hoàn tất.</li>
          </ol>
        </section>
        <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold">iPhone / iPad</h2><p className="mt-2 text-sm text-slate-600">Thêm phiên bản web vào màn hình chính bằng Safari.</p>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-700">
            <li>Mở <a className="font-semibold text-orange-700 underline" href="https://thoidai.online">thoidai.online</a> trong Safari.</li>
            <li>Chạm Chia sẻ, rồi chọn “Thêm vào Màn hình chính”.</li><li>Chạm Thêm và mở biểu tượng Thời Đại Work để đăng nhập.</li>
          </ol><p className="mt-6 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">Ứng dụng cần kết nối mạng để làm việc. Chức năng được cập nhật cùng phiên bản web của cơ quan.</p>
        </section>
      </div>
      <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Chrome / máy tính</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">Mở thoidai.online trong Chrome, chọn biểu tượng cài đặt trên thanh địa chỉ hoặc mở menu ba chấm rồi chọn “Cài đặt ứng dụng” / “Thêm vào màn hình chính”. Làm theo hướng dẫn của trình duyệt, sau đó mở biểu tượng Thời Đại Work. Nếu chưa thấy tùy chọn cài đặt, bạn vẫn có thể dùng đầy đủ chức năng trên trình duyệt.</p>
      </section>
    </main>
  </div></div>;
}
