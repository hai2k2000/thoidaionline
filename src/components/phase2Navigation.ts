export type Phase2NavigationAccess = {
  roleCode: string;
  canAssignTask: boolean;
  canEvaluateStep1: boolean;
  canEvaluateStep2: boolean;
  canManageRubrics: boolean;
};

export type Phase2NavigationItem = {
  id: "assign" | "tasks" | "account" | "evaluation-rubrics";
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
      ...(access.canAssignTask
        ? [{ id: "assign", href: "/tasks/assign" } as const]
        : []),
      { id: "tasks", href: "/tasks" },
    ],
    account: [{ id: "account", href: "/profile" }],
    configuration:
      access.roleCode === "admin" && access.canManageRubrics
        ? [
            {
              id: "evaluation-rubrics",
              href: "/configuration/evaluation-rubrics",
            },
          ]
        : [],
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
