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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function readRoomCache() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeRoomCache(cache) {
  try {
    localStorage.setItem(ROOM_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

return {
  readSavedState,
  readRoomCache,
  writeRoomCache,
  writeSavedState
};
})();
