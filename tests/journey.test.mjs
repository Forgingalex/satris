import test from "node:test";
import assert from "node:assert/strict";
import {
  beginReturn,
  linkReturn,
  returnSummary,
  reviewNote,
} from "../src/journey.js";
import {
  createCheck,
  createProfile,
  assess,
  buildExport,
} from "../src/sleep.js";
import { contextSummary } from "../src/context.js";
import {
  deriveAlerts,
  primaryPlan,
  reportedWorsening,
  worseningContactRecorded,
} from "../src/alerts.js";
import {
  freshWorkspace,
  saveWorkspace,
  loadWorkspace,
} from "../src/workspace.js";
function first(mode = "personal") {
  const profile = { ...createProfile(), eyeMask: "allowed" };
  const check = {
    ...createCheck(mode),
    sleepHours: 6,
    opportunityHours: 8,
    feeling: "sleepy",
    disruptions: ["light"],
    disruptionStatus: "reported",
    selectedActionId: "light-accommodation",
    observedAt: new Date(Date.now() - 86400000).toISOString(),
  };
  if (mode === "example") check.scenarioId = "light";
  return {
    id: check.id,
    check,
    profile,
    assessment: assess(check, profile),
    savedAt: new Date().toISOString(),
    followUps: [],
  };
}
function returned(
  prior,
  extra = {},
  profile = prior.profile,
  response = "tried",
  change = "same",
  note = "",
) {
  const check = {
    ...beginReturn(prior, response, change, note),
    sleepHours: 7.5,
    opportunityHours: 8,
    feelingScope: "current",
    feelingObservedAt: new Date().toISOString(),
    feeling: "sleepy",
    disruptionStatus: "none",
    ...extra,
  };
  const assessment = assess(check, profile);
  check.selectedActionId = assessment.actions.find((a) => a.available).id;
  return {
    id: check.id,
    check,
    profile,
    assessment,
    context: contextSummary(check, [prior]),
    savedAt: new Date().toISOString(),
    followUps: [],
  };
}
test("beginning a return remembers the step without reusing old measurements or changing the saved check", () => {
  const p = first(),
    before = structuredClone(p),
    c = beginReturn(p, "tried", "unknown");
  assert.deepEqual(p, before);
  assert.notEqual(c.id, p.id);
  for (const key of ["sleepHours", "opportunityHours", "reactionMs"])
    assert.equal(c[key], null);
  assert.equal(c.feeling, "unknown");
  assert.deepEqual(c.disruptions, []);
  assert.deepEqual(c.inputOrigins, {});
  assert.equal(c.returnContext.previousActionId, "light-accommodation");
});
for (const feeling of ["impact", "unintended"])
  test(`more sleep after an accommodation never suppresses current ${feeling}`, () => {
    const p = first(),
      r = returned(p, { feeling });
    assert.equal(r.assessment.priority, "review");
    assert.equal(r.assessment.actions[0].id, "medical-review");
    const summary = returnSummary(r.check, r.assessment, [p]);
    assert(summary.changed);
    assert.equal(summary.oldAction, "Review the light accommodation");
  });
