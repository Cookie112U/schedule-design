window.ScheduleStorage = (() => {
const STORAGE_KEY = "nttek-schedule-ui-v2";
const ROOM_CACHE_KEY = `${STORAGE_KEY}:rooms`;
const SCHEDULE_META_KEY = `${STORAGE_KEY}:schedule-meta`;
const SCHEDULE_DATA_KEY = `${STORAGE_KEY}:schedule-data`;
const CATALOG_CACHE_KEY = `${STORAGE_KEY}:catalogs`;

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

function readScheduleMetaCache() {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULE_META_KEY)) || {};
  } catch {
    return {};
  }
}

function writeScheduleMetaCache(cache) {
  try {
    localStorage.setItem(SCHEDULE_META_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

function readScheduleDataCache() {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULE_DATA_KEY)) || {};
  } catch {
    return {};
  }
}

function writeScheduleDataCache(cache) {
  try {
    localStorage.setItem(SCHEDULE_DATA_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

function readCatalogCache() {
  try {
    return JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCatalogCache(cache) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

return {
  readSavedState,
  readRoomCache,
  readCatalogCache,
  readScheduleDataCache,
  readScheduleMetaCache,
  writeRoomCache,
  writeCatalogCache,
  writeScheduleDataCache,
  writeScheduleMetaCache,
  writeSavedState
};
})();
