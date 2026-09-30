export type LifecycleState = "PENDING" | "APPROVED" | "CANCELLED";
export type CreatorMutationInput = {
  actorId: string | null | undefined;
  createdBy: string | null | undefined;
  isAdmin: boolean;
  state: LifecycleState | string | null | undefined;
};
export function normalizeLifecycleState(value: unknown): LifecycleState | null;
export function canEditCreatorMutation(input: CreatorMutationInput): boolean;
export function canCancelCreatorMutation(input: CreatorMutationInput): boolean;
export function taskLifecycleState(task: { status?: string | null; approvalRequired?: boolean; approval_required?: boolean; assignmentApprovedAt?: string | null; assignment_approved_at?: string | null; assignmentApprovalState?: string | null; assignment_approval_state?: string | null }): LifecycleState | null;
export function leaveLifecycleState(status: string | null | undefined): LifecycleState | null;
export function personalScheduleLifecycleState(status: string | null | undefined): LifecycleState | null;
