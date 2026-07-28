window.ScheduleHoliday = (() => {
function getOrthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13);
  return julian;
}

function inRange(date, fromMonth, fromDay, toMonth, toDay) {
  const year = date.getFullYear();
  const start = new Date(year, fromMonth, fromDay);
  const end = new Date(year, toMonth, toDay);
  if (start <= end) return date >= start && date <= end;
  return date >= start || date <= end;
}

function autoHoliday(today) {
  if (inRange(today, 11, 22, 0, 16)) return "new-year";
  if (inRange(today, 1, 21, 1, 24)) return "february-23";
  if (inRange(today, 2, 6, 2, 9)) return "march-8";
  if (inRange(today, 5, 10, 5, 13)) return "russia-day";
  if (inRange(today, 7, 6, 7, 10)) return "tagil-day";
  if (inRange(today, 8, 1, 8, 5)) return "september";

  const easter = getOrthodoxEaster(today.getFullYear());
  const easterStart = new Date(easter);
  const easterEnd = new Date(easter);
  easterStart.setDate(easter.getDate() - 2);
  easterEnd.setDate(easter.getDate() + 3);
  if (today >= easterStart && today <= easterEnd) return "easter";
  return "none";
}

function activeHoliday(mode, today) {
  return mode === "auto" ? autoHoliday(today) : mode;
}

return {
  activeHoliday,
  autoHoliday
};
})();
