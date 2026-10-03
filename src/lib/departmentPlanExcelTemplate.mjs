import JSZip from "jszip";

export const DEPARTMENT_PLAN_EXCEL_TEMPLATE_FILENAME = "Mau_Import_Ke_Hoach_Phong.xlsx";

export const DEPARTMENT_PLAN_EXCEL_HEADERS = [
  "STT",
  "Phòng ban",
  "Loại kỳ",
  "Từ ngày",
  "Đến ngày",
  "Tên công việc",
  "Nội dung / yêu cầu",
  "Người thực hiện",
  "Người phối hợp",
  "Ngày bắt đầu",
  "Mốc trong kỳ",
  "Hạn hoàn thành cuối",
  "Ngày báo cáo",
  "Mức ưu tiên",
  "Trạng thái",
  "Quan hệ với kỳ",
  "Nguồn công việc",
  "Task ID liên kết",
  "Yêu cầu xác nhận",
  "Ghi chú",
];

const DATE_COLUMNS = new Set([3, 4, 9, 10, 11, 12]);
const TEMPLATE_ROW_COUNT = 100;

const escapeXml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const inlineStringCell = (reference, value, style = 0) => {
  const text = escapeXml(value);
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
};

const blankCell = (reference, style = 0) => `<c r="${reference}" s="${style}"></c>`;

const columnName = (index) => {
  let value = "";
  let current = index;
  while (current >= 0) {
    value = String.fromCharCode((current % 26) + 65) + value;
    current = Math.floor(current / 26) - 1;
  }
  return value;
};

const worksheetXml = () => {
  const headerCells = DEPARTMENT_PLAN_EXCEL_HEADERS
    .map((header, index) => inlineStringCell(`${columnName(index)}1`, header, 1))
    .join("");
  const blankRows = Array.from({ length: TEMPLATE_ROW_COUNT }, (_, rowOffset) => {
    const rowNumber = rowOffset + 2;
    const cells = DEPARTMENT_PLAN_EXCEL_HEADERS
      .map((_, columnIndex) => blankCell(`${columnName(columnIndex)}${rowNumber}`, DATE_COLUMNS.has(columnIndex) ? 2 : 3))
      .join("");
    return `<row r="${rowNumber}" customFormat="1" customHeight="1" ht="22">${cells}</row>`;
  }).join("");
  const widths = [8, 20, 12, 13, 13, 32, 42, 28, 28, 13, 13, 17, 13, 15, 18, 24, 22, 38, 18, 30]
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><outlinePr summaryBelow="1" summaryRight="1"/><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:T${TEMPLATE_ROW_COUNT + 1}"/>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${widths}</cols>
  <sheetData><row r="1" customFormat="1" customHeight="1" ht="34">${headerCells}</row>${blankRows}</sheetData>
  <autoFilter ref="A1:T${TEMPLATE_ROW_COUNT + 1}"/>
  <dataValidations count="7">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="C2:C${TEMPLATE_ROW_COUNT + 1}"><formula1>"Tuần,Tháng"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="N2:N${TEMPLATE_ROW_COUNT + 1}"><formula1>"Ưu tiên 1,Ưu tiên 2,Ưu tiên 3"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="O2:O${TEMPLATE_ROW_COUNT + 1}"><formula1>"Mới,Đang thực hiện,Hoàn thành,Đã hủy"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="P2:P${TEMPLATE_ROW_COUNT + 1}"><formula1>"Mới,Dài hạn,Chuyển tiếp,Định kỳ,Phát sinh trong kỳ,Import"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="Q2:Q${TEMPLATE_ROW_COUNT + 1}"><formula1>"Lãnh đạo giao,Tự nhận,Giao việc,Import"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="S2:S${TEMPLATE_ROW_COUNT + 1}"><formula1>"Có,Không"</formula1></dataValidation>
    <dataValidation type="date" allowBlank="1" showErrorMessage="1" operator="between" sqref="D2:E${TEMPLATE_ROW_COUNT + 1} J2:M${TEMPLATE_ROW_COUNT + 1}"><formula1>DATE(2000,1,1)</formula1><formula2>DATE(2100,12,31)</formula2></dataValidation>
  </dataValidations>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
};

const instructionXml = () => {
  const rows = [
    "Hướng dẫn nhập kế hoạch phòng",
    "",
    "1. Nhập một công việc trên mỗi dòng của sheet KeHoach_Import.",
    "2. Không đổi tên hoặc xóa dòng tiêu đề. Có thể để trống các cột không áp dụng.",
    "3. Các cột ngày dùng định dạng dd/mm/yyyy. Không nhập ngày kết thúc trước ngày bắt đầu.",
    "4. Người thực hiện và Người phối hợp có thể nhập nhiều người, ngăn cách bằng dấu chấm phẩy (;).",
    "5. Sau khi điền dữ liệu, lưu file .xlsx rồi chọn Import kế hoạch từ Excel để xem trước.",
    "6. Bản xem trước chưa lưu dữ liệu cho đến khi bạn bấm Xác nhận import.",
    "",
    "Danh sách chọn có sẵn",
    "Loại kỳ: Tuần, Tháng",
    "Mức ưu tiên: Ưu tiên 1, Ưu tiên 2, Ưu tiên 3",
    "Trạng thái: Mới, Đang thực hiện, Hoàn thành, Đã hủy",
    "Quan hệ với kỳ: Mới, Dài hạn, Chuyển tiếp, Định kỳ, Phát sinh trong kỳ, Import",
    "Nguồn công việc: Lãnh đạo giao, Tự nhận, Giao việc, Import",
    "Yêu cầu xác nhận: Có, Không",
  ];
  const cells = rows.map((label, index) => {
    const rowNumber = index + 1;
    const style = index === 0 ? 4 : index === 9 ? 1 : 5;
    return `<row r="${rowNumber}" customHeight="1" ht="${index === 0 ? 30 : 22}">${inlineStringCell(`A${rowNumber}`, label, style)}${blankCell(`B${rowNumber}`, style)}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:B${rows.length}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="105" customWidth="1"/><col min="2" max="2" width="35" customWidth="1"/></cols>
  <sheetData>${cells}</sheetData>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><color rgb="FF7C2D12"/><sz val="14"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF97316"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE7E5E4"/></left><right style="thin"><color rgb="FFE7E5E4"/></right><top style="thin"><color rgb="FFE7E5E4"/></top><bottom style="thin"><color rgb="FFE7E5E4"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" applyNumberFormat="1" xfId="0"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyAlignment="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" applyAlignment="1" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/>
</styleSheet>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

export async function createDepartmentPlanExcelTemplate() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr defaultThemeVersion="164011"/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000" activeTab="0"/></bookViews>
  <sheets><sheet name="KeHoach_Import" sheetId="1" r:id="rId1"/><sheet name="HuongDan" sheetId="2" r:id="rId2"/></sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file("xl/styles.xml", stylesXml);
  zip.file("xl/worksheets/sheet1.xml", worksheetXml());
  zip.file("xl/worksheets/sheet2.xml", instructionXml());
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
