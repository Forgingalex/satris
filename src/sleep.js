// Satris routine sleep assessment. Deterministic educational decision support.
// Clinical principles, arithmetic, and mission adaptations remain distinguishable.
export const VERSION = "0.5.1";
export const CONTENT_VERSION = "2026-11-14-routine-5";
export const SOURCES = {
  hrp: {
    id: "hrp",
    title: "NASA Human Research Program: Risks of Human Spaceflight",
    url: "https://www.nasa.gov/hrp/risks/",
    section: "Risk of Inadequate Sleep and Irregular Schedules",
    kind: "NASA challenge resource / research overview",
    version: "Web page checked 13 November 2026",
    summary:
      "Sleep, work demands and biological timing are relevant to crew health and performance.",
    limitation:
      "Establishes a relevant risk, not a personal diagnosis or a validated Satris rule.",
  },
  study: {
    id: "study",
    title: "Sleep deficiency and neurobehavioral functioning in ISS astronauts",
    url: "https://pubmed.ncbi.nlm.nih.gov/35023565/",
    section:
      "Jones et al., Sleep 2022;45(3):zsac006; 24 astronauts on approximately six-month missions",
    kind: "Observational spaceflight research",
    version: "2022 study; reviewed for this rebuild",
    summary:
      "The study collected 2,856 repeated assessments in 24 astronauts and found associations between shorter sleep and poorer neurobehavioral outcomes. This supports considering sleep and present functioning together.",
    limitation:
      "Repeated assessments are not additional participants. Study sleep categories and averages are not individual action thresholds, targets or fitness-clearance rules. Associations do not establish this person’s cause.",
  },
  fatigue: {
    id: "fatigue",
    title: "NASA Fatigue Management Services",
    url: "https://ntrs.nasa.gov/api/citations/20200011570/downloads/20200011570.pdf",
    section:
      "February 2020 presentation, PDF page 8; lighting examples on page 4",
    kind: "NASA operational countermeasure briefing",
    version: "NTRS 20200011570; reviewed for this rebuild",
    summary:
      "NASA describes scheduling, sleep environment, naps and fatigue-management support as countermeasure considerations.",
    limitation:
      "This does not select an intervention for an individual, authorize schedule changes or supply portable lighting instructions. Satris does not prescribe naps or circadian lighting.",
  },
  operations: {
    id: "operations",
    title: "NASA Medical Operations",
    url: "https://www.nasa.gov/reference/6-0-medical-operations/",
    section: "V1 6001, section 6.1; V1 6002, section 6.2",
    kind: "NASA operational standard and rationale",
    version: "Web requirements checked 13 November 2026",
    summary:
      "Sleep scheduling involves protected opportunity, workload, timing and individual needs. Medical communication arrangements depend on the mission.",
    limitation:
      "The scheduling rationale is not a diagnostic cutoff. An entered plan is not independently verified or approved by Satris.",
  },
  accommodation: {
    id: "accommodation",
    title: "NASA Sleep Accommodation",
    url: "https://www.nasa.gov/reference/7-0-habit-ability-functions-vol-2/",
    section: "V2 7070, section 7.9.1",
    kind: "NASA system requirement and rationale",
    version: "Web requirements checked 13 November 2026",
    summary:
      "Light, noise and other environmental conditions can interfere with sleep. Accommodation examples include masks, light blockers and earplugs.",
    limitation:
      "A reported disturbance does not prove a cause. Equipment availability and mission permission must be checked.",
  },
  data: {
    id: "data",
    title: "NASA Crew Interfaces",
    url: "https://www.nasa.gov/reference/10-0-crew-interfaces-vol-2/",
    section: "V2 10020, section 10.2.1",
    kind: "NASA engineering requirement",
    version: "Web requirements checked 13 November 2026",
    summary:
      "Missing, unknown, unavailable and stale information must be recognizable.",
    limitation:
      "Supports displaying data status. Satris decision handling is an engineering application, not a clinical rule from this requirement.",
  },
  sleepiness: {
    id: "sleepiness",
    title: "NHS: Excessive daytime sleepiness",
    url: "https://www.nhs.uk/conditions/excessive-daytime-sleepiness-hypersomnia/",
    section: "When to seek medical review; assessment and sleep diary",
    kind: "Terrestrial clinical guidance",
    version: "Reviewed 23 June 2023; checked 13 November 2026",
    summary:
      "Sleepiness affecting everyday activities or frequent unintended daytime sleep is a reason for medical review. A sleep diary can help assessment.",
    limitation:
      "Does not diagnose the cause or validate use in space. Routing to crew medical support is a Satris adaptation.",
  },
  emergency: {
    id: "emergency",
    title: "NHS: Shortness of breath",
    url: "https://www.nhs.uk/symptoms/shortness-of-breath/",
    section: "Immediate action advice",
    kind: "Terrestrial emergency recognition guidance",
    version: "Reviewed 30 January 2024; checked 13 November 2026",
    summary:
      "Severe breathing difficulty, a tight or heavy chest, or sudden confusion require immediate help.",
    limitation:
      "This is not a complete emergency assessment. Crew routing requires the applicable mission procedure, not an Earth telephone number.",
  },
  aha: {
    id: "aha",
    title: "AHA: Adult Basic Life Support",
    url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-life-support",
    section: "2025 guidance, section 6.1, recognition of cardiac arrest",
    kind: "Terrestrial emergency guidance",
    version: "2025 guideline; checked 13 November 2026",
    summary:
      "Unresponsiveness with absent or abnormal breathing requires prompt emergency recognition and response.",
    limitation:
      "Satris does not diagnose cardiac arrest or teach resuscitation. These Earth recommendations are not a validated microgravity procedure.",
  },
  design: {
    id: "design",
    title: "Satris assessment design",
    url: null,
    section: "Routine assessment mechanism and scope",
    kind: "Engineering choice",
    version: CONTENT_VERSION,
    summary:
      "Reported observations, source guidance, plan arithmetic and action constraints remain separate. Unknown is not zero or normal.",
    limitation:
      "The workflow has not been clinically validated. Reminder times are user choices. Follow-up changes do not prove treatment effects.",
  },
};
const num = (x) => typeof x === "number" && Number.isFinite(x);
const uid = () => globalThis.crypto.randomUUID();
const iso = () => new Date().toISOString();
const amount = (x) => Number(x.toFixed(2));
// Legacy records did not distinguish the sleep period from the condition report.
export const feelingIsCurrent = (c) =>
  c.feelingScope === "current" || (!c.feelingScope && c.isCurrent !== false);
