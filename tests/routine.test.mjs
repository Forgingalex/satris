import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSchedule,
  validateSchedule,
  nextRoutineAt,
  advanceRoutine,
  journeyProgress,
} from "../src/routine.js";
const s = {
  ...defaultSchedule(),
  enabled: true,
  timeZone: "Africa/Lagos",
  time: "08:00",
};
test("local preference chooses the next future calendar time", () => {
  assert.equal(
    nextRoutineAt(s, Date.parse("2026-11-14T06:00:00Z")),
    "2026-11-14T07:00:00.000Z",
  );
  assert.equal(
    nextRoutineAt(s, Date.parse("2026-11-14T08:00:00Z")),
    "2026-11-15T07:00:00.000Z",
  );
});
test("two-day and weekly cadences use calendar dates", () => {
  assert.equal(
    nextRoutineAt({ ...s, cadenceDays: 2 }, Date.parse("2026-11-14T08:00:00Z")),
    "2026-11-16T07:00:00.000Z",
  );
  assert.equal(
    nextRoutineAt({ ...s, cadenceDays: 7 }, Date.parse("2026-11-14T08:00:00Z")),
    "2026-11-21T07:00:00.000Z",
  );
});
test("daylight-saving changes preserve the selected wall time", () => {
  const ny = { ...s, timeZone: "America/New_York", time: "08:00" };
  assert.equal(
    nextRoutineAt(ny, Date.parse("2026-03-07T14:00:00Z")),
    "2026-03-08T12:00:00.000Z",
  );
  assert.equal(
    nextRoutineAt(ny, Date.parse("2026-10-31T13:00:00Z")),
    "2026-11-01T13:00:00.000Z",
  );
});
test("a nonexistent local clock time moves later across the DST gap", () => {
  assert.equal(
    nextRoutineAt(
      { ...s, timeZone: "America/New_York", time: "02:30" },
      Date.parse("2026-03-08T05:00:00Z"),
    ),
    "2026-03-08T07:30:00.000Z",
  );
});
test("only a current routine check after the due time advances the rhythm", () => {
  const due = { ...s, nextAt: "2026-11-14T07:00:00.000Z" },
    now = Date.parse("2026-11-14T09:00:00Z"),
    check = {
      urgent: "no",
      isCurrent: true,
      observedAt: "2026-11-14T08:00:00Z",
    };
  assert.equal(
    advanceRoutine(due, check, now).nextAt,
    "2026-11-15T07:00:00.000Z",
  );
  for (const changed of [
    { isCurrent: false },
    { urgent: "yes" },
    { urgent: "unsure" },
    { observedAt: "2026-11-13T08:00:00Z" },
  ])
    assert.deepEqual(advanceRoutine(due, { ...check, ...changed }, now), due);
  assert.deepEqual(advanceRoutine({ ...due, enabled: false }, check, now), {
    ...due,
    enabled: false,
  });
});
test("an early check does not move a future reminder", () => {
  const future = { ...s, nextAt: "2026-11-15T07:00:00.000Z" };
  assert.deepEqual(
    advanceRoutine(
      future,
      { urgent: "no", isCurrent: true, observedAt: "2026-11-14T08:00:00Z" },
      Date.parse("2026-11-14T09:00:00Z"),
    ),
    future,
  );
});
test("invalid preferences are rejected as format errors", () => {
  assert.ok(validateSchedule({ ...s, cadenceDays: 0 }).length);
  assert.ok(validateSchedule({ ...s, time: "25:00" }).length);
  assert.ok(validateSchedule({ ...s, timeZone: "not-a-zone" }).length);
});
test("journey progress records process, including an unwell check", () => {
  const r = {
    id: "r",
    check: {
      urgent: "no",
      isCurrent: true,
      selectedActionId: "medical-review",
      feeling: "impact",
      followUp: { status: "not_tried" },
    },
    assessment: { priority: "review" },
  };
  assert.equal(journeyProgress([r]).completed, 3);
  assert.equal(
    journeyProgress([
      {
        ...r,
        check: { ...r.check, urgent: "yes" },
        assessment: { priority: "urgent" },
      },
    ]).completed,
    0,
  );
  assert.equal(journeyProgress([]).completed, 0);
});
