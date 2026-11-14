import {
  SOURCES,
  EXAMPLES,
  createProfile,
  createCheck,
  validateCheck,
  validateProfile,
  assess,
  buildExport,
  environmentInsight,
} from "./sleep.js";
import { loadWorkspace, saveWorkspace } from "./workspace.js";
import {
  deriveAlerts,
  calendarEvent,
  primaryPlan,
  reportedWorsening,
  worseningContactRecorded,
} from "./alerts.js";
import { contextSummary, validateContext } from "./context.js";
import {
  beginReturn,
  linkReturn,
  returnSummary,
  reviewNote,
} from "./journey.js";
import {
  defaultSchedule,
  validateSchedule,
  nextRoutineAt,
  advanceRoutine,
  journeyProgress,
} from "./routine.js";
const app = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
const loaded = loadWorkspace();
let state = loaded.state,
  storageError = loaded.error || "",
  canSave = !loaded.error,
  error = "",
  tourStep = 0;
const ws = () => state.workspaces[state.mode],
  demo = () => state.mode === "example";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clone = (v) => structuredClone(v),
  time = (v) =>
    v
      ? new Date(v).toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not recorded";
const hrs = (v) =>
  v == null ? "Not sure" : Number(v).toFixed(1).replace(/\.0$/, "") + " h";
const recordTime = (r) =>
  r.assessment.priority === "urgent"
    ? r.check.urgentReportedAt
    : r.check.observedAt;
const inp = (v) => {
  if (!v) return "";
  let d = new Date(v);
  return Number.isFinite(d.getTime())
    ? new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : "";
};
const enteredTime = (v) =>
  v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : v || null;
const sel = (a, b) => (a === b ? " selected" : ""),
  ck = (a, b) => (a === b ? " checked" : "");
const btn = (t, a, s = "primary", extra = "") =>
  '<button type="button" class="button ' +
  s +
  '" data-action="' +
  a +
  '" ' +
  extra +
  ">" +
  t +
  "</button>";
