# Thời Đại Work Mobile

App Flutter MVP cho dự án `thoidai-work`, dùng trực tiếp Supabase endpoint của `thoidai.online`.

## Phạm vi hiện có

- Đăng nhập bằng `username`, email hoặc số điện thoại giống web app.
- Dashboard tổng quan: công việc, nhân sự, tài sản đang dùng, công văn quá hạn.
- Danh sách công việc, lọc theo trạng thái.
- Chấm công ngày hiện tại.
- Trang tài khoản và đăng xuất.

## Cấu hình

App đọc cấu hình qua `--dart-define`:

```bash
--dart-define=SUPABASE_URL=https://thoidai.online/supa
--dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Lấy `SUPABASE_ANON_KEY` từ `.env.production` trên server hoặc Supabase project settings. Không commit key thật vào repo.

## Chạy local

Máy cần cài Flutter SDK trước.

```bash
cd mobile/thoidai_work_flutter
flutter create --platforms=android,ios .
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://thoidai.online/supa \
  --dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Build Android

```bash
flutter build apk --release \
  --dart-define=SUPABASE_URL=https://thoidai.online/supa \
  --dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

File APK sẽ nằm ở `build/app/outputs/flutter-apk/app-release.apk`.

## Phát hành Google Play

Google Play cần file `AAB`. Xem checklist chi tiết tại `PLAY_STORE_RELEASE.md`.
