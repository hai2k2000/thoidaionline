import "server-only";

import { serverSupabase } from "@/lib/serverSupabase";

export type ApprovalPermission = {
  scopes: string[];
  source: string;
};

export type ApprovalCapabilities = {
  "leave.approve": ApprovalPermission;
  "schedule.business.approve": ApprovalPermission;
  "schedule.event.approve": ApprovalPermission;
  leaveLongTbt: boolean;
  personalWorkLegacy: boolean;
};

const emptyPermission = (): ApprovalPermission => ({ scopes: [], source: "none" });

export async function getApprovalCapabilities(actorId: string): Promise<ApprovalCapabilities> {
  const { data, error } = await serverSupabase.rpc("api_get_approval_capabilities", { p_actor: actorId });
  if (error) throw error;
  const value = (data ?? {}) as Partial<ApprovalCapabilities>;
  return {
    "leave.approve": value["leave.approve"] ?? emptyPermission(),
    "schedule.business.approve": value["schedule.business.approve"] ?? emptyPermission(),
    "schedule.event.approve": value["schedule.event.approve"] ?? emptyPermission(),
    leaveLongTbt: value.leaveLongTbt === true,
    personalWorkLegacy: value.personalWorkLegacy === true,
  };
}

export function canReviewAnyLeave(caps: ApprovalCapabilities): boolean {
  return caps["leave.approve"].scopes.length > 0 || caps.leaveLongTbt;
}

export function canReviewAnyPersonalPlan(caps: ApprovalCapabilities): boolean {
  return caps["schedule.business.approve"].scopes.length > 0
    || caps["schedule.event.approve"].scopes.length > 0
    || caps.personalWorkLegacy;
}