// Read older subjectId records without mixing different or conflicting people.
export function personIdentity(check = {}) {
  const ids = [check.personId, check.subjectId].filter(
    (v) => v != null && v !== "",
  );
  if (ids.some((v) => typeof v !== "string" || !v.trim())) return null;
  const unique = [...new Set(ids.map((v) => v.trim()))];
  return unique.length > 1 ? null : unique[0] || "self";
}
export function createProfile() {
  return {
    environment: "unspecified",
    planHours: null,
    planSource: "",
    eyeMask: "unknown",
    earplugs: "unknown",
    communication: "unknown",
  };
}
export function environmentInsight(p = createProfile()) {
  const settings = {
    unspecified: [
      "Your sleep, in context",
      "Choose your setting to see what to consider. Your actual schedule, equipment and medical connection determine which next steps are available.",
    ],
    station: [
      "Rest in orbit",
      "Light, noise and shared activities can interrupt sleep. Record what you noticed and check the permitted accommodations for your sleeping area.",
    ],
    transit: [
      "Rest between worlds",
      "A changing work schedule can compete with sleep opportunity. Compare your available window with the plan supplied for this mission; confirm the onboard support route.",
    ],
    rover: [
      "Rest during a rover mission",
      "Check when a safe pause and a suitable rest space are available under your mission plan. Record cabin disturbances and resource limits; Satris does not authorize stopping a task or vehicle.",
    ],
    surface: [
      "Rest beyond Earth",
      "Use the sleep schedule supplied for your habitat. Outside daylight is not a substitute for that plan. Record light, noise and timing changes without assuming they establish your body-clock phase.",
    ],
  };
  const [title, text] = settings[p.environment] || settings.unspecified;
  return {
    title,
    text,
    sourceIds: ["hrp", "operations", "accommodation"],
    basis:
      "NASA sleep principles applied to a user-selected setting. Setting-specific prompts are engineering choices, not validated environment-specific clinical rules.",
  };
}
export function createCheck(mode = "personal") {
  return {
    id: uid(),
    mode,
    observedAt: iso(),
    enteredAt: iso(),
    isCurrent: true,
    inputOrigins: {},
    sleepHours: null,
    opportunityHours: null,
    quality: "estimated",
    feeling: "unknown",
    feelingScope: null,
    feelingObservedAt: null,
    disruptions: [],
    disruptionStatus: "unknown",
    recurring: "unknown",
    urgent: "no",
    urgentReportedAt: null,
    notes: "",
    selectedActionId: null,
    actionStatus: "planned",
    followUpAt: null,
    followUp: null,
    bedTime: "",
    wakeTime: "",
    sleepTimeZone: "",
    stress: "unknown",
    workload: "unknown",
    caffeineMg: null,
    caffeineTime: "",
    scheduleChanged: "unknown",
    upcomingTask: "",
    reactionMs: null,
    reactionMetric: "",
    reactionMethod: "",
    reactionProtocol: "",
    reactionDevice: "",
    reactionObservedAt: null,
  };
}
export const EXAMPLES = [
  {
    id: "opportunity",
    label: "A short sleep window",
    description:
      "Six hours asleep, with too little opportunity for the supplied example plan.",
    profile: {
      ...createProfile(),
      environment: "transit",
      planHours: 8,
      planSource: "Fictional example plan, not a clinical prescription",
      communication: "delayed",
    },
    check: {
      sleepHours: 6,
      opportunityHours: 6,
      feeling: "sleepy",
      disruptions: ["workload"],
      disruptionStatus: "reported",
      notes:
        "Fictional case. A protected task occupied part of the planned sleep window.",
    },
  },
  {
    id: "light",
    label: "Light interrupted sleep",
    description:
      "The same six hours, a longer opportunity, and an available accommodation.",
    profile: {
      ...createProfile(),
      environment: "station",
      planHours: 8,
      planSource: "Fictional example plan, not a clinical prescription",
      eyeMask: "allowed",
      communication: "available",
    },
    check: {
      sleepHours: 6,
      opportunityHours: 8,
      feeling: "sleepy",
      disruptions: ["light"],
      disruptionStatus: "reported",
      notes: "Fictional case. Light was reported during the sleep period.",
    },
  },
  {
    id: "review",
    label: "Sleepiness needs review",
    description:
      "Six hours recorded, but daytime sleepiness is affecting activities.",
    profile: {
      ...createProfile(),
      environment: "surface",
      planHours: 8,
      planSource: "Fictional example plan, not a clinical prescription",
      communication: "unavailable",
    },
    check: {
      sleepHours: 6,
      opportunityHours: 8,
      feeling: "impact",
      disruptions: [],
      disruptionStatus: "unknown",
      notes:
        "Fictional case. Sleepiness is interfering with activities. Ground contact is unavailable.",
    },
  },
].map((example) => ({
  ...example,
  check: {
    ...example.check,
    inputOrigins: Object.fromEntries(
      Object.keys(example.check).map((k) => [k, "example"]),
    ),
  },
}));
export function validateCheck(c, nowMs = Date.now()) {
  const errors = [];
  for (const [key, label] of [
    ["sleepHours", "Estimated sleep"],
    ["opportunityHours", "Sleep opportunity"],
  ]) {
    if (
      c[key] !== null &&
      c[key] !== undefined &&
      (!num(c[key]) || c[key] < 0 || c[key] > 24)
    )
      errors.push(
        `${label} must be a number from 0 to 24 hours, or left unknown. These are format limits, not clinical ranges.`,
      );
  }
  if (
    num(c.sleepHours) &&
    num(c.opportunityHours) &&
    c.sleepHours > c.opportunityHours
  )
    errors.push(
      "Estimated sleep exceeds the available time. Check that both describe the same main sleep period, or mark an uncertain value unknown.",
    );
  if (!["estimated", "uncertain"].includes(c.quality))
    errors.push("Confirm whether the sleep estimates are usable or uncertain.");
  if (
    !["alert", "sleepy", "impact", "unintended", "unknown"].includes(c.feeling)
  )
    errors.push("Choose how you feel now, including Not sure.");
  if (!["yes", "no", "unsure"].includes(c.urgent))
    errors.push("Confirm whether there is an urgent concern.");
  if (
    !Array.isArray(c.disruptions) ||
    c.disruptions.some(
      (d) =>
        !["light", "noise", "temperature", "workload", "other"].includes(d),
    )
  )
    errors.push("Check the reported disturbances.");
  if (!["reported", "none", "unknown"].includes(c.disruptionStatus))
    errors.push("Record whether a disturbance was noticed.");
  if (c.disruptionStatus === "reported" && !c.disruptions?.length)
    errors.push(
      "Select a reported disturbance, or choose Nothing reported / Not sure.",
    );
  if (c.disruptionStatus !== "reported" && c.disruptions?.length)
    errors.push(
      "Reported disturbances conflict with the selected disturbance status.",
    );
  if (!c.observedAt || !Number.isFinite(new Date(c.observedAt).getTime()))
    errors.push("Record a valid observation date and time.");
  for (const [key, label] of [
    ["observedAt", "Sleep observation"],
    ["feelingObservedAt", "Condition report"],
    ["urgentReportedAt", "Urgent report"],
  ]) {
    if (c[key] && !Number.isFinite(Date.parse(c[key])))
      errors.push(`${label} time must be valid.`);
    else if (c[key] && Date.parse(c[key]) > nowMs)
      errors.push(
        `${label} time cannot be in the future. Record observations already made; use reminders for planned checks.`,
      );
  }
  if (
    c.feelingScope != null &&
    !["current", "historical"].includes(c.feelingScope)
  )
    errors.push(
      "Confirm whether the condition report is current or historical.",
    );
  if (
    c.feelingScope === "current" &&
    c.feeling !== "unknown" &&
    !c.feelingObservedAt
  )
    errors.push("Record a condition report time for the current experience.");
  return errors;
}
export function validateProfile(p) {
  const errors = [];
  if (
    p.planHours !== null &&
    p.planHours !== undefined &&
    (!num(p.planHours) || p.planHours <= 0 || p.planHours > 24)
  )
    errors.push(
      "A supplied sleep opportunity must be more than 0 and no more than 24 hours.",
    );
  if (num(p.planHours) && !p.planSource?.trim())
    errors.push(
      "Name the source of the supplied plan, or leave the plan empty.",
    );
  if (
    !["unspecified", "station", "transit", "rover", "surface"].includes(
      p.environment,
    )
  )
    errors.push("Choose a valid mission setting.");
  if (
    !["allowed", "unavailable", "unknown"].includes(p.eyeMask) ||
    !["allowed", "unavailable", "unknown"].includes(p.earplugs)
  )
    errors.push("Confirm the available and permitted accommodations.");
  if (
    !["available", "delayed", "unavailable", "unknown"].includes(
      p.communication,
    )
  )
    errors.push("Confirm the communication arrangement.");
  return errors;
}
function contactInstructions(p) {
  if (p.communication === "delayed")
    return [
      "Inform the onboard crew medical officer or designated crewmate.",
      "Prepare the record for the approved delayed medical communication channel. Satris does not send it.",
      "Follow the mission procedure while awaiting a response; this tool cannot establish that waiting is safe.",
    ];
  if (p.communication === "unavailable")
    return [
      "Inform the onboard crew medical officer or designated crewmate.",
      "Use the applicable onboard medical procedure. Save the review for ground support when communication is restored.",
      "A missing ground connection does not remove the need for onboard help.",
    ];
  if (p.communication === "available")
    return [
      "Contact the crew medical officer or flight surgeon through the approved channel.",
      "Share the sleep record, current symptoms and relevant uncertainty. Satris prepares a file; it does not transmit it.",
    ];
  return [
    "Ask the crew medical officer or designated crewmate which medical support pathway applies.",
    "Keep this record available for that review. No communication connection has been verified by Satris.",
  ];
}
export function assess(c, p = createProfile(), nowMs = Date.now()) {
  const r = {
    priority: "routine",
    headline: "Keep a useful sleep record",
    summary:
      "These observations do not establish a diagnosis or a specific cause.",
    findings: [],
    uncertainties: [],
    actions: [],
    followUpPrompt:
      "At your next main sleep review, record what you tried and what you noticed. The reminder time is your choice, not a clinical instruction.",
    limitations: [
      "User reported information; no automatic measurements.",
      "No diagnosis, medication advice or fitness clearance.",
    ],
    metrics: {
      sleepHours: num(c.sleepHours) ? c.sleepHours : null,
      opportunityHours: num(c.opportunityHours) ? c.opportunityHours : null,
      planHours: num(p.planHours) && p.planSource?.trim() ? p.planHours : null,
      gapHours: null,
    },
    sourceIds: ["hrp", "design"],
  };
  const addFinding = (
    id,
    title,
    text,
    sourceIds,
    basis = "Sourced principle with an engineering application",
  ) => r.findings.push({ id, title, text, sourceIds, basis });
  const action = (
    id,
    title,
    why,
    how,
    sourceIds,
    available = true,
    requiresReview = false,
  ) =>
    r.actions.push({
      id,
      title,
      why,
      how,
      sourceIds,
      available,
      requiresReview,
    });
  const finish = () => {
    r.sourceIds = [
      ...new Set([
        ...r.sourceIds,
        ...r.findings.flatMap((f) => f.sourceIds),
        ...r.actions.flatMap((a) => a.sourceIds),
      ]),
    ];
    r.contentVersion = CONTENT_VERSION;
    r.sourceVersions = Object.fromEntries(
      r.sourceIds.map((key) => [key, SOURCES[key].version]),
    );
    return r;
  };
  // Current urgent reports take precedence over missing measurements or past numbers.
  if (c.urgent === "yes" || c.urgent === "unsure") {
    r.priority = "urgent";
    r.headline =
      c.urgent === "yes"
        ? "Get crew help now"
        : "Get help assessing this concern";
    r.summary =
      "Do not wait to complete a sleep check or enter more measurements.";
    addFinding(
      "urgent",
      "An urgent concern is unresolved",
      c.urgent === "yes"
        ? "You reported a new urgent concern. Sleep duration cannot explain or clear it."
        : "You are uncertain about a possible urgent concern. That uncertainty must not become a reassuring result.",
      ["emergency", "aha", "design"],
    );
    action(
      "urgent-help",
      c.urgent === "yes"
        ? "Activate the applicable emergency response"
        : "Get immediate help assessing the concern",
      "A routine sleep review cannot assess an acute emergency.",
      [
        "Get a crewmate’s help and alert the designated onboard responder.",
        c.urgent === "yes"
          ? "Follow your training and the applicable mission emergency procedure. On Earth, seek local emergency assistance."
          : "Ask the designated responder to assess the possible danger and follow the applicable procedure. Do not use an incomplete sleep check for reassurance.",
        "Satris does not diagnose the problem or provide a complete emergency treatment procedure.",
      ],
      ["emergency", "aha", "design"],
      true,
      true,
    );
    return finish();
  }
  const errors = validateCheck(c, nowMs),
    planErrors = validateProfile(p);
  r.uncertainties.push(...errors, ...planErrors);
  if (c.isCurrent === false && !feelingIsCurrent(c)) {
    r.priority = "clarify";
    r.headline = "Keep this as a historical record";
    r.summary =
      "These observations describe an earlier period. They cannot establish your current condition.";
    r.uncertainties.push(
      "A current assessment needs a new report, rather than reusing this earlier observation.",
    );
    addFinding(
      "historical",
      "Earlier observations stay historical",
      "The sleep and condition reports are retained with their time. They have not been substituted for a current measurement.",
      ["data", "design"],
    );
    action(
      "current-check",
      "Begin a current check",
      "Earlier observations can provide context, but cannot answer how you are now.",
      [
        "Save this dated record if useful.",
        "Start a new check for the latest main sleep period and your present condition.",
      ],
      ["data", "design"],
    );
    return finish();
  }
  const review =
    feelingIsCurrent(c) && ["impact", "unintended"].includes(c.feeling);
  if (review) {
    r.priority = "review";
    r.headline = "Arrange a medical review";
    r.summary =
      "Your reported daytime sleepiness deserves attention, whatever the recorded sleep duration.";
    addFinding(
      "sleepiness",
      "Current function needs attention",
      c.feeling === "impact"
        ? "You report sleepiness affecting your activities."
        : "You report often falling asleep unintentionally during waking hours.",
      ["sleepiness"],
    );
    action(
      "medical-review",
      "Contact crew medical support",
      "Clinical guidance recommends review when sleepiness affects daily life or unintended daytime sleep happens often.",
      contactInstructions(p),
      ["sleepiness", "operations"],
      true,
      true,
    );
  }
  if (errors.length || planErrors.length) {
    if (!review) {
      r.priority = "clarify";
      r.headline = "Clarify the record first";
      r.summary = "Some entries conflict or cannot be interpreted as recorded.";
    }
    action(
      "clarify",
      "Check the unresolved entries",
      "A format error or contradictory report must not create a clinical conclusion.",
      [
        "Review the specific issues shown above.",
        "Correct the entry or explicitly mark it unknown.",
      ],
      ["data", "design"],
    );
    return finish();
  }
  if (c.isCurrent === false || !feelingIsCurrent(c)) {
    addFinding(
      "historical-sleep",
      "Sleep and condition reports have different times",
      "The sleep observations describe an earlier period. Any current condition report is considered separately; older sleep values do not establish your latest sleep or its cause.",
      ["data", "design"],
    );
    if (!review) {
      r.priority = "clarify";
      r.headline = "Add a current sleep check when available";
      r.summary =
        "The earlier sleep record is retained separately from your condition report. This does not establish a current health assessment.";
    }
    action(
      "current-check",
      "Begin a current check",
      "Earlier sleep observations cannot establish your latest sleep period.",
      [
        "Keep the earlier record with its observation time.",
        "Record your latest main sleep when available. Current concerning sleepiness still needs medical review.",
      ],
      ["data", "design"],
    );
    return finish();
  }
  if (c.quality === "uncertain")
    r.uncertainties.push(
      "Your sleep estimates are uncertain. No numerical plan discrepancy is inferred from them.",
    );
  if (c.sleepHours == null)
    r.uncertainties.push(
      "Time asleep was not recorded. Satris cannot describe its amount or change.",
    );
  if (c.opportunityHours == null)
    r.uncertainties.push(
      "Sleep opportunity was not recorded. It cannot be compared with a supplied plan.",
    );
  if (c.feeling === "unknown")
    r.uncertainties.push(
      "Current sleepiness is not known. Recorded hours alone cannot establish how you are functioning now.",
    );
  if (c.disruptionStatus === "unknown")
    r.uncertainties.push(
      "It is not known whether sleep was disturbed. No environmental explanation is inferred.",
    );
  if (!num(p.planHours))
    r.uncertainties.push(
      "No sleep opportunity plan was supplied. Satris has not inserted a universal target.",
    );
  const usable = c.quality !== "uncertain";
  if (usable && num(c.sleepHours) && num(c.opportunityHours))
    addFinding(
      "sleep-record",
      "Two different observations",
      `You estimate ${c.sleepHours} hours asleep within ${c.opportunityHours} hours available. The difference is not a diagnosis or proof of a cause.`,
      ["hrp", "operations", "study"],
    );
  if (
    usable &&
    num(c.opportunityHours) &&
    num(p.planHours) &&
    c.opportunityHours < p.planHours
  ) {
    const gap = amount(p.planHours - c.opportunityHours);
    r.metrics.gapHours = gap;
    addFinding(
      "opportunity-gap",
      "Opportunity differs from your supplied plan",
      `${c.opportunityHours} hours were available, ${gap} hours less than the ${p.planHours} hours in your entered plan. Plan source: ${p.planSource}.`,
      ["operations", "design"],
      "Comparison with a supplied, unverified plan; arithmetic is an engineering choice",
    );
    action(
      "schedule-review",
      "Review the sleep window",
      "The available opportunity did not match the plan supplied for this check.",
      [
        "Record which activity limited the window.",
        "Ask the appropriate mission lead or medical support to review the conflict.",
        "Only adjust activities under the applicable mission procedure. Satris does not move protected tasks.",
      ],
      ["operations", "fatigue", "design"],
      true,
      true,
    );
  }
  const ds = c.disruptionStatus === "reported" ? c.disruptions : [];
  for (const [kind, label, capability] of [
    ["light", "light", "eyeMask"],
    ["noise", "noise", "earplugs"],
  ]) {
    if (!ds.includes(kind)) continue;
    addFinding(
      `reported-${kind}`,
      `You reported ${label} disruption`,
      `This is a reported experience, not a sensor measurement or proof that ${label} caused the sleep result.`,
      ["accommodation"],
    );
    const allowed = p[capability] === "allowed";
    action(
      `${kind}-accommodation`,
      kind === "light"
        ? "Review the light accommodation"
        : "Review the noise accommodation",
      `NASA identifies ${label} as a relevant sleep factor.`,
      allowed
        ? [
            kind === "light"
              ? "Use the available, mission-permitted eye mask or light blocker according to its instructions."
              : "Use the available, mission-permitted hearing protection according to its instructions.",
            "Keep required alarms and communication perceptible. Do not alter essential vehicle systems.",
            "At the next review, record whether it was used and what you noticed.",
          ]
        : [
            "An available and permitted accommodation has not been confirmed.",
            "Check the resource and permission with the appropriate crew lead. Do not assume a missing item is available.",
          ],
      ["accommodation", "design"],
      allowed,
      !allowed,
    );
    if (!allowed)
      action(
        `check-${kind}-resource`,
        `Check ${kind} accommodation availability`,
        "The reported disturbance can be documented, but an unconfirmed accommodation cannot be treated as ready to use.",
        [
          "Confirm which equipment is available and permitted.",
          "If none is suitable, include the constraint in the crew review.",
        ],
        ["accommodation", "design"],
        true,
        true,
      );
  }
  if (ds.some((x) => ["temperature", "workload", "other"].includes(x))) {
    addFinding(
      "other-disruption",
      "Other disruption recorded",
      "Your report is useful context, but it does not identify a medical cause or authorize changing mission systems.",
      ["accommodation", "operations"],
    );
    action(
      "disruption-review",
      "Review the reported disturbance",
      "The appropriate response depends on mission arrangements and the nature of the disturbance.",
      [
        "Describe what you noticed for the designated crew lead or medical support.",
        "Follow the applicable accommodation or scheduling procedure. Do not change ventilation, alarms or protected tasks through this tool.",
      ],
      ["accommodation", "operations"],
      true,
      true,
    );
  }
  if (!review && c.feeling === "unknown") {
    r.priority = "clarify";
    r.headline = "Add how you feel now";
    r.summary = "Hours alone cannot answer the assessment question.";
    action(
      "current-function",
      "Clarify current sleepiness",
      "Present function changes the appropriate next step.",
      [
        "Choose the description that best fits your current experience.",
        "If you are unable to judge safely, get help from a crewmate.",
      ],
      ["sleepiness", "design"],
    );
    r.actions.sort(
      (a, b) =>
        (a.id === "current-function" ? -1 : 0) -
        (b.id === "current-function" ? -1 : 0),
    );
  } else if (!review && r.actions.length) {
    const gap = r.findings.some((f) => f.id === "opportunity-gap");
    r.headline = gap
      ? "Review your sleep opportunity"
      : ds.includes("light")
        ? "Address the reported light disturbance"
        : ds.includes("noise")
          ? "Address the reported noise disturbance"
          : "Review the reported disturbance";
    r.summary =
      "These are observations and action options. They do not establish what caused your sleep difficulty.";
  } else if (
    !review &&
    (c.sleepHours == null || c.opportunityHours == null || !usable)
  ) {
    r.priority = "clarify";
    r.headline = "Keep the uncertainty visible";
    r.summary =
      "Some information is missing or uncertain. No normal result is inferred.";
  }
  if (
    !review &&
    (c.sleepHours == null || c.opportunityHours == null || !usable)
  ) {
    const missing = [
      c.sleepHours == null ? "estimated sleep" : null,
      c.opportunityHours == null ? "available sleep opportunity" : null,
      !usable ? "confidence in the estimates" : null,
    ]
      .filter(Boolean)
      .join(", ");
    action(
      "clarify-sleep",
      "Clarify the sleep record if you can",
      `The unresolved information is ${missing}.`,
      [
        "Confirm these details for the same main sleep period if you know them.",
        "Otherwise keep the unknown or uncertain status. Do not guess to complete the check.",
      ],
      ["data", "design"],
    );
    if (r.priority === "clarify" && c.feeling !== "unknown")
      r.actions.sort(
        (a, b) =>
          (a.id === "clarify-sleep" ? -1 : 0) -
          (b.id === "clarify-sleep" ? -1 : 0),
      );
  }
  if (!r.actions.length)
    action(
      "next-check",
      "Keep a sleep diary for the next review",
      "A dated record can help identify questions for a later assessment. It does not diagnose a condition.",
      [
        "Record the next main sleep period and how you feel afterward.",
        "Use the supplied mission schedule, or choose a reminder time as a personal preference.",
        "Seek medical review if sleepiness affects your activities or unintended daytime sleep occurs often.",
      ],
      ["sleepiness", "design"],
    );
  if (r.uncertainties.length) r.sourceIds.push("data");
  return finish();
}
export function buildExport(c, p) {
  const assessmentProfile = c.profileSnapshot || p;
  const assessment =
    c.profileSnapshot && c.assessment
      ? c.assessment
      : assess(c, assessmentProfile);
  const observations = [
    ["sleep_duration", c.sleepHours, "h", "sleepHours"],
    ["sleep_opportunity", c.opportunityHours, "h", "opportunityHours"],
    [
      feelingIsCurrent(c) ? "current_sleepiness" : "recorded_sleepiness",
      c.feeling,
      null,
      "feeling",
    ],
  ].map(([indicator, value, unit, key]) => ({
    indicator,
    value: value ?? null,
    unit,
    status:
      value == null
        ? "unknown"
        : key === "feeling" && value === "unknown"
          ? "unknown"
          : c.quality === "uncertain" && key !== "feeling"
            ? "uncertain"
            : "reported",
    observedAt:
      key === "feeling"
        ? c.feelingObservedAt ||
          (c.feelingScope === "current" ? null : c.observedAt)
        : c.observedAt,
    enteredAt: c.enteredAt,
    method:
      key === "feeling"
        ? "Plain-language self-report, not a validated numerical scale"
        : "Estimate for the last main sleep period",
    inputRoute: "keyboard or selection",
    origin:
      c.inputOrigins?.[key] ||
      (c.mode === "example" ? "example" : "user-entry"),
  }));
  for (const item of observations) {
    if (
      item.observedAt &&
      (!Number.isFinite(Date.parse(item.observedAt)) ||
        Date.parse(item.observedAt) > Date.now())
    )
      item.status = "invalid";
  }
  if (["yes", "unsure"].includes(c.urgent))
    observations.push({
      indicator: "urgent_concern",
      value: c.urgent,
      unit: null,
      status: "reported",
      observedAt: c.urgentReportedAt || null,
      enteredAt: c.urgentReportedAt || null,
      method: "Current concern reported through the urgent-help control",
      inputRoute: "selection",
      origin: c.inputOrigins?.urgent || "user-entry",
    });
  if (c.caffeineMg != null)
    observations.push({
      indicator: "latest_reported_caffeine",
      value: c.caffeineMg,
      unit: "mg",
      status: "reported",
      observedAt: null,
      reportedClockTime: c.caffeineTime || null,
      enteredAt: c.enteredAt,
      method: "User report of latest intake, not a daily total",
      origin: c.inputOrigins?.caffeineMg || "user-entry",
    });
  if (c.reactionMs != null)
    observations.push({
      indicator: "external_reaction_test_result",
      value: c.reactionMs,
      unit: "ms",
      metric: c.reactionMetric || null,
      status: "reported",
      observedAt: c.reactionObservedAt || null,
      enteredAt: c.enteredAt,
      method: c.reactionMethod || null,
      device: c.reactionDevice || null,
      protocol: c.reactionProtocol || null,
      origin: c.inputOrigins?.reactionMs || "user-entry",
    });
  return {
    app: "Satris",
    version: VERSION,
    contentVersion: CONTENT_VERSION,
    exportedAt: iso(),
    fictional: c.mode === "example",
    contextProvenance:
      c.mode === "example"
        ? "Fictional mission context"
        : "User supplied mission context, not independently verified",
    observationProvenance:
      c.mode === "example"
        ? "Supplied example values and any user changes are identified in check.inputOrigins. User entries are unverified; scenario records are not NASA participant data."
        : "User reported, not independently verified",
    observations,
    check: structuredClone(c),
    profile: structuredClone(assessmentProfile),
    assessment,
    sources: Object.values(SOURCES),
    transmission: "Prepared locally. Nothing has been transmitted.",
    limitations:
      "Decision support; no diagnosis, treatment prescription, fitness clearance or clinical validation.",
  };
}
