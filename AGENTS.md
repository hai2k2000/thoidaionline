## REVIEW BUDGET

- Mỗi task chỉ được tối đa 1 implementation review.
- Nếu task có migration/data/security: cho phép thêm 1 independent review.
- Tổng số review tối đa cho một task: 2.
- Không được tạo reviewer để review kết quả của reviewer khác.
- Không được tạo audit mới nếu audit hiện tại đã PASS.
- PASS là trạng thái kết thúc, không phải lý do để kiểm tra thêm.

## BẮT BUỘC ĐỌC RULECODEX TRƯỚC KHI SỬA DỰ ÁN

- Trước khi thực hiện bất kỳ chỉnh sửa nào trong dự án, mọi agent tham gia (bao gồm main agent, subagent, reviewer và validator có quyền sửa) phải truy cập repo `https://github.com/hai2k2000/rulecodex.git` và đọc đầy đủ các nguyên tắc phù hợp với nhiệm vụ.
- Tài liệu nguyên tắc chính hiện tại là `rule.md`: `https://github.com/hai2k2000/rulecodex/blob/main/rule.md`.
- Phải tuân thủ các nguyên tắc đã đọc cùng với các chỉ dẫn trong file này; nếu có nhiều tài liệu nguyên tắc phù hợp trong repo thì phải đọc đầy đủ tất cả các tài liệu đó trước khi sửa.
- Nếu chưa thể truy cập repo hoặc chưa đọc đầy đủ các nguyên tắc phù hợp, phải dừng lại, không sửa bất kỳ file/cấu hình/dữ liệu nào của dự án và báo rõ blocker cho orchestrator hoặc người dùng.

## BẮT BUỘC COMMIT VÀ PUSH SAU KHI CHỈNH SỬA

- Sau mỗi đợt chỉnh sửa đã đạt Definition of Done, agent phải chạy validation phù hợp, rà soát secret/runtime artifact, commit toàn bộ thay đổi thuộc phạm vi và push lên upstream của branch hiện tại.
- Không được báo hoàn thành khi source đã triển khai nhưng vẫn còn commit local chưa push hoặc file thuộc phạm vi còn dirty/untracked.
- Không force-push, không rewrite history và không đưa file môi trường, credential, backup, build output hoặc runtime artifact vào Git.
- Nếu push thất bại, phải báo blocker cùng bằng chứng; không được mô tả dự án là đã đồng bộ Git.

## LOCAL BUILD VÀ RELEASE LIFECYCLE

- Quy trình chính thức: Windows code/test/commit/push -> WSL2 Ubuntu với Node.js 22 Linux native build -> direct VPS transfer -> VPS verify -> owner approval -> activate.
- GitHub lưu trữ và quản lý source code; GitHub Actions không phải điều kiện bắt buộc để deploy.
- VPS chỉ verify artifact và activate; không chạy `npm ci`, `next build` hoặc build lại source trên VPS.
- Docker không bắt buộc.
- Artifact phải là Next.js standalone, có `.release-meta`, `.artifact-manifest.json`, `.artifact-manifest.sha256` và provenance/checksum verification trước khi bàn giao.
- Build phải ghi `build_config=canonical-public`; runtime secrets không được đóng gói. Artifact dùng `env_model=runtime-injected`; chỉ deployment gate được phép gắn runtime env tại thời điểm activation.
- `scripts/production/deploy-external-artifact.sh` mặc định verify-only; activation phải có owner approval và ủy quyền rõ ràng, sau đó delegate cho `deploy-gate.sh`.
- Provenance, checksum, secret scan, atomic activation, health checks, rollback protection và disk guard là bắt buộc.
- Activation uses the immutable artifact risk classification for technical checks, but authenticated smoke is optional diagnostics for every risk class. Missing smoke credentials, test accounts, controlled waivers, or RBAC smoke evidence must never block activation. High-risk changes still require their applicable static/automated auth/RBAC tests, migration/data-safety checks, artifact verification, health, rollback, and disk gates. The classifier remains fail closed for risk-specific technical requirements and manual downgrade flags are not accepted.
- Lifecycle mới giữ current/previous/rollback-1/rollback-2, bảo vệ `.keep`, evidence, references và UNKNOWN; retention chỉ dry-run cho đến khi có phê duyệt APPLY riêng.
- Mọi build/worktree mới phải có metadata; disk guard dùng hard floor 10 GiB sau estimated headroom và warning threshold 20 GiB. Không backfill metadata legacy trong Phase 1.

## VPS DISK GUARD

- Build and deploy use `deploy/disk-guard.conf` through `scripts/production/disk-guard.sh`. An explicit `THOIDAI_DISK_GUARD_CONFIG` takes precedence; otherwise the script uses the repository-local config or the canonical `/opt/thoidai-work/deploy/disk-guard.conf` fallback. Missing/invalid config fails closed.
- The hard minimum is 10 GiB free after estimated build/release headroom. The warning threshold is 20 GiB.
- Free disk below 10 GiB, or projected free disk below 10 GiB after estimated writes, is blocked. The guard must not be disabled or bypassed.