test("reported improvement cannot override current symptoms or fabricate treatment success", () => {
  const p = first(),
    r = returned(p, { feeling: "impact" }, p.profile, "tried", "better");
  assert.equal(r.assessment.priority, "review");
  assert(reviewNote(r, [p]).includes("do not establish its effect"));
});
test("a blocked action requires an obstacle before a fresh check can begin", () => {
  assert.throws(
    () => beginReturn(first(), "blocked", "unknown", "  "),
    /obstacle/,
  );
  const c = beginReturn(first(), "blocked", "unknown", "Mask unavailable");
  assert.equal(c.returnContext.note, "Mask unavailable");
});
test("unavailable equipment changes the next action instead of recommending it as ready", () => {
  const p = first(),
    r = returned(
      p,
      { disruptions: ["light"], disruptionStatus: "reported" },
      { ...p.profile, eyeMask: "unavailable" },
      "blocked",
      "same",
      "Mask unavailable",
    );
  assert.equal(
    r.assessment.actions.find((a) => a.id === "light-accommodation").available,
    false,
  );
  assert.equal(r.check.selectedActionId, "check-light-resource");
});
test("unknown current functioning requests clarification and never borrows the earlier answer", () => {
  const p = first(),
    r = returned(p, { feeling: "unknown" });
  assert.equal(r.assessment.priority, "clarify");
});
test("a similar fresh check can retain the same supported next step", () => {
  const p = first(),
    r = returned(p, { disruptions: ["light"], disruptionStatus: "reported" });
  assert.equal(returnSummary(r.check, r.assessment, [p]).changed, false);
});
test("the return comparison follows the user's selected available action", () => {
  const p = first();
  const r = returned(
    p,
    { disruptions: ["light", "noise"], disruptionStatus: "reported" },
    { ...p.profile, earplugs: "allowed" },
  );
  r.check.selectedActionId = "noise-accommodation";
  assert.equal(
    returnSummary(r.check, r.assessment, [p]).nextAction,
    "Review the noise accommodation",
  );
  assert.equal(
    reviewNote(r, [p]).includes("Next step: Review the noise accommodation"),
    true,
  );
});
test("urgent reports override the return comparison and all numerical results", () => {
  const p = first(),
    r = returned(p, {
      urgent: "yes",
      urgentReportedAt: new Date().toISOString(),
      sleepHours: 50,
    });
  assert.equal(r.assessment.priority, "urgent");
  assert.equal(r.check.selectedActionId, "urgent-help");
  assert.throws(() => beginReturn(r, "tried", "same"), /emergency response/);
});
test("saving links both records, preserves the original assessment and resolves only the follow-up reminder", () => {
  const p = first();
  p.check.followUpAt = new Date(Date.now() - 1000).toISOString();
  const original = structuredClone(p.assessment),
    r = returned(p);
  linkReturn(r, [p]);
  assert.deepEqual(p.assessment, original);
  assert.equal(p.returnRecordId, r.id);
  assert.equal(p.followUps.length, 1);
  assert.equal(p.check.actionStatus, "planned");
  assert(!deriveAlerts([p, r]).some((a) => a.kind === "reminder"));
  assert.throws(() => linkReturn(r, [p]), /already/);
});
test("returning does not complete an earlier medical contact", () => {
  const p = first();
  p.check.feeling = "impact";
  p.assessment = assess(p.check, p.profile);
  p.check.selectedActionId = "medical-review";
  const r = returned(p, { feeling: "alert" });
  linkReturn(r, [p]);
  assert(
    deriveAlerts([p, r]).some(
      (a) => a.recordId === p.id && a.kind === "review",
    ),
  );
});
test("links cannot cross people, workspaces or example scenarios", () => {
  for (const extra of [
    { mode: "example" },
    { personId: "someone-else" },
    { scenarioId: "another" },
  ]) {
    const p = first(),
      r = returned(p, extra);
    assert.equal(returnSummary(r.check, r.assessment, [p]), null);
    assert.throws(() => linkReturn(r, [p]), /unavailable/);
  }
});
test("linked drafts and saved returns survive reload, JSON export and further returns", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
  };
  const p = first("example"),
    s = freshWorkspace();
  s.mode = "example";
  s.workspaces.example.checks.push(p);
  const r = returned(p, { feeling: "impact" });
  s.workspaces.example.draft = r.check;
  saveWorkspace(s);
  assert.deepEqual(
    loadWorkspace().state.workspaces.example.draft.returnContext,
    r.check.returnContext,
  );
  linkReturn(r, s.workspaces.example.checks);
  s.workspaces.example.checks.push(r);
  s.workspaces.example.draft = null;
  saveWorkspace(s);
  const loaded = loadWorkspace().state.workspaces.example;
  assert.equal(loaded.checks[0].returnRecordId, r.id);
  assert.equal(
    buildExport(loaded.checks[1].check, loaded.checks[1].profile).check
      .returnContext.previousRecordId,
    p.id,
  );
  assert.equal(
    beginReturn(loaded.checks[1], "not_tried", "unknown").scenarioId,
    "light",
  );
});
test("review notes identify simulation, timing, action status, constraints and the source basis", () => {
  const p = first("example"),
    r = returned(
      p,
      { feeling: "impact" },
      p.profile,
      "blocked",
      "worse",
      "Mask unavailable",
    );
  const note = reviewNote(r, [p]);
  for (const text of [
    "FICTIONAL",
    "Mask unavailable",
    "Current condition reported:",
    "Sleep observed:",
    "NHS:",
    "Not sent",
    "No diagnosis",
    "Planned; completion not confirmed",
  ])
    assert(note.includes(text));
});
test("invalid return choices and repeated returns do not mutate an earlier record", () => {
  const p = first();
  assert.throws(() => beginReturn(p, "invented", "same"), /Choose/);
  assert.throws(() => beginReturn(p, "tried", "invented"), /Choose/);
  p.returnRecordId = "already";
  assert.throws(() => beginReturn(p, "tried", "same"), /already/);
});
for (const response of ["blocked", "not_tried"])
  test(`worsening remains visible when the action was ${response}`, () => {
    const p = first();
    const r = returned(
      p,
      { feeling: "unknown" },
      p.profile,
      response,
      "worse",
      "No mask available",
    );
    linkReturn(r, [p]);
    assert.equal(p.check.followUp.status, "not_tried");
    assert.equal(reportedWorsening(p.check), true);
    assert.equal(r.assessment.priority, "clarify");
    const alert = deriveAlerts([p, r]).find((a) => a.kind === "review");
    assert.equal(alert.recordId, r.id);
    assert.match(alert.title, /Worsening/);
    assert.equal(primaryPlan([p, r]).id, r.id);
    assert.equal(
      deriveAlerts([p, r]).filter((a) => a.kind === "review").length,
      1,
    );
  });
