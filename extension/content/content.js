/**
 * Feed Blocker - Content script for feed hiding and todo widget coordination
 */

(function () {
  let lastUrl = location.href;
  let scheduleCheckInterval = null;
  let watchLayoutRefreshTimeout = null;
  let lastWatchLayoutEnabled = false;
  let lastWatchFlexy = null;
  let lastWatchColumns = null;
  let lastWatchPrimary = null;
  let lastWatchSecondary = null;
  let lastBlockingState = false;
  let hideDebounceTimer = null;
  let observer = null;
  let storageListener = null;
  let rafId = null;
  let endScreenBlocked = false;

  function isExtensionContextValid() {
    return !!(chrome.runtime && chrome.runtime.id);
  }

  function teardown() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (storageListener) {
      try { chrome.storage.onChanged.removeListener(storageListener); } catch {}
      storageListener = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const html = document.documentElement;
    html.classList.remove("fb-blocking", "fb-end-block");

    document.querySelectorAll("[data-fb-hidden]").forEach((el) => {
      el.style.removeProperty("display");
      delete el.dataset.fbHidden;
    });
    document.querySelectorAll("[data-fb-end-hidden]").forEach((el) => {
      el.style.removeProperty("display");
      el.style.removeProperty("opacity");
      el.style.removeProperty("visibility");
      delete el.dataset.fbEndHidden;
    });

    applyWatchPageLayoutFix(false);

    if (typeof FBTodo !== "undefined") {
      FBTodo.remove();
    }

    if (scheduleCheckInterval) {
      clearInterval(scheduleCheckInterval);
      scheduleCheckInterval = null;
    }
    if (watchLayoutRefreshTimeout) {
      clearTimeout(watchLayoutRefreshTimeout);
      watchLayoutRefreshTimeout = null;
    }
    if (hideDebounceTimer) {
      clearTimeout(hideDebounceTimer);
      hideDebounceTimer = null;
    }

    lastBlockingState = false;
  }

  function isHomepage() {
    const path = window.location.pathname;
    return path === "/" || path === "/feed" || path === "/feed/";
  }

  const FEED_SELECTORS = [
    'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
    "ytd-watch-next-secondary-results-renderer",
    "#related",
    "ytd-watch-flexy #secondary",
  ];

  const END_SCREEN_SELECTORS = [
    ".ytp-ce-element",
    ".ytp-endscreen-content",
    ".html5-endscreen",
    ".ytp-videowall-still",
    ".ytp-suggestion-set",
    ".ytp-endscreen-previous",
    ".videowall-endscreen",
  ];

  function setImportantStyle(element, property, value) {
    if (!element) return;

    if (value === null) {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, value, "important");
  }

  function refreshWatchLayout() {
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("yt-window-resized"));
  }

  function scheduleWatchLayoutRefresh() {
    if (watchLayoutRefreshTimeout) {
      clearTimeout(watchLayoutRefreshTimeout);
    }

    refreshWatchLayout();
    requestAnimationFrame(refreshWatchLayout);
    watchLayoutRefreshTimeout = setTimeout(() => {
      refreshWatchLayout();
      watchLayoutRefreshTimeout = null;
    }, 150);
  }

  function applyWatchPageLayoutFix(enabled) {
    const html = document.documentElement;
    const body = document.body;
    const watchFlexy = document.querySelector("ytd-watch-flexy");
    const columns = document.querySelector("ytd-watch-flexy #columns");
    const primary = document.querySelector("ytd-watch-flexy #primary");
    const secondary = document.querySelector("ytd-watch-flexy #secondary");

    const layoutChanged =
      enabled !== lastWatchLayoutEnabled ||
      watchFlexy !== lastWatchFlexy ||
      columns !== lastWatchColumns ||
      primary !== lastWatchPrimary ||
      secondary !== lastWatchSecondary;

    if (!watchFlexy) {
      setImportantStyle(html, "overflow-x", null);
      setImportantStyle(body, "overflow-x", null);
      lastWatchLayoutEnabled = enabled;
      lastWatchFlexy = null;
      lastWatchColumns = null;
      lastWatchPrimary = null;
      lastWatchSecondary = null;
      return;
    }

    if (enabled) {
      setImportantStyle(html, "overflow-x", "hidden");
      setImportantStyle(body, "overflow-x", "hidden");
      setImportantStyle(watchFlexy, "--ytd-watch-flexy-sidebar-width", "0px");
      setImportantStyle(watchFlexy, "min-width", "0");

      setImportantStyle(columns, "min-width", "0");
      setImportantStyle(columns, "max-width", "100%");
      setImportantStyle(columns, "justify-content", "center");

      setImportantStyle(primary, "margin-left", "auto");
      setImportantStyle(primary, "margin-right", "auto");

      setImportantStyle(secondary, "display", "none");
      setImportantStyle(secondary, "width", "0");
      setImportantStyle(secondary, "min-width", "0");
      setImportantStyle(secondary, "max-width", "0");
      setImportantStyle(secondary, "flex", "0 0 0px");
      setImportantStyle(secondary, "margin", "0");
      setImportantStyle(secondary, "padding", "0");
    } else {
      setImportantStyle(html, "overflow-x", null);
      setImportantStyle(body, "overflow-x", null);
      setImportantStyle(watchFlexy, "--ytd-watch-flexy-sidebar-width", null);
      setImportantStyle(watchFlexy, "min-width", null);

      setImportantStyle(columns, "min-width", null);
      setImportantStyle(columns, "max-width", null);
      setImportantStyle(columns, "justify-content", null);

      setImportantStyle(primary, "margin-left", null);
      setImportantStyle(primary, "margin-right", null);

      setImportantStyle(secondary, "display", null);
      setImportantStyle(secondary, "width", null);
      setImportantStyle(secondary, "min-width", null);
      setImportantStyle(secondary, "max-width", null);
      setImportantStyle(secondary, "flex", null);
      setImportantStyle(secondary, "margin", null);
      setImportantStyle(secondary, "padding", null);
    }

    lastWatchLayoutEnabled = enabled;
    lastWatchFlexy = watchFlexy;
    lastWatchColumns = columns;
    lastWatchPrimary = primary;
    lastWatchSecondary = secondary;

    if (layoutChanged) {
      scheduleWatchLayoutRefresh();
    }
  }

  function hideEndScreenElements() {
    END_SCREEN_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.dataset.fbEndHidden = "true";
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("opacity", "0", "important");
        el.style.setProperty("visibility", "hidden", "important");
      });
    });
  }

  function showEndScreenElements() {
    END_SCREEN_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.dataset.fbEndHidden) {
          el.style.removeProperty("display");
          el.style.removeProperty("opacity");
          el.style.removeProperty("visibility");
          delete el.dataset.fbEndHidden;
        }
      });
    });
  }

  function applyBlockingState(state, blockEndScreen) {
    const html = document.documentElement;
    html.classList.toggle("fb-blocking", state.blocking);
    html.classList.toggle("fb-end-block", state.blocking && blockEndScreen);
    endScreenBlocked = state.blocking && blockEndScreen;

    FEED_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (state.blocking) {
          el.dataset.fbHidden = "true";
          el.style.setProperty("display", "none", "important");
        } else if (el.dataset.fbHidden) {
          el.style.removeProperty("display");
          delete el.dataset.fbHidden;
        }
      });
    });

    if (endScreenBlocked) {
      hideEndScreenElements();
    } else {
      showEndScreenElements();
    }

    applyWatchPageLayoutFix(state.blocking);
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
    if (!isExtensionContextValid()) {
      teardown();
      return;
    }
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
    }).catch(() => {
      teardown();
    });
  }

  function onUrlChange() {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      evaluateAndApply();
    }
  }

  function rehideFeedIfNeeded() {
    if (!lastBlockingState) return;
    FEED_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.dataset.fbHidden = "true";
        el.style.setProperty("display", "none", "important");
      });
    });
    applyWatchPageLayoutFix(true);
    if (endScreenBlocked) {
      hideEndScreenElements();
    }
  }

  function setupMutationObserver() {
    observer = new MutationObserver(() => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        onUrlChange();
        if (lastBlockingState) {
          clearTimeout(hideDebounceTimer);
          hideDebounceTimer = setTimeout(rehideFeedIfNeeded, 100);
        }
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function setupStorageListener() {
    try {
      storageListener = (changes, areaName) => {
        if (areaName === "sync" || areaName === "local") {
          evaluateAndApply();
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
    } catch {
      teardown();
    }
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
