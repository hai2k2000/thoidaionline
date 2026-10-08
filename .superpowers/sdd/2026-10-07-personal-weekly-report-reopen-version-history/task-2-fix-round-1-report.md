# Task 2 fix round 1 report

Addressed reviewer findings:

- Removed caller-supplied `isAdmin` dependency flags. Historical report and version reads now verify active actor role and canonical `can_manage_rubrics` permission from `staff_users`/`roles` before allowing admin scope; default employee reads remain parent-report employee scoped.
- Removed `Date.now()` and browser-time 24-hour computation. Employee completed-report eligibility is now explicitly unknown until database authorization evaluates it; verified admin context remains available.
- Added executable pure behavior helpers for reopen RPC argument shape, reason normalization, bounded newest-first versions, and eligibility states. Focused test now covers four behaviors.
- Repository version reads enforce parent ownership and bound results newest-first.

Tests: `node --test src/lib/personalWeeklyReportReopenService.test.mjs` (4 passed); `git diff --check` passed. TypeScript compiler remains unavailable in this worktree.

No production deployment or database changes.
