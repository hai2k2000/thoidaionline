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

## VPS-FIRST DEPLOYMENT PROFILE

- `deployment_profile: thoidai-work-vps-first` (canonical RuleCodex 1.2.0 exception for Thời Đại Work only).
- Authorized target: SSH alias `vps-aylaspa`; source workspaces live under `/opt/worktrees` or `/opt/build`, never in the active release.
- Immutable release root: `/opt/releases/thoidai-work`; activation target is the `current` pointer, with `previous`, `rollback-1` and `rollback-2` protected.
- Service/health target: `thoidai-work.service` and `http://127.0.0.1:3001/login`.
- The authorized VPS source workspace performs test/package operations with the compatible Node.js 22 toolchain. WSL2, GitHub Actions, PRs, external artifact transfer and cross-machine lineage are not deployment prerequisites.
- The canonical entry point is `scripts/production/deploy-vps-first.sh`; it delegates immutable release activation to the existing `deploy-gate.sh` and never edits the active release during build.
- Every VPS-local release must include `.release-meta`, `.artifact-manifest.json`, `.artifact-manifest.sha256`, source/dirty-tree/toolchain provenance and a secret scan before verification.
- Runtime secrets remain on the VPS and are linked only by the existing activation gate; they never enter the release artifact, Git, logs or reports.
- `scripts/production/deploy-external-artifact.sh` and `.github/workflows/production-artifact.yml` remain archival/optional compatibility paths and are not the default Thời Đại Work deployment path.
- Activation uses the immutable artifact risk classification for technical checks, but authenticated smoke is optional diagnostics for every risk class. Missing smoke credentials, test accounts, controlled waivers, or RBAC smoke evidence must never block activation. High-risk changes still require their applicable static/automated auth/RBAC tests, migration/data-safety checks, artifact verification, health, rollback, and disk gates. The classifier remains fail closed for risk-specific technical requirements and manual downgrade flags are not accepted.
- Lifecycle mới giữ current/previous/rollback-1/rollback-2, bảo vệ `.keep`, evidence, references và UNKNOWN; retention chỉ dry-run cho đến khi có phê duyệt APPLY riêng.
- Mọi build/worktree mới phải có metadata; disk guard dùng hard floor 10 GiB sau estimated headroom và warning threshold 20 GiB. Không backfill metadata legacy trong Phase 1.

## VPS DISK GUARD

- The canonical disk guard is `deploy/disk-guard.conf`, evaluated by `scripts/production/disk-guard.sh`.
- The hard minimum is 10 GiB free after estimated build/release headroom. The warning threshold is 20 GiB.
- Free disk below 10 GiB, or projected free disk below 10 GiB after estimated writes, is blocked. The guard must not be disabled or bypassed.

## VPS-FIRST SAFETY GATES

- Owner approval is required once for the final VPS-local release before activation, restart, migration or destructive cleanup APPLY; preparatory source/build changes do not create repeated SHA approvals.
- Keep deploy lock, backup and migration/data-safety gates, checksum/provenance, atomic activation, health checks, automatic rollback, protected pointers and bounded retention.
- Verify-only must not mutate production, restart the service, apply migrations or change current/previous/rollback pointers.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
