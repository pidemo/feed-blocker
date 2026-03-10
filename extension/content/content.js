/**
 * Feed Blocker - Content script for feed hiding and todo widget coordination
 */

(function () {
  let lastUrl = location.href;
  let scheduleCheckInterval = null;

  function isHomepage() {
    const path = window.location.pathname;
    return path === "/" || path === "/feed" || path === "/feed/";
  }

  const FEED_SELECTORS = [
    "ytd-rich-grid-renderer",
    "ytd-watch-next-secondary-results-renderer",
    "#related",
    "ytd-watch-flexy #secondary",
  ];

  function applyBlockingState(state, blockEndScreen) {
    const html = document.documentElement;
    html.classList.toggle("fb-blocking", state.blocking);
    html.classList.toggle("fb-end-block", state.blocking && blockEndScreen);

    FEED_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (state.blocking) {
          el.style.setProperty("display", "none", "important");
        } else {
          el.style.removeProperty("display");
        }
      });
    });
  }

  function updateTodoWidget(blocking, onHomepage) {
    if (typeof FBTodo !== "undefined") {
      if (blocking && onHomepage) {
        FBTodo.inject();
      } else {
        FBTodo.remove();
      }
    }
  }

  function evaluateAndApply() {
    Promise.all([
      chrome.storage.sync.get([STORAGE_KEYS.MODE, STORAGE_KEYS.SCHEDULE, STORAGE_KEYS.BLOCK_END_SCREEN]),
      chrome.storage.local.get(SNOOZE_KEY),
    ]).then(([sync, local]) => {
      const settings = {
        mode: sync[STORAGE_KEYS.MODE] ?? DEFAULTS.mode,
        schedule: sync[STORAGE_KEYS.SCHEDULE] ?? DEFAULTS.schedule,
      };
      const blockEndScreen = sync[STORAGE_KEYS.BLOCK_END_SCREEN] ?? DEFAULTS.blockEndScreen;
      const snooze = local[SNOOZE_KEY] ?? SNOOZE_DEFAULTS;

      const state = resolveBlockingState(settings, snooze);
      lastBlockingState = state.blocking;
      applyBlockingState(state, blockEndScreen);
      updateTodoWidget(state.blocking, isHomepage());
    });
  }

  function onUrlChange() {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      evaluateAndApply();
    }
  }

  let lastBlockingState = false;
  let hideDebounceTimer = null;

  function rehideFeedIfNeeded() {
    if (!lastBlockingState) return;
    FEED_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
    });
  }

  function setupMutationObserver() {
    const observer = new MutationObserver(() => {
      onUrlChange();
      if (lastBlockingState) {
        clearTimeout(hideDebounceTimer);
        hideDebounceTimer = setTimeout(rehideFeedIfNeeded, 100);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync" || areaName === "local") {
        evaluateAndApply();
      }
    });
  }

  function setupScheduleCheck() {
    scheduleCheckInterval = setInterval(evaluateAndApply, 60 * 1000);
  }

  function init() {
    if (!document.body) {
      setTimeout(init, 10);
      return;
    }
    evaluateAndApply();
    setupMutationObserver();
    setupStorageListener();
    setupScheduleCheck();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
