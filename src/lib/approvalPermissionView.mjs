/** @typedef {'leave.approve'|'schedule.business.approve'|'schedule.event.approve'} ApprovalPermissionCode */
/** @typedef {'self'|'assigned'|'department'|'all'} Scope */

export const APPROVAL_PERMISSION_CODES = ["leave.approve", "schedule.business.approve", "schedule.event.approve"];
export const PERMISSION_PRESETS = [{
  key: "record_department_editor",
  label: "Người nhập CSDL của phòng",
  description: "Tạo hồ sơ, tải tệp lên và gửi duyệt CSDL của phòng mình.",
  items: [
    { code: "record.discover", scope: "department", tier: "required", name: "Tìm hồ sơ" },
    { code: "record.create", scope: "all", tier: "required", name: "Tạo hồ sơ" },
    { code: "record.edit", scope: "all", tier: "required", name: "Chỉnh sửa hồ sơ" },
    { code: "record.metadata.view", scope: "department", tier: "recommended", name: "Xem siêu dữ liệu" },
    { code: "record.preview", scope: "department", tier: "recommended", name: "Xem trước hồ sơ" },
    { code: "record.download", scope: "department", tier: "recommended", name: "Tải tệp xuống" },
    { code: "record.delete", scope: "all", tier: "optional", name: "Xóa hồ sơ" },
    { code: "record.restore", scope: "all", tier: "optional", name: "Khôi phục hồ sơ" },
    { code: "record.export", scope: "all", tier: "optional", name: "Xuất hồ sơ" },
  ],
}];
export const PERMISSION_GROUP_DEFINITIONS = [
  { key: "task", label: "Giao việc", matches: (code) => code.startsWith("task.") },
  { key: "record", label: "Dữ liệu (CSDL)", matches: (code) => code.startsWith("record.") },
  { key: "asset", label: "Tài sản", matches: (code) => code.startsWith("asset.") },
  { key: "attendance", label: "Chấm công & nghỉ phép", matches: (code) => code.startsWith("attendance.") || code === "leave.view_self" },
  { key: "schedule", label: "Lịch & kế hoạch", matches: (code) => code === "schedule.view_self" },
  { key: "journalism", label: "Báo chí", matches: (code) => code.startsWith("journalism.") },
  { key: "staff", label: "Nhân sự & quản trị", matches: (code) => code.startsWith("staff.") || code === "permission.manage" || code.startsWith("evaluation.") },
  { key: "approval", label: "Phê duyệt đơn và kế hoạch", matches: (code) => APPROVAL_PERMISSION_CODES.includes(code) },
  { key: "other", label: "Khác", matches: () => true },
];

/**
 * @template {{code:string,name?:string,description?:string|null}} Permission
 * @param {Permission[]} permissions
 * @returns {{key:string,label:string,permissions:Permission[]}[]}
 */
export function groupPermissions(permissions = []) {
  /** @type {{key:string,label:string,permissions:Permission[]}[]} */
  const groups = PERMISSION_GROUP_DEFINITIONS.map(({ key, label }) => ({ key, label, permissions: [] }));
  for (const permission of permissions) {
    const index = PERMISSION_GROUP_DEFINITIONS.findIndex(({ matches }) => matches(permission.code));
    groups[index < 0 ? groups.length - 1 : index].permissions.push(permission);
  }
  return groups.filter((group) => group.permissions.length > 0);
}
export const APPROVAL_PERMISSION_LABELS = {
  "leave.approve": "Duyệt đơn xin nghỉ",
  "schedule.business.approve": "Duyệt kế hoạch công tác cá nhân",
  "schedule.event.approve": "Duyệt kế hoạch tham gia sự kiện cá nhân",
};
export const APPROVAL_PERMISSION_DESCRIPTIONS = {
  "leave.approve": "Duyệt đơn xin nghỉ dưới 3 ngày.",
  "schedule.business.approve": "Duyệt kế hoạch công tác cá nhân.",
  "schedule.event.approve": "Duyệt kế hoạch tham gia sự kiện cá nhân.",
};
export const SOURCE_LABELS = { role: "Vai trò", structural: "Chức vụ Trưởng phòng", user_allow: "Cấp riêng", user_deny: "Chặn riêng", none: "Không có" };
export const RESTRICTION_LABELS = {
  no_self_approval: "Không tự duyệt hồ sơ của chính mình.",
  leave_ge_3_days_tbt_only: "Đơn từ 3 ngày trở lên chỉ Tổng biên tập duyệt.",
};

/** @param {ApprovalPermissionCode|string} code */
export function defaultGrantScope(code) { return APPROVAL_PERMISSION_CODES.includes(code) || code === "record.approve" ? "department" : null; }

