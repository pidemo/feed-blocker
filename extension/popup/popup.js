/**
 * Feed Blocker - Popup UI
 */

(function () {
  const statusBadge = document.getElementById("status-badge");
  const modeBtns = document.querySelectorAll(".mode-btn");
  const scheduleSection = document.getElementById("schedule-section");
  const weekdayStart = document.getElementById("weekday-start");
  const weekdayEnd = document.getElementById("weekday-end");
  const weekendStart = document.getElementById("weekend-start");
  const weekendEnd = document.getElementById("weekend-end");
  const weekendEnabled = document.getElementById("weekend-enabled");
  const weekendTimes = document.getElementById("weekend-times");
  const blockEndScreen = document.getElementById("block-end-screen");
  const snoozeButtons = document.getElementById("snooze-buttons");
  const snoozeActive = document.getElementById("snooze-active");
  const snoozeRemaining = document.getElementById("snooze-remaining");
  const cancelSnooze = document.getElementById("cancel-snooze");

  function localizePopup() {
    document.documentElement.lang = chrome.i18n.getUILanguage();
    document.title = t("extName");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    const madeByEl = document.querySelector('[data-i18n="madeBy"]');
    if (madeByEl) {
      madeByEl.innerHTML = madeByEl.textContent.replace("♥︎", '<span class="heart">♥︎</span>');
    }
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });
  }

  function buildTimeOptions() {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hs = String(h).padStart(2, "0");
        const ms = String(m).padStart(2, "0");
        const value = `${hs}:${ms}`;
        const label = `${h}:${ms}`;
        options.push({ value, label });
      }
    }
    return options;
  }

  function initTimeSelects() {
    const opts = buildTimeOptions();
    [weekdayStart, weekdayEnd, weekendStart, weekendEnd].forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
    });
  }

  function roundTimeToNearest15(timeStr) {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return "08:00";
    const [h, m] = timeStr.split(":").map(Number);
    const roundedM = Math.round(m / 15) * 15;
    const adjM = roundedM >= 60 ? 0 : roundedM;
    const adjH = roundedM >= 60 ? (h + 1) % 24 : h;
    return `${String(adjH).padStart(2, "0")}:${String(adjM).padStart(2, "0")}`;
  }

  function updateWeekendTimesVisibility() {
    weekendTimes.classList.toggle("collapsed", !weekendEnabled.checked);
  }

  function loadSettings() {
    chrome.storage.sync.get(
      [STORAGE_KEYS.MODE, STORAGE_KEYS.SCHEDULE, STORAGE_KEYS.BLOCK_END_SCREEN],
      (data) => {
        const mode = data[STORAGE_KEYS.MODE] ?? DEFAULTS.mode;
        const schedule = data[STORAGE_KEYS.SCHEDULE] ?? DEFAULTS.schedule;

        modeBtns.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.mode === mode);
        });

        scheduleSection.classList.toggle("hidden", mode !== "schedule");

        weekdayStart.value = roundTimeToNearest15(schedule.weekday?.start ?? "08:00");
        weekdayEnd.value = roundTimeToNearest15(schedule.weekday?.end ?? "17:00");
        weekendStart.value = roundTimeToNearest15(schedule.weekend?.start ?? "08:00");
        weekendEnd.value = roundTimeToNearest15(schedule.weekend?.end ?? "17:00");
        weekendEnabled.checked = schedule.weekendEnabled ?? false;
        updateWeekendTimesVisibility();

        blockEndScreen.checked = data[STORAGE_KEYS.BLOCK_END_SCREEN] ?? DEFAULTS.blockEndScreen;
      }
    );
  }

  function loadSnoozeAndUpdateStatus() {
    chrome.storage.local.get(SNOOZE_KEY, (data) => {
      const snooze = data[SNOOZE_KEY] ?? SNOOZE_DEFAULTS;
      chrome.storage.sync.get(
        [STORAGE_KEYS.MODE, STORAGE_KEYS.SCHEDULE],
        (syncData) => {
          const settings = {
            mode: syncData[STORAGE_KEYS.MODE] ?? DEFAULTS.mode,
            schedule: syncData[STORAGE_KEYS.SCHEDULE] ?? DEFAULTS.schedule,
          };
          const state = resolveBlockingState(settings, snooze);

          const isSnoozed = snooze.active && snooze.until && snooze.until > Date.now();
          snoozeButtons.classList.toggle("hidden", isSnoozed);
          snoozeActive.classList.toggle("hidden", !isSnoozed);

          if (isSnoozed) {
            const remaining = Math.ceil((snooze.until - Date.now()) / 60000);
            snoozeRemaining.textContent =
              remaining >= 60
                ? t("snoozedForHM", [String(Math.floor(remaining / 60)), String(remaining % 60)])
                : t("snoozedForM", [String(remaining)]);
          }

          if (state.reason === "snoozed" && state.snoozeUntil) {
            const timeStr = new Date(state.snoozeUntil).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            statusBadge.textContent = t("snoozedUntil", [timeStr]);
            statusBadge.className = "status-badge snoozed";
          } else if (state.blocking) {
            statusBadge.textContent = t("statusBlocking");
            statusBadge.className = "status-badge blocking";
          } else {
            statusBadge.textContent = t("statusOff");
            statusBadge.className = "status-badge off";
          }
        }
      );
    });
  }

  function saveMode(mode) {
    chrome.storage.sync.set({ [STORAGE_KEYS.MODE]: mode });
  }

  function saveSchedule() {
    chrome.storage.sync.get(STORAGE_KEYS.SCHEDULE, (data) => {
      const schedule = data[STORAGE_KEYS.SCHEDULE] ?? DEFAULTS.schedule;
      schedule.weekday = {
        start: weekdayStart.value,
        end: weekdayEnd.value,
      };
      schedule.weekend = {
        start: weekendStart.value,
        end: weekendEnd.value,
      };
      schedule.weekendEnabled = weekendEnabled.checked;
      chrome.storage.sync.set({ [STORAGE_KEYS.SCHEDULE]: schedule });
    });
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
      scheduleSection.classList.toggle("hidden", mode !== "schedule");
      saveMode(mode);
      loadSnoozeAndUpdateStatus();
    });
  });

  localizePopup();
  initTimeSelects();

  [weekdayStart, weekdayEnd, weekendStart, weekendEnd, weekendEnabled].forEach((el) => {
    el.addEventListener("change", saveSchedule);
  });

  weekendEnabled.addEventListener("change", updateWeekendTimesVisibility);

  blockEndScreen.addEventListener("change", () => {
    chrome.storage.sync.set({ [STORAGE_KEYS.BLOCK_END_SCREEN]: blockEndScreen.checked });
  });

  snoozeButtons?.querySelectorAll(".snooze-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const minutes = parseInt(btn.dataset.minutes, 10);
      chrome.runtime.sendMessage(
        { action: "startSnooze", durationMinutes: minutes },
        () => loadSnoozeAndUpdateStatus()
      );
    });
  });

  cancelSnooze.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "cancelSnooze" }, () =>
      loadSnoozeAndUpdateStatus()
    );
  });

  loadSettings();
  loadSnoozeAndUpdateStatus();

  setInterval(loadSnoozeAndUpdateStatus, 5000);
})();
