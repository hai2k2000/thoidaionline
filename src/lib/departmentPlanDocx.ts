import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const decodeXml = (value: string) => value
  .replace(/<w:tab\s*\/?>/g, "\t")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, " ").trim();

export async function parseDepartmentPlanDocx(file: File) {
  if (!file.name.toLowerCase().endsWith(".docx") || file.size > 10 * 1024 * 1024) throw new Error("Chỉ hỗ trợ tệp .docx tối đa 10MB.");
  const dir = await mkdtemp(`${tmpdir()}/thoidai-plan-`);
  const path = `${dir}/input.docx`;
  try {
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    const { stdout } = await execFileAsync("unzip", ["-p", path, "word/document.xml"], { maxBuffer: 8 * 1024 * 1024 });
    const rows = [...stdout.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((match) => [...match[0].matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((cell) => decodeXml(cell[0])).filter(Boolean)).filter((row) => row.length);
    return rows.slice(1).map((cells, index) => {
      const title = cells[0] || `Công việc import ${index + 1}`;
      const deadline = cells.find((cell) => /\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/.test(cell))?.match(/\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/)?.[0] ?? null;
      return { title, description: cells.slice(1).join(" | ") || null, assigneeName: cells[2] ?? null, mappingConfidence: "REVIEW", dueDate: deadline, periodRelation: "IMPORTED" };
    });
  } finally { await rm(dir, { recursive: true, force: true }); }
}
