export type Phase2NavigationAccess = {
  roleCode: string;
  canAssignTask: boolean;
  canEvaluateStep1: boolean;
  canEvaluateStep2: boolean;
  isDepartmentManager?: boolean;
  canManageRubrics: boolean;
  canManageUsers: boolean;
  canManagePermissions: boolean;
};

export type Phase2NavigationItem = {
  id: "assign" | "duty-schedule" | "online-work" | "online-work-admin" | "duty-roster" | "tasks" | "evaluations" | "account" | "users" | "departments"
    | "permissions" | "evaluation-rubrics" | "evaluation-cycles" | "work-schedule" | "work-schedule-leader" | "work-schedule-staff" | "work-schedule-admin";
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
  return {
    primary: [
      ...(access.canAssignTask || ["tong_bien_tap", "pho_tong_bien_tap"].includes(access.roleCode)
        ? [
            { id: "assign", href: "/tasks/assign" } as const,
          ]
        : []),
      { id: "tasks", href: "/tasks" },
      { id: "work-schedule", href: "/work-schedule" },
      { id: "work-schedule-leader", href: "/work-schedule/leadership" },
      { id: "work-schedule-staff", href: "/work-schedule/staff" },
      { id: "duty-schedule", href: "/duty-schedule" },
      { id: "online-work", href: "/online-work" },
      ...((access.canEvaluateStep1 && access.isDepartmentManager)
        || (access.roleCode === "tong_bien_tap" && access.canEvaluateStep2)
        ? [{ id: "evaluations", href: "/evaluations" } as const]
        : []),
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
