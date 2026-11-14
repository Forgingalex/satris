import test from "node:test";
import assert from "node:assert/strict";
import {
  createCheck,
  createProfile,
  assess,
  validateCheck,
  buildExport,
} from "../src/sleep.js";
import { contextSummary, validateContext } from "../src/context.js";
import { advanceRoutine } from "../src/routine.js";
import { deriveAlerts } from "../src/alerts.js";
const now = Date.parse("2026-11-14T12:00:00Z");
const at = (delta) => new Date(now + delta).toISOString();
const check = (extra) => ({
  ...createCheck(),
  observedAt: at(-60000),
  enteredAt: at(-60000),
  sleepHours: 6,
  opportunityHours: 8,
  feeling: "alert",
  disruptionStatus: "none",
  ...extra,
});
const current = (extra) =>
  check({
    isCurrent: false,
    observedAt: at(-86400000),
    feelingScope: "current",
    feelingObservedAt: at(0),
    ...extra,
  });
for (const feeling of ["impact", "unintended"])
  test(`older sleep cannot suppress current ${feeling} report`, () => {
    for (const hours of [null, 0, 6, 8]) {
      const c = current({ feeling, sleepHours: hours }),
        r = assess(c, createProfile(), now);
      assert.equal(r.priority, "review");
      assert.equal(r.actions[0].id, "medical-review");
      assert(r.actions.some((a) => a.id === "current-check"));
      assert(
        !r.actions.some(
          (a) => a.id === "schedule-review" || a.id === "light-accommodation",
        ),
      );
      assert.deepEqual(validateCheck(c, now), []);
    }
  });
test("current symptoms retain review with contradictory older measurements", () => {
  const r = assess(
    current({ feeling: "impact", sleepHours: 10, opportunityHours: 6 }),
    createProfile(),
    now,
  );
  assert.equal(r.actions[0].id, "medical-review");
  assert(r.uncertainties.some((t) => t.includes("exceeds")));
});
test("historical and legacy condition reports do not become current symptoms", () => {
  for (const feelingScope of ["historical", null]) {
    const r = assess(
      check({ isCurrent: false, feelingScope, feeling: "impact" }),
      createProfile(),
      now,
    );
    assert.equal(r.priority, "clarify");
    assert(!r.actions.some((a) => a.id === "medical-review"));
  }
});
test("older sleep with ordinary or unknown current functioning requests a current sleep check", () => {
  for (const feeling of ["alert", "sleepy", "unknown"]) {
    const r = assess(current({ feeling }), createProfile(), now);
    assert.equal(r.priority, "clarify");
    assert.equal(r.actions[0].id, "current-check");
  }
});
test("condition and sleep times survive context and export independently", () => {
  const c = current({ feeling: "impact" }),
    e = buildExport(c, createProfile());
  assert.equal(e.observations[0].observedAt, c.observedAt);
  assert.equal(e.observations[2].observedAt, c.feelingObservedAt);
  assert.equal(e.observations[2].indicator, "current_sleepiness");
  assert(
    contextSummary(c, [], now).items.some(
      (i) =>
        i.label === "Current experience" &&
        i.meaning.includes(c.feelingObservedAt),
    ),
  );
  assert.equal(
    buildExport(
      check({ isCurrent: false, feelingScope: "historical" }),
      createProfile(),
    ).observations[2].indicator,
    "recorded_sleepiness",
  );
});
test("completed observations allow past and now but reject any future timestamp", () => {
  for (const delta of [-86400000, -1, 0])
    assert.deepEqual(validateCheck(check({ observedAt: at(delta) }), now), []);
  for (const delta of [1, 60000, 86400000]) {
    const c = check({ observedAt: at(delta) });
    assert(validateCheck(c, now).some((t) => t.includes("future")));
    assert.equal(assess(c, createProfile(), now).priority, "clarify");
  }
});
test("current conditions and external tests reject future or malformed report times", () => {
  assert(
    validateCheck(current({ feelingObservedAt: at(1) }), now).some((t) =>
      t.includes("Condition report time cannot"),
    ),
  );
  assert(
    validateCheck(current({ feelingObservedAt: "invalid" }), now).some((t) =>
      t.includes("time must be valid"),
    ),
  );
  assert(
    validateCheck(current({ feelingObservedAt: null }), now).some((t) =>
      t.includes("condition report time"),
    ),
  );
  const c = check({
    reactionMs: 250,
    reactionMetric: "median",
    reactionMethod: "External",
    reactionDevice: "Device",
    reactionProtocol: "Protocol",
    reactionObservedAt: at(1),
  });
  assert(validateContext(c, now).some((t) => t.includes("future")));
  assert.deepEqual(
    validateContext({ ...c, reactionObservedAt: at(0) }, now),
    [],
  );
});
test("future timestamps cannot satisfy a routine reminder", () => {
  const s = {
    enabled: true,
    cadenceDays: 1,
    time: "08:00",
    timeZone: "UTC",
    nextAt: at(-3600000),
  };
  assert.deepEqual(advanceRoutine(s, check({ observedAt: at(1) }), now), s);
  assert.notEqual(
    advanceRoutine(s, check({ observedAt: at(0) }), now).nextAt,
    s.nextAt,
  );
});
test("legacy records dated after their own save stay excluded after that date passes", () => {
  const previous = {
    id: "bad",
    check: check({ id: "bad", observedAt: at(-3600000) }),
    savedAt: at(-7200000),
  };
  assert.equal(
    contextSummary(check({ observedAt: at(0) }), [previous], now).comparison
      .count,
    0,
  );
});
test("a future current record cannot create a usable history comparison", () => {
  const past = {
    id: "past",
    check: check({ id: "past", observedAt: at(-3600000) }),
    savedAt: at(-3000000),
  };
  const r = contextSummary(check({ observedAt: at(60000) }), [past], now);
  assert.equal(r.comparison.count, 0);
  assert.equal(r.comparison.differenceHours, null);
  assert.equal(r.comparison.series.at(-1).hours, null);
});
test("urgent help overrides future sleep dates and retains the new concern time", () => {
  for (const urgent of ["yes", "unsure"]) {
    const c = current({
        observedAt: at(86400000),
        urgent,
        urgentReportedAt: at(0),
      }),
      r = assess(c, createProfile(), now);
    assert.equal(r.priority, "urgent");
    assert.deepEqual(
      r.actions.map((a) => a.id),
      ["urgent-help"],
    );
    assert.equal(deriveAlerts([], c, now)[0].at, c.urgentReportedAt);
    assert.equal(
      deriveAlerts([{ id: "r", check: c, assessment: r }], null, now)[0].at,
      c.urgentReportedAt,
    );
    assert.equal(
      buildExport(c, createProfile()).observations.find(
        (o) => o.indicator === "urgent_concern",
      ).observedAt,
      c.urgentReportedAt,
    );
  }
});
test("urgent exports preserve unusable sleep dates without presenting them as measured results", () => {
  for (const observedAt of [
    "invalid",
    new Date(Date.now() + 86400000).toISOString(),
  ]) {
    const c = current({ observedAt, urgent: "yes", urgentReportedAt: at(0) });
    const r = assess(c, createProfile(), now);
    assert.equal(r.priority, "urgent");
    const e = buildExport(c, createProfile());
    for (const indicator of ["sleep_duration", "sleep_opportunity"]) {
      const observation = e.observations.find((o) => o.indicator === indicator);
      assert.equal(observation.status, "invalid");
      assert.equal(observation.observedAt, observedAt);
    }
    assert.equal(
      e.observations.find((o) => o.indicator === "urgent_concern").observedAt,
      c.urgentReportedAt,
    );
  }
});
