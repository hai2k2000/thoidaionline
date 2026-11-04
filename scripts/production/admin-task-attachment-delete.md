# Admin task content editing

Source only; no production migration or activation performed.

Requirements use a JSON string array (50 entries, 2,000 characters per entry,
existing 10,000-character DB ceiling). Legacy non-array text remains verbatim.
The admin edit RPC retains existing lifecycle checks and no-deadline behavior.

Attachments use a `deleted_at` tombstone so project library foreign keys and
source metadata remain intact. The admin-only, service-role RPC locks the task
and attachment, validates the reason, hides the auto-filed library item, and
writes an audit in the same transaction. The normal library mutation rule
forbidding deletion of automatic items remains unchanged.

Storage removal follows the transaction. Failures return 503; retrying DELETE
for the same task/attachment returns its tombstone storage key without another
audit. The browser keeps the item until storage deletion succeeds. A page reload
hides tombstones; failed storage cleanup can also be retried by an administrator
using the recorded attachment ID. Existing signed URLs may remain usable until
the storage object is removed or their short expiry is reached.

Apply migration 20261106130000 before deploying the new readers. The revert SQL
removes the new RPC only, preserving tombstones/read filters to avoid resurrecting
removed files. Recovering file contents requires the storage backup; this is not
a data undelete script. Do not roll back to old readers after real deletions.

The disposable runner follows admin-edit-participants-dryrun.sh: it requires
THOIDAI_ADMIN_ATTACHMENT_DELETE_DRYRUN_APPROVED=1, BUNDLE_DIR and POSTGRES_IMAGE,
restores the verified daily backup into its own container, verifies ACLs and
real-trigger behavior, replays, reverts the endpoint and reapplies. No migration
is run against production by this script. Docker and psql are absent in the
current Windows environment; database behavior rehearsal remains outstanding.
