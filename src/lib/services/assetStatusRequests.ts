import { fail, ok, type ServiceResult, withError } from "./common";

export type AssetStatusChangeRequest = {
  id: string;
  asset_id: string;
  requester_id: string;
  requested_status: "maintenance" | "broken";
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  asset_name?: string | null;
  asset_code?: string | null;
  current_status?: string | null;
  requester_name?: string | null;
  assigned_department_name?: string | null;
  assignee_name?: string | null;
};

async function parse<T>(response: Response): Promise<ServiceResult<T>> {
  const body = await response.json().catch(() => null) as { error?: string } & T;
  return response.ok ? ok(body) : fail(body?.error || "status_request_failed");
}

export async function listMyAssetStatusRequests() {
  try { return await parse<{ requests: AssetStatusChangeRequest[] }>(await fetch("/api/assets/status-requests?mine=1", { cache: "no-store" })); }
  catch (error) { return fail(withError(error, "status_requests_read_failed")); }
}

export async function createAssetStatusRequest(assetId: string, requestedStatus: "maintenance" | "broken", reason: string) {
  try { return await parse<{ request: AssetStatusChangeRequest }>(await fetch("/api/assets/status-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_id: assetId, requested_status: requestedStatus, reason }) })); }
  catch (error) { return fail(withError(error, "status_request_failed")); }
}

export async function listPendingAssetStatusRequests() {
  try { return await parse<{ requests: AssetStatusChangeRequest[] }>(await fetch("/api/assets/status-requests", { cache: "no-store" })); }
  catch (error) { return fail(withError(error, "status_requests_read_failed")); }
}

export async function reviewAssetStatusRequest(requestId: string, decision: "approve" | "reject", reviewNote?: string) {
  try { return await parse<{ request: AssetStatusChangeRequest }>(await fetch("/api/assets/status-requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ request_id: requestId, decision, review_note: reviewNote }) })); }
  catch (error) { return fail(withError(error, "status_review_failed")); }
}
