export type ApprovalItem = { id: string; record_code: string; title: string; updated_at: string; status: string };
export type ApprovalIssue = { item: ApprovalItem; reason: string };
export type ApprovalResult = { succeeded: ApprovalItem[]; skipped: ApprovalIssue[]; failed: ApprovalIssue[] };
export type ApprovalSummary = { count: number; issues: { code: string; reason: string }[] };
export function approvalSelection<T extends ApprovalItem>(rows: T[], approvableIds: string[], status?: string): T[];
export function runBulkApproval(items: ApprovalItem[], deps: {
  getRecord: (id: string) => Promise<{ record?: { record?: { status?: string; updated_at?: string } } }>;
  approve: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onProgress?: (current: number, total: number) => void;
}): Promise<ApprovalResult>;
export function summarizeApproval(result: ApprovalResult): ApprovalSummary;
export function createApprovalRunner(): <T>(operation: () => Promise<T>) => Promise<T | null>;
