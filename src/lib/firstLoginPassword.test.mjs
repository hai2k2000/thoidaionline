import assert from "node:assert/strict"; import test from "node:test"; import { getFirstLoginGateDecision, resolvePostLoginPath } from "./firstLoginPassword.ts";
test("accounts enter the home desk after login",()=>{assert.equal(resolvePostLoginPath(true),"/");assert.equal(resolvePostLoginPath(false),"/")});
test("password state never blocks pages or APIs",()=>{for(const path of ["/account","/tasks","/api/notifications","/api/tasks"])assert.deepEqual(getFirstLoginGateDecision(path,true),{type:"allow"})});
