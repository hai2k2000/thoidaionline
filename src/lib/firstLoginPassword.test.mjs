import assert from "node:assert/strict"; import test from "node:test"; import { getFirstLoginGateDecision, resolvePostLoginPath } from "./firstLoginPassword.ts";
test("accounts enter task management after login",()=>{assert.equal(resolvePostLoginPath(true),"/tasks");assert.equal(resolvePostLoginPath(false),"/tasks")});
test("password state never blocks pages or APIs",()=>{for(const path of ["/account","/tasks","/api/notifications","/api/tasks"])assert.deepEqual(getFirstLoginGateDecision(path,true),{type:"allow"})});
