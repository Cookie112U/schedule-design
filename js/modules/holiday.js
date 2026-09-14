window.ScheduleHoliday = (() => {
function inRange(date, fromMonth, fromDay, toMonth, toDay) {
  const year = date.getFullYear();
  const start = new Date(year, fromMonth, fromDay);
  const end = new Date(year, toMonth, toDay);
  if (start <= end) return date >= start && date <= end;
  return date >= start || date <= end;
}

function inAbsoluteRange(date, fromYear, fromMonth, fromDay, toYear, toMonth, toDay) {
  const start = new Date(fromYear, fromMonth, fromDay);
  const end = new Date(toYear, toMonth, toDay);
  return date >= start && date <= end;
}

function autoHoliday(today) {
  if (inRange(today, 11, 22, 0, 10)) return "new-year";
  if (inRange(today, 1, 21, 1, 24)) return "february-23";
  if (inRange(today, 2, 6, 2, 7)) return "march-8";
  if (inRange(today, 4, 7, 4, 9)) return "victory-day";
  if (inRange(today, 5, 10, 5, 13)) return "russia-day";
  if (inRange(today, 8, 1, 8, 5)) return "september";
  if (inAbsoluteRange(today, 2027, 3, 30, 2027, 4, 3)) return "easter";
  return "none";
}

function activeHoliday(mode, today) {
  const supportedModes = new Set([
    "auto",
    "none",
    "new-year",
    "russia-day",
    "easter",
    "september",
    "march-8",
    "february-23",
    "victory-day"
  ]);
  const safeMode = supportedModes.has(mode) ? mode : "auto";
  return safeMode === "auto" ? autoHoliday(today) : safeMode;
}

return {
  activeHoliday,
  autoHoliday
};
})();
