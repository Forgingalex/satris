import test from "node:test";
import assert from "node:assert/strict";
import { contextSummary, validateContext } from "../src/context.js";
import { createCheck, createProfile, assess } from "../src/sleep.js";
const check = (extra) => ({
  ...createCheck(),
  id: "current",
  observedAt: "2026-11-14T08:00:00Z",
  sleepHours: 6,
  opportunityHours: 8,
  feeling: "alert",
  ...extra,
});
const earlier = (id, hours, extra = {}) => ({
  id,
  check: check({
    id,
    observedAt: `2026-11-${id}T08:00:00Z`,
    sleepHours: hours,
    ...extra,
  }),
  savedAt: `2026-11-${id}T09:00:00Z`,
});
test("history shows exact descriptive count and difference without a clinical baseline", () => {
  const r = contextSummary(check(), [
    earlier("11", 7),
    earlier("12", 7),
    earlier("13", 7),
  ]);
  assert.equal(r.comparison.count, 3);
  assert.equal(r.comparison.meanHours, 7);
  assert.equal(r.comparison.differenceHours, -1);
  assert(r.comparison.text.includes("not a clinical threshold"));
});
test("no previous records or unknown current hours cannot fabricate a comparison", () => {
  const r = contextSummary(check(), []);
  assert.equal(r.comparison.count, 0);
  assert.equal(r.comparison.meanHours, null);
  assert.equal(r.comparison.differenceHours, null);
  const unknown = contextSummary(check({ sleepHours: null }), [
    earlier("13", 7),
  ]);
  assert.equal(unknown.comparison.differenceHours, null);
});
test("uncertain earlier values are excluded while zero remains a reported value", () => {
  const r = contextSummary(check(), [
    earlier("11", 0),
    earlier("12", 7, { quality: "uncertain" }),
  ]);
  assert.equal(r.comparison.count, 1);
  assert.equal(r.comparison.meanHours, 0);
});
test("personal comparisons exclude scenarios and other people", () => {
  const r = contextSummary(check(), [
    earlier("11", 7, { mode: "example", scenarioId: "light" }),
    earlier("12", 8, { subjectId: "other" }),
  ]);
  assert.equal(r.comparison.count, 0);
});
test("different examples cannot become the same simulated person baseline", () => {
  const r = contextSummary(check({ mode: "example", scenarioId: "light" }), [
    earlier("11", 7, { mode: "example", scenarioId: "opportunity" }),
    earlier("12", 8, { mode: "example", scenarioId: "light" }),
  ]);
  assert.equal(r.comparison.count, 1);
  assert.equal(r.comparison.meanHours, 8);
});
test("earlier historical observations remain valid for descriptive comparison", () => {
  assert.equal(
    contextSummary(check(), [earlier("13", 7, { isCurrent: false })]).comparison
      .count,
    1,
  );
});
test("future records are excluded and the latest saved revision of a period is used", () => {
  const old = earlier("12", 7, { sleepPeriodId: "same-period" });
  const revised = {
    ...earlier("13", 8, { sleepPeriodId: "same-period" }),
    savedAt: "2026-11-13T10:00:00Z",
  };
  const future = earlier("15", 9);
  const r = contextSummary(check(), [future, old, revised]);
  assert.equal(r.comparison.count, 1);
  assert.equal(r.comparison.meanHours, 8);
});
const reaction = {
  reactionMs: 300,
  reactionMetric: "median",
  reactionMethod: "External RST",
  reactionProtocol: "Protocol A",
  reactionDevice: "Device A",
  reactionObservedAt: "2026-11-14T07:00:00Z",
};
test("reaction comparison requires matching metric, protocol, device and method", () => {
  const past = earlier("13", 7, {
    ...reaction,
    reactionMs: 250,
    reactionObservedAt: "2026-11-13T07:00:00Z",
  });
  const compatible = contextSummary(check(reaction), [past]);
  assert.equal(compatible.reactionComparison.count, 1);
  assert.equal(compatible.reactionComparison.differenceMs, 50);
  for (const changes of [
    { reactionMetric: "mean" },
    { reactionProtocol: "Protocol B" },
    { reactionDevice: "Device B" },
    { reactionMethod: "Different test" },
  ])
    assert.equal(
      contextSummary(check({ ...reaction, ...changes }), [past])
        .reactionComparison.count,
      0,
    );
});
test("an undated existing reaction result is recorded without being pooled", () => {
  const r = contextSummary(check({ ...reaction, reactionObservedAt: null }), [
    earlier("13", 7, {
      ...reaction,
      reactionObservedAt: "2026-11-13T07:00:00Z",
    }),
  ]);
  assert.equal(r.reactionComparison.count, 0);
  assert(
    r.items
      .find((x) => x.label === "Existing reaction-test result")
      .meaning.includes("not recorded"),
  );
});
test("an unspecified other reaction metric is retained without being pooled", () => {
  const c = check({ ...reaction, reactionMetric: "other" });
  const past = earlier("13", 7, {
    ...reaction,
    reactionMetric: "other",
    reactionObservedAt: "2026-11-13T07:00:00Z",
  });
  assert.deepEqual(validateContext(c), []);
  assert.equal(contextSummary(c, [past]).reactionComparison.count, 0);
});
test("zero and unknown caffeine amounts stay different", () => {
  const zero = contextSummary(check({ caffeineMg: 0 }), []);
  const unknown = contextSummary(
    check({ caffeineMg: null, caffeineTime: "08:00" }),
    [],
  );
  assert(
    zero.items.find((x) => x.label.includes("caffeine")).value.includes("0 mg"),
  );
  assert(
    unknown.items
      .find((x) => x.label.includes("caffeine"))
      .value.includes("Amount unknown"),
  );
});
test("optional fields can remain empty and malformed values require correction", () => {
  assert.deepEqual(validateContext(createCheck()), []);
  assert(validateContext(check({ caffeineMg: -1 })).length);
  assert(validateContext(check({ reactionMs: 200 })).length);
  assert(validateContext(check({ bedTime: "25:00" })).length);
});
test("stress and reaction context never downgrade an indicated medical review", () => {
  const c = check({
    feeling: "impact",
    stress: "high",
    workload: "high",
    caffeineMg: 100,
    ...reaction,
  });
  const a = assess(c, createProfile());
  assert.equal(a.priority, "review");
  assert.equal(a.actions[0].id, "medical-review");
  assert(
    contextSummary(c, []).summary.includes(
      "does not establish a cause or clear you for a task",
    ),
  );
});
