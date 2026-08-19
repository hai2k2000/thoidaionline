# Production Deploy Checklist - ThoiDai Work

## 1) Supabase
- [ ] Tạo project Supabase production
- [ ] Chạy `supabase-init.sql`
- [ ] Kiểm tra dữ liệu demo/tài khoản admin đã có
- [ ] Tắt dữ liệu demo nếu cần trước khi dùng thật

## 2) Vercel
- [ ] Import repo vào Vercel
- [ ] Set Root Directory: `thoidai-work`
- [ ] Thêm biến môi trường:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] (Tuỳ chọn) Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - [ ] (Tuỳ chọn) Email: `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`
- [ ] Deploy production

## 3) Reminder/Notification
- [ ] Xác nhận route reminder chạy được: `POST /api/notify/due-soon?days=3`
- [ ] Trên dashboard bấm nút "Nhắc việc sắp đến hạn" để test tay
- [ ] Kiểm tra cron/timer trên VPS (mặc định 08:00 ICT)
- [ ] Xác nhận Telegram/email nhận được tin nhắn

## 4) Bảo mật & vận hành
- [ ] Đổi mật khẩu các user demo
- [ ] Chỉ cấp quyền cần thiết theo role
- [ ] Backup DB định kỳ (ít nhất 1 lần/ngày)
- [ ] Ghi log và quy trình xử lý sự cố

## 5) Nghiệm thu
- [ ] Test end-to-end: tạo việc -> giao người -> cập nhật tiến độ -> hoàn thành
- [ ] Test lọc/tìm kiếm/phân trang
- [ ] Test phân quyền: admin/manager/ops/reporter
- [ ] Xác nhận UX với người dùng thật và chốt vòng cải tiến tiếp theo
 vòng cải tiến tiếp theo
