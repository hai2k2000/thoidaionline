/** @typedef {'leave.approve'|'schedule.business.approve'|'schedule.event.approve'} ApprovalPermissionCode */
/** @typedef {'self'|'assigned'|'department'|'all'} Scope */

export const APPROVAL_PERMISSION_CODES = ["leave.approve", "schedule.business.approve", "schedule.event.approve"];
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

/** @param {ApprovalPermissionCode|string} code */
export function defaultGrantScope(code) { return APPROVAL_PERMISSION_CODES.includes(code) ? "department" : null; }

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
  const phrase = code === "leave.approve" ? `${label.toLowerCase()} của ${target}` : `${label.toLowerCase()} của ${target}`;
  const restriction = (item.restrictions || []).includes("leave_ge_3_days_tbt_only") ? " (đơn từ 3 ngày trở lên chỉ Tổng biên tập được duyệt)" : "";
  return `${phrase}${restriction}`;
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
  const actor = item.actor?.name || "Hệ thống";
  const action = actionLabel[item.action] || item.action;
  const code = item.newData?.permissionCode || item.oldData?.permissionCode || item.newData?.permission_code || item.oldData?.permission_code;
  const permission = code ? (labels[code] || APPROVAL_PERMISSION_LABELS[code] || code) : "quyền duyệt";
  if (item.action === "restore_permission_inheritance") {
    return `${actor} đã khôi phục tất cả về mặc định (${item.newData?.changed ?? 0} mục).`;
  }
  if (item.action === "clear_permission_override") {
    return `${actor} đã xóa cấp riêng ${permission}: ${dataText(item.newData?.old || item.oldData)} → ${effectLabel.none}.`;
  }
  if (item.action === "set_permission_override") {
    return `${actor} đã cập nhật ${permission}: ${dataText(item.newData?.old)} → ${dataText(item.newData?.new)}.`;
  }
  const before = dataText(item.oldData); const after = dataText(item.newData);
  return `${actor} đã ${action} ${permission}: ${before} → ${after}.`;
}

export function requiresTypedConfirmation(effect, scope) { return effect === "allow" && scope === "all"; }
