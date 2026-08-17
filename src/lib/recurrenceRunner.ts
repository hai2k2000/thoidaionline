import "server-only";

import { timingSafeEqual } from "node:crypto";
import { apiError, apiJson } from "@/lib/serverApi";
import { serverSupabase } from "@/lib/serverSupabase";

const same = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function runTaskRecurrence(request: Request) {
  const configured = process.env.RECURRENCE_RUNNER_SECRET;
  const supplied = request.headers.get("x-recurrence-secret") ?? "";
  if (!configured || configured.length < 32 || !same(configured, supplied)) {
    return apiError("forbidden", 403);
  }
  const { data, error } = await serverSupabase.rpc("api_run_task_recurrence", {
    p_run_on: null,
  });
  return error
    ? apiError("operation_failed", 500)
    : apiJson({ created: data });
}
