# Production Stabilization Design

Date: 2026-07-31
Project: thoidai.online / `/opt/thoidai-work`
Status: Approved by user direction to select the recommended option without further questions

## 1. Objective

Create a recoverable, clean, documented production baseline without downtime or behavior changes. Preserve all server-side work, separate source from generated and sensitive artifacts, and establish a zero-downtime release path for later security and feature work.

This design covers stabilization only. Authentication replacement, restrictive RLS, missing attendance/push functionality, and notification hardening will be handled in separate designs after this baseline is complete.

## 2. Current Baseline

- Production source is `/opt/thoidai-work` on branch `main`.
- Local `main` is 37 commits ahead of `origin/main`.
- The worktree contains tracked modifications, a tracked deletion, and many untracked source, migration, mobile, backup, release, and generated files.
- The running Next.js build was generated on 2026-03-25 and is served by `thoidai-work.service` on port 3001.
- Nginx serves `thoidai.online` and proxies `/supa/` to the self-hosted Supabase stack on port 54331.
- PostgreSQL and Supabase run in Docker. The application database currently has four recorded migrations.
- The server does not contain a project `AGENTS.md` or Memory Bank.
- Production must remain available throughout stabilization.

## 3. Approaches Considered

### 3.1 Recommended: Preserve, classify, and rebuild cleanly

Treat the complete server state as authoritative. Create independent recovery artifacts, classify every dirty path, commit legitimate project content in focused commits, and perform all verification in an isolated worktree.

Benefits:

- Preserves work that exists only on the server.
- Makes every cleanup decision reviewable.
- Avoids changing the running application until a candidate has passed verification.
- Creates a repeatable release and rollback process.

Cost:

- Requires more inventory and verification than an in-place cleanup.

### 3.2 In-place cleanup

Edit `.gitignore`, delete artifacts, and commit directly in `/opt/thoidai-work`.

Rejected because it mixes cleanup with the production checkout and makes accidental data loss or deployment drift more likely.

### 3.3 Reset to `origin/main`

Recreate the project from GitHub and selectively restore server files.

Rejected because `origin/main` is missing 37 commits and multiple untracked project components.

## 4. Safety Artifacts

Before cleanup, create a timestamped, root-only backup set under `/opt/thoidai-backups/<UTC timestamp>/`, outside the repository. Each artifact receives a SHA-256 checksum and a manifest containing creation time, source path, Git commit, database container, and restore command.

Required artifacts:

1. Git bundle containing every current ref and commit.
2. Filesystem archive of `/opt/thoidai-work`, including untracked files but excluding reproducible heavy caches such as `node_modules`, `.next`, Flutter build output, `.dart_tool`, and Gradle caches.
3. Separate restricted archive for operational and sensitive files that must not enter Git, including environment files, signing configuration, database dumps, and existing release artifacts.
4. PostgreSQL custom-format dump of the `thoidai-work` database.
5. Copies of the active Nginx site, systemd unit/drop-in, and non-secret Supabase configuration.

The backup directory must be owned by root and mode `0700`; sensitive files must be mode `0600`. Backups are never stored inside the Git worktree.

## 5. Git Recovery and Classification

Create a safety ref before changing tracked content. The exact filesystem snapshot remains the ultimate recovery source; Git records only non-secret, maintainable project content.

Classify dirty paths as follows:

### 5.1 Commit as project content

- Web and Flutter source code.
- Database migrations and seed scripts that are reviewed and intentionally retained.
- Project documentation, rollout notes, `AGENTS.md`, and Memory Bank.
- Logos, icons, and other source assets.
- Supabase configuration that contains no credentials.
- Dependency manifests and lockfiles.

### 5.2 Ignore as reproducible output

- `.next/`, `node_modules/`, Flutter `build/`, `.dart_tool/`, `.gradle/`, and local platform files.
- TypeScript and package-manager caches.
- Generated APK/AAB artifacts unless release retention is explicitly required outside Git.

### 5.3 Store outside Git

- `.env.local`, `.env.production`, private keys, keystores, `key.properties`, service-role keys, database dumps, and operational backups.
- Release binaries and server backup archives.

### 5.4 Review before inclusion

- Standalone SQL files not represented in `supabase/migrations`.
- Documentation whose status conflicts with the current code.
- Deleted deployment files such as `vercel.json`.
- Generated Android project files that may contain machine-specific paths.

Cleanup commits must be focused and ordered: ignore rules and secret hygiene, infrastructure/migrations, web source, mobile source, documentation/Memory Bank, then release automation.

## 6. Isolated Working Model

The production checkout remains untouched while cleanup and verification occur.

- Create a dedicated stabilization branch from current `main`.
- Create an isolated worktree under `/opt/thoidai-worktrees/production-stabilization`.
- Perform classification, commits, tests, and candidate builds only in that worktree.
- Never run concurrent heavy builds across repositories on this host.
- Check available memory and swap before Next.js or Flutter builds.

The original `/opt/thoidai-work` checkout remains the active rollback source until the new release is promoted.

## 7. Project Guidance and Memory Bank

Add a root `AGENTS.md` containing authoritative working rules:

