import { createProfile } from "./sleep.js";
import { defaultSchedule } from "./routine.js";

const KEY = "satris-routine-v2";
export function freshWorkspace() {
  return {
    schemaVersion: 2,
    mode: "personal",
    view: "today",
    step: 0,
    tourSeen: false,
    workspaces: Object.fromEntries(
      ["personal", "example"].map((mode) => [
        mode,
        {
          profile: createProfile(),
          checks: [],
          draft: null,
          schedule: defaultSchedule(),
          journeyEnabled: false,
        },
      ]),
    ),
  };
}
export function loadWorkspace() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { state: freshWorkspace(), error: null };
    const state = JSON.parse(raw);
    if (
      state.schemaVersion !== 2 ||
      !["personal", "example"].includes(state.mode) ||
      !state.workspaces ||
      !["personal", "example"].every(
        (mode) =>
          Array.isArray(state.workspaces[mode]?.checks) &&
          state.workspaces[mode]?.profile,
      )
    )
      throw new Error(
        "The saved record format could not be opened. It has not been overwritten.",
      );
    for (const mode of ["personal", "example"]) {
      state.workspaces[mode].schedule = {
        ...defaultSchedule(),
        ...state.workspaces[mode].schedule,
      };
      state.workspaces[mode].journeyEnabled =
        state.workspaces[mode].journeyEnabled === true;
    }
    return { state, error: null };
  } catch (error) {
    return {
      state: freshWorkspace(),
      error: error.message || "Browser storage could not be opened.",
    };
  }
}
export function saveWorkspace(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Your browser could not save this record.",
    };
  }
}
