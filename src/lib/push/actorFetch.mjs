const mutationNames = new Set([
  'api_create_task', 'api_assign_task_v2', 'api_assign_task_batch_v1', 'api_admin_set_task_participants',
  'api_assign_project_task', 'api_assign_journalism_task_v1', 'api_register_journalism_task_v1',
  'api_assign_department_plan_task_v2', 'api_quick_assign_department_plan_task_v1',
  'api_create_department_plan_task', 'api_create_department_plan_task_v2',
  'api_create_department_plan_v2', 'api_create_department_plan_v2_result', 'api_close_department_plan_v2',
  'api_add_task_comment', 'api_update_task', 'api_admin_edit_task', 'api_claim_task_plan', 'api_approve_task_claim',
  'api_create_personal_task_v2', 'api_complete_personal_task', 'api_cancel_personal_task',
  'api_create_quick_report_v1', 'api_report_task_progress', 'api_submit_task_progress_report',
  'api_submit_assigned_task_completion', 'api_score_task_completion', 'api_review_assigned_task_completion',
  'api_review_task_completion', 'api_cancel_assigned_task', 'api_create_bulk_task_plan',
  'api_save_monthly_duty_roster', 'api_run_task_recurrence',
]);

// This server-only client's arguments already came through the business guard.
// Decorating fetch preserves Supabase's lazy, chainable RPC builders.
export function withPushActor(fetchImpl, kickPushDispatcher = () => {}) {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(url).pathname;
    const rpc = init.method?.toUpperCase() === 'POST' && pathname.includes('/rpc/');
    if (rpc && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const actor = body.p_actor_id ?? body.p_actor;
        if (typeof actor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor)) {
          const headers = new Headers(init.headers);
          headers.set('x-thoidai-push-actor', actor);
          init = { ...init, headers };
        }
      } catch { /* Leave non-JSON requests unchanged. */ }
    }
    const response = await fetchImpl(input, init);
    if (response.ok && rpc && mutationNames.has(pathname.split('/').at(-1))) {
      try { kickPushDispatcher(); } catch { /* Queue polling survives a failed kick. */ }
    }
    return response;
  };
}
