# VPS disk guard

Build and deployment share the centralized configuration in `deploy/disk-guard.conf`.

- Free disk >= 20 GiB: PASS.
- Free disk from 10 GiB to below 20 GiB: PASS with WARNING when projected free disk remains at least 10 GiB.
- Free disk below 10 GiB: BLOCKED.
- If estimated build or release writes project free disk below 10 GiB: BLOCKED.
- Estimated headroom remains mandatory and configurable for the specific build/release.
- The disk guard never deletes backups/releases and does not bypass rollback, atomic activation, health, migration, or security gates.