const icon = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.2A8.3 8.3 0 0 1 9.8 4 8.3 8.3 0 1 0 20 14.2Z"/></svg>',
  arrow: '<span aria-hidden="true">↗</span>',
};
function notify(t) {
  const el = document.querySelector("#toast");
  el.textContent = t;
  el.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove("visible"), 4500);
}
function persist() {
  if (!canSave) return false;
  const r = saveWorkspace(state);
  if (!r.ok) {
    canSave = false;
    storageError = r.error;
    notify("Saving failed. Export before closing this tab.");
  }
  document
    .querySelectorAll("[data-storage]")
    .forEach(
      (el) =>
        (el.textContent = canSave ? "Saved on this browser" : "In memory only"),
    );
  return r.ok;
}
function go(v) {
  state.view = v;
  error = "";
  persist();
  render();
}
function review() {
  const r = ws().checks.find((r) => r.id === state.reviewId);
  return r && state.view === "result"
    ? { c: r.check, p: r.profile, a: r.assessment, r }
    : ws().draft
      ? {
          c: ws().draft,
          p: ws().profile,
          a: assess(ws().draft, ws().profile),
          r: null,
        }
      : null;
}
function sources(ids = []) {
  return [...new Set(ids)]
    .filter((id) => SOURCES[id]?.url)
    .map(
      (id) =>
        '<a href="' +
        esc(SOURCES[id].url) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(SOURCES[id].title) +
        " ↗</a>",
    )
    .join("");
}
function title(k, t, p = "") {
  return (
    '<div class="page-heading"><p class="eyebrow">' +
    k +
    '</p><h1 id="view-title" tabindex="-1">' +
    t +
    "</h1>" +
    (p ? '<p class="lede">' + p + "</p>" : "") +
    "</div>"
  );
}
function companion() {
  const items = deriveAlerts(
      ws().checks,
      ws().draft,
      Date.now(),
      ws().schedule,
    ),
    label = items.length
      ? items.length + " item" + (items.length === 1 ? "" : "s") + " to review"
      : "No reminders due";
  return (
    '<button type="button" id="reminder-companion" class="companion ' +
    (items[0]?.kind || "quiet") +
    '" data-action="alerts" aria-label="Open Satris reminders, ' +
    items.length +
    " item" +
    (items.length === 1 ? "" : "s") +
    '"><svg viewBox="0 0 56 56" aria-hidden="true"><path class="bot-orbit" d="M6 34C-1 17 37 6 49 19s-2 31-22 28"/><path class="bot-antenna" d="M28 9v6"/><circle class="bot-tip" cx="28" cy="7" r="2"/><rect class="bot-body" x="13" y="15" width="31" height="25" rx="9"/><rect class="bot-screen" x="18" y="21" width="21" height="12" rx="5"/><path class="bot-eyes" d="M23 26h1m9 0h1"/><path class="bot-legs" d="M21 40v5m15-5v5"/><path class="bot-arm" d="M45 27h5"/></svg><span class="companion-copy"><strong>Satris reminders</strong><span data-alert-label>' +
    label +
    '</span></span><span class="companion-count" data-alert-count ' +
    (!items.length ? "hidden" : "") +
    ">" +
    items.length +
    "</span></button>"
  );
}
function refreshAlerts() {
  const el = document.querySelector("#reminder-companion");
  if (!el) return;
  const items = deriveAlerts(
      ws().checks,
      ws().draft,
      Date.now(),
      ws().schedule,
    ),
    label = items.length
      ? items.length + " item" + (items.length === 1 ? "" : "s") + " to review"
      : "No reminders due";
  el.className = "companion " + (items[0]?.kind || "quiet");
  el.setAttribute(
    "aria-label",
    "Open Satris reminders, " +
      items.length +
      " item" +
      (items.length === 1 ? "" : "s"),
  );
  el.querySelector("[data-alert-label]").textContent = label;
  const count = el.querySelector("[data-alert-count]");
  count.hidden = !items.length;
  count.textContent = items.length;
}
function alertsDialog() {
  const items = deriveAlerts(
    ws().checks,
    ws().draft,
    Date.now(),
    ws().schedule,
  );
  modal(
    "Your Satris reminders",
    '<p class="quiet small">Based on your saved checks and chosen reminder times. Satris checks these while this app is open; it does not monitor your physiology.</p>' +
      (demo()
        ? '<p class="example-note">These reminders belong to scenario records.</p>'
        : "") +
      (items.length
        ? '<div class="alert-list">' +
          items
            .map(
              (item) =>
                '<article class="reminder-card ' +
                esc(item.kind) +
                '"><p class="eyebrow">' +
                esc(
                  {
                    urgent: "Reported urgent concern",
                    review: "Medical review reminder",
                    reminder: "Follow-up due",
                    check: "Your chosen check-in",
                  }[item.kind] || "Reminder",
                ) +
                "</p><h3>" +
                esc(item.title) +
                "</h3><p>" +
                esc(item.message) +
                "</p>" +
                (item.at
                  ? '<p class="small quiet">' + esc(time(item.at)) + "</p>"
                  : "") +
                btn(
                  item.action === "start"
                    ? "Start sleep check"
                    : item.action === "follow"
                      ? "Record follow-up"
                      : "Open check",
                  item.action === "start"
                    ? "alert-start"
                    : item.action === "follow"
                      ? "alert-follow"
                      : "alert-record",
                  "secondary",
                  'data-id="' + esc(item.recordId) + '"',
                ) +
                "</article>",
            )
            .join("") +
          "</div>"
        : '<div class="reminders-empty"><h3>No reminders due</h3><p>Your records have no reminder requiring attention here. This is not an assessment of your health.</p></div>') +
      '<p class="small quiet">Closing this panel does not complete a step or resolve a concern.</p>' +
      btn("Close", "close", "text"),
  );
}
function calendarDownload() {
  const q = review();
  if (!q?.r || !q.c.followUpAt || new Date(q.c.followUpAt) <= new Date()) {
    notify(
      "Set a future follow-up time before downloading a calendar reminder.",
    );
    return;
  }
  const data = calendarEvent(q.r);
  if (!data) {
    notify("A calendar reminder could not be prepared.");
    return;
  }
  const url = URL.createObjectURL(
      new Blob([data], { type: "text/calendar;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "Satris-follow-up.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  notify(
    "Calendar file downloaded. Import it into your calendar to create a reminder.",
  );
}
function render(focus = true) {
  if (!["today", "check", "result", "history", "about"].includes(state.view))
    state.view = "today";
  if (
    (state.view === "check" && !ws().draft) ||
    (state.view === "result" && !review())
  )
    state.view = "today";
  app.innerHTML =
    '<div class="app-shell"><header class="topbar"><a href="#" class="brand" data-action="home" aria-label="Satris home"><img src="./assets/satris-wordmark.svg" alt="Satris"></a><nav aria-label="Main navigation">' +
    [
      ["today", "Today"],
      ["history", "My checks"],
      ["about", "About"],
    ]
      .map(
        ([v, t]) =>
          '<button data-action="nav" data-view="' +
          v +
          '" ' +
          (state.view === v ? 'aria-current="page"' : "") +
          ">" +
          t +
          "</button>",
      )
      .join("") +
    '</nav><button class="urgent-link" data-action="urgent">Urgent symptoms ↗</button></header>' +
    (demo()
      ? '<div class="example-banner"><span><strong>Fictional mission context</strong> · Example observations are editable.</span>' +
        btn("My personal records", "personal", "text") +
        "</div>"
      : "") +
    '<main id="main" tabindex="-1">' +
    (!canSave
      ? '<div class="notice warning" role="alert"><strong>This session is not saved.</strong> ' +
        esc(storageError) +
        " Keep this tab open and export your records.</div>"
      : "") +
    {
      today: todayView,
      check: checkView,
      result: resultView,
      history: historyView,
      about: aboutView,
    }[state.view]() +
    '</main><div class="companion-row">' +
    companion() +
    '</div><footer class="app-footer"><span>Routine sleep review · Manual inputs</span><span data-storage>' +
    (canSave ? "Saved on this browser" : "In memory only") +
    '</span><button class="text-link" data-action="tour">Quick tour</button></footer></div>';
  if (focus) {
    window.scrollTo?.(0, 0);
    document.querySelector("#view-title")?.focus({ preventScroll: true });
  }
}
function env(v) {
  return (
    {
      unspecified: "Mission not specified",
      station: "Space station",
      transit: "Spacecraft in transit",
      surface: "Surface habitat",
      rover: "Rover",
    }[v] || "Mission not specified"
  );
}
function scheduleTime(value, zone) {
  if (!value) return "Not set";
  try {
    return (
      new Date(value).toLocaleString(undefined, {
        timeZone: zone,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) +
      " · " +
      zone
    );
  } catch {
    return time(value);
  }
}
function rhythmCard() {
  const schedule = ws().schedule,
    due =
      schedule.enabled &&
      schedule.nextAt &&
      Date.parse(schedule.nextAt) <= Date.now();
  return (
    '<section class="rhythm-card ' +
    (due ? "due" : "") +
    '"><div><p class="eyebrow">Your check-in rhythm</p><h2>' +
    (due
      ? "Your chosen check-in is due"
      : schedule.enabled
        ? "A little space for your next check"
        : "Choose a rhythm that works for you") +
    "</h2><p>" +
    (due
      ? "Ready to take a look? Check when your mission duties allow."
      : schedule.enabled
        ? "Next check-in: " +
          esc(scheduleTime(schedule.nextAt, schedule.timeZone))
        : "Choose when Satris should remind you to check in.") +
    '</p><p class="small quiet">Your preference, not a prescribed medical schedule. Reminders appear while this app is open.</p></div><div class="button-column">' +
    (due
      ? btn(
          ws().draft ? "Continue my check" : "Start sleep check",
          ws().draft ? "continue" : "start",
          "primary",
        )
      : "") +
    btn(
      schedule.enabled ? "Change rhythm" : "Set my rhythm",
      "rhythm",
      "secondary",
    ) +
    (schedule.enabled &&
    schedule.nextAt &&
    Date.parse(schedule.nextAt) > Date.now()
      ? btn("Download calendar reminder", "rhythm-calendar", "text")
      : "") +
    "</div></section>"
  );
}
function journeyCard() {
  if (!ws().journeyEnabled)
    return (
      '<section class="journey-invite"><div><h2>A small mission, at your pace.</h2><p class="small quiet">If you like, follow a simple path through a check, a next step and a follow-up. No points or streaks.</p></div>' +
      btn("Show my journey", "journey-on", "text") +
      "</section>"
    );
  const progress = journeyProgress(ws().checks);
  return (
    '<section class="mission-journey"><div class="journey-heading"><div><p class="eyebrow">Your journey</p><h2>One check. A step to follow through.</h2></div>' +
    btn("Hide journey", "journey-off", "text") +
    '</div><ol class="mission-nodes">' +
    progress.steps
      .map(
        (step, i) =>
          '<li class="' +
          (step.done ? "done" : "waiting") +
          '"><span class="mission-node" aria-hidden="true">' +
          (step.done ? "✓" : i + 1) +
          "</span><strong>" +
          esc(step.label) +
          '</strong><span class="small quiet">' +
          (step.done ? "Recorded" : "At your pace") +
          "</span></li>",
      )
      .join("") +
    '</ol><p class="small quiet">Progress describes your records, not your health or readiness. Unknown answers and feeling unwell do not lose progress.</p>' +
    (progress.checkId
      ? btn(
          "Open this check",
          "record",
          "text",
          'data-id="' + esc(progress.checkId) + '"',
        )
      : "") +
    "</section>"
  );
}
function habitatCard() {
  const insight = environmentInsight(ws().profile);
  return (
    '<section class="habitat-card"><div><p class="eyebrow">Your surroundings</p><h2>' +
    esc(insight.title) +
    "</h2><p>" +
    esc(insight.text) +
    '</p><details><summary>Why the setting matters</summary><p class="small quiet">' +
    esc(insight.basis) +
    '</p><div class="source-links">' +
    sources(insight.sourceIds) +
    "</div></details></div>" +
    btn("Change setting", "profile", "text") +
    "</section>"
  );
}
function rhythmDialog() {
  const s = ws().schedule,
    deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    zones = [...new Set([s.timeZone, deviceZone])];
  modal(
    "Your check-in rhythm",
    '<p>Choose when you would like a reminder. This is your preference, not a clinical instruction.</p><form id="rhythm-form"><label class="choice"><input type="checkbox" name="enabled" value="yes"' +
      (s.enabled ? " checked" : "") +
      '><span><strong>Remind me to check in</strong><small>Shown here while Satris is open.</small></span></label><div class="two-fields"><div><label class="field-label" for="cadenceDays">How often?</label><select id="cadenceDays" name="cadenceDays">' +
      [
        [1, "Every day"],
        [2, "Every 2 days"],
        [7, "Every week"],
      ]
        .map(
          ([n, label]) =>
            '<option value="' +
            n +
            '"' +
            sel(Number(s.cadenceDays), n) +
            ">" +
            label +
            "</option>",
        )
        .join("") +
      '</select></div><div><label class="field-label" for="rhythmTime">At what time?</label><input type="time" id="rhythmTime" name="time" value="' +
      esc(s.time) +
      '" required></div></div><label class="field-label" for="rhythmZone">Time zone</label><select id="rhythmZone" name="timeZone">' +
      zones
        .map(
          (zone) =>
            '<option value="' +
            esc(zone) +
            '"' +
            sel(s.timeZone, zone) +
            ">" +
            esc(zone) +
            (zone === deviceZone ? " · this device" : "") +
            "</option>",
        )
        .join("") +
      '</select><label class="field-label" for="rhythmNext">Choose a one-off next check <span class="quiet">Optional</span></label><input id="rhythmNext" name="nextAt" type="datetime-local"><p class="small quiet">This field uses your device time, ' +
      esc(deviceZone) +
      ". Leave it blank to keep the current next check or use your changed rhythm. Recurring checks use the time zone above.</p>" +
      (s.enabled && s.nextAt
        ? '<p class="small quiet">Current next check: ' +
          esc(scheduleTime(s.nextAt, s.timeZone)) +
          "</p>"
        : "") +
      '<div id="rhythm-error" class="error" role="alert" hidden></div><div class="form-actions">' +
      btn("Cancel", "close", "text") +
      '<button class="button primary" type="submit">Save my rhythm</button></div></form>',
  );
}
function rhythmCalendar() {
  const s = ws().schedule;
  if (!s.enabled || !s.nextAt || Date.parse(s.nextAt) <= Date.now()) {
    notify("Choose a future check-in time first.");
    return;
  }
  const data = calendarEvent({
    id: "routine-check",
    check: { followUpAt: s.nextAt },
  })
    .replaceAll("Satris follow-up", "Satris check-in")
    .replace(
      "Open Satris to review your chosen next step.",
      "Open Satris for your chosen routine check-in.",
    );
  const url = URL.createObjectURL(
      new Blob([data], { type: "text/calendar;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "Satris-check-in.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  notify(
    "Calendar file downloaded. Import it into your calendar to create the reminder.",
  );
}
function historyExplorer() {
  let records = ws()
      .checks.filter((r) => {
        const observed = Date.parse(r.check.observedAt),
          saved = Date.parse(r.savedAt);
        return (
          Number.isFinite(observed) &&
          observed <= Date.now() &&
          (!Number.isFinite(saved) || observed <= saved)
        );
      })
      .slice(-7),
    scenario = demo() ? records.at(-1)?.check?.scenarioId : null;
  if (demo())
    records = records.filter(
      (r) => scenario && r.check.scenarioId === scenario,
    );
  if (!records.length) return "";
  const values = records.map((r) =>
      r.check.quality !== "uncertain" && Number.isFinite(r.check.sleepHours)
        ? r.check.sleepHours
        : null,
    ),
    max = Math.max(10, ...values.filter((v) => v !== null));
  return (
    '<section class="history-explorer"><h2>Your sleep, over time</h2><p class="small quiet">Reported sleep from your checks. Select a record to explore it. Missing or uncertain values stay blank.</p>' +
    (demo()
      ? '<p class="small quiet">Only this scenario is shown; alternative scenarios are not pooled.</p>'
      : "") +
    "<ol>" +
    records
      .map(
        (r, i) =>
          '<li><button class="history-point" data-action="record" data-id="' +
          esc(r.id) +
          '" aria-label="Open check ' +
          esc(time(r.check.observedAt)) +
          ": " +
          (values[i] === null
            ? "sleep not recorded or uncertain"
            : esc(hrs(values[i])) + " reported sleep") +
          '"><span class="point-date">' +
          esc(time(r.check.observedAt)) +
          '</span><svg viewBox="0 0 360 30" aria-hidden="true"><path d="M0 15H360" class="history-track"/>' +
          (values[i] !== null
            ? '<rect x="0" y="6" width="' +
              Math.max(0, Math.min(360, (values[i] / max) * 360)) +
              '" height="18" rx="5" class="history-bar"/>'
            : "") +
          '</svg><span class="point-value">' +
          (values[i] === null ? "Not recorded" : esc(hrs(values[i]))) +
          '</span><span aria-hidden="true">↗</span></button></li>',
      )
      .join("") +
    '</ol><p class="small quiet">This is a record of your reports, not a normal range or a performance prediction.</p></section>'
  );
}
function crewScene() {
  return '<svg viewBox="0 0 420 310" class="crew-scene" role="presentation" focusable="false"><defs><linearGradient id="crew-window-depth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#193956"/><stop offset="1" stop-color="#071321"/></linearGradient><linearGradient id="crew-helmet-silver" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edf3f5"/><stop offset=".48" stop-color="#c9d5dc"/><stop offset="1" stop-color="#718a9e"/></linearGradient><linearGradient id="crew-face-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d5b79c"/><stop offset="1" stop-color="#ae876e"/></linearGradient><linearGradient id="crew-suit-depth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#345774"/><stop offset="1" stop-color="#0e2142"/></linearGradient><clipPath id="crew-window-clip"><rect x="12" y="12" width="396" height="286" rx="78"/></clipPath></defs><rect x="12" y="12" width="396" height="286" rx="78" fill="url(#crew-window-depth)" stroke="#6b879f" stroke-width="2"/><g clip-path="url(#crew-window-clip)"><path d="M17 233C104 119 272 17 412 62" fill="none" stroke="#365a76" stroke-dasharray="3 9"/><path d="M30 180C137 80 292 38 402 95" fill="none" stroke="#294a66"/><circle cx="331" cy="76" r="38" fill="#a8bdcd" opacity=".78"/><path d="M296 62c22 7 48 13 70 9m-64 18c15 6 34 10 51 8" fill="none" stroke="#d4e1e9" stroke-width="2" opacity=".47"/><circle cx="342" cy="59" r="5" fill="#7994a9"/><path d="M71 57v10m-5-5h10m177-26v8m-4-4h8m112 91v8m-4-4h8m-108-25v5m-2-2h5" fill="none" stroke="#c3d7e4" stroke-width="1.8" stroke-linecap="round"/><circle cx="231" cy="71" r="1.5" fill="#d6e5ed"/><circle cx="51" cy="120" r="1.5" fill="#91b0c7"/><path d="M61 300c1-48 25-73 65-83h66c42 12 68 39 74 83" fill="url(#crew-suit-depth)" stroke="#081525" stroke-width="3"/><path d="m100 226-17 47m129-47 24 59" stroke="#7893aa" stroke-width="2"/><path d="M87 241c-13 5-22 19-24 40l31 5 12-38" fill="#b7c9d7" stroke="#10283e" stroke-width="2"/><path d="m212 232 29 12 15 29-24 14-25-30" fill="#a7bdce" stroke="#10283e" stroke-width="2"/><path d="M108 216c8 20 78 26 98-1l-12-17-72 1Z" fill="#a1b7c9" stroke="#092039" stroke-width="2"/><ellipse cx="153" cy="133" rx="80" ry="91" fill="url(#crew-helmet-silver)" stroke="#0b2036" stroke-width="3"/><ellipse cx="156" cy="130" rx="66" ry="74" fill="#16364f" stroke="#66849a" stroke-width="3"/><path d="M111 116c-3-24 13-42 42-42 30 0 46 20 44 44l-4 38c-5 24-23 42-41 42-20 0-37-18-42-40Z" fill="url(#crew-face-light)" stroke="#4f514d" stroke-width="1.5"/><path d="M111 125c-10-36 9-57 40-57 30 0 48 21 47 51-5-11-9-20-15-25-17 4-36 1-49-5-7 11-14 21-23 25Z" fill="#263c49"/><path d="M114 115c9-5 14-12 20-20m-12-12c12 9 29 12 43 10" fill="none" stroke="#49616b" stroke-width="2"/><path d="m126 119 14-4m26 0 13 5" fill="none" stroke="#4c4a43" stroke-width="3.5" stroke-linecap="round"/><path d="M127 129c4-3 9-3 13 0m26 0c4-3 9-3 13 0" fill="none" stroke="#f1e3d5" stroke-width="4" stroke-linecap="round"/><circle cx="137" cy="129" r="2.5" fill="#263b4a"/><circle cx="176" cy="129" r="2.5" fill="#263b4a"/><path d="m154 129-4 15 8 2" fill="none" stroke="#946f5c" stroke-width="2" stroke-linecap="round"/><path d="M140 162c7 5 16 6 26 0" fill="none" stroke="#6a5149" stroke-width="2.6" stroke-linecap="round"/><path d="M144 165c6 1 11 1 16-1" fill="none" stroke="#e0c2aa" stroke-width="1.5"/><path d="M118 145c4 1 7 1 11 0m48 1 9 1" stroke="#c69c82" stroke-width="4" stroke-linecap="round" opacity=".65"/><path d="M100 102c1-24 22-45 45-48" fill="none" stroke="#eaf3f8" stroke-width="5" stroke-linecap="round" opacity=".5"/><path d="M188 71c20 15 31 43 28 65" fill="none" stroke="#e2eef5" stroke-width="2" opacity=".4"/><path d="M102 178c29 19 69 23 103-1l-8 28c-28 16-59 15-85 0Z" fill="#a9bece" stroke="#4a6c86" stroke-width="2"/><path d="m119 190 12 9h45l13-9" fill="none" stroke="#edf3f6" stroke-width="2"/><rect x="119" y="254" width="67" height="34" rx="9" fill="#0d2139" stroke="#7391a9" stroke-width="2"/><path d="M131 265h20m-20 11h42" stroke="#b9cddc" stroke-width="2" stroke-linecap="round"/><circle cx="173" cy="265" r="3" fill="#c9d5dc"/><path d="m249 262 12-19 14 1 7 14-9 13-16 1Z" fill="#d2dfe6" stroke="#1d3b53" stroke-width="2"/><path d="m262 245 7 10m-12 1 8 7" stroke="#7691a8" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="325" cy="283" rx="43" ry="7" fill="#020a14" opacity=".3"/><path d="M300 218c-10 3-17 11-24 27" fill="none" stroke="#829eb5" stroke-width="10" stroke-linecap="round"/><path d="M300 218c-10 3-17 11-24 27" fill="none" stroke="#d8e4eb" stroke-width="5" stroke-linecap="round"/><path d="M355 220c17-1 19-16 19-29" fill="none" stroke="#d1dfe8" stroke-width="7" stroke-linecap="round"/><path d="m367 184 7 7 8-7" fill="none" stroke="#d1dfe8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="294" y="206" width="62" height="66" rx="24" fill="url(#crew-helmet-silver)" stroke="#17344e" stroke-width="2.5"/><path d="M309 253h32m-25 7h18" stroke="#6c8aa1" stroke-width="2" stroke-linecap="round"/><path d="M325 137v13" stroke="#bfd1df" stroke-width="3"/><circle cx="325" cy="133" r="5" fill="#dce7ed" stroke="#54738d" stroke-width="2"/><rect x="283" y="150" width="84" height="66" rx="23" fill="url(#crew-helmet-silver)" stroke="#183750" stroke-width="2.5"/><rect x="294" y="161" width="62" height="42" rx="15" fill="#102d47"/><path d="M304 177c4-4 8-4 11-1m21 0c3-3 7-3 10 0" fill="none" stroke="#dce9f1" stroke-width="3.5" stroke-linecap="round"/><path d="M314 188c7 6 15 6 22-1" fill="none" stroke="#b9d2e3" stroke-width="2.5" stroke-linecap="round"/><path d="M291 170v18m67-18v18" stroke="#edf4f7" stroke-width="2" opacity=".6"/><path d="m307 273-4 10m39-10 5 10" stroke="#97b0c4" stroke-width="5" stroke-linecap="round"/><path d="M35 294h354" stroke="#7993aa" opacity=".25"/></g></svg>';
}

function todayView() {
  const last = primaryPlan(ws().checks),
    due = ws().checks.find(
      (r) =>
        r.check.followUpAt &&
        !r.check.followUp &&
        new Date(r.check.followUpAt) <= new Date(),
    );
  return (
    title(
      "Your next health step",
      last
        ? "Welcome back. Pick up your plan."
        : "A small check. A clearer next step.",
      last
        ? "Your last review, next step and fresh check stay connected."
        : "Look back at your sleep, understand the context, and choose what to address next.",
    ) +
    (ws().draft &&
    (reportedWorsening(ws().draft) ||
      ["yes", "unsure"].includes(ws().draft.urgent))
      ? '<section class="notice warning"><strong>Your unfinished check includes a concern.</strong><p>Get crew help for an urgent concern or report worsening to medical support. Do not wait to finish the check.</p>' +
        btn("Open reported concern", "draft-concern", "secondary") +
        "</section>"
      : "") +
    (last
      ? nextStepCard(last) +
        '<div class="button-row return-tools">' +
        btn(
          ws().draft ? "Continue my check" : "Start a separate check",
          ws().draft ? "continue" : "start",
          "secondary",
        ) +
        btn("Try an example", "examples", "text") +
        "</div>"
      : '<section class="welcome-card"><div><span class="section-kicker">Your sleep brief</span><h2>How was your last sleep?</h2><p>Record what you know. See what it means in context. Decide what to address before your next sleep period.</p><div class="button-row">' +
        btn(
          ws().draft ? "Continue my check" : "Start sleep check",
          ws().draft ? "continue" : "start",
          "primary",
          'data-testid="start-check"',
        ) +
        btn("Try an example", "examples", "secondary") +
        '</div><p class="quiet small">No wearable needed. Not sure is useful information too.</p></div><div class="sleep-art orbital-window crew-portrait" aria-hidden="true">' +
        crewScene() +
        "<p>One small step, at your pace.</p></div></section>") +
    rhythmCard() +
    (due
      ? '<section class="notice follow-notice"><div><p class="eyebrow">Your reminder</p><h2>A follow-up is due</h2><p>What happened after your planned step?</p></div>' +
        btn(
          "Record follow-up",
          "follow",
          "secondary",
          'data-id="' + esc(due.id) + '"',
        ) +
        "</section>"
      : "") +
    '<div class="journey-strip"><div><span>01</span><p><strong>Your observations</strong><br>Sleep, sleepiness and disruptions.</p></div><div><span>02</span><p><strong>A clear explanation</strong><br>What is supported and what is uncertain.</p></div><div><span>03</span><p><strong>One next step</strong><br>Available actions and a follow-up.</p></div></div>' +
    journeyCard() +
    (!last
      ? '<p class="start-note">New here? ' +
        btn("Take the quick tour", "tour", "text") +
        " You can also begin straight away.</p>"
      : "") +
    habitatCard() +
    '<div class="context-line"><span>' +
    esc(env(ws().profile.environment)) +
    " · " +
    (ws().profile.planHours == null
      ? "No sleep plan supplied"
      : "Supplied plan " + hrs(ws().profile.planHours)) +
    '</span><button class="text-link" data-action="profile">Plan & resources</button></div>'
  );
}
function nextStepCard(record) {
  if (!record) return "";
  const action = record.assessment.actions.find(
    (a) => a.id === record.check.selectedActionId,
  );
  const concern = deriveAlerts([record]).find(
    (a) => a.kind === "urgent" || a.kind === "review",
  );
  return (
    '<section class="active-plan"><div><p class="eyebrow">Your next step</p><h2>' +
    esc(concern?.title || action?.title || record.assessment.headline) +
    "</h2><p>" +
    esc(concern?.message || action?.why || record.assessment.summary) +
    '</p><p class="small quiet">' +
    (record.check.actionStatus === "done"
      ? "You marked this step completed. A fresh check can record how you are now."
      : "Your step is planned. Tell us what you could do, then check how you are now.") +
    '</p></div><div class="button-column">' +
    btn(
      concern ? "Open concern" : "Return to my plan",
      concern ? "record" : "return-check",
      "primary",
      'data-id="' + esc(record.id) + '"',
    ) +
    btn(
      "View saved review",
      "record",
      "text",
      'data-id="' + esc(record.id) + '"',
    ) +
    "</div></section>"
  );
}
function returnCard(c, a) {
  const s = returnSummary(c, a, ws().checks);
  if (!s) return "";
  return (
    '<section class="return-review"><p class="eyebrow">Your plan, carried forward</p><h2>' +
    (s.changed
      ? "Your next step has changed"
      : "Your next step still applies") +
    '</h2><div class="return-grid"><div><span class="small quiet">Previous step</span><h3>' +
    esc(s.oldAction) +
    "</h3><p>" +
    esc(s.response + ". " + s.change + ".") +
    "</p><p>" +
    esc(c.returnContext.note || "No additional observation recorded.") +
    '</p></div><div><span class="small quiet">From this new check</span><h3>' +
    esc(s.nextAction) +
    "</h3><p>" +
    esc(a.summary) +
    '</p></div></div><p class="small quiet">New observations determine this review. A later change does not prove the previous action caused it. A new check does not confirm that medical support was contacted or clear an earlier concern.</p>' +
    btn(
      "Open previous check",
      "record",
      "text",
      'data-id="' + esc(s.prior.id) + '"',
    ) +
    "</section>"
  );
}
function checkView() {
  let c = ws().draft,
    s = state.step || 0;
  return (
    title(
      c.returnContext ? "Return check · Fresh observations" : "Sleep check",
      [
        "Your last sleep period",
        "How do you feel now?",
        "What interrupted your sleep?",
      ][s],
    ) +
    '<ol class="stepper" aria-label="Progress">' +
    ["Last sleep", "How you feel", "Disruptions"]
      .map(
        (t, i) =>
          '<li class="' +
          (s === i ? "current" : i < s ? "complete" : "") +
          '" ' +
          (s === i ? 'aria-current="step"' : "") +
          "><span>" +
          (i < s ? "✓" : i + 1) +
          "</span>" +
          t +
          "</li>",
      )
      .join("") +
    '</ol><section class="check-card">' +
    (demo()
      ? '<p class="example-note">Fictional mission context. Replace example observations with your own if you wish; this check stays in scenario records.</p>'
      : "") +
    (error ? '<div class="error" role="alert">' + esc(error) + "</div>" : "") +
    (s === 0 ? sleepForm(c) : s === 1 ? feelingForm(c) : disruptionForm(c)) +
    '</section><p class="under-note">This is a routine review. If something feels urgently wrong, use <button class="text-link" data-action="urgent">Urgent symptoms</button>.</p>'
  );
}
function timingFields(c) {
  return (
    '<details class="help-details optional-context" ' +
    (error ? "open" : "") +
    '><summary>Add sleep timing <span class="quiet">(optional)</span></summary><p class="small quiet">Reported clock times add context. They do not measure your body clock or predict circadian phase.</p><div class="two-fields"><div><label class="field-label" for="bedTime">When did you try to sleep?</label><input type="time" id="bedTime" name="bedTime" value="' +
    esc(c.bedTime || "") +
    '"></div><div><label class="field-label" for="wakeTime">When did you finish that sleep period?</label><input type="time" id="wakeTime" name="wakeTime" value="' +
    esc(c.wakeTime || "") +
    '"></div></div><label class="field-label" for="sleepTimeZone">Clock or time reference</label><input id="sleepTimeZone" name="sleepTimeZone" maxlength="100" value="' +
    esc(c.sleepTimeZone || "") +
    '" placeholder="For example, UTC or mission time"><p class="small quiet">Leave blank if unknown. Times are not used to calculate your sleep duration.</p></details>'
  );
}
function contextFields(c) {
  return (
    '<details class="help-details optional-context" ' +
    (error ? "open" : "") +
    '><summary>Add context for a review <span class="quiet">(optional)</span></summary><p class="small quiet">Add what you know. You can skip this section.</p><div class="two-fields">' +
    [
      ["stress", "Reported stress"],
      ["workload", "Reported workload"],
    ]
      .map(
        ([key, label]) =>
          '<div><label class="field-label" for="' +
          key +
          '">' +
          label +
          '</label><select id="' +
          key +
          '" name="' +
          key +
          '">' +
          [
            ["unknown", "Not recorded"],
            ["low", "Low"],
            ["usual", "Usual for me"],
            ["high", "High"],
          ]
            .map(
              ([v, t]) =>
                '<option value="' +
                v +
                '"' +
                sel(c[key] || "unknown", v) +
                ">" +
                t +
                "</option>",
            )
            .join("") +
          "</select></div>",
      )
      .join("") +
    '</div><p class="small quiet">These descriptions are your reports, not a validated numerical scale.</p><div class="two-fields"><div><label class="field-label" for="caffeineMg">Latest reported caffeine intake</label><div class="number-input"><input type="number" id="caffeineMg" name="caffeineMg" min="0" step="1" inputmode="decimal" value="' +
    (c.caffeineMg ?? "") +
    '" placeholder="Not recorded"><span>mg</span></div></div><div><label class="field-label" for="caffeineTime">Reported caffeine clock time</label><input type="time" id="caffeineTime" name="caffeineTime" value="' +
    esc(c.caffeineTime || "") +
    '"></div></div><p class="small quiet">Blank means not recorded. Enter 0 only when you know the amount was zero. This is not a daily total; no dose or alertness effect is inferred. A clock time alone does not supply a consumption date.</p><label class="field-label" for="scheduleChanged">Did your sleep schedule change?</label><select id="scheduleChanged" name="scheduleChanged">' +
    [
      ["unknown", "Not sure"],
      ["no", "No"],
      ["yes", "Yes"],
    ]
      .map(
        ([v, t]) =>
          '<option value="' +
          v +
          '"' +
          sel(c.scheduleChanged || "unknown", v) +
          ">" +
          t +
          "</option>",
      )
      .join("") +
    '</select><label class="field-label" for="upcomingTask">Upcoming task</label><input id="upcomingTask" name="upcomingTask" maxlength="200" value="' +
    esc(c.upcomingTask || "") +
    '" placeholder="Optional, for your review note"><p class="small quiet">Adds context to your review note. Satris cannot clear you for a task.</p><details class="reaction-context" ' +
    (error ? "open" : "") +
    '><summary>I already have a reaction-test result</summary><p class="small quiet">Only add a result you already have. Different tests, metrics and devices may not be comparable. Satris does not administer or validate a reaction test.</p><label class="field-label" for="reactionMs">Reported reaction time</label><div class="number-input"><input type="number" id="reactionMs" name="reactionMs" min="0.001" step="any" inputmode="decimal" value="' +
    (c.reactionMs ?? "") +
    '" placeholder="Not recorded"><span>ms</span></div><div class="two-fields"><div><label class="field-label" for="reactionMetric">Which reported metric?</label><select name="reactionMetric" id="reactionMetric">' +
    [
      ["", "Not recorded"],
      ["mean", "Mean"],
      ["median", "Median"],
      ["other", "Other reported metric"],
    ]
      .map(
        ([v, t]) =>
          '<option value="' +
          v +
          '"' +
          sel(c.reactionMetric || "", v) +
          ">" +
          t +
          "</option>",
      )
      .join("") +
    '</select></div><div><label class="field-label" for="reactionObservedAt">When was it measured?</label><input type="datetime-local" name="reactionObservedAt" id="reactionObservedAt" value="' +
    esc(inp(c.reactionObservedAt)) +
    '"></div></div><label class="field-label" for="reactionMethod">Measurement method</label><input id="reactionMethod" name="reactionMethod" maxlength="200" value="' +
    esc(c.reactionMethod || "") +
    '" placeholder="Method stated on the existing result"><label class="field-label" for="reactionDevice">Device</label><input id="reactionDevice" name="reactionDevice" maxlength="200" value="' +
    esc(c.reactionDevice || "") +
    '" placeholder="Device used for that test"><label class="field-label" for="reactionProtocol">Test or protocol identifier</label><input id="reactionProtocol" name="reactionProtocol" maxlength="200" value="' +
    esc(c.reactionProtocol || "") +
    '" placeholder="Exact test, protocol or version"><p class="small quiet">If you supply a value, identify its metric, method, device and protocol. An unknown measurement time remains unknown.</p></details></details>'
  );
}
function combinedContext(c, a, context) {
  const first =
    a.actions.find((x) => x.id === c.selectedActionId && x.available) ||
    a.actions.find((x) => x.available);
  return (
    '<section class="combined-review"><p class="eyebrow">Your observations together</p><h2>' +
    (c.upcomingTask
      ? "Your review before " + esc(c.upcomingTask)
      : "Your sleep review") +
    "</h2><p>" +
    esc(
      context.summary ||
        "Your current experience, sleep record and reported context remain distinct observations.",
    ) +
    '</p><div class="combined-next"><span class="small quiet">Supported next step</span><strong>' +
    esc(first?.title || a.headline) +
    "</strong><p>" +
    esc(first?.why || a.summary) +
    '</p></div><p class="small quiet">This review does not predict performance or clear you for the task.</p>' +
    (context.items?.length
      ? '<details><summary>See the observations together</summary><dl class="context-items">' +
        context.items
          .map(
            (item) =>
              "<div><dt>" +
              esc(item.label) +
              "</dt><dd><strong>" +
              esc(item.value) +
              "</strong><span>" +
              esc(item.meaning || "") +
              "</span></dd></div>",
          )
          .join("") +
        '</dl><div class="source-links">' +
        sources(["study", "fatigue"]) +
        "</div></details>"
      : "") +
    "</section>"
  );
}
function recentPattern(context) {
  const comparison = context.comparison || {},
    series = (comparison.series || [])
      .filter((x) => Number.isFinite(x.hours))
      .slice(-8),
    max = Math.max(10, ...series.map((x) => x.hours));
  const plot = series.length
    ? '<svg viewBox="0 0 600 180" role="img" aria-label="' +
      esc(
        series
          .map(
            (x) =>
              (x.current ? "Current check" : "Recorded check") +
              " " +
              time(x.at) +
              ": " +
              hrs(x.hours),
          )
          .join(". "),
      ) +
      '"><text x="0" y="16" class="bar-label">Hours</text><path d="M25 140h550" class="pattern-axis"/>' +
      series
        .map((x, i) => {
          const width = Math.min(48, 400 / series.length),
            step = 500 / series.length,
            left = 42 + i * step,
            height = (x.hours / max) * 110;
          return (
            '<rect x="' +
            left +
            '" y="' +
            (140 - height) +
            '" width="' +
            width +
            '" height="' +
            height +
            '" rx="4" class="' +
            (x.current ? "pattern-current" : "pattern-prior") +
            '"><title>' +
            esc(
              time(x.at) +
                ": " +
                hrs(x.hours) +
                (x.current ? " · current" : ""),
            ) +
            '</title></rect><text x="' +
            (left + width / 2) +
            '" y="162" text-anchor="middle" class="pattern-date">' +
            esc(
              x.current
                ? "Current"
                : new Date(x.at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  }),
            ) +
            "</text>"
          );
        })
        .join("") +
      "</svg>"
    : "";
  return (
    '<section class="recent-pattern"><h2>Your recent pattern</h2><p class="small quiet">Up to 7 earlier comparable recorded checks, plus this check when usable. Missing estimates are not plotted as zero.</p>' +
    plot +
    "<p>" +
    esc(
      comparison.text || "No comparable previous records are available yet.",
    ) +
    "</p>" +
    (context.reactionComparison
      ? '<details class="reaction-comparison"><summary>Existing reaction-result comparison</summary><p>' +
        esc(context.reactionComparison.text) +
        '</p><p class="small quiet">A descriptive comparison does not establish alertness, safety or fitness for a task.</p></details>'
      : "") +
    (context.limitations?.length
      ? '<details><summary>How to read this comparison</summary><ul class="small quiet">' +
        context.limitations.map((t) => "<li>" + esc(t) + "</li>").join("") +
        "</ul></details>"
      : "") +
    "</section>"
  );
}
function sleepForm(c) {
  return (
    '<form id="sleep-form" novalidate><p class="intro">Time available for sleep and time actually asleep are different. An estimate is useful; uncertainty is useful too.</p><div class="two-fields">' +
    [
      [
        "opportunityHours",
        "Time available for sleep",
        "The window set aside for your last main sleep, including time spent awake.",
      ],
      [
        "sleepHours",
        "Estimated time asleep",
        "Estimate time asleep in that same window, excluding known awake time.",
      ],
    ]
      .map(
        ([n, l, t]) =>
          '<div class="measurement-field"><label for="' +
          n +
          '">' +
          l +
          '</label><p id="' +
          n +
          '-help">' +
          t +
          '</p><div class="number-input"><input id="' +
          n +
          '" name="' +
          n +
          '" type="number" min="0" max="24" step="0.25" inputmode="decimal" value="' +
          (c[n] ?? "") +
          '" placeholder="Not sure" aria-describedby="' +
          n +
          '-help"><span>hours</span></div></div>',
      )
      .join("") +
    '</div><p class="quiet small">Leave a value blank if you do not know it. Hours are self-reported, not measured by Satris.</p><label class="field-label" for="quality">How confident are you in these estimates?</label><select name="quality" id="quality"><option value="estimated"' +
    sel(c.quality, "estimated") +
    '>Reasonable estimates</option><option value="uncertain"' +
    sel(c.quality, "uncertain") +
    ">Very uncertain</option></select>" +
    timingFields(c) +
    '<details class="help-details"><summary>How to estimate and record the period</summary><p>Use a sleep diary or the start and end of your main sleep. Subtract known awake time for the sleep estimate. Do not combine naps with a different window. The 0–24 limits check data format, not medical health.</p><label class="field-label" for="isCurrent">Which sleep period?</label><select name="isCurrent" id="isCurrent"><option value="yes"' +
    sel(c.isCurrent === false ? "no" : "yes", "yes") +
    '>Latest main sleep period</option><option value="no"' +
    sel(c.isCurrent === false ? "no" : "yes", "no") +
    '>Earlier sleep period</option></select><label class="field-label" for="observedAt">When did you make these observations?</label><input id="observedAt" name="observedAt" type="datetime-local" max="' +
    inp(new Date().toISOString()) +
    '" value="' +
    esc(inp(c.observedAt)) +
    '"><p class="quiet small">' +
    esc(Intl.DateTimeFormat().resolvedOptions().timeZone) +
    '</p></details><div class="form-actions">' +
    btn("Save & leave", "home", "text") +
    '<button class="button primary" type="submit">Continue →</button></div></form>'
  );
}
function feelingForm(c) {
  return (
    '<form id="feeling-form"><p class="intro">Choose how you feel now. Your experience matters, even when the hours look reassuring.</p>' +
    (c.isCurrent === false
      ? '<p class="notice">Your sleep record is from an earlier period. This question is about how you feel now and is recorded with its own time.</p>'
      : "") +
    '<fieldset class="choice-list"><legend class="sr-only">Current sleepiness</legend>' +
    [
      ["alert", "As usual", "Awake and functioning as I usually do."],
      [
        "sleepy",
        "Sleepy, but managing",
        "Sleepy without it affecting my activities.",
      ],
      [
        "impact",
        "Sleepiness affects my activities",
        "It makes usual activities harder.",
      ],
      [
        "unintended",
        "Often falling asleep unintentionally",
        "I often fall asleep unintentionally during waking hours.",
      ],
      ["unknown", "I am not sure", "I cannot describe this confidently."],
    ]
      .map(
        ([v, l, t]) =>
          '<label class="choice"><input type="radio" name="feeling" value="' +
          v +
          '"' +
          ck(c.feeling, v) +
          "><span><strong>" +
          l +
          "</strong><small>" +
          t +
          "</small></span></label>",
      )
      .join("") +
    '</fieldset><div class="form-actions">' +
    btn("← Back", "back", "text") +
    '<button class="button primary" type="submit">Continue →</button></div></form>'
  );
}
function disruptionForm(c) {
  return (
    '<form id="disruption-form"><p class="intro">Report only what you noticed. A disturbance may be relevant, but it does not prove why you slept poorly.</p><fieldset class="disruption-grid"><legend class="field-label">Did you notice any of these?</legend>' +
    [
      ["light", "Light"],
      ["noise", "Noise"],
      ["temperature", "Temperature"],
      ["workload", "Work or schedule"],
      ["other", "Something else"],
    ]
      .map(
        ([v, l]) =>
          '<label class="chip-choice"><input type="checkbox" name="disruptions" value="' +
          v +
          '"' +
          ((c.disruptions || []).includes(v) ? " checked" : "") +
          "><span>" +
          l +
          "</span></label>",
      )
      .join("") +
    '</fieldset><label class="field-label" for="disruptionStatus">If none are selected</label><select id="disruptionStatus" name="disruptionStatus"><option value="unknown"' +
    sel(c.disruptionStatus, "unknown") +
    '>I am not sure what interrupted sleep</option><option value="none"' +
    sel(c.disruptionStatus, "none") +
    '>I did not notice a disruption</option></select><label class="field-label" for="notes">Anything else to record? <span class="quiet">Optional</span></label><textarea name="notes" id="notes" rows="3" maxlength="2000" placeholder="What did you notice?">' +
    esc(c.notes) +
    "</textarea>" +
    contextFields(c) +
    '<details class="help-details"><summary>Why these questions?</summary><p>NASA identifies scheduling and conditions such as light, noise and temperature as relevant to sleep. A reported disturbance remains separate from a diagnosis.</p><div class="source-links">' +
    sources(["hrp", "operations", "accommodation"]) +
    '</div></details><div class="form-actions">' +
    btn("← Back", "back", "text") +
    '<button class="button primary" type="submit">Understand my check →</button></div></form>'
  );
}
function bars(m) {
  const valueLabel = (label, v) =>
    v == null
      ? label === "Supplied plan"
        ? "Not supplied"
        : "Not recorded"
      : hrs(v);
  let items = [
      ["Time available", m.opportunityHours, "opportunity"],
      ["Reported sleep", m.sleepHours, "actual"],
      ["Supplied plan", m.planHours, "plan"],
    ],
    max = Math.max(10, ...items.map((x) => Number(x[1]) || 0));
  return (
    '<section class="sleep-visual"><h2>Your sleep in context</h2><p class="small quiet">Hours for the same main sleep period. A supplied plan is a reference, not a diagnostic cutoff.</p><svg viewBox="0 0 600 162" role="img" aria-label="' +
    esc(items.map(([l, v]) => l + ": " + valueLabel(l, v)).join(". ")) +
    '">' +
    items
      .map(
        ([l, v, cls], i) =>
          '<text x="0" y="' +
          (25 + i * 49) +
          '" class="bar-label">' +
          l +
          '</text><rect x="150" y="' +
          (9 + i * 49) +
          '" width="350" height="23" rx="5" class="bar-track"/>' +
          (v != null
            ? '<rect x="150" y="' +
              (9 + i * 49) +
              '" width="' +
              Math.max(0, Math.min(350, (Number(v) / max) * 350)) +
              '" height="23" rx="5" class="bar-' +
              cls +
              '"/>'
            : "") +
          '<text x="515" y="' +
          (25 + i * 49) +
          '" class="bar-value">' +
          valueLabel(l, v) +
          "</text>",
      )
      .join("") +
    "</svg></section>"
  );
}
function actionCard(act, c, saved) {
  const chosen = c.selectedActionId === act.id;
  const body =
    "<p>" +
    esc(act.why) +
    "</p>" +
    (act.available
      ? ""
      : '<p class="small quiet">Resource or permission not confirmed</p>') +
    "<details " +
    (chosen ? "open" : "") +
    "><summary>How to do this</summary><ol>" +
    (act.how || []).map((t) => "<li>" + esc(t) + "</li>").join("") +
    '</ol><div class="source-links">' +
    sources(act.sourceIds) +
    "</div></details>" +
    (!saved
      ? btn(
          chosen ? "✓ Selected" : "Choose this step",
          "choose",
          "secondary small",
          'data-id="' + esc(act.id) + '" ' + (!act.available ? "disabled" : ""),
        )
      : "");
  return chosen
    ? '<article class="action-option selected"><h3>' +
        esc(act.title) +
        "</h3>" +
        body +
        "</article>"
    : '<details class="action-option alternative"><summary>' +
        esc(act.title) +
        '</summary><div class="alternative-body">' +
        body +
        "</div></details>";
}
function resultView() {
  const q = review();
  if (!q) return todayView();
  let { c, p, a, r } = q,
    chosen = a.actions.find((x) => x.id === c.selectedActionId),
    context = r?.context || contextSummary(c, r ? [] : ws().checks);
  return (
    title(
      a.priority === "urgent"
        ? r
          ? "Saved concern"
          : "Urgent concern"
        : r
          ? "Saved sleep check"
          : "Your sleep check",
      esc(a.headline),
      esc(a.summary),
    ) +
    '<div class="result-meta"><span class="status ' +
    esc(a.priority) +
    '">' +
    {
      urgent: "Get help now",
      review: "Medical review",
      clarify: "Information to clarify",
      routine: "Routine review",
    }[a.priority] +
    "</span><span>" +
    esc(
      (a.priority === "urgent" ? "Concern reported " : "Sleep observed ") +
        time(a.priority === "urgent" ? c.urgentReportedAt : c.observedAt),
    ) +
    "</span>" +
    (a.priority !== "urgent" && c.feelingObservedAt
      ? "<span>Condition reported " + esc(time(c.feelingObservedAt)) + "</span>"
      : "") +
    "</div>" +
    (demo()
      ? '<p class="example-note">Fictional mission context · ' +
        (Object.values(c.inputOrigins || {}).includes("user-entry")
          ? "Includes user-entered observations."
          : "Example observations; edit them to use your own.") +
        "</p>"
      : "") +
    (a.priority === "urgent"
      ? '<section class="urgent-card"><h2>Do not wait to finish this check</h2><p>' +
        esc(a.actions[0]?.how?.[0] || a.summary) +
        "</p></section>"
      : "") +
    (reportedWorsening(c)
      ? '<section class="notice warning" role="status"><strong>Worsening was reported.</strong><p>' +
        (worseningContactRecorded(c)
          ? "You recorded medical contact about this report. That does not establish clinical clearance."
          : "Report the worsening to crew medical support. You do not need to finish this check before getting help. Use Urgent symptoms if something feels urgently wrong.") +
        "</p>" +
        (r && !worseningContactRecorded(c)
          ? btn(
              "Record medical contact",
              "medical-contact",
              "secondary",
              'data-id="' + esc(r.id) + '"',
            )
          : "") +
        "</section>"
      : "") +
    returnCard(c, a) +
    (a.priority === "urgent" ? "" : combinedContext(c, a, context)) +
    '<div class="result-layout"><div>' +
    (a.priority === "urgent" ? "" : bars(a.metrics) + recentPattern(context)) +
    '<section class="findings"><h2>What your observations tell us</h2>' +
    a.findings
      .map(
        (f) =>
          '<article class="finding"><h3>' +
          esc(f.title) +
          "</h3><p>" +
          esc(f.text) +
          '</p><details><summary>Why this finding?</summary><p class="small quiet">' +
          esc(f.basis) +
          '</p><div class="source-links">' +
          sources(f.sourceIds) +
          "</div></details></article>",
      )
      .join("") +
    (a.uncertainties.length
      ? '<div class="uncertainty"><h3>What remains uncertain</h3><ul>' +
        a.uncertainties.map((t) => "<li>" + esc(t) + "</li>").join("") +
        "</ul></div>"
      : "") +
    '</section></div><aside class="next-step"><p class="eyebrow">' +
    (a.priority === "urgent"
      ? "Get help first"
      : r
        ? "Your planned next step"
        : "Choose your next step") +
    "</p><h2>" +
    (a.priority === "urgent"
      ? "What to do now"
      : r && chosen
        ? esc(chosen.title)
        : "Choose your next step") +
    "</h2>" +
    a.actions.map((act) => actionCard(act, c, r)).join("") +
    (!r
      ? (a.priority === "urgent"
          ? ""
          : '<button class="text-link context-edit" data-action="profile">Check available resources & plan</button>') +
        '<form id="save-form">' +
        (a.priority === "urgent"
          ? ""
          : '<label class="field-label" for="followUpAt">Remind me to follow up <span class="quiet">Optional</span></label><input name="followUpAt" id="followUpAt" type="datetime-local" value="' +
            esc(inp(c.followUpAt)) +
            '"><p class="small quiet">Your choice, not a clinical interval. Reminders appear in this app while it is open. No background notifications.</p>') +
        (error ? '<p class="error" role="alert">' + esc(error) + "</p>" : "") +
        '<button class="button primary full" type="submit" ' +
        (!chosen ? "disabled" : "") +
        ">" +
        (a.priority === "urgent" ? "Save concern" : "Save my next step") +
        "</button></form>"
      : '<div class="saved-next"><p>' +
        (c.actionStatus === "done"
          ? "Step marked completed."
          : "Your step is recorded as planned.") +
        (c.followUpAt ? " Follow-up: " + esc(time(c.followUpAt)) : "") +
        '</p><div class="button-column">' +
        (c.actionStatus !== "done"
          ? btn(
              "Mark step completed",
              "complete",
              "secondary",
              'data-id="' + esc(r.id) + '"',
            )
          : "") +
        btn(
          r.returnRecordId
            ? "Open return assessment"
            : a.priority === "urgent"
              ? "Record response"
              : "Check how I am now",
          r.returnRecordId
            ? "record"
            : a.priority === "urgent"
              ? "follow"
              : "return-check",
          "secondary",
          'data-id="' + esc(r.returnRecordId || r.id) + '"',
        ) +
        (c.followUpAt && new Date(c.followUpAt) > new Date()
          ? btn("Download calendar reminder", "calendar", "text") +
            '<p class="small quiet">Import the file into your calendar to create a reminder.</p>'
          : "") +
        "</div></div>") +
    "</aside></div>" +
    (r?.followUps?.length
      ? '<section class="follow-history"><h2>Follow-up observations</h2>' +
        r.followUps
          .map(
            (f) =>
              "<p><strong>" +
              esc(
                {
                  better: "Reported improvement",
                  same: "No reported change",
                  worse: "Reported worsening",
                  not_tried: "Step not attempted",
                  unknown: "Change not known",
                }[f.status],
              ) +
              "</strong> · " +
              esc(time(f.at)) +
              (f.change && f.change !== f.status
                ? " · " +
                  esc(
                    {
                      better: "Reported improvement",
                      same: "No reported change",
                      worse: "Reported worsening",
                      unknown: "Change not known",
                    }[f.change] || f.change,
                  )
                : "") +
              "<br>" +
              esc(f.note || "No additional note.") +
              "</p>",
          )
          .join("") +
        '<p class="small quiet">A later change does not establish that the action caused it.</p>' +
        "</section>"
      : "") +
    '<details class="scope-note"><summary>Sources, uncertainty and scope</summary><ul>' +
    a.limitations.map((t) => "<li>" + esc(t) + "</li>").join("") +
    '</ul><div class="source-links">' +
    sources(a.sourceIds) +
    '</div><p class="quiet small">No diagnosis, prescription or fitness clearance. Your entries are not independently verified.</p></details><div class="result-actions">' +
    btn(
      r ? "Back to Today" : "← Edit answers",
      r ? "home" : "edit",
      "secondary",
    ) +
    btn("Prepare review note", "review-note", "secondary") +
    btn("Download review", "export", "text") +
    (r ? btn("Start a new check", "start", "text") : "") +
    "</div>"
  );
}
function historyView() {
  return (
    title(
      demo() ? "Scenario records" : "Your records",
      "My checks",
      "Your observations, chosen actions and follow-up stay together.",
    ) +
    '<div class="button-row history-tools">' +
    btn("Start sleep check", "start") +
    "</div>" +
    historyExplorer() +
    (ws().checks.length
      ? '<div class="history-list">' +
        [...ws().checks]
          .reverse()
          .map(
            (r) =>
              '<article class="history-card"><div><p class="eyebrow">' +
              esc(time(recordTime(r))) +
              "</p><h2>" +
              esc(r.assessment.headline) +
              "</h2><p>" +
              (r.assessment.priority === "urgent"
                ? "Urgent concern recorded. Sleep measurements are not used for this response."
                : hrs(r.check.sleepHours) +
                  " reported sleep · " +
                  hrs(r.check.opportunityHours) +
                  " available") +
              '</p><span class="small quiet">' +
              (r.check.followUp
                ? "Follow-up recorded"
                : r.check.actionStatus === "done"
                  ? "Step completed"
                  : "Step planned") +
              "</span></div>" +
              btn(
                "Open check",
                "record",
                "secondary",
                'data-id="' + esc(r.id) + '"',
              ) +
              "</article>",
          )
          .join("") +
        "</div>"
      : '<section class="empty-state">' +
        icon.moon +
        "<h2>Your first check starts the picture.</h2><p>No records have been added here. Personal and scenario records stay separate.</p></section>")
  );
}
function aboutView() {
  return (
    title(
      "About Satris",
      "Small checks. Clearer next steps.",
      "Routine sleep checks for mission crews and analog mission teams.",
    ) +
    '<section class="about-card"><h2>What this version does</h2><p>Satris connects reported sleep, available opportunity, current sleepiness and reported disruptions to a bounded explanation and feasible next step. It keeps the uncertainty and supporting sources visible.</p><p>This version has not been clinically validated or certified for flight. It does not provide a full health assessment, diagnosis, prescriptions or fitness clearance. Satris does not measure through a camera or connect to sensors.</p><h2>Your data</h2><p>Records stay in this browser. No account, analytics, model service or health-data upload is used. This app does not encrypt browser records; storage can be cleared or evicted. Export anything you need to keep. Earlier-version records remain in separate storage.</p><h2>Scenario and personal observations</h2><p>Examples contain fictional mission context and example observations. You can edit them with your own observations; their origins remain distinct in exports and they stay in scenario records. Personal checks start empty.</p><div class="button-row">' +
    btn("Quick tour", "tour", "secondary") +
    btn("Plan & resources", "profile", "secondary") +
    '</div></section><section class="sources-list"><h2>Evidence and its limits</h2>' +
    Object.values(SOURCES)
      .map(
        (s) =>
          '<article><p class="eyebrow">' +
          esc(s.kind) +
          "</p><h3>" +
          (s.url
            ? '<a href="' +
              esc(s.url) +
              '" target="_blank" rel="noopener noreferrer">' +
              esc(s.title) +
              " ↗</a>"
            : esc(s.title)) +
          "</h3><p>" +
          esc(s.summary) +
          '</p><p class="small quiet">' +
          esc(s.section) +
          " · " +
          esc(s.version) +
          '</p><p class="small quiet"><strong>Limit:</strong> ' +
          esc(s.limitation) +
          "</p></article>",
      )
      .join("") +
    '</section><p class="quiet small">S.M.A.S.H. No NASA endorsement is implied.</p>'
  );
}
function modal(t, b) {
  dialog.innerHTML =
    '<div class="modal-heading"><h2 id="dialog-title">' +
    t +
    '</h2><button class="icon-button" data-action="close" aria-label="Close dialog">×</button></div>' +
    b;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector("button, input, select, textarea")?.focus();
}
function profile() {
  let p = ws().profile;
  modal(
    "Plan & available resources",
    '<p class="quiet">Optional context. A mission name does not establish equipment availability or permission.</p><form id="profile-form"><label class="field-label" for="environment">Environment</label><select name="environment" id="environment">' +
      [
        ["unspecified", "Not specified"],
        ["station", "Space station"],
        ["transit", "Spacecraft in transit"],
        ["surface", "Surface habitat"],
        ["rover", "Rover"],
      ]
        .map(
          ([v, l]) =>
            '<option value="' +
            v +
            '"' +
            sel(p.environment, v) +
            ">" +
            l +
            "</option>",
        )
        .join("") +
      '</select><label class="field-label" for="planHours">Supplied sleep opportunity plan <span class="quiet">Optional</span></label><div class="number-input"><input name="planHours" id="planHours" type="number" step="0.25" min="0.25" max="24" value="' +
      (p.planHours ?? "") +
      '" placeholder="Not supplied"><span>hours</span></div><label class="field-label" for="planSource">Where does this plan come from?</label><input id="planSource" name="planSource" maxlength="300" value="' +
      esc(p.planSource) +
      '" placeholder="Document, section or explicitly your own note"><p class="small quiet">A supplied plan is unverified. Satris does not make it a clinical threshold or approve it.</p>' +
      [
        ["eyeMask", "Eye mask or light blocker"],
        ["earplugs", "Approved noise accommodation"],
      ]
        .map(
          ([key, label]) =>
            '<label class="field-label" for="' +
            key +
            '">' +
            label +
            '</label><select name="' +
            key +
            '" id="' +
            key +
            '">' +
            [
              ["unknown", "Availability or permission unknown"],
              ["allowed", "Available and permitted for this sleep period"],
              ["unavailable", "Unavailable or not permitted"],
            ]
              .map(
                ([v, l]) =>
                  '<option value="' +
                  v +
                  '"' +
                  sel(p[key], v) +
                  ">" +
                  l +
                  "</option>",
              )
              .join("") +
            "</select>",
        )
        .join("") +
      '<label class="field-label" for="communication">Medical communication</label><select id="communication" name="communication">' +
      [
        ["unknown", "Not confirmed"],
        ["available", "Available"],
        ["delayed", "Delayed"],
        ["unavailable", "Unavailable"],
      ]
        .map(
          ([v, l]) =>
            '<option value="' +
            v +
            '"' +
            sel(p.communication, v) +
            ">" +
            l +
            "</option>",
        )
        .join("") +
      '</select><div id="profile-error" class="error" role="alert" hidden></div><div class="form-actions">' +
      btn("Cancel", "close", "text") +
      '<button class="button primary" type="submit">Save context</button></div></form>',
  );
}
function examples() {
  modal(
    "Same hours. Different next steps.",
    '<p class="quiet">Each case starts with six hours of example sleep. Replace the observations with your own if you wish; the mission remains fictional.</p><div class="example-choices">' +
      EXAMPLES.map(
        (e) =>
          '<button class="example-choice" data-action="example" data-id="' +
          esc(e.id) +
          '"><strong>' +
          esc(e.label) +
          "</strong><span>" +
          esc(e.description) +
          '</span><span aria-hidden="true">→</span></button>',
      ).join("") +
      "</div>",
  );
}
function tour() {
  let slides = [
      [
        "One check at a time",
        "Begin on Today. Report your last sleep, how you feel and what you noticed. Leave uncertain hours blank.",
      ],
      [
        "Understand the difference",
        "See reported sleep alongside time available and a supplied plan. Open “Why this finding?” to inspect the evidence and its limits.",
      ],
      [
        "Choose a step and follow through",
        "Confirm resources, choose a supported step and save it. Record what happens later. Examples stay separate from personal records.",
      ],
    ],
    s = slides[tourStep];
  modal(
    s[0],
    '<p class="eyebrow">Quick tour · ' +
      (tourStep + 1) +
      ' of 3</p><div class="tour-mark">' +
      icon.moon +
      '</div><p class="tour-copy">' +
      s[1] +
      '</p><div class="form-actions">' +
      btn("Skip tour", "close", "text") +
      '<div class="button-row">' +
      (tourStep ? btn("Back", "tour-back", "secondary") : "") +
      btn(
        tourStep === 2 ? "Got it" : "Next",
        tourStep === 2 ? "tour-end" : "tour-next",
      ) +
      "</div></div>",
  );
}
function urgent() {
  modal(
    "An urgent concern comes first",
    '<p class="urgent-intro">New severe breathing difficulty, a tight or heavy chest, sudden confusion, collapse or unresponsiveness needs immediate attention.</p><p>Get a crewmate’s help and activate the applicable mission emergency procedure. Do not wait to complete a sleep check or enter measurements.</p><p class="small quiet">On Earth, seek appropriate local emergency help. This is not a complete emergency assessment or spacecraft treatment procedure.</p><div class="source-links">' +
      sources(["emergency", "aha"]) +
      '</div><div class="button-column">' +
      btn("Record an urgent concern", "urgent-yes", "danger") +
      btn(
        "I am unsure and need help assessing this",
        "urgent-unsure",
        "secondary",
      ) +
      btn("No urgent concern; return to my check", "close", "text") +
      "</div>",
  );
}
function follow(id) {
  let r = ws().checks.find((r) => r.id === id);
  if (!r) return;
  if (r.assessment.priority !== "urgent") return returnDialog(id);
  modal(
    "What happened after your step?",
    '<p class="quiet">Report what you noticed. A later change does not prove that the step caused it.</p><form id="follow-form" data-id="' +
      esc(id) +
      '"><label class="field-label" for="follow-status">Since the planned step</label><select name="status" id="follow-status" required><option value="">Choose what you noticed</option>' +
      [
        ["better", "I noticed an improvement"],
        ["same", "I noticed no change"],
        ["worse", "I noticed worsening"],
        ["not_tried", "I have not tried the step"],
      ]
        .map(([v, l]) => '<option value="' + v + '">' + l + "</option>")
        .join("") +
      '</select><label class="field-label" for="follow-note">What did you notice? <span class="quiet">Optional</span></label><textarea name="note" id="follow-note" rows="3" maxlength="2000"></textarea><p class="small quiet">New or worsening symptoms may need medical review. Use Urgent symptoms if something feels urgently wrong.</p><div class="form-actions">' +
      btn("Cancel", "close", "text") +
      '<button class="button primary" type="submit">Save follow-up</button></div></form>',
  );
}
function returnDialog(id) {
  const r = ws().checks.find((r) => r.id === id);
  if (!r) return;
  if (r.returnRecordId)
    return actions.record({ dataset: { id: r.returnRecordId } });
  if (r.assessment.priority === "urgent") return follow(id);
  if (ws().draft?.returnContext?.previousRecordId === id)
    return actions.continue();
  const chosen = r.assessment.actions.find(
    (a) => a.id === r.check.selectedActionId,
  );
  const resource = r.check.selectedActionId?.includes("light")
    ? "eyeMask"
    : r.check.selectedActionId?.includes("noise")
      ? "earplugs"
      : null;
  const resourceField = resource
    ? '<label class="field-label" for="return-resource">' +
      (resource === "eyeMask"
        ? "Eye mask or light blocker"
        : "Hearing protection") +
      ' available and permitted now?</label><select name="resource" id="return-resource">' +
      [
        ["unknown", "Not confirmed"],
        ["allowed", "Available and permitted"],
        ["unavailable", "Unavailable or not permitted"],
      ]
        .map(
          ([v, t]) =>
            '<option value="' +
            v +
            '"' +
            sel(ws().profile[resource], v) +
            ">" +
            t +
            "</option>",
        )
        .join("") +
      "</select>"
    : "";
  modal(
    "Pick up where you left off",
    "<p>Your previous step: <strong>" +
      esc(chosen?.title || r.assessment.headline) +
      '</strong></p><form id="return-form" data-id="' +
      esc(id) +
      '"><label class="field-label" for="return-response">Were you able to take the step?</label><select id="return-response" name="response" required><option value="">Choose what happened</option><option value="tried">I tried it</option><option value="blocked">I could not do it</option><option value="not_tried">I have not tried it yet</option></select><label class="field-label" for="return-change">What have you noticed since then?</label><select id="return-change" name="change" required><option value="unknown">I am not sure yet</option><option value="better">An improvement</option><option value="same">No change</option><option value="worse">Worsening</option></select><label class="field-label" for="return-note">What happened or got in the way?</label><textarea id="return-note" name="note" maxlength="2000" rows="3" placeholder="For example: the eye mask was unavailable"></textarea><p class="small quiet">If you could not take the step, tell us why. Next, record your latest sleep and how you feel now. Your previous answers stay in the earlier check.</p>' +
      resourceField +
      (ws().draft
        ? '<p class="notice">You have an unfinished check. Beginning this return check will replace that draft. Saved checks remain available.</p>'
        : "") +
      '<p id="return-error" class="error" role="alert" hidden></p><div class="form-actions">' +
      btn("Cancel", "close", "text") +
      '<button type="submit" class="button primary">' +
      (ws().draft ? "Replace draft & begin return" : "Begin return check") +
      "</button></div></form>",
  );
}
function noteDialog() {
  const q = review();
  if (!q) return;
  const note = reviewNote(
    { check: q.c, profile: q.p, assessment: q.a },
    ws().checks,
  );
  modal(
    "A note for crew medical support",
    '<p>Review the details before sharing. This note stays on your device until you choose to share it. It does not contact medical support.</p><label class="field-label" for="review-note">Your review note</label><textarea id="review-note" class="review-note" rows="16" readonly>' +
      esc(note) +
      '</textarea><div class="button-row">' +
      btn("Copy note", "copy-note") +
      btn("Download text note", "download-note", "secondary") +
      '</div><p id="note-feedback" class="small" role="status"></p>',
  );
}
function changed(c, field, value) {
  c[field] = value;
  c.inputOrigins ??= {};
  c.inputOrigins[field] = "user-entry";
}
function capture(form, target) {
  const v = new FormData(form),
    c = ws().draft;
  if (!c) return;
  let entries = {};
  if (form.id === "sleep-form") {
    entries = {
      sleepHours:
        v.get("sleepHours") === "" ? null : Number(v.get("sleepHours")),
      opportunityHours:
        v.get("opportunityHours") === ""
          ? null
          : Number(v.get("opportunityHours")),
      quality: v.get("quality"),
      isCurrent: v.get("isCurrent") !== "no",
      bedTime: v.get("bedTime") || "",
      wakeTime: v.get("wakeTime") || "",
      sleepTimeZone: (v.get("sleepTimeZone") || "").trim(),
    };
    let t = v.get("observedAt");
    entries.observedAt =
      t && Number.isFinite(new Date(t).getTime())
        ? t === inp(c.observedAt)
          ? c.observedAt
          : new Date(t).toISOString()
        : "";
  }
  if (form.id === "feeling-form")
    entries = {
      feeling: v.get("feeling") || "unknown",
      feelingScope: "current",
      feelingObservedAt: new Date().toISOString(),
    };
  if (form.id === "disruption-form") {
    let d = v.getAll("disruptions");
    entries = {
      disruptions: d,
      disruptionStatus: d.length ? "reported" : v.get("disruptionStatus"),
      notes: v.get("notes") || "",
      stress: v.get("stress") || "unknown",
      workload: v.get("workload") || "unknown",
      caffeineMg:
        v.get("caffeineMg") === "" ? null : Number(v.get("caffeineMg")),
      caffeineTime: v.get("caffeineTime") || "",
      scheduleChanged: v.get("scheduleChanged") || "unknown",
      upcomingTask: (v.get("upcomingTask") || "").trim(),
      reactionMs:
        v.get("reactionMs") === "" ? null : Number(v.get("reactionMs")),
      reactionMetric: v.get("reactionMetric") || "",
      reactionObservedAt: enteredTime(v.get("reactionObservedAt")),
      reactionMethod: (v.get("reactionMethod") || "").trim(),
      reactionDevice: (v.get("reactionDevice") || "").trim(),
      reactionProtocol: (v.get("reactionProtocol") || "").trim(),
    };
  }
  for (const [key, value] of Object.entries(entries)) {
    if (JSON.stringify(c[key]) !== JSON.stringify(value))
      changed(c, key, value);
  }
  if (target?.name && Object.hasOwn(entries, target.name))
    c.inputOrigins = { ...c.inputOrigins, [target.name]: "user-entry" };
  persist();
}
function download() {
  let q = review();
  if (!q) return;
  let payload = {
    ...buildExport(q.c, q.p),
    assessment: q.a,
    context: q.r?.context || contextSummary(q.c, q.r ? [] : ws().checks),
    followUps: q.r?.followUps || [],
  };
  let url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download =
    "satris-" + (demo() ? "scenario" : "sleep") + "-" + q.c.id + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  notify("Review downloaded. Nothing has been transmitted.");
}
const actions = {
  home: () => go("today"),
  nav: (el) => go(el.dataset.view),
  close: () => dialog.close(),
  start: () => {
    if (ws().draft) {
      modal(
        "Continue your unfinished check?",
        '<p>Your earlier answers are retained. Continue or begin a new check.</p><div class="button-column">' +
          btn("Continue check", "continue") +
          btn("Start a new check", "replace", "secondary") +
          btn("Cancel", "close", "text") +
          "</div>",
      );
      return;
    }
    actions.replace();
  },
  replace: () => {
    dialog.close();
    ws().draft = createCheck(state.mode);
    state.step = 0;
    state.reviewId = null;
    go("check");
  },
  continue: () => {
    dialog.close();
    state.reviewId = null;
    go("check");
  },
  back: () => {
    state.step = Math.max(0, state.step - 1);
    go("check");
  },
  edit: () => {
    state.step = 0;
    state.reviewId = null;
    go("check");
  },
  examples,
  example: (el) => {
    let e = EXAMPLES.find((e) => e.id === el.dataset.id);
    if (!e) return;
    state.mode = "example";
    ws().profile = { ...createProfile(), ...clone(e.profile) };
    ws().draft = {
      ...createCheck("example"),
      ...clone(e.check),
      scenarioId: e.id,
    };
    ws().draft.inputOrigins = Object.fromEntries(
      Object.keys(e.check).map((k) => [k, "example"]),
    );
    let a = assess(ws().draft, ws().profile);
    ws().draft.selectedActionId =
      a.actions.find((x) => x.available)?.id || null;
    state.reviewId = null;
    dialog.close();
    go("result");
  },
  personal: () => {
    state.mode = "personal";
    state.reviewId = null;
    go("today");
  },
  choose: (el) => {
    let q = review();
    if (!q || q.r) return;
    let a = q.a.actions.find((x) => x.id === el.dataset.id && x.available);
    if (a) {
      q.c.selectedActionId = a.id;
      persist();
      render(false);
    }
  },
  alerts: alertsDialog,
  calendar: calendarDownload,
  "alert-record": (el) => {
    dialog.close();
    actions.record(el);
  },
  "alert-follow": (el) => {
    dialog.close();
    follow(el.dataset.id);
  },
  rhythm: rhythmDialog,
  "rhythm-calendar": rhythmCalendar,
  "journey-on": () => {
    ws().journeyEnabled = true;
    persist();
    render(false);
  },
  "journey-off": () => {
    ws().journeyEnabled = false;
    persist();
    render(false);
  },
  "alert-start": () => {
    dialog.close();
    actions.start();
  },
  profile,
  tour: () => {
    tourStep = 0;
    tour();
  },
  "tour-next": () => {
    tourStep++;
    tour();
  },
  "tour-back": () => {
    tourStep--;
    tour();
  },
  "tour-end": () => {
    state.tourSeen = true;
    persist();
    dialog.close();
  },
  urgent,
  "urgent-yes": () => recordUrgent("yes"),
  "urgent-unsure": () => recordUrgent("unsure"),
  record: (el) => {
    state.reviewId = el.dataset.id;
    go("result");
  },
  complete: (el) => {
    let r = ws().checks.find((r) => r.id === el.dataset.id);
    if (r) {
      r.check.actionStatus = "done";
      r.check.actionUpdatedAt = new Date().toISOString();
      persist();
      render(false);
      notify("Step completion recorded.");
    }
  },
  follow: (el) => follow(el.dataset.id),
  "return-check": (el) => returnDialog(el.dataset.id),
  "draft-concern": () => {
    state.reviewId = null;
    go("result");
  },
  "medical-contact": (el) =>
    modal(
      "Record medical contact",
      '<p>Record contact you have already made about this worsening report. This does not send a message or establish clinical clearance.</p><form id="contact-form" data-id="' +
        esc(el.dataset.id) +
        '"><label><input type="checkbox" name="contacted" required> I contacted crew medical support about this report</label><label class="field-label" for="contact-note">What should stay in your record? Optional</label><textarea id="contact-note" name="note" maxlength="2000" rows="3"></textarea><div class="form-actions">' +
        btn("Cancel", "close", "text") +
        '<button class="button primary" type="submit">Record contact made</button></div></form>',
    ),
  "review-note": noteDialog,
  "copy-note": async () => {
    const feedback = document.querySelector("#note-feedback");
    try {
      await navigator.clipboard.writeText(
        document.querySelector("#review-note").value,
      );
      feedback.textContent = "Note copied. Review it before sharing.";
    } catch {
      feedback.textContent =
        "Copy is unavailable here. Select the note to copy it, or download the text file.";
    }
  },
  "download-note": () => {
    const url = URL.createObjectURL(
      new Blob([document.querySelector("#review-note").value], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "satris-crew-review.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    document.querySelector("#note-feedback").textContent =
      "Note downloaded. Nothing has been sent.";
  },
  export: download,
};
function recordUrgent(value) {
  if (!ws().draft) ws().draft = createCheck(state.mode);
  changed(ws().draft, "urgent", value);
  changed(ws().draft, "urgentReportedAt", new Date().toISOString());
  ws().draft.selectedActionId =
    assess(ws().draft, ws().profile).actions.find((a) => a.available)?.id ||
    null;
  state.reviewId = null;
  dialog.close();
  go("result");
}
document.addEventListener("click", (ev) => {
  let el = ev.target.closest("[data-action]");
  if (!el) return;
  ev.preventDefault();
  try {
    actions[el.dataset.action]?.(el);
  } catch (e) {
    console.error(e);
    notify("That action could not finish. Your entries remain in this tab.");
  }
});
document.addEventListener("input", (ev) => {
  let f = ev.target.closest("form");
  if (f && ["sleep-form", "feeling-form", "disruption-form"].includes(f.id))
    capture(f, ev.target);
});
document.addEventListener("change", (ev) => {
  let f = ev.target.closest("form");
  if (f && ["sleep-form", "feeling-form", "disruption-form"].includes(f.id))
    capture(f, ev.target);
});
document.addEventListener("submit", (ev) => {
  let f = ev.target;
  if (
    ![
      "sleep-form",
      "feeling-form",
      "disruption-form",
      "profile-form",
      "save-form",
      "follow-form",
      "rhythm-form",
      "return-form",
      "contact-form",
    ].includes(f.id)
  )
    return;
  ev.preventDefault();
  error = "";
  let v = new FormData(f);
  try {
    if (["sleep-form", "feeling-form", "disruption-form"].includes(f.id)) {
      capture(f);
      let c = ws().draft;
      if (f.id === "sleep-form") {
        let errors = [
          ...validateCheck(c).filter((t) =>
            /sleep|opportunity|hours|period|time|date|numeric|number|estimate/i.test(
              t,
            ),
          ),
          ...validateContext(c).filter((t) =>
            /bed|wake|clock|timing|zone/i.test(t),
          ),
        ];
        if (errors.length) throw Error(errors.join(" "));
        state.step = 1;
      } else if (f.id === "feeling-form") state.step = 2;
      else {
        let e = [...validateCheck(c), ...validateContext(c)];
        if (e.length) throw Error(e.join(" "));
        state.view = "result";
        state.reviewId = null;
        c.selectedActionId =
          assess(c, ws().profile).actions.find((x) => x.available)?.id || null;
      }
      persist();
      render();
    }
    if (f.id === "profile-form") {
      let raw = v.get("planHours"),
        p = {
          environment: v.get("environment"),
          planHours: raw === "" ? null : Number(raw),
          planSource: v.get("planSource").trim(),
          eyeMask: v.get("eyeMask"),
          earplugs: v.get("earplugs"),
          communication: v.get("communication"),
        },
        errors = validateProfile(p);
      if (errors.length) throw Error(errors.join(" "));
      ws().profile = p;
      if (ws().draft) {
        let a = assess(ws().draft, p);
        if (
          !a.actions.some(
            (x) => x.id === ws().draft.selectedActionId && x.available,
          )
        )
          ws().draft.selectedActionId =
            a.actions.find((x) => x.available)?.id || null;
      }
      persist();
      dialog.close();
      render(false);
      notify("Context saved. Current draft guidance updated.");
    }
    if (f.id === "rhythm-form") {
      const old = ws().schedule,
        chosen = {
          enabled: v.has("enabled"),
          cadenceDays: Number(v.get("cadenceDays")),
          time: v.get("time"),
          timeZone: v.get("timeZone"),
          nextAt: null,
        };
      const issues = validateSchedule(chosen);
      if (issues.length) throw Error(issues.join(" "));
      const manual = v.get("nextAt"),
        unchanged = ["enabled", "cadenceDays", "time", "timeZone"].every(
          (key) => chosen[key] === old[key],
        );
      if (chosen.enabled) {
        if (manual) {
          const at = Date.parse(manual);
          if (!Number.isFinite(at) || at <= Date.now())
            throw Error(
              "Choose a future next check-in time, or leave it blank.",
            );
          chosen.nextAt = new Date(at).toISOString();
        } else
          chosen.nextAt =
            unchanged && old.nextAt ? old.nextAt : nextRoutineAt(chosen);
      }
      ws().schedule = chosen;
      persist();
      dialog.close();
      render(false);
      notify(
        chosen.enabled
          ? "Your chosen check-in rhythm is saved."
          : "Routine check-in reminders are off.",
      );
    }
    if (f.id === "save-form") {
      let q = review();
      if (!q || q.r) return;
      const contextErrors =
        q.a.priority === "urgent"
          ? []
          : [...validateCheck(q.c), ...validateContext(q.c)];
      if (contextErrors.length) throw Error(contextErrors.join(" "));
      if (
        !q.a.actions.some((x) => x.id === q.c.selectedActionId && x.available)
      )
        throw Error("Choose an available next step first.");
      let t = v.get("followUpAt");
      if (
        t &&
        (!Number.isFinite(new Date(t).getTime()) || new Date(t) <= new Date())
      )
        throw Error("Choose a future reminder or leave it blank.");
      q.c.followUpAt = t ? new Date(t).toISOString() : null;
      q.c.actionStatus = "planned";
      const newRecord = {
        id: q.c.id,
        check: clone(q.c),
        profile: clone(q.p),
        assessment: clone(q.a),
        context: clone(contextSummary(q.c, ws().checks)),
        savedAt: new Date().toISOString(),
        followUps: [],
      };
      linkReturn(newRecord, ws().checks);
      ws().checks.push(newRecord);
      ws().schedule = advanceRoutine(ws().schedule, q.c, Date.now());
      state.reviewId = q.c.id;
      ws().draft = null;
      persist();
      render();
      notify(
        canSave
          ? "Check saved. Your next step is here when you need it."
          : "Record is in memory only. Export before closing.",
      );
    }
    if (f.id === "return-form") {
      const prior = ws().checks.find((r) => r.id === f.dataset.id);
      if (!prior) throw Error("The previous check could not be found.");
      ws().draft = beginReturn(
        prior,
        v.get("response"),
        v.get("change"),
        v.get("note"),
      );
      const resource = prior.check.selectedActionId?.includes("light")
        ? "eyeMask"
        : prior.check.selectedActionId?.includes("noise")
          ? "earplugs"
          : null;
      if (
        resource &&
        ["allowed", "unavailable", "unknown"].includes(v.get("resource"))
      ) {
        ws().profile[resource] = v.get("resource");
        ws().draft.returnContext.resource = {
          name: resource,
          status: v.get("resource"),
        };
      }
      state.step = 0;
      state.reviewId = null;
      dialog.close();
      go("check");
    }
    if (f.id === "follow-form") {
      let r = ws().checks.find((r) => r.id === f.dataset.id);
      if (!r) return;
      let follow = {
        status: v.get("status"),
        note: v.get("note") || "",
        at: new Date().toISOString(),
      };
      r.check.followUp = follow;
      r.followUps ??= [];
      r.followUps.push(clone(follow));
      state.reviewId = r.id;
      state.view = "result";
      persist();
      dialog.close();
      render();
      notify("Follow-up recorded.");
    }
    if (f.id === "contact-form") {
      const record = ws().checks.find((r) => r.id === f.dataset.id);
      if (!record || !v.has("contacted"))
        throw Error("Confirm contact already made about this report.");
      const contact = {
        at: new Date().toISOString(),
        note: v.get("note") || "",
      };
      record.check.medicalContactAt = contact.at;
      record.check.medicalContacts ??= [];
      record.check.medicalContacts.push(contact);
      state.reviewId = record.id;
      state.view = "result";
      persist();
      dialog.close();
      render();
      notify(
        "Medical contact recorded. This does not establish clinical clearance.",
      );
    }
  } catch (e) {
    error = e.message;
    if (f.id === "return-form") {
      const el = document.querySelector("#return-error");
      el.hidden = false;
      el.textContent = error;
      return;
    }
    if (f.id === "profile-form" || f.id === "rhythm-form") {
      let el = document.querySelector(
        f.id === "rhythm-form" ? "#rhythm-error" : "#profile-error",
      );
      el.hidden = false;
      el.textContent = error;
    } else {
      render(false);
      document.querySelector(".error")?.scrollIntoView({ block: "center" });
    }
  }
});
window.addEventListener("beforeunload", (ev) => {
  if (!canSave && (ws().draft || ws().checks.length)) {
    ev.preventDefault();
    ev.returnValue = "";
  }
});
render(false);
setInterval(() => {
  if (state.view === "today" && !dialog.open) render(false);
  else refreshAlerts();
}, 60000);
