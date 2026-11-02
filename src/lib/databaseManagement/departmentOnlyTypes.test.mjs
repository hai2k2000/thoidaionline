import assert from "node:assert/strict";
import test from "node:test";
import { isDepartmentOnlyRecordType } from "./departmentOnlyTypes.mjs";

test("both contact directories are department-only", () => { assert.equal(isDepartmentOnlyRecordType("danh_ba_nghiep_vu"), true); assert.equal(isDepartmentOnlyRecordType("ngoai_ngu_danh_ba_doi_tac"), true); assert.equal(isDepartmentOnlyRecordType("ho_so_nhan_vat"), false); });
