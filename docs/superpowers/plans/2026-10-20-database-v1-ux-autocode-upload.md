# Database V1 UX Autocode Upload Implementation Plan

> **For agentic workers:** Execute this plan as one cohesive hotfix on the dedicated branch; do not merge or deploy production.

**Goal:** Add server-generated Vietnamese record codes, shared field validation/editing UX, Vietnamese record screens, and multi-file upload during record creation while preserving existing ACL/storage behavior.

**Architecture:** Keep the existing record/file APIs and private storage compensation path. Add one additive PostgreSQL counter function for concurrency-safe yearly codes, make the client use a shared database record form, and orchestrate create-then-upload with per-file retry state.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase PostgreSQL migrations/RPC, Node test runner.

**Spec:** Owner-provided `THỜI ĐẠI WORK 3.0 – DATABASE MANAGEMENT V1` brief.

## Global Constraints

- Base branch is canonical `4e9da05d1308fadec77cfdf35add40f54ecdd4f1`.
- No edits to applied migrations; new migration is additive only.
- Do not change production data, VPS releases, policy, or `AGENTS.md`.
- Preserve ACL, audit, checksum, path containment, rollback compatibility, and existing asset functionality.
- Build/test in WSL2 Node 22; no production deployment in this task.

### Task 1: Atomic Code Generation

**Files:** `supabase/migrations/<new>_database_management_v1_autocode.sql`, `src/lib/databaseManagement/repository.ts`, `src/lib/databaseManagement/types.ts`, `src/lib/databaseManagement/validation.ts`, database contract tests.

- Add a yearly counter table and `api_next_database_record_code()` using a transaction-safe upsert/returning pattern and Vietnam year.
- Generate `HS-YYYY-NNNNNN` server-side during create; ignore client-provided code for creation and never update code in the edit flow.
- Add tests for missing/spoofed code, format, uniqueness contract, and immutable update behavior.

### Task 2: Shared Form and Validation UX

**Files:** shared database form component, new/edit pages, UI contract tests.

- Render labels from published form definitions, required `*`, Vietnamese field errors, summary error, first-error focus, and no duplicate submits.
- Reuse the same metadata controls for create and edit; keep technical keys out of visible labels.
- Render Vietnamese statuses, date formatting, select labels, and safe person/department names from catalog options.

### Task 3: Create-Time Multi-File Upload

**Files:** new page/form component, upload orchestration helper/tests.

- Validate PDF/DOC/DOCX/XLS/XLSX and 50 MiB before submit.
- Create once, upload each selected file through the existing record file endpoint, preserve per-file status, and retry only failed files.
- Report partial success without deleting the record or creating a second record.

### Task 4: Detail/Edit and Regression Verification

**Files:** detail page, focused tests.

- Allow permitted metadata edits with server validation and immutable code display.
- Preserve existing files and ACL-gated download/upload behavior.
- Run focused tests, TypeScript, build, standalone verification, secret scan, and regression suites; record any pre-existing lint errors.
