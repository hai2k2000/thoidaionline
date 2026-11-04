# Project Library File Proxy Report

## Changed Files

| File | Purpose |
|---|---|
| `src/app/api/projects/[id]/library/file/[itemId]/route.ts` | Authorizes library files, fetches storage server-side, streams GET/HEAD, forwards Range, and never exposes Supabase URLs. |
| `src/app/api/projects/[id]/library/download/[itemId]/route.ts` | Preserves the legacy JSON contract with a same-origin attachment URL. |
| `src/lib/projectLibraryFile.ts` | Shared MIME allowlist, RFC 5987 filename headers, and bounded text streaming helper. |
| `src/components/ProjectLibrary.tsx` | Uses same-origin download anchors and adds preview/Office affordances. |
| `src/components/ProjectLibraryPreview.tsx` | Accessible native-dialog viewer for PDF, images, media, and text/CSV. |
| `src/lib/projectLibraryRoutes.test.mjs` | Updates old signed-URL expectations and adds auth/order/range/error coverage. |
| `src/lib/projectLibraryFile.test.mjs` | Adds MIME, filename, security-header, and text-cap coverage. |
| `PROJECT_STATUS.md` | Appends this change checkpoint. |

## MIME Policy

| Type | Inline | Viewer |
|---|---:|---|
| PDF | Yes | iframe |
| PNG/JPEG/GIF/WebP/AVIF | Yes | image |
| MP4/WebM/OGG/QuickTime | Yes | video |
| MPEG/MP4/AAC/OGG/WAV/WebM/x-m4a | Yes | audio |
| text/plain, text/csv | Yes | escaped `<pre>`, max 2 MiB |
| SVG, HTML, XML, JavaScript, unknown | No | attachment/octet-stream when risky |
| Office formats | No | download with Vietnamese hint |

