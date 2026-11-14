import test from "node:test";
import assert from "node:assert/strict";
import {
  createProfile,
  environmentInsight,
  validateProfile,
  assess,
  createCheck,
} from "../src/sleep.js";
import { deriveAlerts } from "../src/alerts.js";
test("all four mission settings provide bounded context without inventing measurements", () => {
  for (const environment of ["station", "transit", "rover", "surface"]) {
    const profile = { ...createProfile(), environment };
    assert.deepEqual(validateProfile(profile), []);
    assert(environmentInsight(profile).text.length > 20);
    assert.equal(assess(createCheck(), profile).metrics.planHours, null);
  }
});
test("routine check reminders need an enabled valid due time", () => {
  const now = Date.parse("2026-11-14T10:00Z");
  const schedule = { enabled: true, nextAt: "2026-11-14T09:00Z" };
  assert.equal(deriveAlerts([], null, now, schedule)[0].action, "start");
  for (const s of [
    null,
    { ...schedule, enabled: false },
    { ...schedule, nextAt: "bad" },
    { ...schedule, nextAt: "2026-11-15T09:00Z" },
  ])
    assert.equal(deriveAlerts([], null, now, s).length, 0);
});
