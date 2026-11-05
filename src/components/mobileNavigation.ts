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
};

export function isMobileNavigationActive(currentPath: string, href: string): boolean {
  const [pathname, query = ""] = currentPath.split("?");
  const personal = new URLSearchParams(query).get("type") === "personal";
  if (href === "/") return pathname === "/" || (pathname === "/tasks" && !personal);
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
  return { items, menu };
}
