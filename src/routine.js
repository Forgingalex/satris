const CADENCES = [1, 2, 7];
export function defaultSchedule() {
  return {
    enabled: false,
    cadenceDays: 1,
    time: "08:00",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    nextAt: null,
  };
}
function zoneOK(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function validateSchedule(schedule) {
  const errors = [];
  if (typeof schedule.enabled !== "boolean")
    errors.push("Choose whether reminders are enabled.");
  if (!CADENCES.includes(Number(schedule.cadenceDays)))
    errors.push("Choose a check-in rhythm of 1, 2 or 7 days.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time || ""))
    errors.push("Choose a valid local reminder time.");
  if (!zoneOK(schedule.timeZone))
    errors.push("Confirm a valid time zone for this rhythm.");
  if (schedule.nextAt && !Number.isFinite(Date.parse(schedule.nextAt)))
    errors.push("Choose a valid next check-in date and time.");
  return errors;
}
function parts(at, zone) {
  const fields = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  return Object.fromEntries(
    fields
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  );
}
const civilStamp = (p) =>
  Date.UTC(p.year, p.month - 1, p.day, p.hour || 0, p.minute || 0);
function civilDate(year, month, day, hour, minute) {
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}
function instantFor(civil, zone) {
  const wanted = civilStamp(civil),
    offsets = new Set(
      [-48, -24, 0, 24, 48].map((h) => {
        const at = wanted + h * 3600000;
        return at - civilStamp(parts(at, zone));
      }),
    );
  const candidates = [...offsets]
    .map((offset) => ({
      at: wanted + offset,
      delta: civilStamp(parts(wanted + offset, zone)) - wanted,
    }))
    .sort((a, b) => a.at - b.at);
  const exact = candidates.find((x) => x.delta === 0);
  if (exact) return exact.at;
  const later = candidates
    .filter((x) => x.delta > 0)
    .sort((a, b) => a.delta - b.delta || a.at - b.at)[0];
  if (!later)
    throw new Error("That local reminder time could not be resolved.");
  return later.at;
}
export function nextRoutineAt(schedule, nowMs = Date.now()) {
  const errors = validateSchedule(schedule);
  if (errors.length) throw new Error(errors.join(" "));
  const p = parts(nowMs, schedule.timeZone),
    [hour, minute] = schedule.time.split(":").map(Number);
  let civil = civilDate(p.year, p.month, p.day, hour, minute),
    candidate = instantFor(civil, schedule.timeZone);
  if (candidate <= nowMs) {
    civil = civilDate(
      p.year,
      p.month,
      p.day + Number(schedule.cadenceDays),
      hour,
      minute,
    );
    candidate = instantFor(civil, schedule.timeZone);
  }
  return new Date(candidate).toISOString();
}
export function advanceRoutine(schedule, check, nowMs = Date.now()) {
  const next = structuredClone(schedule);
  const due = Date.parse(schedule?.nextAt),
    observed = Date.parse(check?.observedAt);
  if (
    !schedule?.enabled ||
    !Number.isFinite(due) ||
    due > nowMs ||
    check?.isCurrent === false ||
    check?.urgent !== "no" ||
    !Number.isFinite(observed) ||
    observed < due
  )
    return next;
  const p = parts(due, schedule.timeZone),
    now = parts(nowMs, schedule.timeZone),
    [hour, minute] = schedule.time.split(":").map(Number);
  const elapsedDays = Math.max(
    0,
    Math.floor(
      (Date.UTC(now.year, now.month - 1, now.day) -
        Date.UTC(p.year, p.month - 1, p.day)) /
        86400000,
    ),
  );
  let intervals = Math.max(
    1,
    Math.floor(elapsedDays / Number(schedule.cadenceDays)),
  );
  let civil = civilDate(
      p.year,
      p.month,
      p.day + intervals * Number(schedule.cadenceDays),
      hour,
      minute,
    ),
    at = instantFor(civil, schedule.timeZone);
  while (at <= nowMs) {
    intervals++;
    civil = civilDate(
      p.year,
      p.month,
      p.day + intervals * Number(schedule.cadenceDays),
      hour,
      minute,
    );
    at = instantFor(civil, schedule.timeZone);
  }
  next.nextAt = new Date(at).toISOString();
  return next;
}
export function journeyProgress(records = []) {
  const latest = [...records]
    .reverse()
    .find(
      (r) =>
        r.check?.urgent === "no" &&
        r.check?.isCurrent !== false &&
        r.assessment?.priority !== "urgent",
    );
  const steps = [
    { id: "check", label: "Check recorded", done: !!latest },
    {
      id: "step",
      label: "Next step chosen",
      done: !!latest?.check?.selectedActionId,
    },
    {
      id: "followup",
      label: "Follow-up recorded",
      done: !!latest?.check?.followUp || !!latest?.followUps?.length,
    },
  ];
  return {
    checkId: latest?.id || null,
    steps,
    completed: steps.filter((x) => x.done).length,
  };
}
