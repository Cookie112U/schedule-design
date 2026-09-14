window.ScheduleStorage = (() => {
const STORAGE_KEY = "nttek-schedule-ui-v2";
const ROOM_CACHE_KEY = `${STORAGE_KEY}:rooms`;

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

function readRoomCache() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeRoomCache(cache) {
  localStorage.setItem(ROOM_CACHE_KEY, JSON.stringify(cache));
}

return {
  readSavedState,
  readRoomCache,
  writeRoomCache,
  writeSavedState
};
})();
