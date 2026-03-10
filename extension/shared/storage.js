/**
 * Feed Blocker - Shared storage constants and blocking state logic
 * Loaded by content scripts (via manifest js array), popup (via script tag), and service worker (via importScripts)
 */

const STORAGE_KEYS = {
  MODE: "mode",
  SCHEDULE: "schedule",
  BLOCK_END_SCREEN: "blockEndScreen",
  TODOS: "todos",
};

const DEFAULTS = {
  mode: "always",
  schedule: {
    weekday: { start: "08:00", end: "17:00" },
    weekend: { start: "08:00", end: "17:00" },
    weekendEnabled: false,
  },
  blockEndScreen: false,
  todos: [],
};

const SNOOZE_KEY = "snooze";
const SNOOZE_DEFAULTS = { active: false, until: null };

/**
 * Determines if blocking should be active based on settings and snooze state.
 * @param {Object} settings - From chrome.storage.sync (mode, schedule)
 * @param {Object} snooze - From chrome.storage.local (active, until)
 * @returns {{ blocking: boolean, reason?: string }} blocking state and optional reason for UI
 */
function resolveBlockingState(settings, snooze) {
  const mode = settings?.mode ?? DEFAULTS.mode;
  const schedule = settings?.schedule ?? DEFAULTS.schedule;
  const snoozeState = snooze ?? SNOOZE_DEFAULTS;

  if (mode === "off") {
    return { blocking: false, reason: "off" };
  }

  if (snoozeState.active && snoozeState.until && snoozeState.until > Date.now()) {
    return { blocking: false, reason: "snoozed", snoozeUntil: snoozeState.until };
  }

  if (mode === "always") {
    return { blocking: true, reason: "always" };
  }

  if (mode === "schedule") {
    const now = new Date();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend && !schedule.weekendEnabled) {
      return { blocking: false, reason: "schedule" };
    }

    const slot = isWeekend ? schedule.weekend : schedule.weekday;

    if (!slot || !slot.start || !slot.end) {
      return { blocking: false, reason: "schedule" };
    }

    const startParts = slot.start.split(":").map(Number);
    const endParts = slot.end.split(":").map(Number);
    if (startParts.length < 2 || endParts.length < 2 || isNaN(startParts[0]) || isNaN(endParts[0])) {
      return { blocking: false, reason: "schedule" };
    }
    const [startH, startM] = startParts;
    const [endH, endM] = endParts;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let inRange;
    if (startMinutes <= endMinutes) {
      inRange = nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
      inRange = nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }

    return {
      blocking: inRange,
      reason: "schedule",
    };
  }

  return { blocking: false, reason: "off" };
}
