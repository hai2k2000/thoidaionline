# thoidai-work

App quản lý công việc tổng quát.

✅ Hiện hỗ trợ giao 1 task cho nhiều người (không tách task con), có sẵn cấu trúc nâng cấp lên task cha/con qua `tasks.parent_task_id`.

## Các trang chính
- `/` Quản lý công việc tổng quan (lọc, trạng thái, tiến độ, audit)
- `/users` Quản trị user
- `/permissions` Quản trị phân quyền theo role
- `/my-tasks` Công việc theo từng user + comment + log tiến độ

## Setup
1. Supabase full-stack đã được chuẩn hoá trong repo:
   - `supabase/config.toml`
   - `supabase/migrations/20260318101500_baseline.sql`
2. Khởi tạo DB (chọn 1):
   - Nhanh: chạy `supabase-init.sql` trên SQL Editor
   - Chuẩn migration: `npx supabase db push` (sau khi link project)
3. Set ENV:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy Vercel với Root Directory: `thoidai-work`

## Nhắc việc (Telegram/Email)
- Nút gửi tay trên dashboard: **Nhắc việc sắp đến hạn**
- API route: `POST /api/notify/due-soon?days=3`
- ENV tùy chọn:
  - Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - Email (Resend): `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`
- Cron production: cấu hình bằng cron/systemd timer trên VPS (khuyến nghị 08:00 ICT mỗi ngày).

## Triển khai production
Xem checklist chi tiết: `DEPLOY_CHECKLIST.md`
