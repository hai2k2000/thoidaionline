export function buildAttendanceSyncClaimFilter(reclaimBefore: string) {
  return `status.eq.pending,and(status.eq.completing,or(started_at.lt.${reclaimBefore},and(started_at.is.null,requested_at.lt.${reclaimBefore})))`;
}
