import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function render(props) {
  const path = new URL("./CameraCaptureButton.tsx", import.meta.url);
  assert.ok(existsSync(path), "camera control is implemented");
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === "react" ? { useRef: () => ({ current: null }) } : require(name) });
  return exports.default(props).props.children;
}

test("camera requests an image with rear camera and passes the original File to the upload path", () => {
  const selected = [];
  const [button, input] = render({ onCapture: file => selected.push(file) });
  assert.equal(button.props.type, "button");
  assert.equal(input.props.type, "file");
  assert.equal(input.props.accept, "image/*");
  assert.equal(input.props.capture, "environment");
  const file = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
  const target = { files: [file], value: "camera.jpg" };
  input.props.onChange({ currentTarget: target });
  assert.equal(selected[0], file);
  assert.equal(target.value, "", "same photo may be selected again");
  input.props.onChange({ currentTarget: { files: [], value: "" } });
  assert.equal(selected.length, 1, "cancelling keeps current attachment");
});

test("busy or read-only upload disables both camera activation and selection", () => {
  const [button, input] = render({ disabled: true, onCapture: () => assert.fail("disabled capture") });
  assert.equal(button.props.disabled, true);
  assert.equal(input.props.disabled, true);
  input.props.onChange({ currentTarget: { files: [new File(["x"], "x.jpg")], value: "x.jpg" } });
});

test("image-capable uploads expose capture and document-only imports stay restricted", () => {
  for (const name of ["TaskAttachmentUploader", "ProjectLibrary", "CanonicalAssignmentForm", "TaskAssignShell", "DutyReviewCard", "AccountShell"]) {
    assert.match(readFileSync(new URL(`./${name}.tsx`, import.meta.url), "utf8"), /<CameraCaptureButton\b/, name);
  }
  assert.match(readFileSync(new URL("../app/hr-profiles/[id]/page.tsx", import.meta.url), "utf8"), /<CameraCaptureButton\b/);
  for (const path of ["./DatabaseRecordForm.tsx", "./DepartmentPlanActions.tsx", "../app/assets/page.tsx", "../app/database/records/[id]/page.tsx"]) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), "utf8"), /<CameraCaptureButton\b|capture="environment"/, path);
  }
});
