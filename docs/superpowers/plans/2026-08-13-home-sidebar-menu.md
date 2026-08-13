# Home Sidebar Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the asset/document sidebar groups, rename the admin display label, and make child menus an exclusive accordion.

**Architecture:** Extract navigation configuration and pure state helpers into a small TypeScript module. Keep authorization filtering and visual rendering in `AppNav`, with one nullable state value controlling the only open group.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, ESLint, systemd.

---

### Task 1: Add focused behavior tests

**Files:**
- Create: `src/components/appNavState.test.mjs`

- [ ] Write assertions that the rendered group configuration excludes `assets`
  and `docs`, and that the admin display label is `Cấu hình`.
- [ ] Write assertions that clicking the open group closes it and clicking a
  different group replaces the prior open group.
- [ ] Write assertions that a visible current route opens its group while a
  route in a hidden group opens none.
- [ ] Run:
  `node --experimental-strip-types --test src/components/appNavState.test.mjs`
  and verify failure because `appNavState.ts` does not exist.

### Task 2: Implement minimal navigation state

**Files:**
- Create: `src/components/appNavState.ts`
- Modify: `src/components/AppNav.tsx`

- [ ] Move the existing group configuration and route matching helper into
  `appNavState.ts`.
- [ ] Add the final visibility predicate, exclusive toggle helper, and
  route-based initial group helper.
- [ ] Filter hidden groups after the existing permission mapping.
- [ ] Replace parent labels with buttons and conditionally render children for
  the single open group.
- [ ] Run the focused test and verify all assertions pass.

### Task 3: Verify, deploy, and publish

**Files:**
- Verify only the five task files listed in this plan.

- [ ] Run the focused test, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
