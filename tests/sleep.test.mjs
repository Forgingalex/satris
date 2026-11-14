import test from "node:test";
import assert from "node:assert/strict";
import {
  createCheck,
  createProfile,
  assess,
  validateCheck,
  validateProfile,
  buildExport,
  EXAMPLES,
  SOURCES,
} from "../src/sleep.js";
const observation = (changes) => ({
  ...createCheck(),
  sleepHours: 6,
  opportunityHours: 8,
  feeling: "alert",
  disruptionStatus: "none",
  ...changes,
});
const suppliedPlan = (changes) => ({
  ...createProfile(),
  planHours: 8,
  planSource: "Test fixture: supplied mission plan",
  ...changes,
});
test("same duration, different context yields different supported next steps", () => {
  const cases = EXAMPLES.map((x) =>
    assess({ ...createCheck("example"), ...x.check }, x.profile),
  );
  assert.equal(cases[0].actions[0].id, "schedule-review");
  assert.equal(cases[1].actions[0].id, "light-accommodation");
  assert.equal(cases[2].actions[0].id, "medical-review");
  assert.deepEqual(
    cases.map((x) => x.metrics.sleepHours),
    [6, 6, 6],
  );
});
test("a missing supplied plan never becomes a universal diagnostic target", () => {
  const r = assess(
    observation({ sleepHours: 3, opportunityHours: 4 }),
    createProfile(),
  );
  assert.equal(r.metrics.planHours, null);
  assert.equal(r.metrics.gapHours, null);
  assert(!r.findings.some((x) => x.id === "opportunity-gap"));
  assert(!r.actions.some((x) => x.id === "schedule-review"));
});
test("sleep opportunity comparison is exact supplied-plan arithmetic", () => {
  const r = assess(observation({ opportunityHours: 6 }), suppliedPlan());
  assert.equal(r.metrics.gapHours, 2);
  assert(r.actions.find((x) => x.id === "schedule-review").requiresReview);
});
test("unknown and zero sleep stay distinct", () => {
  const absent = assess(observation({ sleepHours: null }), suppliedPlan());
  const zero = assess(observation({ sleepHours: 0 }), suppliedPlan());
  assert.equal(absent.metrics.sleepHours, null);
  assert.equal(zero.metrics.sleepHours, 0);
  assert(
    absent.uncertainties.some((x) =>
      x.includes("Time asleep was not recorded"),
    ),
  );
});
test("uncertain estimates cannot establish a plan discrepancy", () => {
  const r = assess(
    observation({ quality: "uncertain", opportunityHours: 6 }),
    suppliedPlan(),
  );
  assert.equal(r.metrics.gapHours, null);
  assert(!r.actions.some((x) => x.id === "schedule-review"));
});
test("reported sleepiness overrides apparently adequate hours and missing data", () => {
  for (const hours of [null, 8, 10]) {
    const r = assess(
      observation({
        sleepHours: hours,
        opportunityHours: 10,
        feeling: "impact",
      }),
      suppliedPlan(),
    );
    assert.equal(r.priority, "review");
    assert.equal(r.actions[0].id, "medical-review");
  }
});
test("urgent reports override every numerical result and invalid optional inputs", () => {
  const r = assess(
    observation({ urgent: "yes", sleepHours: 100 }),
    suppliedPlan(),
  );
  assert.equal(r.priority, "urgent");
  assert.deepEqual(
    r.actions.map((x) => x.id),
    ["urgent-help"],
  );
  assert(r.summary.includes("Do not wait"));
});
test("uncertainty about urgent symptoms is never a negative screen", () => {
  assert.equal(
    assess(observation({ urgent: "unsure" }), createProfile()).priority,
    "urgent",
  );
});
test("light and schedule findings coexist without causal diagnosis", () => {
  const r = assess(
    observation({
      opportunityHours: 6,
      disruptionStatus: "reported",
      disruptions: ["light"],
    }),
    suppliedPlan({ eyeMask: "allowed" }),
  );
  assert(r.findings.some((x) => x.id === "opportunity-gap"));
  assert(r.findings.some((x) => x.id === "reported-light"));
  assert(
    r.findings
      .find((x) => x.id === "reported-light")
      .text.includes("not a sensor measurement"),
  );
});
test("an unknown or unavailable accommodation cannot be selected as ready to use", () => {
  for (const state of ["unknown", "unavailable"]) {
    const r = assess(
      observation({ disruptionStatus: "reported", disruptions: ["noise"] }),
      suppliedPlan({ earplugs: state }),
    );
    assert.equal(
      r.actions.find((x) => x.id === "noise-accommodation").available,
      false,
    );
    assert(
      r.actions.find((x) => x.id === "check-noise-resource").requiresReview,
    );
  }
});
test("a resource and communication change alters actionable guidance", () => {
  const c = observation({
    feeling: "impact",
    disruptionStatus: "reported",
    disruptions: ["light"],
  });
  const live = assess(
    c,
    suppliedPlan({ eyeMask: "allowed", communication: "available" }),
  );
  const offline = assess(
    c,
    suppliedPlan({ eyeMask: "unavailable", communication: "unavailable" }),
  );
  assert.notDeepEqual(live.actions[0].how, offline.actions[0].how);
  assert.equal(
    live.actions.find((x) => x.id === "light-accommodation").available,
    true,
  );
  assert.equal(
    offline.actions.find((x) => x.id === "light-accommodation").available,
    false,
  );
});
test("conflicting estimates require correction without silently changing either", () => {
  const c = observation({ sleepHours: 9, opportunityHours: 6 });
  assert(validateCheck(c).some((x) => x.includes("exceeds")));
  assert.equal(assess(c, suppliedPlan()).priority, "clarify");
  assert.equal(c.sleepHours, 9);
});
test("historical observations cannot substitute for a current review", () => {
  const r = assess(
    observation({ isCurrent: false, feeling: "unintended" }),
    suppliedPlan(),
  );
  assert.equal(r.headline, "Keep this as a historical record");
  assert.deepEqual(
    r.actions.map((x) => x.id),
    ["current-check"],
  );
});
test("unknown function becomes the first next step despite an accommodation finding", () => {
  const r = assess(
    observation({
      feeling: "unknown",
      disruptionStatus: "reported",
      disruptions: ["light"],
    }),
    suppliedPlan({ eyeMask: "allowed" }),
  );
  assert.equal(r.priority, "clarify");
  assert.equal(r.actions[0].id, "current-function");
});
test("a plan requires explicit provenance and never becomes clinician approved", () => {
  const p = suppliedPlan({ planSource: "" });
  assert(validateProfile(p).length);
  assert.equal(assess(observation(), p).metrics.planHours, null);
});
test("every interpretation and action has an identifiable evidence or engineering basis", () => {
  for (const x of EXAMPLES) {
    const r = assess({ ...createCheck("example"), ...x.check }, x.profile);
    for (const item of [...r.findings, ...r.actions]) {
      assert(item.sourceIds.length);
      for (const key of item.sourceIds) assert(SOURCES[key]);
    }
  }
});
test("mixed scenario inputs preserve origin and export as simulation context", () => {
  const c = {
    ...createCheck("example"),
    ...EXAMPLES[0].check,
    inputOrigins: {
      ...EXAMPLES[0].check.inputOrigins,
      sleepHours: "user-entry",
    },
    sleepHours: 5,
  };
  const e = buildExport(c, EXAMPLES[0].profile);
  assert.equal(e.fictional, true);
  assert.equal(e.check.inputOrigins.sleepHours, "user-entry");
  assert.equal(e.check.inputOrigins.opportunityHours, "example");
  assert(e.contextProvenance.includes("Fictional"));
  assert(e.transmission.includes("Nothing has been transmitted"));
});
test("export retains follow-up report without a causal efficacy claim", () => {
  const c = observation({
    followUp: {
      status: "better",
      at: new Date().toISOString(),
      note: "I used the accommodation",
    },
  });
  assert.equal(buildExport(c, suppliedPlan()).check.followUp.status, "better");
});
test("an optional saved assessment cannot conflict with the exported resource profile", () => {
  const c = observation({
    disruptionStatus: "reported",
    disruptions: ["light"],
  });
  c.assessment = assess(c, suppliedPlan({ eyeMask: "allowed" }));
  const e = buildExport(c, suppliedPlan({ eyeMask: "unavailable" }));
  assert.equal(e.profile.eyeMask, "unavailable");
  assert.equal(
    e.assessment.actions.find((x) => x.id === "light-accommodation").available,
    false,
  );
});
test("unknown sleep gets a specific clarification without forcing a fabricated value", () => {
  const r = assess(observation({ sleepHours: null }), suppliedPlan());
  assert(
    r.actions
      .find((x) => x.id === "clarify-sleep")
      .how.some((x) => x.includes("Do not guess")),
  );
});
test("export supplies meaningful units, time and per-observation provenance", () => {
  const e = buildExport(observation(), suppliedPlan());
  assert.equal(e.observations[0].unit, "h");
  assert.equal(e.observations[0].origin, "user-entry");
  assert(e.observations[0].observedAt);
});
