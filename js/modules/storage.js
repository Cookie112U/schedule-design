window.ScheduleStorage = (() => {
const STORAGE_KEY = "nttek-schedule-ui-v2";

function readSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSavedState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

return {
  readSavedState,
  writeSavedState
};
})();
