import test from "node:test";
import assert from "node:assert/strict";
import { deriveAlerts, calendarEvent } from "../src/alerts.js";
const NOW = Date.parse("2026-11-15T10:00:00Z");
const record = (check = {}, assessment = {}) => ({
  id: "test-record",
  check: {
    observedAt: "2026-11-14T10:00:00Z",
    followUpAt: "2026-11-15T09:00:00Z",
    ...check,
  },
  assessment: { priority: "routine", ...assessment },
});
test("reminders are due only at user-selected times and resolve after follow-up", () => {
  assert.equal(deriveAlerts([record()], null, NOW)[0].kind, "reminder");
  assert.equal(
    deriveAlerts([record({ followUpAt: "2026-11-16T09:00:00Z" })], null, NOW)
      .length,
    0,
  );
  assert.equal(
    deriveAlerts([record({ followUp: { status: "same" } })], null, NOW).length,
    0,
  );
});
test("urgent and medical review tasks take precedence without duplicate alerts", () => {
  const alerts = deriveAlerts(
    [
      record({}, { priority: "review" }),
      { ...record({}, { priority: "urgent" }), id: "urgent" },
    ],
    null,
    NOW,
  );
  assert.deepEqual(
    alerts.map((a) => a.kind),
    ["urgent", "review"],
  );
});
test("completing an accommodation cannot silently clear a medical-review task", () => {
  const alerts = deriveAlerts(
    [
      record(
        { selectedActionId: "light-accommodation", actionStatus: "done" },
        { priority: "review" },
      ),
    ],
    null,
    NOW,
  );
  assert.equal(alerts[0].kind, "review");
});
test("a reported completed medical contact does not imply clinical clearance", () => {
  const alerts = deriveAlerts(
    [
      record(
        {
          selectedActionId: "medical-review",
          actionStatus: "done",
          followUpAt: null,
        },
        { priority: "review" },
      ),
    ],
    null,
    NOW,
  );
  assert.equal(alerts.length, 0);
});
test("reported worsening retains a review task and a draft concern is immediately visible", () => {
  assert.equal(
    deriveAlerts([record({ followUp: { status: "worse" } })], null, NOW)[0]
      .kind,
    "review",
  );
  assert.equal(
    deriveAlerts(
      [],
      {
        id: "draft",
        urgent: "unsure",
        observedAt: new Date(NOW).toISOString(),
      },
      NOW,
    )[0].kind,
    "urgent",
  );
});
test("calendar export contains the chosen UTC time and no health measurements", () => {
  const text = calendarEvent(record(), new Date(NOW).toISOString());
  assert(text.includes("DTSTART:20261115T090000Z"));
  assert(text.includes("BEGIN:VALARM"));
  assert(!text.includes("sleepHours"));
  assert(text.endsWith("END:VCALENDAR\r\n"));
});
