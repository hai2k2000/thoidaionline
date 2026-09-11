# Phát hành Thời Đại Work lên Google Play

## Thông tin đề xuất

- App name: `Thời Đại Work`
- Package name: `online.thoidai.work`
- Category: `Business`
- Distribution: `Private/Internal` nếu chỉ dùng nội bộ, hoặc `Public` nếu muốn người dùng ngoài tải.
- Login required: Có.
- Primary language: Vietnamese.

## Yêu cầu kỹ thuật

- Build định dạng `AAB`, không upload APK cho production.
- Target Android 15 / API 35 trở lên theo yêu cầu Google Play hiện tại.
- Dùng signing key riêng và lưu backup an toàn. Mất key sẽ rất khó xử lý release về sau.
- Không commit `key.properties` hoặc keystore.

## Tạo Android project

Máy build cần cài Flutter SDK, Android Studio, Android SDK API 35+.

```bash
cd mobile/thoidai_work_flutter
flutter create --platforms=android,ios --org online.thoidai .
flutter pub get
```

Sau khi chạy lệnh trên, kiểm tra package id trong:

```text
android/app/build.gradle
```

Hoặc nếu Flutter tạo Gradle Kotlin DSL:

```text
android/app/build.gradle.kts
```

Đặt application id thành:

```text
online.thoidai.work
```

## Tạo upload keystore

```bash
keytool -genkey -v \
  -keystore ~/thoidai-work-upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias thoidai-work-upload
```

Tạo file `android/key.properties`:

```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=thoidai-work-upload
storeFile=/absolute/path/to/thoidai-work-upload-keystore.jks
```

## Build AAB release

```bash
flutter clean
flutter pub get
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://thoidai.online
```

File upload:

```text
build/app/outputs/bundle/release/app-release.aab
```

## Nội dung Play Console cần chuẩn bị

- App icon 512x512 PNG.
- Feature graphic 1024x500 PNG.
- Tối thiểu 2 screenshots điện thoại.
- Short description tối đa 80 ký tự.
- Full description.
- Privacy policy URL.
- Data safety form.
- App access instructions: cung cấp tài khoản test cho reviewer nếu app bắt đăng nhập.

## Mô tả đề xuất

Short description:

```text
Ứng dụng quản lý công việc nội bộ Báo Thời Đại.
```

Full description:

```text
Thời Đại Work hỗ trợ cán bộ, nhân sự và lãnh đạo theo dõi công việc nội bộ, chấm công, hồ sơ nhân sự, tài sản và công văn trên thiết bị di động.

Các chức năng chính:
- Đăng nhập bằng tài khoản nội bộ.
- Xem tổng quan công việc và các chỉ số vận hành.
- Theo dõi danh sách công việc theo trạng thái.
- Xem dữ liệu chấm công trong ngày.
- Quản lý thông tin tài khoản cá nhân.
```

## Data safety gợi ý

Khai báo theo dữ liệu thực tế app đang đọc/lưu:

- Personal info: name, email, phone number.
- App activity / productivity data: tasks, attendance, internal work records.
- Files/documents: nếu bật tính năng tài liệu/tệp đính kèm trên mobile.
- Data is transmitted over HTTPS.
- Data is used for app functionality and internal workforce management.
- User account deletion: nếu Play Console yêu cầu, cần có quy trình hoặc URL hướng dẫn liên hệ quản trị viên nội bộ.

## Trình tự upload

1. Tạo app trong Play Console.
2. Điền Store listing.
3. Điền App content: Privacy policy, App access, Ads, Content rating, Target audience, Data safety.
4. Upload `app-release.aab` vào Internal testing trước.
5. Mời tester cài thử, kiểm tra login, dashboard, công việc, chấm công.
6. Sau khi ổn định mới promote lên Production.
