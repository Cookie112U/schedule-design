window.ScheduleErrorCatalog = (() => {
  const LOG_KEY = "nttek-schedule-diagnostics";
  const MAX_LOG_ITEMS = 60;

  const catalog = {
    NETWORK_OFFLINE: {
      code: "NTT-NET-001",
      message: "Нет подключения к сервису расписания"
    },
    NETWORK_BLOCKED: {
      code: "NTT-NET-002",
      message: "Не удалось получить данные расписания"
    },
    API_RATE_LIMIT: {
      code: "NTT-API-429",
      message: "Слишком много запросов. Попробуйте чуть позже"
    },
    API_NOT_FOUND: {
      code: "NTT-API-404",
      message: "Запрошенные данные не найдены"
    },
    API_FORBIDDEN: {
      code: "NTT-API-403",
      message: "Доступ к данным расписания ограничен"
    },
    API_SERVER: {
      code: "NTT-API-500",
      message: "Сервис расписания временно недоступен"
    },
    CATALOG_EMPTY: {
      code: "NTT-CAT-001",
      message: "Списки групп и преподавателей временно недоступны"
    },
    CATALOG_PARTIAL: {
      code: "NTT-CAT-002",
      message: "Часть данных расписания временно недоступна"
    },
    TIME_TEMPLATE_FAILED: {
      code: "NTT-TIME-001",
      message: "Не удалось уточнить время занятий"
    },
    CLASSROOMS_FAILED: {
      code: "NTT-ROOM-001",
      message: "Не удалось загрузить занятость аудиторий"
    },
    SCHEDULE_FAILED: {
      code: "NTT-SCH-001",
      message: "Не удалось загрузить расписание"
    },
    DOWNLOAD_MISSING: {
      code: "NTT-FILE-001",
      message: "Файл расписания для выбранной даты не найден"
    },
    UNKNOWN: {
      code: "NTT-APP-001",
      message: "Произошла ошибка"
    }
  };

  function storage() {
    try {
      return window.sessionStorage || window.localStorage;
    } catch {
      return null;
    }
  }

  function isOffline(error) {
    if (error?.reason === "offline") return true;
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }

  function classify(error = {}, context = {}) {
    if (context.key && catalog[context.key]) return context.key;
    if (error?.publicKey && catalog[error.publicKey]) return error.publicKey;
    if (error?.code && catalog[error.code]) return error.code;

    if (error?.code === "NETWORK_ERROR") {
      return isOffline(error) ? "NETWORK_OFFLINE" : "NETWORK_BLOCKED";
    }

    const status = Number(error?.status || 0);
    if (status === 429) return "API_RATE_LIMIT";
    if (status === 404) return "API_NOT_FOUND";
    if (status === 401 || status === 403) return "API_FORBIDDEN";
    if (status >= 500) return "API_SERVER";

    return "UNKNOWN";
  }

  function errorDetails(error = {}) {
    return {
      name: error?.name || "",
      code: error?.code || "",
      status: error?.status || "",
      statusText: error?.statusText || "",
      reason: error?.reason || "",
      url: error?.url || "",
      message: error?.message || "",
      cause: error?.cause?.message || ""
    };
  }

  function readLog(store) {
    if (!store) return [];
    try {
      const raw = store.getItem(LOG_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLog(store, items) {
    if (!store) return;
    try {
      store.setItem(LOG_KEY, JSON.stringify(items.slice(-MAX_LOG_ITEMS)));
    } catch {
      /* ignore storage restrictions */
    }
  }

  function record(error, info, context = {}) {
    const store = storage();
    const item = {
      id: `${info.code}-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      key: info.key,
      code: info.code,
      context,
      error: errorDetails(error)
    };
    const log = readLog(store);
    log.push(item);
    writeLog(store, log);
    return item;
  }

  function normalize(error, fallback = "", context = {}) {
    const key = classify(error, context);
    const entry = catalog[key] || catalog.UNKNOWN;
    const message = entry.message || fallback || catalog.UNKNOWN.message;
    const info = {
      key,
      code: entry.code,
      message,
      display: `${message}. Код: ${entry.code}`
    };
    record(error, info, context);
    return info;
  }

  function userMessage(error, fallback = "", context = {}) {
    return normalize(error, fallback, context).display;
  }

  function getDiagnostics() {
    return readLog(storage());
  }

  function clearDiagnostics() {
    writeLog(storage(), []);
  }

  return {
    clearDiagnostics,
    getDiagnostics,
    normalize,
    userMessage
  };
})();
