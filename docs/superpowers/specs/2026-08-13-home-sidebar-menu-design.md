# Home Sidebar Menu Design

Date: 2026-08-13
Project: thoidai.online / `/opt/thoidai-work`
Status: Approved through the user's pre-approved recommended option

## Objective

Temporarily simplify the shared home/sidebar navigation without removing routes,
data, permissions, or underlying modules.

## Design

- Keep the existing navigation group keys, routes, permission checks, and page
  implementations unchanged.
- Exclude the `assets` and `docs` groups at the final sidebar rendering filter.
  Direct URLs remain available to authorized users.
- Change only the `admin` display label from `Qu?n tr? ph?n m?m` to `C?u h?nh`.
- Store the open parent group as one nullable group key. Clicking a closed parent
  opens it and replaces any prior key; clicking the open parent sets the key to
  null.
- Initialize the open key from the current route among visible groups. Routes
  belonging only to hidden groups leave all parents closed.
- Render child links only for the open group. Keep the existing mobile menu and
  link behavior unchanged.

## Components

- `src/components/appNavState.ts` owns navigation configuration and pure route /
  accordion helpers.
- `src/components/AppNav.tsx` retains permission filtering and rendering, and
  consumes the pure helpers.
- `src/components/appNavState.test.mjs` exercises the hidden groups, display
  label, exclusive toggle behavior, and route-based initialization.

## Verification

Use Node's built-in test runner with TypeScript stripping for the focused
behavior test. Then run ESLint, TypeScript checking, the production Next.js
build, `git diff --check`, service health checks, local/public HTTP checks,
and an HTML response check that confirms the removed labels are absent while
`C?u h?nh` is present.

## Rollback
