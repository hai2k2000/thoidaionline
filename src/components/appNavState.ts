export type GroupKey = "work" | "hr" | "assets" | "docs" | "admin";

export type Group = {
  key: GroupKey;
  label: string;
  items: { href: string; label: string }[];
};

export const groups: Group[] = [
  {
    key: "work",
    label: "Qu?n l? c?ng vi?c",
    items: [
      { href: "/", label: "Giao vi?c" },
      { href: "/tasks/active", label: "CV ?ang tri?n khai" },
      { href: "/tasks/pending-review", label: "CV ch? duy?t" },
      { href: "/tasks/done", label: "CV ho?n th?nh" },
    ],
  },
  {
    key: "hr",
    label: "Qu?n l? nh?n s?",
    items: [
      { href: "/hr-profiles", label: "H? s? nh?n s?" },
      { href: "/attendance", label: "Ch?m c?ng" },
      { href: "/performance", label: "??nh gi?" },
    ],
  },
  {
    key: "assets",
    label: "Qu?n l? t?i s?n",
    items: [
      { href: "/assets", label: "Danh s?ch t?i s?n" },
      { href: "/assets/new", label: "Th?m t?i s?n" },
    ],
  },
  {
    key: "docs",
    label: "Qu?n l? t?i li?u",
    items: [
      { href: "/documents/common", label: "T?i li?u chung" },
      { href: "/documents", label: "Danh s?ch t?i li?u" },
      { href: "/documents/new", label: "Th?m t?i li?u" },
    ],
  },
  {
    key: "admin",
    label: "C?u h?nh",
    items: [
      { href: "/users", label: "Qu?n l? nh?n vi?n" },
      { href: "/departments", label: "Ph?ng ban" },
      { href: "/permissions", label: "Ph?n quy?n" },
    ],
  },
];

export const isActive = (currentPath: string, href: string) => {
  if (href === "/") return currentPath === "/";
  if (href.startsWith("/tasks/") && currentPath.startsWith("/tasks/")) return true;
  if (href === "/documents" && currentPath.startsWith("/documents/")) return true;
  if (href === "/assets" && currentPath.startsWith("/assets/")) return true;
  return currentPath === href;
};

export const isSidebarGroupVisible = (key: GroupKey) => key !== "assets" && key !== "docs";

export const toggleOpenGroup = (openGroup: GroupKey | null, nextGroup: GroupKey) =>
  openGroup === nextGroup ? null : nextGroup;

export const getInitialOpenGroup = (visibleGroups: Group[], currentPath: string): GroupKey | null =>
  visibleGroups.find((group) => group.items.some((item) => isActive(currentPath, item.href)))?.key ?? null;
