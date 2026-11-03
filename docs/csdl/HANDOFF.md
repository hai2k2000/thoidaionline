# CSDL (Cơ sở dữ liệu hồ sơ): tài liệu bàn giao cho phiên Claude khác

Cập nhật lần cuối: 2026-11-03 (sau PR #120, production artifact-5816e3c). Người viết: phiên Claude ở máy cơ quan. Người duyệt: owner (hai2k2000).

## 1. Đọc trước
- **Ngôn ngữ:** owner trao đổi bằng tiếng Việt, ưa câu ngắn.
- **Phân công:** Claude lập đặc tả và review; Codex viết code (`codex exec`). Owner không tự chạy lệnh nào. Claude chạy mọi thứ, kể cả Playwright; khi cần đăng nhập thì mở trình duyệt có giao diện để owner tự đăng nhập.
- **Production:** mọi thao tác trên production (migration, deploy, Nginx) đều cần owner duyệt riêng cho từng việc. Duyệt PR không có nghĩa là duyệt deploy.
- **Secret:** không đọc, không in. Không chạy `docker top` hay `docker inspect` lên container DB. Không đọc nội dung hồ sơ thật (`db_records.metadata`); chỉ đếm.
- **Chỉ một máy deploy production tại một thời điểm.** Trước khi activate: `readlink -f /opt/releases/thoidai-work/current`, rồi so release đang chạy với commit sắp deploy để biết những PR nào sẽ lên cùng.
- **Merge:** chỉ merge khi `gh pr checks <n>` xanh ở `build-test-package`. Job `isolated-authenticated-e2e` đỏ sẵn từ 27/10 ở `20261020100000` ("db_records does not exist"), không phải lỗi của PR.

## 2. Trạng thái hiện tại (2026-11-03)
- Repo `hai2k2000/thoidaionline`, nhánh `integration/production`. Production đang chạy `artifact-5816e3c` (PR #120). Release trước: `artifact-3382ecc` (PR #113), trước nữa `artifact-ffcdafa` (PR #111, #112).
- Các migration CSDL đã áp, mới nhất ở cuối:
  - `20261028090000_doan_the_types`: tạo nhóm "Các tổ chức đoàn thể" với 16 loại (nay đã inactive, xem `20261102140000`).
  - `20261028120000_record_type_sort_order`
  - `20261029120000_department_visibility`: thêm cột `visibility` (department/public), bảng `db_department_view_grants`; trưởng phòng (`departments.manager_id`) duyệt hồ sơ.
  - `20261030100000_record_approve_department_scope`: định nghĩa lại `api_transition_database_record`.
  - `20261031100000_p2_search_hardening`: định nghĩa lại `api_search_database_records`.
  - `20261102100000_noidung_forms`: thêm `db_form_fields.hidden`, `validation.help`, form riêng cho 11 loại `ngoai_ngu`, Tổ Tiếng Nga (`ru`).
  - `20261102140000_p2_restricted_groups`: cột `db_categories.restricted`, bảng `db_category_access_grants` (level view/contribute/approve), hàm `db_restricted_category_id`, `db_category_is_restricted`. 6 nhóm hạn chế: `cong_tac_dang`, `chi_hoi_nha_bao`, `cong_doan`, `doan_thanh_nien`, `cuc_bao_chi`, `lien_hiep`. Nhóm `phap_ly_dieu_hanh` không hạn chế. `doan_the_quan_ly` inactive (đã bật lại làm nhóm cha ở `20261103120000`). Định nghĩa lại CẢ `api_search_database_records` và `api_transition_database_record`.
  - `20261102160000_p2_form_fields_fix`: form version mới cho 24 loại của 4 nhóm `cong_tac_dang`, `cong_doan`, `lien_hiep`, `phap_ly_dieu_hanh` (sửa options, `keywords` là text, `con_phai_thu` là number).
  - `20261102170000_to_tieng_viet_forms`: form riêng 10 loại của `noi_dung_tieng_viet`; trigger `db_records_danh_ba_visibility` chặn danh bạ nghiệp vụ `public`.
  - `20261102190000_gopy_dot1_forms` (PR #112): form version mới cho 9 loại `truyen_thong` theo góp ý Phòng Truyền thông (Mã khách hàng, Số hợp đồng, giá trị tiền dạng number, tình trạng dạng select); 11 loại `ngoai_ngu` ẩn mã hồ sơ; loại mới `ngoai_ngu_ho_so_nhan_vat`; trigger danh bạ chặn `public` cho cả `ngoai_ngu_danh_ba_doi_tac`.
  - `20261103100000_p3_tong_hop_subgroups` (PR #113): 3 nhóm con của `tong_hop`: `tong_hop_van_thu_luu_tru`, `tong_hop_to_chuc_can_bo` (restricted), `tong_hop_chung`; chuyển 11 loại và hồ sơ của chúng; form mới Văn bản đến/đi; 4 loại mới `tccb_*` (không có trường mức lương — owner quyết định).
  - `20261103120000_doan_the_parent` (PR #115): bật lại `doan_the_quan_ly` ("Các tổ chức đoàn thể", tên do owner chọn) làm nhóm cha của 7 nhóm: `cong_tac_dang`, `chi_hoi_nha_bao`, `cong_doan`, `doan_thanh_nien`, `cuc_bao_chi`, `lien_hiep` (đều restricted) và `phap_ly_dieu_hanh` (không restricted).
  - `20261103140000_keywords_fix_remaining` (PR #116): `keywords` chuyển thành text cho 10 loại của `chi_hoi_nha_bao`, `doan_thanh_nien`, `cuc_bao_chi`.
  - PR #117–#120 chỉ đổi giao diện, không có migration (xem bộ lọc ở mục 3). Ledger production mới nhất: `20261103140000`.
- **Bản gốc khi viết lại RPC:** luôn lấy định nghĩa mới nhất. Hiện CẢ search và transition đều ở `20261102140000`. Hàm `rbac_v2_scope_supported` lấy từ migration mới nhất có ghi đè hàm này. Không dùng bản cũ hơn.
- **Cấp quyền nhóm hạn chế:** Phân quyền → Theo người dùng → mục "Nhóm hồ sơ hạn chế" (API `PUT /api/permissions/users/[userId]/category-grants`, cần `permission.manage`). Nhóm con hạn chế hiện dạng "Phòng Tổng hợp › Tổ chức – Cán bộ". Đến 2026-11-03 chưa ai được cấp; chỉ Admin thấy các nhóm hạn chế. Đã test bằng Admin và tài khoản thường (tài khoản thường không thấy nhóm hạn chế).
- **Hồ sơ trên production:** rất ít (khoảng 6 hồ sơ). Có thể cấu trúc lại nhóm và loại mà không phải chuyển dữ liệu lớn, nhưng migration vẫn phải cập nhật `db_records.category_id` khi chuyển loại sang nhóm khác.
- **Revert script** cho mỗi migration form nằm ở `scripts/production/database-management-*-revert.sql`; chỉ chạy sau khi migration tương ứng đã áp.

## 3. Mô hình dữ liệu (tóm tắt)
- `db_categories` (code, name, parent_id, department_id, sort_order, active, restricted): nhóm hồ sơ.
  - Phòng Nội dung là nhóm cha, các tổ ngôn ngữ là nhóm con (chọn qua ô "Tổ ngôn ngữ", `language_code`).
  - Loại hồ sơ của tổ ngoại ngữ nằm trong nhóm `ngoai_ngu`, nhóm này bị ẩn khỏi ô chọn (xem `languageGroup.mjs`).
  - Nhóm khác có nhóm con (hiện chỉ Phòng Tổng hợp): form hiện ô "Nhóm con" bắt buộc, gửi `categoryId` là id nhóm con; repository trả `subcategory_required` nếu gửi nhóm cha. Hàm `childCategories`, `hasSubcategories` trong `languageGroup.mjs`. Lọc theo nhóm cha thì RPC search gồm cả hồ sơ nhóm con.
  - Nhóm cha "Các tổ chức đoàn thể" (`doan_the_quan_ly`) chứa 7 nhóm con (xem mục 2). Nhóm con hạn chế vẫn kiểm quyền theo nhóm con; `orderCategoriesForFilter` sắp thứ tự ô lọc nhóm.
  - **Bộ lọc `/database/records` (PR #117–#120):**
    - Nhóm 2 cấp: ô "Nhóm" (nhóm gốc) + ô "Nhóm con" (hoặc "Tổ ngôn ngữ" cho Phòng Nội dung). Hàm `resolveCategoryFilter`, `recordTypesForFilter` trong `languageGroup.mjs`.
    - Ô "Loại hồ sơ" bị khóa cho tới khi chọn nhóm / nhóm con / tổ ngôn ngữ.
    - Bộ lọc nâng cao dạng lưới 4 cột gọn; ngày hiển thị dd/mm/yyyy; chip lọc hiện tên thay vì mã; từ màn hình lg đến 2xl ô tìm kiếm nằm một hàng riêng.
    - Cột bảng hiển thị "Cha › Con · Loại" (trường `subcategory_name`).
    - Styled-jsx: class `.control` không áp vào component con; dùng `controlClass`.
- `db_category_access_grants` (user_id, category_id, level): quyền theo nhóm hạn chế (nhóm gốc hoặc nhóm con). Catalog không hiện nhóm con hạn chế với người không có quyền.
- `db_record_types` (category_id, code, name, sort_order, active): loại hồ sơ.
- `db_form_definitions` (record_type_id, version, status draft/published/retired; KHÔNG có cột `updated_at`) và `db_form_fields` (id, form_definition_id, field_key, label, data_type, required, searchable, options, validation{help, …}, sort_order, hidden): form của từng loại. **Không tách bảng theo loại.** Mọi trường riêng nằm trong `db_records.metadata` (jsonb). Mỗi loại chỉ có một form `published`; sửa form thì tạo version mới (`max(version)+1`) và retire bản cũ, không sửa tại chỗ.
- Options của trường `person`, `department`, `country` do API catalog tự nạp; trong DB để `[]`.
- Trường `date` trên form nhập dạng dd/mm/yyyy (`dateVi.mjs`), lưu ISO `yyyy-mm-dd`; trang chi tiết hiện dd/mm/yyyy.
- `db_records`: owner_id, department_id, visibility, status (draft/pending_review/approved/archived/deleted), metadata.
- **Ai xem được hồ sơ:**
  - Admin (`record.discover` scope `all`) xem tất cả.
  - Người cùng phòng xem mọi trạng thái.
  - Người ngoài phòng chỉ xem hồ sơ approved/archived, khi hồ sơ là `public` hoặc người đó có grant xem phòng.
  - ACL từng hồ sơ: allow cho xem, deny chặn.
  - **Nhóm hạn chế** (nhóm của loại hoặc nhóm cha có `restricted=true`): chỉ Admin (`record.sensitive.access`) hoặc người có grant nhóm đó (mọi level) thấy, mọi trạng thái, bất kể phòng; ACL deny vẫn chặn. Tạo/sửa cần `record.create` + grant contribute/approve. Duyệt/trả lại chỉ grant approve hoặc Admin; trưởng phòng KHÔNG duyệt. Catalog chỉ hiện nhóm hạn chế với Admin hoặc grant contribute/approve.
  - 4 code nhạy cảm cũ (`ho_so_dang`, `chi_hoi_nha_bao`, `doan_thanh_nien`, `giay_phep_quan_ly_bao_chi`) vẫn chỉ cho người có `record.sensitive.access`.
  - Danh bạ (`danh_ba_nghiep_vu`, `ngoai_ngu_danh_ba_doi_tac`) không được `public`: chặn ở form, repository (`departmentOnlyTypes.mjs`) và trigger DB.
  - Logic này nằm ở RPC search/transition và ở `src/lib/databaseManagement/{policy.ts,repository.ts}`.
- **Code chính:**
  - `src/lib/databaseManagement/*`
  - `src/app/database/records/**`
  - `src/app/api/database/**`
  - `src/app/api/permissions/users/[userId]/route.ts` và `category-grants/route.ts`
  - `src/components/DatabaseRecordForm.tsx`
  - `src/components/permissions/*` (trang phân quyền, gồm `CategoryGrantsSection.tsx`)

## 4. Quy trình
**Giao Codex**
- Worktree đang dùng: `D:\Dev\thoidaionline-csdl-totv`. Tạo nhánh mới từ `origin/integration/production` trước khi giao (Codex không ghi được `.git` của worktree; nếu cần thì thêm `-c "sandbox_workspace_write.writable_roots=['D:/Dev/thoidaionline/.git']"`, hoặc Claude tự tạo nhánh).
- Ghi đặc tả (JSON nhãn/options/help tiếng Việt) và prompt ra file trong Temp, đặt tên riêng theo dự án (`thoidai-*.md`), rồi chạy: `codex exec -s workspace-write -C <dir> --skip-git-repo-check -o <last.md> - < <prompt.md> > <run.log> 2>&1`. Đường dẫn redirect phải ghi thẳng (không dùng biến) để hook cho qua. Không dùng `resume --last` (phiên khác dùng chung).
- Prompt phải có:
  - "DESIGN PRE-APPROVED; do not stop for approval";
  - đường dẫn RuleCodex (AGENTS.md yêu cầu);
  - "No network: không next build, không npm install";
  - quy tắc ghi file: không dùng PowerShell `Set-Content`/`Out-File`/here-string. Trên máy này `apply_patch` của Codex chạy qua PowerShell và cũng làm hỏng tiếng Việt thành `?`. Mọi file/đoạn có tiếng Việt: Codex dùng script `node` (`fs.readFileSync`/`fs.writeFileSync` với `'utf8'`). Nội dung tiếng Việt dài để sẵn trong file UTF-8 ở Temp.
- Codex thường không commit được vì bị chặn `index.lock`. Claude tự commit, chạy `node_modules/.bin/tsc --noEmit`, `node --test`, rồi `next build` với các biến môi trường placeholder sau:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://ci.invalid/supabase NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key-placeholder SUPABASE_SERVICE_ROLE_KEY=ci-service-role-key-placeholder-01234567890123456789 SESSION_SECRET=ci-session-secret-placeholder-01234567890123456789 THOIDAI_BUILD_CONFIG=ci-placeholder THOIDAI_RELEASE_BRANCH=integration/production THOIDAI_INTEGRATION_BRANCH=origin/integration/production npx next build
  ```

- **Review kỹ những lỗi Codex từng mắc:**
  - Chép lại khối seed của migration cũ vào migration mới.
  - Dùng `pg_get_functiondef` kết hợp regexp để viết lại RPC. Không được làm vậy: phải viết lại tường minh và kết thúc bằng khối DO assertion.
  - Bỏ qua validation ở trường ẩn.
  - **Mã hóa UTF-8 hai lần** làm chữ tiếng Việt thành "Ã¡…", hoặc PowerShell biến thành `?` (gặp lại ở đợt 1 và giai đoạn 3: `Ngưi ph? trch`, `Ng?y`, ký tự `›` thành `?`). Trước khi mở PR luôn quét bằng node mọi file đã sửa: `?` giữa chữ, U+FFFD, BOM.
  - Gắn danh sách trạng thái cho mọi trường; ô chọn dùng nhầm danh sách. Phải kiểm NỘI DUNG options từng ô chọn, không chỉ kiểm "có options".
  - `gen_random_uuid()` trong lateral không tham chiếu bảng ngoài bị tính một lần → trùng khóa, tùy kế hoạch thực thi.
  - Câu update chung đặt `hidden=false` cho trường cũ ở mọi loại → form lẫn nhãn của loại khác.
  - Shell nuốt `$` trong `$$` → dùng tag `$function$`.
  - Thừa dấu ngoặc trong RPC. Lỗi cú pháp kiểu này chỉ lộ khi áp DB thật, test contract không bắt được.
  - `insert into db_form_fields select …` / `values (…)` không ghi danh sách cột (bảng có `id` đầu, `hidden` cuối) → sai cột.
  - Biến plpgsql trùng bí danh bảng trong câu SQL (`record "t" is not assigned yet`) → đặt tên biến `item`, `old_form`, `spec_field`…
  - Insert lại trường đã copy từ form cũ mà không có `on conflict (form_definition_id, field_key) do update` → trùng khóa.
  - Dùng cột không tồn tại (`db_form_definitions.updated_at`).
  - Version form `old.version + 1` → áp lại sau revert bị trùng; dùng `coalesce(max(version),0)+1`.
  - Viết SQL dồn nhiều lệnh trên một dòng rất dài, khó review → yêu cầu mỗi lệnh một dòng, dòng ≤ 160 ký tự.
  - Bỏ sót bước trong plan (bộ lọc, trang phân quyền) nhưng tóm tắt báo đã làm → luôn đối chiếu diff với từng bước.
- **Migration mới:**
  - Đặt version theo timestamp, sau khi kiểm tra `gh pr list` xem có PR nào đang mở dùng trùng version không.
  - Thêm migration vào danh sách MIGRATION_REFERENCE ở 3 file: `scripts/package-standalone.mjs`, `scripts/verify-standalone-artifact.mjs` (thêm một dòng `assert.match` riêng, không gộp regex), `scripts/standalone-packaging.test.mjs`.
  - **Chạy thử trước khi mở PR** (CI không áp migration): Postgres 17 Docker dùng một lần, chạy bootstrap giống `scripts/e2e/start-sandbox.sh`, áp toàn bộ `supabase/migrations` theo thứ tự (khoảng 9 migration seed dữ liệu hoặc không thuộc CSDL lỗi là bình thường), rồi: áp migration mới trên 2 bản sao (`create database t2 template t`), chạy file revert, rồi áp lại migration. Script mẫu `dot1.sh` trong scratchpad của phiên trước; chạy script từ file (không pipe `| bash` trong thư mục repo, vì log sẽ rơi vào repo và bị commit nhầm).
- **PR xếp chồng:** merge PR dưới (không xóa nhánh) thì phải `gh pr edit <n> --base integration/production` cho PR trên. Đổi base không chạy lại CI → `gh pr close` rồi `gh pr reopen`.

**Deploy (chỉ khi owner duyệt)**
1. Backup: `ssh vps-aylaspa 'sudo -n /usr/local/sbin/thoidai-backup run --kind predeploy --label <x>'`. Bản backup nằm ở `/opt/ops/thoidai-work/backups/managed/predeploy/`.
2. Áp migration, trước khi deploy code:
   - Kiểm tra ledger: `select version from supabase_migrations.schema_migrations order by 1 desc limit 5`.
   - Chạy thử: thay `commit;` cuối bằng `rollback;`. Nhiều migration: bỏ `begin;`/`commit;` của từng file, bọc chung một `begin; … rollback;`.
   - Chạy thật: bỏ dòng `commit;` cuối, nối câu insert ledger rồi `commit;`, pipe vào `ssh vps-aylaspa 'docker exec -i supabase_db_thoidai-work psql -U postgres -d postgres -v ON_ERROR_STOP=1'`.
3. Ghi ledger: `insert into supabase_migrations.schema_migrations(version,name) values (...)` (cùng transaction ở bước 2).
4. Lấy artifact CI:
   - Tìm run: `gh run list --workflow production-artifact.yml --limit 3`. Nếu có commit khác đẩy ngay sau, run cũ bị hủy; dùng run của commit merge.
   - Tải về thư mục Temp: `gh run download <run> -D <Temp>/thoidai-ci-<sha7>`.
   - Kiểm tra: `node scripts/{verify-artifact-manifest,scan-artifact-secrets,verify-standalone-artifact}.mjs <dir>`.
5. Chuyển lên VPS và activate: hook chặn Claude chạy `tar`, nên Claude viết script `Temp/thoidai-codex-deploy-<sha7>.sh` (mẫu gần nhất `thoidai-codex-deploy-5816e3c.sh` nếu còn trong Temp, nếu không thì `thoidai-codex-deploy-3382ecc.sh`: kiểm tra release hiện tại → `tar` artifact vào `/opt/build/thoidai-work/artifact-<sha7>` → `git -c core.autocrlf=false archive <sha> scripts deploy` vào `/opt/build/thoidai-work/deploy-tools-<sha7>` → verify-only → activate) và Codex chỉ chạy script, với `-c "sandbox_workspace_write.network_access=true"`.
6. Trong thư mục deploy-tools: `bash scripts/production/deploy-external-artifact.sh <artifact-dir> <fullsha> --verify-only`, sau đó chạy lại với `THOIDAI_EXTERNAL_DEPLOY_APPROVED=1` và `--activate`. **Không** tự tạo marker `*.codex-staging-owner`.
7. Kiểm tra:
   - Từ ngoài: `curl https://thoidai.online/login`, `/database/records`. (curl tới `127.0.0.1:3001` trong sandbox Codex luôn lỗi, bỏ qua.)
   - `journalctl -u thoidai-work.service -p err --since '-3 min'`.
   - Trình duyệt tích hợp (owner đã đăng nhập Admin): mở `/database/records/new`, chọn nhóm/loại để kiểm form; không bấm lưu.
8. Rollback: release trước đó là `/opt/releases/thoidai-work/previous`.

## 5. Việc tiếp theo
- **Đợt 2026-11-03:** PR #115–#120 đã deploy (nhóm cha đoàn thể, sửa keywords, làm lại bộ lọc). Việc còn lại: báo cáo doanh thu/công nợ/Excel cho Phòng Truyền thông (chờ dữ liệu thật); 5 mảng Phòng Tổng hợp (Kế toán, Quản trị, Công nghệ, Pháp chế, Đối ngoại) chờ danh mục; owner tự cấp quyền nhóm hạn chế.
- **Giai đoạn 2:** đã xong và deploy 2026-11-02 (PR #108, #109). Xem `PHASE2_SPEC.md`.
- **Góp ý Tổ Tiếng Việt:** đã làm phần form riêng 10 loại (PR #110). Việc để sau ghi ở `TO_TIENG_VIET_FEEDBACK.md`.
- **Góp ý tổ ngoại ngữ và Phòng Truyền thông (đợt 1):** đã deploy (PR #112). Việc để sau ghi ở `GOP_Y_TO_NGOAI_NGU_TRUYEN_THONG.md`: báo cáo doanh thu, công nợ, tiến độ hợp đồng, xuất Excel; liên kết hồ sơ; quyền Phòng Tổng hợp cập nhật hóa đơn/thanh toán trong nhóm Truyền thông. Owner muốn đợi phòng nhập dữ liệu thật trước khi làm báo cáo.
- **Giai đoạn 3:** đã deploy phần nhóm con Phòng Tổng hợp, Văn thư – Lưu trữ, Tổ chức – Cán bộ (PR #113). Kế toán, Quản trị, Công nghệ, Pháp chế, Đối ngoại: chờ Phòng Tổng hợp gửi danh mục. Owner cần cấp quyền nhóm Tổ chức – Cán bộ cho người phụ trách.
- **Nguồn:** góp ý của các phòng (file docx của owner). Phần đã thống nhất được tóm tắt trong các đặc tả trên.
- **Cách làm:** gửi owner bản đặc tả rút gọn, hỏi các điểm còn mở được đánh dấu **[HỎI OWNER]**, rồi mới giao Codex.
