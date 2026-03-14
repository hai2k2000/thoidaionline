# thoidai-work

App quản lý công việc tổng quát.

✅ Hiện hỗ trợ giao 1 task cho nhiều người (không tách task con), có sẵn cấu trúc nâng cấp lên task cha/con qua `tasks.parent_task_id`.

## Các trang chính
- `/` Quản lý công việc tổng quan (lọc, trạng thái, tiến độ, audit)
- `/users` Quản trị user
- `/permissions` Quản trị phân quyền theo role
- `/my-tasks` Công việc theo từng user + comment + log tiến độ

## Setup
1. Tạo project Supabase và chạy `supabase-init.sql` (đã có dữ liệu demo)
2. Set ENV:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy Vercel với Root Directory: `thoidai-work`

## Nhắc việc (Telegram/Email)
- Nút gửi tay trên dashboard: **Nhắc việc sắp đến hạn**
- API route: `POST /api/notify/due-soon?days=3`
- ENV tùy chọn:
  - Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - Email (Resend): `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`
- Cron production: cấu hình sẵn trong `vercel.json` (08:00 ICT mỗi ngày).

## Triển khai production
Xem checklist chi tiết: `DEPLOY_CHECKLIST.md`
