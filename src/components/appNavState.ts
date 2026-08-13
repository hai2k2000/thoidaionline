export type GroupKey = "work" | "hr" | "assets" | "docs" | "admin";

type RoleAccessPolicy = {
  modules: Array<"work" | "hr" | "assets" | "documents" | "performance" | "admin">;
  readOnly: boolean;
  viewAllWorkHr: boolean;
  admin: boolean;
};

const DEFAULT_ACCESS_POLICY: RoleAccessPolicy = {
  modules: ["work", "hr", "assets", "documents", "performance", "admin"],
  readOnly: false,
  viewAllWorkHr: false,
  admin: false,
};

export const getRoleAccessPolicy = (roleCode: string): RoleAccessPolicy =>
  roleCode === "tbt_read_only"
    ? { modules: ["work", "hr"], readOnly: true, viewAllWorkHr: true, admin: false }
    : DEFAULT_ACCESS_POLICY;

export const isGroupAllowedForRole = (roleCode: string, group: GroupKey) => {
  if (roleCode !== "tbt_read_only") return true;
  return group === "work" || group === "hr";
};

export type Group = {
  key: GroupKey;
  label: string;
  items: { href: string; label: string }[];
};

export const groups: Group[] = [
  {
    key: "work",
    label: "Quản lý công việc",
    items: [
      { href: "/", label: "Giao việc" },
      { href: "/tasks/active", label: "CV đang triển khai" },
      { href: "/tasks/pending-review", label: "CV chờ duyệt" },
      { href: "/tasks/done", label: "CV hoàn thành" },
    ],
  },
  {
    key: "hr",
    label: "Quản lý nhân sự",
    items: [
      { href: "/hr-profiles", label: "Hồ sơ nhân sự" },
      { href: "/attendance", label: "Chấm công" },
      { href: "/performance", label: "Đánh giá" },
    ],
  },
  {
    key: "assets",
    label: "Quản lý tài sản",
    items: [
      { href: "/assets", label: "Danh sách tài sản" },
      { href: "/assets/new", label: "Thêm tài sản" },
    ],
  },
  {
    key: "docs",
    label: "Quản lý tài liệu",
    items: [
      { href: "/documents/common", label: "Tài liệu chung" },
      { href: "/documents", label: "Danh sách tài liệu" },
      { href: "/documents/new", label: "Thêm tài liệu" },
    ],
  },
  {
    key: "admin",
    label: "Cấu hình",
    items: [
      { href: "/users", label: "Quản lý nhân viên" },
      { href: "/departments", label: "Phòng ban" },
      { href: "/permissions", label: "Phân quyền" },
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