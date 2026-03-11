/**
 * Feed Blocker - Background service worker
 */

importScripts("../shared/storage.js");

const SNOOZE_ALARM_NAME = "snooze-end";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([STORAGE_KEYS.MODE, STORAGE_KEYS.SCHEDULE, STORAGE_KEYS.BLOCK_END_SCREEN, STORAGE_KEYS.TODOS], (data) => {
    if (chrome.runtime.lastError) return;
    const toSet = {};
    if (data[STORAGE_KEYS.MODE] === undefined) toSet[STORAGE_KEYS.MODE] = DEFAULTS.mode;
    if (data[STORAGE_KEYS.SCHEDULE] === undefined) toSet[STORAGE_KEYS.SCHEDULE] = DEFAULTS.schedule;
    if (data[STORAGE_KEYS.BLOCK_END_SCREEN] === undefined) toSet[STORAGE_KEYS.BLOCK_END_SCREEN] = DEFAULTS.blockEndScreen;
    if (data[STORAGE_KEYS.TODOS] === undefined) toSet[STORAGE_KEYS.TODOS] = DEFAULTS.todos;
    if (Object.keys(toSet).length > 0) {
      chrome.storage.sync.set(toSet);
    }
  });

  chrome.storage.local.get(SNOOZE_KEY, (data) => {
    if (chrome.runtime.lastError) return;
    if (data[SNOOZE_KEY] === undefined) {
      chrome.storage.local.set({ [SNOOZE_KEY]: SNOOZE_DEFAULTS });
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "startSnooze") {
    const durationMinutes = message.durationMinutes;
    if (!durationMinutes || typeof durationMinutes !== "number" || durationMinutes < 1 || durationMinutes > 480) {
      sendResponse({ ok: false });
      return true;
    }
    const until = Date.now() + durationMinutes * 60 * 1000;
    chrome.storage.local.set({ [SNOOZE_KEY]: { active: true, until } }, () => {
      if (chrome.runtime.lastError) { sendResponse({ ok: false }); return; }
      chrome.alarms.create(SNOOZE_ALARM_NAME, { delayInMinutes: durationMinutes });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.action === "cancelSnooze") {
    chrome.alarms.clear(SNOOZE_ALARM_NAME);
    chrome.storage.local.set({ [SNOOZE_KEY]: SNOOZE_DEFAULTS }, () => {
      void chrome.runtime.lastError;
      sendResponse({ ok: true });
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SNOOZE_ALARM_NAME) {
    chrome.storage.local.set({ [SNOOZE_KEY]: SNOOZE_DEFAULTS });
  }
});
