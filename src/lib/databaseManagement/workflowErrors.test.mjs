import assert from "node:assert/strict";
import test from "node:test";
import { classifyWorkflowRpcError, workflowHttpStatus } from "./workflowErrors.mjs";

test("only serialization conflicts are classified as stale conflicts", () => {
  assert.equal(classifyWorkflowRpcError({ code: "40001", message: "serialization failure" }), "stale_conflict");
  assert.equal(classifyWorkflowRpcError({ code: "55000", message: "business conflict" }), "stale_conflict");
  assert.equal(classifyWorkflowRpcError({ code: "22023", message: "Invalid transition." }), "invalid_transition");
  assert.equal(workflowHttpStatus("stale_conflict"), 409);
  assert.equal(workflowHttpStatus("invalid_transition"), 409);
});

test("unknown RPC failures are not misreported as HTTP 409", () => {
  assert.equal(classifyWorkflowRpcError({ code: "42883", message: "function is missing" }), "workflow_failed");
  assert.equal(workflowHttpStatus("workflow_failed"), 500);
});

test("self approval remains a forbidden action", () => {
  assert.equal(classifyWorkflowRpcError({ code: "42501", message: "Self approval is not allowed." }), "self_approval_forbidden");
  assert.equal(workflowHttpStatus("self_approval_forbidden"), 403);
});
