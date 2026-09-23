export type Phase2NavigationAccess = {
  roleCode: string;
  departmentCode?: string | null;
  canAccessJournalism?: boolean;
  canAssignTask: boolean;
  canEvaluateStep1: boolean;
  canEvaluateStep2: boolean;
  isDepartmentManager?: boolean;
  canManageRubrics: boolean;
  canManageUsers: boolean;
  canManagePermissions: boolean;
  canManageJournalismStructures?: boolean;
};

export type Phase2NavigationItem = {
  id: "assign" | "attendance" | "attendance-admin" | "duty-schedule" | "online-work" | "online-work-admin" | "duty-roster" | "tasks" | "evaluations" | "account" | "users" | "departments"
    | "evaluation-summary" | "permissions" | "evaluation-rubrics" | "evaluation-cycles" | "work-schedule" | "work-schedule-leader" | "work-schedule-staff" | "work-schedule-admin" | "journalism-structures" | "journalism-reports" | "journalism-calendar";
  href: string;
};

export type Phase2Navigation = {
  primary: Phase2NavigationItem[];
  account: Phase2NavigationItem[];
  configuration: Phase2NavigationItem[];
  showEvaluationTab: boolean;
};

export function getPhase2Navigation(
  access: Phase2NavigationAccess,
): Phase2Navigation {
  const canViewAllSchedules = access.isDepartmentManager === true || ["admin", "tong_bien_tap", "pho_tong_bien_tap", "truong_phong"].includes(access.roleCode);
  const canAccessJournalism = access.canAccessJournalism === true
    && (["admin", "tong_bien_tap", "pho_tong_bien_tap"].includes(access.roleCode) || access.departmentCode === "editorial");
  return {
    primary: [
      ...(access.canAssignTask || ["tong_bien_tap", "pho_tong_bien_tap"].includes(access.roleCode)
        ? [
            { id: "assign", href: "/tasks/assign" } as const,
          ]
        : []),
      { id: "tasks", href: "/tasks" },
      ...(canAccessJournalism ? [{ id: "journalism-calendar", href: "/journalism/calendar" } as const] : []),
      ...(canAccessJournalism ? [{ id: "journalism-reports", href: "/journalism/reports" } as const] : []),
      { id: "attendance", href: "/my-attendance" },
      ...(access.roleCode === "admin" ? [{ id: "attendance-admin", href: "/attendance" } as const] : []),
      ...((access.canEvaluateStep1 && access.isDepartmentManager)
        || (access.roleCode === "tong_bien_tap" && access.canEvaluateStep2)
        ? [{ id: "evaluations", href: "/evaluations" } as const]
        : []),
      { id: "evaluation-summary", href: "/evaluation-summary" },
      { id: "work-schedule", href: "/work-schedule" },
      ...(canViewAllSchedules ? [{ id: "work-schedule-leader", href: "/work-schedule/leadership" } as const] : []),
      { id: "work-schedule-staff", href: "/work-schedule/staff" },
      { id: "duty-schedule", href: "/duty-schedule" },
      { id: "online-work", href: "/online-work" },
    ],
    account: [{ id: "account", href: "/account" }],
    configuration: [
      ...(access.roleCode === "admin" ? [{ id: "duty-roster", href: "/configuration/duty-roster" } as const, { id: "online-work-admin", href: "/configuration/online-work" } as const, { id: "work-schedule-admin", href: "/configuration/work-schedule" } as const] : []),
      ...(access.roleCode === "admin" && access.canManageUsers
        ? [
            { id: "users", href: "/users" } as const,
            { id: "departments", href: "/departments" } as const,
          ]
        : []),
      ...(access.roleCode === "admin" && access.canManagePermissions
        ? [
            { id: "permissions", href: "/permissions" } as const,
          ]
        : []),
      ...(access.roleCode === "admin" && access.canManageRubrics
        ? [{
            id: "evaluation-rubrics",
            href: "/configuration/evaluation-rubrics",
          } as const,
          {
            id: "evaluation-cycles",
            href: "/configuration/evaluation-cycles",
          } as const]
        : []),
      ...(canAccessJournalism && access.canManageJournalismStructures ? [{ id: "journalism-structures", href: "/journalism/structures" } as const] : []),
    ],
    showEvaluationTab:
      access.canEvaluateStep1 || access.canEvaluateStep2,
  };
}

export const LEGACY_TASK_REDIRECTS = {
  "/": {},
  "/tasks/active": { status: "active" },
  "/tasks/pending-review": { status: "pending_review" },
  "/tasks/done": { status: "done" },
  "/my-tasks": { type: "personal" },
  "/planning": { type: "personal" },
  "/planning/reports": { type: "personal", scope: "managed" },
  "/performance": { view: "evaluations" },
} as const;

export type LegacyTaskRoute = keyof typeof LEGACY_TASK_REDIRECTS;

export function buildLegacyTaskRedirect(
  path: LegacyTaskRoute,
  rawSearch = "",
): string {
  const search = new URLSearchParams(
    rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch,
  );
  const canonical = LEGACY_TASK_REDIRECTS[path];

  for (const [key, value] of Object.entries(canonical)) {
    search.set(key, value);
  }

  const query = search.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

export type LegacySearchParams = Record<
  string,
  string | string[] | undefined
>;

export function buildLegacyTaskRedirectFromParams(
  path: LegacyTaskRoute,
  params: LegacySearchParams,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else if (value !== undefined) {
      search.append(key, value);
    }
  }
  return buildLegacyTaskRedirect(path, search.toString());
}