test("Today keeps an older unresolved urgent concern ahead of a newer routine check", () => {
  const p = first(),
    routine = first();
  p.check.urgent = "yes";
  p.check.urgentReportedAt = new Date().toISOString();
  p.assessment = assess(p.check, p.profile);
  p.check.selectedActionId = "urgent-help";
  assert.equal(primaryPlan([p, routine]).id, p.id);
  p.check.actionStatus = "done";
  assert.equal(primaryPlan([p, routine]).id, routine.id);
});
test("Today keeps an older unresolved medical review ahead of routine work without completing the contact", () => {
  const p = first(),
    routine = first();
  p.check.feeling = "impact";
  p.assessment = assess(p.check, p.profile);
  p.check.selectedActionId = "medical-review";
  assert.equal(primaryPlan([p, routine]).id, p.id);
  assert.equal(p.check.actionStatus, "planned");
  p.check.actionStatus = "done";
  assert.equal(primaryPlan([p, routine]).id, routine.id);
  assert.equal(primaryPlan([]), null);
});
for (const observedAt of [
  "invalid",
  new Date(Date.now() + 86400000).toISOString(),
])
  test(`an urgent note labels unusable sleep time ${observedAt === "invalid" ? "malformed" : "future"}`, () => {
    const p = first(),
      r = returned(p, {
        urgent: "yes",
        urgentReportedAt: new Date().toISOString(),
        observedAt,
      });
    const note = reviewNote(r, [p]);
    assert.equal(r.assessment.priority, "urgent");
    assert.match(note, /Sleep observed: UNUSABLE time:/);
    assert.match(note, /Estimated sleep: UNUSABLE observation/);
    assert.match(note, /DATA QUALITY/);
    assert.match(note, /Do not wait for this note to get help/);
  });
test("an urgent note marks contradictory numeric observations unusable while preserving unknown values", () => {
  const p = first(),
    r = returned(p, { urgent: "yes", sleepHours: 12, opportunityHours: 6 });
  assert.match(reviewNote(r, [p]), /Estimated sleep: UNUSABLE observation/);
  r.check.sleepHours = null;
  assert.match(reviewNote(r, [p]), /Estimated sleep: Not known/);
});
test("an unfinished worsening return alerts immediately without changing the saved record", () => {
  const p = first(),
    before = structuredClone(p),
    draft = beginReturn(p, "blocked", "worse", "No equipment");
  const alerts = deriveAlerts([p], draft);
  assert.equal(alerts[0].kind, "review");
  assert.equal(alerts[0].recordId, null);
  assert.equal(reportedWorsening(draft), true);
  assert.deepEqual(p, before);
  draft.urgent = "yes";
  assert.equal(deriveAlerts([p], draft)[0].kind, "urgent");
});
test("explicit medical contact resolves the worsening task without rewriting observations or marking the accommodation done", () => {
  const p = first(),
    r = returned(
      p,
      { feeling: "unknown" },
      p.profile,
      "blocked",
      "worse",
      "No equipment",
    );
  linkReturn(r, [p]);
  const contactAt = new Date().toISOString();
  r.check.medicalContactAt = contactAt;
  r.check.medicalContacts = [
    { at: contactAt, note: "Spoke to designated support" },
  ];
  assert.equal(worseningContactRecorded(r.check), true);
  assert.equal(deriveAlerts([p, r]).length, 0);
  assert.equal(r.check.actionStatus, "planned");
  assert.equal(r.check.returnContext.change, "worse");
  assert.match(reviewNote(r, [p]), /Spoke to designated support/);
});
test("older or future medical contact cannot acknowledge a newer worsening report", () => {
  const p = first(),
    r = returned(p, { feeling: "unknown" }, p.profile, "not_tried", "worse");
  const now = Date.now();
  r.check.returnContext.at = new Date(now - 1000).toISOString();
  for (const at of [now - 2000, now + 1000]) {
    r.check.medicalContactAt = new Date(at).toISOString();
    assert.equal(worseningContactRecorded(r.check, now), false);
    assert.equal(deriveAlerts([r], null, now)[0].kind, "review");
  }
});