/** @param {Scope[]} roleScopes @param {Scope[]} structuralScopes @param {Scope} chosenScope */
export function isNarrowingAllow(roleScopes = [], structuralScopes = [], chosenScope) {
  const inherited = new Set([...roleScopes, ...structuralScopes]);
  return chosenScope === "department" && inherited.has("all") || chosenScope === "assigned" && (inherited.has("department") || inherited.has("all")) || chosenScope === "self" && inherited.size > 0 && !inherited.has("self");
}

function permissionPhrase(item) {
  const code = item.permissionCode;
  const label = item.label || APPROVAL_PERMISSION_LABELS[code] || code;
  const scopes = item.effectiveScopes || [];
  if (!scopes.length) return null;
  let target = "toàn cơ quan";
  if (!scopes.includes("all")) target = `nhân sự ${item.effectiveDepartment?.name || "phòng ban của mình"}`;
  const phrase = `${label.replace(/^Duyệt\s+/i, "").toLowerCase()} của ${target}`;
  const restriction = (item.restrictions || []).map((value) => value === "no_self_approval"
    ? "trừ hồ sơ của chính mình"
    : RESTRICTION_LABELS[value]).filter(Boolean).join(" ");
  return restriction ? `${phrase} (${restriction.replace(/\.$/, "")})` : phrase;
}

export function previewSentence(items = [], userName = "người này", options = {}) {
  if (options.active === false) return `${userName} không hoạt động nên hiện không có quyền duyệt đơn hoặc kế hoạch nào.`;
  const phrases = items.map(permissionPhrase).filter(Boolean);
  if (!phrases.length) return "Người này hiện không có quyền duyệt đơn hoặc kế hoạch nào.";
  return `Người này duyệt được: ${phrases.join("; ")}.`;
}

const scopeLabel = { self: "bản thân", assigned: "được giao", department: "phòng ban", all: "toàn cơ quan" };
const effectLabel = { allow: "Cấp riêng", deny: "Chặn riêng", none: "Kế thừa" };
const actionLabel = { set_permission_override: "cập nhật", clear_permission_override: "xóa cấp riêng", restore_permission_inheritance: "khôi phục tất cả", grant_permission: "cấp", revoke_permission: "chặn" };
function dataText(data) {
  if (!data) return effectLabel.none;
  const effect = data.effect || data.userEffect || "none";
  const scope = data.scope || data.userScope;
  return `${effectLabel[effect] || effect}${scope ? ` (${scopeLabel[scope] || scope})` : ""}`;
}

export function historyLine(item, labels = {}) {
  const timestamp = item.createdAt ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt)) : "";
  const prefix = timestamp ? `${timestamp} ` : "";
  const actor = item.actor?.name || "Hệ thống";
  const action = actionLabel[item.action] || item.action;
  const code = item.newData?.permissionCode || item.oldData?.permissionCode || item.newData?.permission_code || item.oldData?.permission_code;
  const permission = code ? (labels[code] || APPROVAL_PERMISSION_LABELS[code] || code) : "quyền duyệt";
  if (item.action === "restore_permission_inheritance") {
    return `${prefix}${actor} đã khôi phục tất cả về mặc định (${item.newData?.changed ?? 0} mục).`;
  }
  if (item.action === "clear_permission_override") {
    return `${prefix}${actor} đã xóa cấp riêng ${permission}: ${dataText(item.newData?.old || item.oldData)} → ${effectLabel.none}.`;
  }
  if (item.action === "set_permission_override") {
    return `${prefix}${actor} đã cập nhật ${permission}: ${dataText(item.newData?.old)} → ${dataText(item.newData?.new)}.`;
  }
  const before = dataText(item.oldData); const after = dataText(item.newData);
  return `${prefix}${actor} đã ${action} ${permission}: ${before} → ${after}.`;
}

export function requiresTypedConfirmation(effect, scope) { return effect === "allow" && scope === "all"; }

const presetScopeRank = { self: 0, assigned: 1, department: 2, all: 3 };
const presetBlockedMessages = {
  no_department: "Cần gán phòng ban cho người dùng trước khi áp dụng gói này.",
  inactive: "Người dùng không hoạt động nên không thể áp dụng gói này.",
};

export function planPresetApplication(preset, user, selectedOptionalCodes = []) {
  const selected = new Set(selectedOptionalCodes);
  const items = preset.items.map((item) => {
      const override = user?.overrides?.[item.code];
      const scopes = user?.effective?.[item.code]?.scopes ?? [];
      const already = !override || override.effect !== "deny"
        ? scopes.some((scope) => presetScopeRank[scope] >= presetScopeRank[item.scope])
        : false;
      const status = already ? "already" : override?.effect === "deny" ? "replace_deny" : "grant";
      return { ...item, status, selected: item.tier === "required" || selected.has(item.code) };
    });
  const blocked = !user?.active
    ? { reason: "inactive", message: presetBlockedMessages.inactive }
    : !user?.department_id
      ? { reason: "no_department", message: presetBlockedMessages.no_department }
      : null;
  return { blocked, items, codesToApply: blocked ? [] : items.filter((item) => item.selected && item.status !== "already").map((item) => item.code) };
}
