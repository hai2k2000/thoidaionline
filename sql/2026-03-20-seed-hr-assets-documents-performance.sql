-- Seed dữ liệu mẫu cho 4 module mới (MVP)
-- Yêu cầu đã apply migration: 20260320114500_hr_assets_documents_performance_mvp.sql

-- 1) HR profiles
insert into public.employee_profiles (
  user_id,
  employee_code,
  join_date,
  contract_type,
  contract_start,
  contract_end,
  emergency_contact_name,
  emergency_contact_phone
)
select u.id,
       'NS-' || lpad((row_number() over(order by u.created_at))::text, 4, '0'),
       coalesce(u.created_at::date, current_date),
       'official',
       current_date - interval '180 days',
       current_date + interval '365 days',
       'Người thân ' || split_part(u.full_name, ' ', 1),
       '09' || lpad((10000000 + row_number() over(order by u.created_at))::text, 8, '0')
from public.staff_users u
where not exists (
  select 1 from public.employee_profiles ep where ep.user_id = u.id
)
limit 20;

-- 2) Performance cycle + reviews
insert into public.performance_cycles (code, name, start_date, end_date, status, created_by)
select 'DG-2026-Q2', 'Đánh giá Quý 2/2026', date '2026-04-01', date '2026-06-30', 'open', (select id from public.staff_users limit 1)
where not exists (
  select 1 from public.performance_cycles where code = 'DG-2026-Q2'
);

insert into public.performance_reviews (
  cycle_id,
  employee_id,
  reviewer_id,
  self_score,
  reviewer_score,
  final_score,
  rank,
  self_comment,
  reviewer_comment,
  status,
  submitted_at,
  reviewed_at
)
select c.id,
       u.id,
       (select id from public.staff_users where id <> u.id limit 1),
       3.5,
       4.0,
       3.8,
       'B',
       'Tự đánh giá hoàn thành phần lớn mục tiêu quý.',
       'Đề nghị cải thiện tốc độ phối hợp liên phòng ban.',
       'reviewed',
       now() - interval '2 day',
       now() - interval '1 day'
from public.performance_cycles c
join public.staff_users u on true
where c.code = 'DG-2026-Q2'
  and not exists (
    select 1 from public.performance_reviews r where r.cycle_id = c.id and r.employee_id = u.id
  )
limit 10;

-- 3) Assets + assignments
insert into public.assets (asset_code, asset_name, category, serial_number, purchase_date, purchase_cost, status, note)
values
  ('TS-2026-0001', 'Laptop Dell Latitude', 'laptop', 'DL-AX-0001', current_date - interval '120 days', 24000000, 'in_use', 'Mua cho phòng Trị sự'),
  ('TS-2026-0002', 'iPhone 14', 'phone', 'IP14-0002', current_date - interval '60 days', 19000000, 'available', 'Thiết bị công tác'),
  ('TS-2026-0003', 'Máy ảnh Sony A6400', 'camera', 'SONY-6400-03', current_date - interval '200 days', 21000000, 'maintenance', 'Đang bảo trì cảm biến')
on conflict (asset_code) do nothing;

insert into public.asset_assignments (
  asset_id,
  assignee_id,
  department_id,
  assigned_at,
  expected_return_at,
  status,
  handover_note,
  created_by
)
select a.id,
       u.id,
       u.department_id,
       now() - interval '10 day',
       now() + interval '170 day',
       'active',
       'Bàn giao đầy đủ phụ kiện.',
       (select id from public.staff_users limit 1)
from public.assets a
join public.staff_users u on true
where a.asset_code = 'TS-2026-0001'
  and not exists (
    select 1 from public.asset_assignments aa where aa.asset_id = a.id and aa.status = 'active'
  )
limit 1;

-- Đồng bộ trạng thái tài sản sau khi có assignment active
update public.assets a
set status = 'in_use', updated_at = now()
where exists (
  select 1 from public.asset_assignments aa where aa.asset_id = a.id and aa.status = 'active' and aa.returned_at is null
)
  and a.status <> 'in_use';

-- 4) Official documents + assignments
insert into public.official_documents (
  doc_code,
  direction,
  title,
  summary,
  issuer,
  received_date,
  urgency,
  confidentiality,
  status,
  processing_deadline,
  owner_user_id,
  owner_department_id,
  note,
  created_by
)
select 'CV-DEN-2026-0001',
       'incoming',
       'Về việc chuẩn hóa quy trình báo cáo tuần',
       'Yêu cầu các phòng ban gửi báo cáo theo mẫu mới.',
       'Ban điều hành',
       current_date - interval '2 days',
       'important',
       'internal',
       'in_progress',
       current_date + interval '5 days',
       u.id,
       u.department_id,
       'Ưu tiên xử lý trong tuần này.',
       (select id from public.staff_users limit 1)
from public.staff_users u
where not exists (select 1 from public.official_documents where doc_code = 'CV-DEN-2026-0001')
limit 1;

insert into public.document_assignments (
  document_id,
  assignee_id,
  assigned_by,
  assigned_at,
  due_date,
  status,
  result_note
)
select d.id,
       u.id,
       (select id from public.staff_users limit 1),
       now() - interval '1 day',
       current_date + interval '4 days',
       'in_progress',
       'Đang tổng hợp nội dung phản hồi.'
from public.official_documents d
join public.staff_users u on true
where d.doc_code = 'CV-DEN-2026-0001'
  and not exists (
    select 1 from public.document_assignments da where da.document_id = d.id
  )
limit 1;

-- 5) Audit demo
insert into public.audit_logs (actor_id, module, entity_type, entity_id, action, new_data)
select
  (select id from public.staff_users limit 1),
  'hr',
  'employee_profiles',
  (select user_id from public.employee_profiles limit 1),
  'update',
  jsonb_build_object('note', 'Seed audit entry')
where exists (select 1 from public.employee_profiles)
  and not exists (
    select 1 from public.audit_logs where module = 'hr' and action = 'update' and (new_data->>'note') = 'Seed audit entry'
  );