- Preserve user and production changes; never reset or delete without a verified backup.
- Use isolated worktrees for feature and release work.
- Do not commit secrets, local build products, release binaries, or database dumps.
- Apply database changes through ordered migrations with rollback notes.
- Run builds sequentially and observe memory limits.
- Deploy through the blue/green process and verify health before traffic switching.
- Keep UI copy in Vietnamese and follow existing role/status/data naming conventions.

Add `memory-bank/` with:

- `projectbrief.md`: product purpose and supported modules.
- `productContext.md`: users, workflows, and Vietnamese UI expectations.
- `systemPatterns.md`: Next.js, Supabase, client/service boundaries, roles, and deployment topology.
- `techContext.md`: versions, commands, ports, environment-variable names, and resource limits.
- `activeContext.md`: current stabilization phase and immediate constraints.
- `progress.md`: implemented features, incomplete database objects, security backlog, and release status.

Memory Bank records facts and current state, not secrets or personal data.

## 8. Zero-Downtime Release Architecture

Use two persistent application slots:

- Blue slot: `thoidai-work-blue.service` on port 3001.
- Green slot: `thoidai-work-green.service` on port 3002.

Each slot runs from an immutable timestamped release directory. Nginx proxies to the active slot. A deployment builds and starts the inactive slot, verifies it, switches Nginx gracefully, and retains the previous slot for immediate rollback.

Release flow:

1. Create a release directory from a verified Git commit.
2. Install dependencies from the lockfile and build Next.js in that release.
3. Start the inactive systemd slot with its assigned port and memory guard.
4. Verify the local app, static assets, login page, API health, and Supabase connectivity.
5. Update only the Nginx upstream target.
6. Run `nginx -t`; abort on any error.
7. Reload Nginx gracefully. Existing connections continue on the old workers.
8. Verify the public domain and key routes.
9. Keep the old slot running for a 15-minute observation window.
10. Roll back by switching Nginx to the previous slot and reloading.

No deployment may overwrite the active release directory.

## 9. Database Rules During Stabilization

- Take a fresh database dump before any migration.
- Use transactional migrations where PostgreSQL permits.
- Stabilization migrations must be additive and backward-compatible with the active build.
- Do not drop columns, remove permissive policies, rewrite authentication, or require new application fields in this phase.
- Compare the migration files with `supabase_migrations.schema_migrations` and document unapplied SQL.
- Validate migrations against a restored disposable database before production.

Attendance, push-token, authentication, and restrictive RLS migrations remain backlog items until their dedicated designs are approved.

## 10. Failure Handling and Rollback

- Backup failure: stop before any cleanup.
- Checksum mismatch: discard the affected artifact and recreate it.
- Dirty-path ambiguity: preserve the path in the restricted snapshot and leave it uncommitted until classified.
- Build or lint failure: do not create a release candidate.
- Candidate health failure: stop the inactive slot; active production remains unchanged.
- Nginx validation failure: do not reload.
- Public verification failure after switching: immediately restore the previous upstream and reload Nginx.
- Database verification failure: do not apply the migration to production.

Every operational script must use explicit absolute paths and fail on errors.

## 11. Verification Strategy

### 11.1 Backup verification

- Verify all expected artifacts exist with restrictive permissions.
- Validate Git bundle integrity.
- List filesystem archive contents.
- Run `pg_restore --list` against the database dump.
- Restore the dump into a timestamped disposable database, verify the expected public tables and migration rows, then remove only that disposable database after verification.

### 11.2 Repository verification

- Confirm the stabilization worktree is clean after commits.
- Scan tracked files for known secret filenames and credential patterns.
- Confirm generated output and sensitive files are ignored.
- Compare the classified inventory against the original dirty status so no path is silently lost.

### 11.3 Application verification

- Run the project lint command.
- Run a production Next.js build.
- Verify TypeScript through the production build.
- Run Flutter analysis separately from the web build.
- Verify the current public site before and after any traffic switch.

### 11.4 Infrastructure verification

- Validate systemd units.
- Validate Nginx configuration.
- Verify both local slot ports and the public HTTPS endpoint.
- Verify `/supa/rest/v1/` responds through Nginx.
- Confirm memory limits and service restart policies.
- Exercise the rollback switch once before declaring the release process ready.

## 12. Acceptance Criteria

Stabilization is complete only when:

1. Recovery artifacts and checksums exist outside the repository with correct permissions.
2. Every originally dirty path is classified and preserved, committed, or intentionally ignored.
3. No secret, database dump, signing file, cache, or release binary is tracked.
4. The canonical stabilization branch and worktree are clean.
5. `AGENTS.md` and all six Memory Bank files exist and reflect production accurately.
6. Web lint and production build pass from the clean worktree.
7. Flutter analysis passes or every pre-existing failure is documented without blocking web stabilization.
8. Blue and green slots can run independently.
9. Nginx can switch between slots with no observed downtime.
10. Public HTTPS and Supabase proxy health checks pass after switching.
11. The previous slot remains usable for rollback.
12. No production database behavior or authentication behavior changes in this phase.

## 13. Follow-up Designs

After stabilization, create separate specs in this order:

1. Authentication migration, password removal, authenticated sessions, restrictive RLS, protected APIs, and secure uploads.
2. Attendance schema and workflows, mobile push-token schema, Firebase delivery, and systemd notification timers.
3. Server Action noise/error handling, operational monitoring, backup retention, and remaining documentation corrections.
