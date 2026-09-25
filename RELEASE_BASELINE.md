# Canonical release baseline

Production artifacts are built only from the canonical integration branch and
its checked-out commit, never from a stale feature branch. The current
production baseline is `e501652e969900b97938acccd8f998df4e5d1873`; the
permanent fix branch must merge into that integration lineage before release.

## Personal Work Schedule lineage

- `59a574f7e3844a4b1cba77829107777cbdf603f4` introduced the personal-plan approval API.
- `e634400` hardened the route and workflow.
- `0143e1bd768154391bf2a93ce0cff572e3f2a34e` restored the missing route, with validator dependency `7b33fa15562b348b40da860df6372c3c5e1ef3e4`.
- J6/J6G production lineage (`d6abcb5` through `2a1ecf5` to `e501652`) never integrated those restoration commits. No direct deletion commit exists in that lineage; the loss was stale-base/incomplete integration.

## Release gate

Run `npm run check:release` before packaging; it verifies the candidate descends
from the current production commit, is built from `integration/production`, and
checks all source routes. Run `npm run check:routes`
again after `npm run build` so the Next.js artifact manifest is checked. A
stale baseline or missing required route fails the release regardless of
TypeScript or build status.
