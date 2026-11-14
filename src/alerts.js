// Task reminders derived from recorded information, never physiological monitoring.
export function deriveAlerts(
  records = [],
  draft = null,
  nowMs = Date.now(),
  schedule = null,
) {
  const alerts = [];
  if (draft && ["yes", "unsure"].includes(draft.urgent))
    alerts.push({
      id: `draft-${draft.id}`,
      recordId: null,
      kind: "urgent",
      title: "A current concern needs help",
      message:
        "Open the recorded concern. Do not wait for routine measurements.",
      action: "record",
      at: draft.observedAt,
    });
  for (const record of records) {
    const c = record.check || {},
      a = record.assessment || {};
    const responseRecorded =
      c.selectedActionId === "urgent-help" &&
      c.actionStatus === "done" &&
      c.followUp?.status !== "not_tried";
    const medicalContactRecorded =
      c.selectedActionId === "medical-review" &&
      c.actionStatus === "done" &&
      c.followUp?.status !== "not_tried";
    const base = {
      recordId: record.id,
      at:
        c.followUp?.status === "worse"
          ? c.followUp.at || c.observedAt
          : c.observedAt,
    };
    if (a.priority === "urgent" && !responseRecorded)
      alerts.push({
        ...base,
        id: `urgent-${record.id}`,
        kind: "urgent",
        title: "A recorded concern needs a response",
        message:
          "Your urgent-concern action has not been marked completed. This is a task reminder, not a new assessment.",
        action: "record",
      });
    else if (
      (a.priority === "review" && !medicalContactRecorded) ||
      c.followUp?.status === "worse"
    )
      alerts.push({
        ...base,
        id: `review-${record.id}`,
        kind: "review",
        title:
          c.followUp?.status === "worse"
            ? "Worsening was reported at follow-up"
            : "A medical review is still recorded as needed",
        message:
          "Open the record and follow its review instructions. Completing a different action does not complete a medical review.",
        action: "record",
      });
    else if (
      c.followUpAt &&
      !c.followUp &&
      Number.isFinite(new Date(c.followUpAt).getTime()) &&
      new Date(c.followUpAt).getTime() <= nowMs
    )
      alerts.push({
        ...base,
        id: `reminder-${record.id}`,
        kind: "reminder",
        title: "Your chosen follow-up time has arrived",
        message:
          "Record what you tried and what you noticed. This time was your preference, not a clinical interval.",
        action: "follow",
        at: c.followUpAt,
      });
  }
  if (
    schedule?.enabled &&
    schedule.nextAt &&
    Number.isFinite(Date.parse(schedule.nextAt)) &&
    Date.parse(schedule.nextAt) <= nowMs
  )
    alerts.push({
      id: "routine-check",
      recordId: null,
      kind: "check",
      title: "Time for your sleep check",
      message:
        "Your chosen check-in time has arrived. Check when your mission duties allow; this is your routine, not a clinical interval.",
      action: "start",
      at: schedule.nextAt,
    });
  const order = { urgent: 0, review: 1, check: 2, reminder: 3 };
  return alerts.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}
const stamp = (date) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function calendarEvent(record, createdAt = new Date().toISOString()) {
  const when = record?.check?.followUpAt;
  if (!when || !Number.isFinite(new Date(when).getTime()))
    throw new Error("Choose a valid follow-up time first.");
  const safeId = String(record.id || "review").replace(/[^A-Za-z0-9-]/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SMASH//Satris//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${safeId}@satris.local`,
    `DTSTAMP:${stamp(createdAt)}`,
    `DTSTART:${stamp(when)}`,
    "SUMMARY:Satris follow-up",
    "DESCRIPTION:Open Satris to review your chosen next step.",
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Satris follow-up",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
