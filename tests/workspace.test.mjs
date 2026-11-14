import test from "node:test";
import assert from "node:assert/strict";
import {
  freshWorkspace,
  loadWorkspace,
  saveWorkspace,
} from "../src/workspace.js";
test("personal and scenario records are allocated independently", () => {
  const s = freshWorkspace();
  s.workspaces.example.checks.push({ id: "example" });
  s.workspaces.example.profile.planHours = 8;
  assert.equal(s.workspaces.personal.checks.length, 0);
  assert.equal(s.workspaces.personal.profile.planHours, null);
});
test("saved action, source context and draft survive a storage round trip", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
  };
  const s = freshWorkspace();
  s.workspaces.personal.checks.push({
    id: "r1",
    check: { selectedActionId: "medical-review" },
    profile: { communication: "delayed" },
    assessment: { priority: "review" },
  });
  s.workspaces.personal.draft = { id: "draft" };
  assert.equal(saveWorkspace(s).ok, true);
  assert.deepEqual(loadWorkspace().state, s);
});
test("malformed stored data produces an honest error without overwriting it", () => {
  const raw = "{broken";
  globalThis.localStorage = {
    getItem: () => raw,
    setItem: () => {
      throw Error("Unexpected overwrite");
    },
  };
  const result = loadWorkspace();
  assert(result.error);
  assert.equal(result.state.workspaces.personal.checks.length, 0);
});
test("a blocked or exhausted storage operation never reports successful saving", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw Error("Blocked");
    },
    setItem: () => {
      throw Error("Quota exceeded");
    },
  };
  assert(loadWorkspace().error);
  const result = saveWorkspace(freshWorkspace());
  assert.equal(result.ok, false);
  assert.equal(result.error, "Quota exceeded");
});
