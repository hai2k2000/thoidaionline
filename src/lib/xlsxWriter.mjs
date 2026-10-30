import { deflateRawSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});

export function crc32(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const cleanXml = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
export const escapeXml = (value) => cleanXml(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const columnName = (index) => {
  let value = index + 1;
  let name = "";
  while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
  return name;
};

const DEFAULT_STYLES = {
  default: {},
  title: { font: { bold: true, size: 16 }, alignment: { horizontal: "center", vertical: "center" } },
  header: { font: { bold: true }, fill: "FFD9E1F2", alignment: { horizontal: "center", vertical: "center" }, border: true },
  weekday: { font: { size: 9, color: "FF64748B" }, fill: "FFD9E1F2", alignment: { horizontal: "center", vertical: "center" }, border: true },
  bordered: { border: true },
  centered: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  present: { font: { bold: true, color: "FF16A34A" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  incomplete: { font: { bold: true, color: "FFF97316" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  absent: { font: { bold: true, color: "FFDC2626" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  leave: { font: { bold: true, color: "FF2563EB" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  online: { font: { bold: true, color: "FF9333EA" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  business: { font: { bold: true, color: "FF334155" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
  weekend: { font: { bold: true, color: "FF94A3B8" }, fill: "FFF1F5F9", alignment: { horizontal: "center", vertical: "center" }, border: true },
  future: { alignment: { horizontal: "center", vertical: "center" }, border: true },
  forgot: { font: { bold: true, color: "FFB45309" }, alignment: { horizontal: "center", vertical: "center" }, border: true },
};

function buildStyles(customStyles = {}) {
  const definitions = { ...DEFAULT_STYLES, ...customStyles };
  const fonts = [{ name: "Calibri", size: 11 }];
  const fills = [null, "gray125"];
  const borders = [false];
  const fontKey = new Map([[JSON.stringify(fonts[0]), 0]]);
  const fillKey = new Map([["", 0], ["gray125", 1]]);
  const styleIndexes = new Map();
  const xfs = [];
  for (const [name, style] of Object.entries(definitions)) {
    const font = { name: style.font?.name ?? "Calibri", size: style.font?.size ?? 11, bold: !!style.font?.bold, italic: !!style.font?.italic, color: style.font?.color ?? null };
    const fontJson = JSON.stringify(font);
    if (!fontKey.has(fontJson)) { fontKey.set(fontJson, fonts.length); fonts.push(font); }
    const fill = style.fill ?? "";
    if (!fillKey.has(fill)) { fillKey.set(fill, fills.length); fills.push(fill); }
    const borderId = style.border ? 1 : 0;
    if (style.border && borders.length === 1) borders.push(true);
    styleIndexes.set(name, xfs.length);
    xfs.push({ fontId: fontKey.get(fontJson), fillId: fillKey.get(fill), borderId, alignment: style.alignment ?? null });
  }
  const fontsXml = fonts.map((font) => `<font>${font.bold ? "<b/>" : ""}${font.italic ? "<i/>" : ""}<sz val="${font.size}"/>${font.color ? `<color rgb="${font.color}"/>` : ""}<name val="${escapeXml(font.name)}"/></font>`).join("");
  const fillsXml = fills.map((fill) => fill === null ? '<fill><patternFill patternType="none"/></fill>' : fill === "gray125" ? '<fill><patternFill patternType="gray125"/></fill>' : `<fill><patternFill patternType="solid"><fgColor rgb="${fill}"/><bgColor indexed="64"/></patternFill></fill>`).join("");
  const bordersXml = borders.map((border) => border ? '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>' : '<border><left/><right/><top/><bottom/><diagonal/></border>').join("");
  const xfsXml = xfs.map((xf) => `<xf numFmtId="0" fontId="${xf.fontId}" fillId="${xf.fillId}" borderId="${xf.borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${xf.alignment ? ' applyAlignment="1"' : ""}>${xf.alignment ? `<alignment horizontal="${xf.alignment.horizontal ?? "general"}" vertical="${xf.alignment.vertical ?? "bottom"}"${xf.alignment.wrapText ? ' wrapText="1"' : ""}/>` : ""}</xf>`).join("");
  return {
    indexes: styleIndexes,
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fontsXml}</fonts><fills count="${fills.length}">${fillsXml}</fills><borders count="${borders.length}">${bordersXml}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfsXml}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
}

function worksheetXml(sheet, styleIndexes) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.cells.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = styleIndexes.get(cell.style ?? "default") ?? 0;
      if (cell.formula) return `<c r="${reference}" s="${style}"><f>${escapeXml(cell.formula)}</f></c>`;
      if (typeof cell.value === "number" && Number.isFinite(cell.value)) return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
      const text = cleanXml(cell.value);
      // A truly empty cell keeps only its style; an empty string would break formulas like =P-N.
      if (text === "") return `<c r="${reference}" s="${style}"/>`;
      const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : "";
      return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${escapeXml(text)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}"${row.height ? ` ht="${row.height}" customHeight="1"` : ""}>${cells}</row>`;
  }).join("");
  const columns = sheet.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`).join("");
  const freeze = sheet.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${sheet.freeze.columns}" ySplit="${sheet.freeze.rows}" topLeftCell="${columnName(sheet.freeze.columns)}${sheet.freeze.rows + 1}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  // OOXML requires sheetPr before sheetViews; fit-to-page needs pageSetUpPr.
  const sheetPr = sheet.pageSetup?.fitToWidth ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : "<sheetPr/>";
  const pageSetup = sheet.pageSetup ? `<pageSetup paperSize="${sheet.pageSetup.paperSize}" orientation="${sheet.pageSetup.orientation}" fitToWidth="${sheet.pageSetup.fitToWidth}" fitToHeight="${sheet.pageSetup.fitToHeight}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetPr}${freeze}<sheetFormatPr defaultRowHeight="15"/><cols>${columns}</cols><sheetData>${rows}</sheetData>${merges}${sheet.pageSetup ? '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' : ""}${pageSetup}</worksheet>`;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, value] of files) {
    const nameBuffer = Buffer.from(name);
    const raw = Buffer.from(value);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function writeXlsx(sheet) {
  const styles = buildStyles(sheet.styles);
  const files = [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheet.name ?? "Sheet1")}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml", styles.xml],
    ["xl/worksheets/sheet1.xml", worksheetXml(sheet, styles.indexes)],
  ];
  return zip(files);
}
