// Descriptive context only. This module does not classify health or task readiness.
import { feelingIsCurrent, personIdentity } from "./sleep.js";
const knownNumber = (v) => typeof v === "number" && Number.isFinite(v);
const norm = (v) =>
  String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
const time = (v) => (v ? Date.parse(v) : NaN);
const rounded = (v) => Math.round(v * 100) / 100;
const feeling = {
  alert: "functioning as usual",
  sleepy: "sleepy but managing",
  impact: "sleepiness affecting activities",
  unintended: "often falling asleep unintentionally",
  unknown: "current sleepiness not known",
};
export function validateContext(c, nowMs = Date.now()) {
  const errors = [];
  for (const key of ["stress", "workload"])
    if (
      c[key] !== undefined &&
      !["low", "usual", "high", "unknown"].includes(c[key])
    )
      errors.push(`Choose a reported ${key} category or leave it unknown.`);
  if (
    c.scheduleChanged !== undefined &&
    !["yes", "no", "unknown"].includes(c.scheduleChanged)
  )
    errors.push("Confirm whether the schedule changed, or leave it unknown.");
  if (c.caffeineMg != null && (!knownNumber(c.caffeineMg) || c.caffeineMg < 0))
    errors.push(
      "Reported caffeine must be a nonnegative amount in mg, or left unknown. This is a format check.",
    );
  for (const [key, label] of [
    ["bedTime", "Sleep opportunity start"],
    ["wakeTime", "Sleep opportunity end"],
    ["caffeineTime", "Caffeine time"],
  ])
    if (c[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c[key]))
      errors.push(`${label} must use a valid 24-hour clock time.`);
  if (c.reactionMs != null) {
    if (!knownNumber(c.reactionMs) || c.reactionMs <= 0)
      errors.push(
        "An existing reaction result must be a positive number in milliseconds, or left blank.",
      );
    for (const [key, label] of [
      ["reactionMethod", "test or measurement method"],
      ["reactionDevice", "device"],
      ["reactionProtocol", "protocol"],
    ])
      if (!norm(c[key]))
        errors.push(
          `Name the ${label} for this existing reaction result, or remove the optional result.`,
        );
    if (!["mean", "median", "other"].includes(c.reactionMetric))
      errors.push(
        "Specify whether the existing result is a mean, median or another metric.",
      );
    if (c.reactionObservedAt && !Number.isFinite(time(c.reactionObservedAt)))
      errors.push(
        "Record a valid reaction-test time, or leave its time unknown.",
      );
    else if (c.reactionObservedAt && time(c.reactionObservedAt) > nowMs)
      errors.push(
        "Reaction-test time cannot be in the future. Record a result already measured, or leave its time unknown.",
      );
  }
  return errors;
}
function cohort(c, records, nowMs) {
  const currentTime = time(c.observedAt);
  const person = personIdentity(c);
  if (person === null) return [];
  if (!Number.isFinite(currentTime) || currentTime > nowMs) return [];
  const candidates = records
    .map((r) => ({ c: r.check || r, savedAt: r.savedAt || r.enteredAt || "" }))
    .filter(({ c: p, savedAt }) => {
      if (
        time(p.observedAt) > nowMs ||
        (Number.isFinite(time(savedAt)) && time(p.observedAt) > time(savedAt))
      )
        return false;
      if (
        p.id === c.id ||
        norm(p.mode || "personal") !== norm(c.mode || "personal")
      )
        return false;
      if (personIdentity(p) !== person) return false;
      if (
        c.mode === "example" &&
        (!c.scenarioId || p.scenarioId !== c.scenarioId)
      )
        return false;
      if (norm(p.periodType || "main") !== norm(c.periodType || "main"))
        return false;
      return (
        Number.isFinite(time(p.observedAt)) &&
        Number.isFinite(currentTime) &&
        time(p.observedAt) < currentTime
      );
    })
    .sort(
      (a, b) =>
        time(a.c.observedAt) - time(b.c.observedAt) ||
        time(a.savedAt) - time(b.savedAt),
    );
  const periods = new Map();
  for (const entry of candidates) {
    const key = entry.c.sleepPeriodId || entry.c.observedAt;
    if (
      !periods.has(key) ||
      time(entry.savedAt) >= time(periods.get(key).savedAt) ||
      !Number.isFinite(time(periods.get(key).savedAt))
    )
      periods.set(key, entry);
  }
  return [...periods.values()]
    .map((x) => x.c)
    .sort((a, b) => time(a.observedAt) - time(b.observedAt));
}
function metricComparison(c, prior, key, nowMs) {
  const earlier = prior
    .filter(
      (p) =>
        p.quality !== "uncertain" &&
        knownNumber(p[key]) &&
        p[key] >= 0 &&
        p[key] <= 24,
    )
    .slice(-7);
  const values = earlier.map((p) => p[key]);
  const mean = values.length
    ? rounded(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
  const current =
    c.quality !== "uncertain" &&
    knownNumber(c[key]) &&
    Number.isFinite(time(c.observedAt)) &&
    time(c.observedAt) <= nowMs
      ? c[key]
      : null;
  return {
    count: earlier.length,
    mean,
    difference:
      current !== null && mean !== null ? rounded(current - mean) : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    firstAt: earlier[0]?.observedAt || null,
    lastAt: earlier.at(-1)?.observedAt || null,
    earlier,
    current,
  };
}
function reactionKey(c) {
  return [
    "reactionMetric",
    "reactionMethod",
    "reactionProtocol",
    "reactionDevice",
  ]
    .map((k) => norm(c[k]))
    .join("|");
}
function validReaction(c, nowMs) {
  return (
    knownNumber(c.reactionMs) &&
    c.reactionMs > 0 &&
    ["mean", "median"].includes(c.reactionMetric) &&
    ["reactionMethod", "reactionProtocol", "reactionDevice"].every((k) =>
      norm(c[k]),
    ) &&
    Number.isFinite(time(c.reactionObservedAt)) &&
    time(c.reactionObservedAt) <= nowMs &&
    c.reactionQuality !== "uncertain"
  );
}
export function contextSummary(c, records = [], nowMs = Date.now()) {
  const prior = cohort(c, records, nowMs),
    sleep = metricComparison(c, prior, "sleepHours", nowMs),
    opportunity = metricComparison(c, prior, "opportunityHours", nowMs);
  const signed =
    sleep.difference === null
      ? null
      : sleep.difference === 0
        ? "the same as"
        : `${Math.abs(sleep.difference)} h ${sleep.difference > 0 ? "more" : "less"} than`;
  const text =
    sleep.count === 0
      ? "No comparable earlier sleep records are available. This is not an established baseline."
      : sleep.difference === null
        ? `${sleep.count} earlier comparable sleep ${sleep.count === 1 ? "record is" : "records are"} available, but this check has no usable duration to compare.`
        : `This estimate is ${signed} the mean of ${sleep.count} earlier comparable ${sleep.count === 1 ? "record" : "records"} (${sleep.mean} h). This is a descriptive comparison, not a clinical threshold.`;
  const items = [
    {
      label: "Sleep",
      value: knownNumber(c.sleepHours)
        ? `${c.sleepHours} h ${c.quality === "uncertain" ? "(uncertain estimate)" : "estimated"}`
        : "Not recorded",
      meaning: "For the reported main sleep period.",
    },
    {
      label: "Available opportunity",
      value: knownNumber(c.opportunityHours)
        ? `${c.opportunityHours} h`
        : "Not recorded",
      meaning: "Time available, not time confirmed asleep.",
    },
    {
      label: feelingIsCurrent(c) ? "Current experience" : "Recorded experience",
      value: feeling[c.feeling] || feeling.unknown,
      meaning: `A plain-language report, not a validated numerical scale. Condition report time: ${c.feelingObservedAt || (c.feelingScope === "current" ? "not recorded" : c.observedAt) || "not recorded"}.`,
    },
  ];
  if (c.bedTime || c.wakeTime)
    items.push({
      label: "Reported sleep window",
      value: `${c.bedTime || "Unknown start"} to ${c.wakeTime || "unknown end"}${c.sleepTimeZone ? " · " + c.sleepTimeZone : ""}`,
      meaning:
        "Clock timing is reported context. Circadian phase is not measured or inferred.",
    });
  for (const key of ["stress", "workload"])
    if (c[key] && c[key] !== "unknown")
      items.push({
        label: key === "stress" ? "Reported stress" : "Reported workload",
        value: c[key],
        meaning:
          "Self-reported context; no causal weight or validated score is assigned.",
      });
  if (c.scheduleChanged && c.scheduleChanged !== "unknown")
    items.push({
      label: "Schedule change reported",
      value: c.scheduleChanged === "yes" ? "Yes" : "No",
      meaning: "A schedule change is not a diagnosis of circadian disruption.",
    });
  if (c.caffeineMg != null || c.caffeineTime)
    items.push({
      label: "Latest reported caffeine intake",
      value: `${c.caffeineMg == null ? "Amount unknown" : c.caffeineMg + " mg"}${c.caffeineTime ? " at " + c.caffeineTime : ""}`,
      meaning: "This is not a daily total or an inferred effect on alertness.",
    });
  let reactionComparison = null;
  if (c.reactionMs != null) {
    items.push({
      label: "Existing reaction-test result",
      value: `${c.reactionMs} ms${c.reactionMetric ? " · " + c.reactionMetric : ""}`,
      meaning: `${c.reactionMethod || "Method unknown"}; ${c.reactionProtocol || "protocol unknown"}; ${c.reactionDevice || "device unknown"}. Test time: ${c.reactionObservedAt || "not recorded"}. Not measured by Satris.`,
    });
    const tests = validReaction(c, nowMs)
      ? prior
          .filter(
            (p) =>
              validReaction(p, nowMs) &&
              reactionKey(p) === reactionKey(c) &&
              time(p.reactionObservedAt) < time(c.reactionObservedAt),
          )
          .filter(
            (p, i, all) =>
              all.findIndex(
                (x) => x.reactionObservedAt === p.reactionObservedAt,
              ) === i,
          )
          .slice(-7)
      : [];
    const mean = tests.length
      ? rounded(tests.reduce((n, p) => n + p.reactionMs, 0) / tests.length)
      : null;
    reactionComparison = {
      count: tests.length,
      meanMs: mean,
      differenceMs: mean === null ? null : rounded(c.reactionMs - mean),
      text: tests.length
        ? `Compared with ${tests.length} earlier result${tests.length === 1 ? "" : "s"} with matching metric, method, protocol and device: mean ${mean} ms. No health or task-readiness classification is made.`
        : "No compatible dated earlier result is available for comparison. Different metrics, protocols or devices are not pooled.",
    };
  }
  const summary = `${knownNumber(c.sleepHours) ? c.sleepHours + " h estimated sleep" : "Sleep amount not recorded"}; ${knownNumber(c.opportunityHours) ? c.opportunityHours + " h available" : "opportunity not recorded"}.${c.isCurrent === false ? " This sleep record is from an earlier period." : ""} ${feelingIsCurrent(c) ? "Current condition report" : "Earlier condition report"}: ${feeling[c.feeling] || feeling.unknown}.${c.workload && c.workload !== "unknown" ? " Reported workload: " + c.workload + "." : ""}${c.stress && c.stress !== "unknown" ? " Reported stress: " + c.stress + "." : ""} Sleep and condition reports retain their own times; their combination does not establish a cause or clear you for a task.`;
  return {
    heading: c.upcomingTask
      ? `Context to review before ${c.upcomingTask}`
      : "Your sleep review",
    summary,
    items,
    comparison: {
      count: sleep.count,
      meanHours: sleep.mean,
      differenceHours: sleep.difference,
      minHours: sleep.min,
      maxHours: sleep.max,
      text,
      opportunityCount: opportunity.count,
      opportunityMeanHours: opportunity.mean,
      opportunityDifferenceHours: opportunity.difference,
      series: [
        ...sleep.earlier.map((p) => ({
          at: p.observedAt,
          hours: p.sleepHours,
          current: false,
        })),
        { at: c.observedAt, hours: sleep.current, current: true },
      ],
    },
    reactionComparison,
    limitations: [
      "History is descriptive, not a clinical normal range or learned readiness cutoff.",
      "Clock timing, workload, stress and caffeine reports do not establish the cause of a reaction or sleep change.",
      "Matching device and protocol labels does not validate the test or its timing accuracy.",
      "Only earlier entries from the same person and workspace are compared. Examples also require the same scenario.",
      "Duplicates use a supplied sleep-period identifier, or exact observation time when one is absent; separate entries can still describe the same period.",
    ],
    sourceIds: ["study", "fatigue", "design"],
  };
}