Every inline response, including PDF, retains the requested CSP: `default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox`. No PDF exception is claimed without browser evidence. Chrome PDF viewing remains a manual verification item. All responses with bytes have `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, and ASCII plus RFC 5987 UTF-8 `Content-Disposition`. `Content-Length` is copied when supplied by storage; attachments have no inline CSP.

Office files use their stored MIME or mapped Office MIME with attachment disposition. Unknown MIME defaults to `application/octet-stream`; HTML/SVG/XML/JavaScript are always attachment/octet-stream. Text preview preserves markup as literal React text, caps reads at 2 MiB and cancels the reader.

## Range Strategy

The app creates a short-lived Supabase signed URL only on the server, forwards the request `Range` header to a server-side fetch, and copies upstream `206`, `Content-Range`, and `Accept-Ranges` metadata. The signed URL and storage path never reach the browser.

## Broken Patterns Report (unchanged by request)

- `src/lib/taskHandlers.ts:119` signs `task-private` attachments and returns the signed `/supa/` URL.
- `src/components/TaskDetailShell.tsx:133` sends `window.location.assign(payload.url)`, so the browser receives that `/supa/` URL.
- `src/app/api/tasks/duty/review/route.ts:42` redirects directly to a signed evidence URL; browser-facing `/supa/` exposure remains.
- `src/lib/serverSession.ts:107` / `src/lib/serverSession.ts:127` creates and returns signed profile-avatar URLs; the browser receives `/supa/`-backed URLs.
- `src/app/api/account/avatar/route.ts:30` returns `avatarUrl` from `createSignedUrl`; browser receives this URL: `src/components/AccountShell.tsx:13` assigns it to avatar state, used as image src. Session avatar also flows through `src/app/account/page.tsx:8` and `src/components/AppNav.tsx:166`.

## Validation

- `node --test src/lib/projectLibraryRoutes.test.mjs src/lib/projectLibrary.test.mjs src/lib/projectLibraryFile.test.mjs src/lib/projectLibraryUi.test.mjs`: 27/27 PASS.
- `npx.cmd tsc --noEmit`: PASS.
- Changed-file ESLint: PASS (0 errors/warnings). The native image element is intentional for authenticated private bytes, with a documented local lint exception.
- Exact workflow test command from `.github/workflows/production-artifact.yml`: 78/78 PASS; exact command is recorded below.
- `npm run build` with CI placeholder env: FAIL solely at offline Google Fonts fetch (Be Vietnam Pro, Geist Mono); required routes and lineage checks PASS. Existing unrelated dynamic filesystem tracing warnings also appear.

No migration, database, deployment, SSH, Docker, commit, or push was performed.

## Additional changed test files

- `src/lib/projectLibrary.test.mjs`: removes the obsolete signed-URL source assertion.
- `src/lib/projectLibraryUi.test.mjs`: renders the library with file/link/task fixtures and checks preview visibility and same-origin download anchors.

## Exact workflow Node command

```powershell
node --test scripts/artifact-provenance.test.mjs scripts/artifact-manifest.test.mjs scripts/artifact-secret-scan.test.mjs scripts/ci-build-env.test.mjs scripts/canonical-build-env.test.mjs scripts/canonical-ref-preparation.test.mjs scripts/rbac-v2-scope-hotfix.test.mjs scripts/deploy-gate.test.mjs scripts/production/controlled-deploy-exception.test.mjs scripts/production/produce-rbac-readiness.test.mjs scripts/package-standalone.test.mjs scripts/standalone-packaging.test.mjs scripts/external-artifact-contract.test.mjs scripts/artifact-roundtrip.test.mjs scripts/classify-release-risk.test.mjs
```

## Provenance, limitations and deviations

- Base/source HEAD: `b2a295c1f1050b4b658d03e625aa023ef8033a4e`; branch `fix/project-library-file-proxy`; changes intentionally uncommitted per owner instructions. Tracked originals are recoverable from HEAD. No release artifact or activation.
- RuleCodex supplied offline snapshot used instead of network access. No SSH, Docker, migration, or external viewer.
- Runtime is Windows Node v24.13.1 (CI uses Linux Node 22.22.0). No production connectivity or live browser acceptance is claimed.
- The first build omitted the CI branch override and stopped at lineage. An intermediate local attempt used the VPS-first environment flag (no remote operation); this was a process deviation and is not used as release validation. Final build restored `default-local-to-target`, `THOIDAI_RUNTIME_ENV_MODEL=runtime-injected`, `THOIDAI_BUILD_CONFIG=ci-placeholder`, `THOIDAI_RELEASE_BRANCH=integration/production`, and the workflow's non-secret placeholder environment. It passed lineage and failed only fetching Google Fonts offline. No persistent build/profile configuration changed.
- Build's built-in next/font loader attempted blocked font requests, as anticipated by the requested offline-build exception. No intentional network inspection was performed.
- Implementation preceded the first test run, rather than following strict test-first sequencing. Tests were subsequently exercised and expanded; no strict TDD claim.
- Real Chrome PDF rendering, native focus behavior and live storage seeking are not verified offline. Sandbox remains for PDF; if Chrome blocks its viewer, apply the spec's PDF-only sandbox exception after reproducing it.
- For upstream 200 responses that ignore Range, full body is streamed with status 200. HEAD forwards HEAD, returns headers without a body. Unsatisfiable upstream ranges return sanitized empty 416 with Content-Range; other storage failures return sanitized 503. Only selected content headers cross the proxy; storage cookies, URLs and paths do not.
- Task-source library items use the same authorization RPC and proxy path as manual files. No permission or schema changes.
- One main-agent implementation review; no delegated reviewer/audit loops. Scope and diff review found no other required source changes.

## Round 2 - browser Office preview and PDF CSP (2026-11-04)

This section supersedes round-1 statements that Office is download-only and PDF retains sandbox.

### Files changed in round 2

- `src/lib/projectLibraryFile.ts`: separates UI preview detection (DOCX/XLSX MIME OR extension) from the server inline allowlist; omits CSP only for inline PDF because CSP sandbox blocks Chrome's built-in PDF viewer. Other inline types keep sandbox; nosniff and private/no-store remain.
- `src/components/ProjectLibrary.tsx`: shows Xem for DOCX/XLSX and the requested download-only hint for unsupported types.
- `src/components/ProjectLibraryPreview.tsx`: dynamically loads OfficePreview with next/dynamic, renders it only for Office, and hides the new-tab action for Office while retaining download.
- `src/components/OfficePreview.tsx` (new): browser-only attachment fetch with same-origin credentials, AbortController cleanup, metadata and ArrayBuffer 15 MiB checks, loading/error states, Mammoth DOCX conversion, and ExcelJS worksheet tabs/text tables capped at 1000 rows by 50 columns. Download remains available in the parent footer on all states.
- `src/lib/officePreviewSanitize.mjs` (new): small allowlist sanitizer rebuilding document tags and safe attributes, removing scripts/handlers/unsafe or encoded URL schemes. Embedded PNG/JPEG/GIF/WebP data images survive. DOCX uses an empty iframe sandbox plus srcdoc CSP restricting images to data and disabling network resources/scripts/forms.
- `src/lib/officePreview.test.mjs` (new), `src/lib/projectLibraryFile.test.mjs`, `src/lib/projectLibraryUi.test.mjs`: sanitizer, lazy-loading, sandbox, size/row/column caps, attachment/abort, type visibility and PDF/media header contracts.
- `PROJECT_LIBRARY_FILE_PROXY_REPORT.md`, `PROJECT_STATUS.md`: appended handoff evidence.

### Lazy loading and browser compatibility

The Office component is a next/dynamic boundary with SSR disabled. Within its mounted fetch effect, only the selected parser is loaded using await import('mammoth') or await import('exceljs'); neither parser is statically imported into ProjectLibrary. The ExcelJS type-only import is erased. ExcelJS declares `browser: ./dist/exceljs.min.js`; no extra Node polyfills, dependency installation, or explicit browser-build override was needed. The requested next build reported exactly two font-fetch errors, with no Mammoth/ExcelJS resolution errors; TypeScript also resolves both imports.

XLSX cells are React text nodes from cell.text (cached formula results); merged cells may repeat values. Sticky column headings and a horizontally/vertically scrollable table preserve the bounded sheet view. DOCX reports conversion warnings subtly. Legacy DOC/XLS and PPTX remain download-only.

### Validation

- `node --test src/lib/officePreview.test.mjs src/lib/projectLibrary*.test.mjs`: 30/30 PASS.
- Exact workflow Node command recorded above: 78/78 PASS.
- `npx.cmd tsc --noEmit`: PASS.
- ESLint on all eight round-2 source/test files: PASS after renaming the existing test harness module variable.
- `git diff --check`: PASS.
- `npm.cmd run build` with workflow CI placeholders: route manifest and lineage PASS; build fails only on offline Be Vietnam Pro and Geist Mono font fetches. Existing unrelated databaseManagement filesystem tracing warnings remain. No Office module-resolution errors.
- Sanitizer encoded-URL test initially failed, then passed after switching to allowlist reconstruction. Initial UI test exposed a PowerShell/Python text-encoding issue, corrected and validated. Implementation was not fully test-first; no strict TDD claim.

### Scope and limitations

Same branch, existing round-1 work preserved; package.json and lockfile changes were already present. Offline RuleCodex snapshot used. No install, commit, push, SSH, Docker, conversion service, external viewer, database or production change. Next's font loader attempted blocked network requests as anticipated by the owner's offline-build exception; no network tool or fetch command was used. Changes intentionally remain uncommitted. No release artifact or deployment readiness is claimed. Live authenticated storage/Chrome visual acceptance remains unverified. One main-agent implementation check; no reviewer agents or additional audit loops.
