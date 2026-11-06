import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../..");
const require = createRequire(import.meta.url);
const modules = new Map();
const compilerOptions = { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true };

// Load the shared production component so the snapshot exercises its real markup and classes.
function load(path) {
  const absolute = resolve(root, path);
  if (modules.has(absolute)) return modules.get(absolute);
  const componentModule = { exports: {} };
  modules.set(absolute, componentModule.exports);
  const localRequire = (id) => {
    if (!id.startsWith("@/") && !id.startsWith(".")) return require(id);
    const target = id.startsWith("@/") ? join(root, "src", id.slice(2)) : resolve(dirname(absolute), id);
    const resolved = [target, `${target}.tsx`, `${target}.ts`, `${target}.mjs`].find(existsSync);
    if (!resolved) throw new Error(`Cannot resolve ${id} from ${path}`);
    return resolved.endsWith(".mjs") ? require(resolved) : load(resolved);
  };
  const js = ts.transpileModule(readFileSync(absolute, "utf8"), { compilerOptions }).outputText;
  new Function("require", "module", "exports", js)(localRequire, componentModule, componentModule.exports);
  return componentModule.exports;
}

const { default: MobileCardList, MobileCard, MobileCardBadge } = load("src/components/mobile/MobileCardList.tsx");
const render = (element) => renderToStaticMarkup(element);
const card = ({ title, badge, tone = "neutral", rows, href, footer, children }) => React.createElement(
  MobileCard,
  { title, href, status: React.createElement(MobileCardBadge, { tone }, badge), meta: rows.map(([label, value]) => ({ label, value })), footer },
  children,
);
const list = (label, cards) => React.createElement("section", { "aria-label": label, className: "snapshot-section" },
  React.createElement("h2", { className: "mb-2 text-lg font-bold text-brand-ink" }, label),
  React.createElement(MobileCardList, { ariaLabel: label }, ...React.Children.toArray(cards)));
const button = (label) => React.createElement("button", { type: "button", className: "min-h-11 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm" }, label);
const monthCalendar = React.createElement("details", { open: true, className: "mt-3 rounded-[var(--radius-control)] border border-border bg-surface-muted p-2" },
  React.createElement("summary", { className: "min-h-11 cursor-pointer py-2 text-sm font-semibold" }, "Xem lịch tháng"),
  React.createElement("div", { className: "mt-2 grid grid-cols-7 gap-1 text-center text-xs", "aria-label": "Lịch chấm công tháng 11" },
    ["T2", "T3", "T4", "T5", "T6", "T7", "CN", ...Array.from({ length: 28 }, (_, index) => `${index + 1}`)].map((value, index) => React.createElement("span", { key: `${value}-${index}`, className: "min-h-11 rounded-[var(--radius-control)] border border-border bg-surface px-1 py-2" }, value))));

const cssDirectory = join(root, ".next/static/css");
const cssFiles = existsSync(cssDirectory) ? readdirSync(cssDirectory).filter((file) => file.endsWith(".css")).sort() : [];
if (!cssFiles.length) throw new Error("Run the build first: no built CSS found.");
const cssLinks = cssFiles.map((file) => `<link rel="stylesheet" href="../../.next/static/css/${file}">`).join("\n");
const schedule = list("Lịch làm việc", [card({ title: "Họp giao ban tuần", badge: "Đã duyệt", tone: "success", rows: [["Thời gian", "08:00 - 09:00"], ["Địa điểm", "Phòng họp lớn"], ["Người tham gia", "Nguyễn An, Trần Bình"], ["Ghi chú", "Chuẩn bị báo cáo tuần"]], footer: button("Xem chi tiết") })]);
const attendance = list("Chấm công theo ngày", [card({ title: "Nguyễn An", badge: "Đúng giờ", tone: "success", rows: [["Phòng ban", "Ban Thư ký"], ["Giờ vào / giờ ra", "08:02 / 17:05"], ["Trạng thái", "Có mặt"], ["Ghi chú", "-"]], footer: button("Xem chi tiết") })]);
const month = list("Lưới chấm công theo tháng", [card({ title: "Nguyễn An", badge: "20 ngày công", tone: "brand", rows: [["Có mặt (v)", "20"], ["Vắng (x)", "1"], ["Nghỉ phép (P)", "1"], ["Mã khác", "QT: 1 · SK: 1"]], children: monthCalendar })]);
const records = list("Danh sách hồ sơ", [card({ title: "Quy chế biên tập 2026", badge: "Đã duyệt", tone: "success", href: "/database/records/record-42", rows: [["Mã", "HS-2026-0042"], ["Nhóm / loại", "Nội bộ · Quy chế"], ["Phòng / đơn vị", "Ban Thư ký"], ["Cập nhật", "06/11/2026 09:30"]] })]);
const users = list("Danh sách người dùng", [card({ title: "Trần Bình", badge: "Đang hoạt động", tone: "success", rows: [["Tên đăng nhập", "tranbinh"], ["Phòng ban", "Phòng Phóng viên"], ["Chức danh", "Phóng viên"], ["Vai trò", "Nhân viên"]], footer: React.createElement(React.Fragment, null, button("Sửa"), button("Khóa")) })]);
const tasks = list("Danh sách công việc", [card({ title: "Hoàn thiện bài phỏng vấn", badge: "Đang làm", tone: "info", href: "/tasks/task-42", rows: [["Người phụ trách", "Trần Bình, Lê Mai"], ["Hạn", "08/11/2026"], ["Tình trạng hạn", "Còn hạn"], ["Phòng", "Phòng Phóng viên"]] })]);
const project = list("Thành viên dự án", [card({ title: "Lê Mai", badge: "Đang hoạt động", tone: "success", rows: [["Vai trò", "Thành viên"]], footer: React.createElement(React.Fragment, null, button("Đổi vai trò"), button("Xóa")) })]);
const desktopTable = `<section class="desktop-preview" aria-label="Bảng hồ sơ desktop"><h2 class="mb-2 text-lg font-bold text-brand-ink">Bảng desktop</h2><div class="overflow-x-auto"><table class="min-w-[900px] text-left text-sm"><thead><tr><th class="p-3">Mã</th><th class="p-3">Tên</th><th class="p-3">Trạng thái</th><th class="p-3">Cập nhật</th></tr></thead><tbody><tr><td class="p-3">HS-2026-0042</td><td class="p-3">Quy chế biên tập 2026</td><td class="p-3">Đã duyệt</td><td class="p-3">06/11/2026</td></tr></tbody></table></div></section>`;
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thời Đại Work - Mobile UI wave B</title>${cssLinks}<style>body{margin:0;background:#fff8f9;padding:1rem}.snapshot-content{display:grid;gap:1rem;max-width:1240px;margin:auto}.snapshot-section{border:1px solid #fed7aa;border-radius:.75rem;background:#fff;padding:1rem}.desktop-preview{display:none}@media(min-width:768px){.desktop-preview{display:block}.snapshot-content{padding:1rem}.snapshot-section ul{display:none}}</style></head><body><main class="snapshot-content">${render(schedule)}${render(attendance)}${render(month)}${render(records)}${render(users)}${render(tasks)}${render(project)}${desktopTable}</main></body></html>`;
writeFileSync(join(directory, "mobile-ui-wave-b-snapshot.html"), html);
console.log(`Snapshot written: scripts/dev/mobile-ui-wave-b-snapshot.html (${cssFiles.length} built CSS chunks)`);
