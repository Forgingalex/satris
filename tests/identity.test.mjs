import test from "node:test";
import assert from "node:assert/strict";
import {
  createCheck,
  createProfile,
  assess,
  personIdentity,
} from "../src/sleep.js";
import { contextSummary } from "../src/context.js";
import { beginReturn, previousRecord } from "../src/journey.js";
const now = Date.now();
const observation = (id, extra = {}) => ({
  ...createCheck(),
  id,
  observedAt: new Date(now - 1000).toISOString(),
  sleepHours: 6,
  opportunityHours: 8,
  feeling: "alert",
  disruptionStatus: "none",
  ...extra,
});
const record = (check) => ({
  id: check.id,
  check,
  profile: createProfile(),
  assessment: assess(check),
  savedAt: new Date(now).toISOString(),
});
test("history uses personId and excludes other people including case-distinct IDs", () => {
  const current = observation("current", {
    personId: "CrewA",
    observedAt: new Date(now).toISOString(),
  });
  const earlier = ["CrewA", "CrewB", "crewa"].map((personId, i) =>
    record(observation(String(i), { personId })),
  );
  assert.equal(contextSummary(current, earlier, now).comparison.count, 1);
});
test("legacy subjectId and canonical personId refer to the same person in history and returns", () => {
  const prior = record(observation("old", { subjectId: "crew-a" }));
  const c = beginReturn(prior, "tried", "same");
  assert.equal(c.personId, "crew-a");
  assert.equal(c.subjectId, undefined);
  assert.equal(previousRecord(c, [prior]).id, prior.id);
  assert.equal(contextSummary(c, [prior]).comparison.count, 1);
  const other = { ...c, personId: "crew-b" };
  assert.equal(previousRecord(other, [prior]), null);
});
test("conflicting identifiers never enter a person comparison or return link", () => {
  const prior = record(
    observation("old", { personId: "crew-a", subjectId: "crew-b" }),
  );
  assert.equal(personIdentity(prior.check), null);
  assert.throws(
    () => beginReturn(prior, "tried", "same"),
    /identifiers conflict/,
  );
  const c = observation("current", {
    personId: "crew-a",
    observedAt: new Date(now).toISOString(),
  });
  assert.equal(contextSummary(c, [prior], now).comparison.count, 0);
  assert.equal(
    contextSummary({ ...c, subjectId: "crew-b" }, [prior], now).comparison
      .count,
    0,
  );
});
test("matching aliases and anonymous legacy self records remain compatible", () => {
  assert.equal(
    personIdentity({ personId: " crew-a ", subjectId: "crew-a" }),
    "crew-a",
  );
  const prior = record(observation("old"));
  const c = beginReturn(prior, "not_tried", "unknown");
  assert.equal(c.personId, "self");
  assert.equal(previousRecord(c, [prior]).id, prior.id);
  assert.equal(contextSummary(c, [prior]).comparison.count, 1);
});
test("malformed identities do not silently become the default person", () => {
  for (const personId of [5, {}, "   "])
    assert.equal(personIdentity({ personId }), null);
});
