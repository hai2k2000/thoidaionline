import { isCollaboratorRole } from "../lib/collaboratorRole.mjs";
import type { Phase2Navigation } from "./phase2Navigation";

export type MobileNavigationItem = {
  href: string;
  label: string;
  id: string;
  kind: "home" | "tasks" | "projects" | "attendance" | "more" | "menu";
};

export type MobileNavigation = {
  items: MobileNavigationItem[];
  menu: Phase2Navigation;
  showHelp: boolean;
};

export function isMobileKeyboardOpen({ baselineHeight, viewportHeight, scale, editableFocused }: {
  baselineHeight: number; viewportHeight: number; scale: number; editableFocused: boolean;
}): boolean {
  // Focus survives keyboard dismissal; browser chrome and pinch zoom also resize the viewport.
  return editableFocused && Math.abs(scale - 1) < 0.05
    && baselineHeight - viewportHeight > Math.max(150, baselineHeight * 0.2);
}

export function isVisibleMobileOverlay(element: Element, getStyle: (node: Element) => CSSStyleDeclaration): boolean {
  if (element.closest('[hidden], [inert], [aria-hidden="true"], dialog:not([open])') || !element.getClientRects().length) return false;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
  }
  return true;
}

export function isMobileNavigationActive(currentPath: string, href: string): boolean {
  const [pathname, query = ""] = currentPath.split("?");
  const personal = new URLSearchParams(query).get("type") === "personal";
  if (href === "/") return pathname === "/";
  if (href === "/my-tasks") return pathname === href || (pathname === "/tasks" && personal) || (pathname.startsWith("/tasks/") && pathname !== "/tasks/assign");
  return pathname === href || pathname.startsWith(href + "/");
}

export function getMobileNavigation(navigation: Phase2Navigation, roleCode: string): MobileNavigation {
  const collaborator = isCollaboratorRole(roleCode);
  const task = navigation.primary.find((item) => item.href === "/my-tasks" || item.id === "tasks");
  const projects = navigation.primary.find((item) => item.id === "projects" && item.href === "/projects");
  const attendance = navigation.primary.find((item) => item.id === "attendance" && item.href === "/my-attendance");
  // NavContent owns all labels, links and account actions, including the mobile app link.
  const menu = collaborator ? { ...navigation, primary: [] } : navigation;

  const items: MobileNavigationItem[] = [
    ...(!collaborator ? [{ id: "home", href: "/", label: "Trang chủ", kind: "home" as const }] : []),
    ...(task ? [{ id: "tasks", href: "/my-tasks", label: "Việc của tôi", kind: "tasks" as const }] : []),
    ...(projects ? [{ id: "projects", href: projects.href, label: "Dự án", kind: "projects" as const }] : []),
    ...(attendance ? [{ id: "attendance", href: attendance.href, label: "Chấm công", kind: "attendance" as const }] : []),
    { id: "more", href: "more", label: "Thêm", kind: "more" },
  ];
  return { items, menu, showHelp: !collaborator };
}
