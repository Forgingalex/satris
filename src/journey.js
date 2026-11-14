import {
  createCheck,
  SOURCES,
  validateCheck,
  feelingIsCurrent,
  personIdentity,
} from "./sleep.js";

export const RESPONSES = {
  tried: "Step attempted",
  blocked: "Unable to take the step",
  not_tried: "Step not yet attempted",
};
export const CHANGES = {
  better: "Reported improvement",
  same: "No reported change",
  worse: "Reported worsening",
  unknown: "Change not known",
};
export function previousRecord(check, records) {
  const prior = records.find(
    (r) => r.id === check.returnContext?.previousRecordId,
  );
  return prior &&
    (prior.check.mode || "personal") === (check.mode || "personal") &&
    (prior.check.scenarioId || null) === (check.scenarioId || null) &&
    personIdentity(check) !== null &&
    personIdentity(prior.check) === personIdentity(check)
    ? prior
    : null;
}
export function beginReturn(
  prior,
  response,
  change,
  note = "",
  now = new Date().toISOString(),
) {
  if (prior.assessment.priority === "urgent")
    throw Error(
      "An urgent concern needs its emergency response, not a routine return check.",
    );
  if (!RESPONSES[response] || !CHANGES[change])
    throw Error("Choose what happened to the step and what you noticed.");
  if (response === "blocked" && !note.trim())
    throw Error(
      "Tell us what prevented the step so the obstacle stays in your record.",
    );
  if (prior.returnRecordId)
    throw Error(
      "This check already has a return assessment. Open that assessment to continue.",
    );
  if (personIdentity(prior.check) === null)
    throw Error(
      "The person identifiers conflict. Correct them before starting a return check.",
    );
  const check = createCheck(prior.check.mode || "personal");
  for (const key of ["scenarioId"])
    if (prior.check[key]) check[key] = prior.check[key];
  check.personId = personIdentity(prior.check);
  check.observedAt = now;
  check.enteredAt = now;
  check.returnContext = {
    previousRecordId: prior.id,
    previousActionId: prior.check.selectedActionId,
    response,
    change,
    note: note.trim(),
    at: now,
  };
  return check;
}
export function linkReturn(record, records) {
  if (!record.check.returnContext) return;
  const prior = previousRecord(record.check, records);
  if (!prior || prior.returnRecordId)
    throw Error(
      "The previous check is unavailable or already has a return assessment. Your draft is retained.",
    );
  const f = {
    ...record.check.returnContext,
    status:
      record.check.returnContext.response === "tried"
        ? record.check.returnContext.change
        : "not_tried",
    nextRecordId: record.id,
  };
  prior.check.followUp = f;
  prior.followUps ??= [];
  prior.followUps.push(structuredClone(f));
  prior.returnRecordId = record.id;
}
export function returnSummary(check, assessment, records) {
  const prior = previousRecord(check, records);
  if (!prior) return null;
  const oldAction = prior.assessment.actions.find(
    (a) => a.id === prior.check.selectedActionId,
  );
  const next =
    assessment.actions.find(
      (a) => a.id === check.selectedActionId && a.available,
    ) || assessment.actions.find((a) => a.available);
  return {
    prior,
    oldAction: oldAction?.title || "Previous step not recorded",
    nextAction: next?.title || assessment.headline,
    changed:
      prior.assessment.priority !== assessment.priority ||
      oldAction?.id !== next?.id,
    response: RESPONSES[check.returnContext.response],
    change: CHANGES[check.returnContext.change],
  };
}
const stamp = (value) => value || "Not recorded";
const hours = (value) => (value == null ? "Not known" : `${value} h`);
export function reviewNote(record, records = []) {
  const c = record.check,
    a = record.assessment,
    p = record.profile;
  const next =
    a.actions.find((x) => x.id === c.selectedActionId) ||
    a.actions.find((x) => x.available);
  const summary = returnSummary(c, a, records);
  const issues = validateCheck(c);
  const invalidSleepTime =
    !c.observedAt ||
    !Number.isFinite(Date.parse(c.observedAt)) ||
    Date.parse(c.observedAt) > Date.now();
  const sleepValue = (value) =>
    value == null
      ? "Not known"
      : invalidSleepTime ||
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 24 ||
          (typeof c.sleepHours === "number" &&
            typeof c.opportunityHours === "number" &&
            c.sleepHours > c.opportunityHours)
        ? `UNUSABLE observation (${String(value)} h recorded; correct the time or conflicting values)`
        : hours(value);
  const lines = [
    "SATRIS | CREW REVIEW NOTE",
    c.mode === "example"
      ? "FICTIONAL MISSION CONTEXT. Observations may include user edits."
      : "User-reported observations. Not independently verified.",
    "",
    `Sleep observed: ${invalidSleepTime ? "UNUSABLE time: " : ""}${stamp(c.observedAt)}`,
    `${feelingIsCurrent(c) ? "Current" : "Earlier"} condition reported: ${stamp(c.feelingObservedAt)}`,
    `Estimated sleep: ${sleepValue(c.sleepHours)}`,
    `Available sleep opportunity: ${sleepValue(c.opportunityHours)}`,
    `Estimate quality: ${c.quality || "Not recorded"}`,
    `Sleep period: ${c.isCurrent === false ? "Earlier period" : "Latest main period reported"}`,
    `Reported functioning: ${{ alert: "As usual", sleepy: "Sleepy but managing", impact: "Sleepiness affects activities", unintended: "Often falling asleep unintentionally", unknown: "Not known" }[c.feeling] || "Not known"}`,
    `Noticed disruptions: ${c.disruptions?.length ? c.disruptions.join(", ") : c.disruptionStatus === "none" ? "None noticed" : "Not known"}`,
    `Setting: ${p.environment || "Not specified"}`,
    `Ground communication: ${p.communication || "Not confirmed"}`,
    `Supplied opportunity plan: ${hours(p.planHours)}; source: ${p.planSource || "Not supplied"}`,
  ];
  if (summary)
    lines.push(
      "",
      "PREVIOUS STEP AND RETURN",
      `Previous check: ${summary.prior.id}`,
      `Previous sleep observed: ${stamp(summary.prior.check.observedAt)}; estimated sleep: ${hours(summary.prior.check.sleepHours)}; available opportunity: ${hours(summary.prior.check.opportunityHours)}`,
      `Previous step: ${summary.oldAction}`,
      `Action report at ${stamp(c.returnContext.at)}: ${summary.response}`,
      `Reported change: ${summary.change}`,
      `Obstacle or observation: ${c.returnContext.note || "None recorded"}`,
      ...(c.returnContext.resource
        ? [
            `Resource reported at return: ${c.returnContext.resource.name}; ${c.returnContext.resource.status}`,
          ]
        : []),
    );
  lines.push(
    "",
    "CURRENT REVIEW",
    a.headline,
    a.summary,
    `Next step: ${next?.title || "Not selected"}`,
    `Step status: ${c.actionStatus === "done" ? "Reported completed; does not establish clinical clearance" : "Planned; completion not confirmed"}`,
  );
  if (c.urgent !== "no")
    lines.push(
      `Urgent concern reported: ${stamp(c.urgentReportedAt)}. Do not wait for this note to get help.`,
    );
  if (issues.length)
    lines.push(
      "",
      "DATA QUALITY: correct these entries before using the measurements",
      ...issues,
    );
  lines.push(...a.uncertainties.map((t) => `Uncertainty: ${t}`));
  if (c.notes) lines.push(`Crew note: ${c.notes}`);
  for (const contact of c.medicalContacts || [])
    lines.push(
      `Reported medical contact: ${stamp(contact.at)}; ${contact.note || "No additional note"}. Contact does not establish clinical clearance.`,
    );
  lines.push(
    "",
    "BASIS",
    ...a.sourceIds
      .map((id) => SOURCES[id])
      .filter(Boolean)
      .map(
        (s) =>
          `${s.title} | ${s.version} | ${s.url || "Satris engineering choice"}`,
      ),
    "",
    "Prepared locally. Not sent to medical support. No diagnosis, prescription or fitness clearance. Changes after a step do not establish its effect.",
  );
  return lines.join("\n");
}
