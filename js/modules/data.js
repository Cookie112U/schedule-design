window.ScheduleData = (() => {
const weekdays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const weekdaysFull = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

const months = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const monthNames = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

const accentColors = ["#2451b8", "#ff4d4d", "#3f8cff", "#33c27f", "#ff9f1c", "#b17cff", "#00c2c7", "#ff70b8"];
const orangeAccent = "#ff9f1c";

function normalizeRoomLabel(value) {
  const room = String(value || "").trim();
  if (!room) return "";

  const withoutCabinet = room.replace(/^каб(?:инет)?\.?\s*/i, "").trim();
  const comparable = withoutCabinet
    .toLocaleLowerCase("ru-RU")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ");
  const isNonCabinetPlace = /^(?:с-з|а-з|ч-з)(?:$|[-\s])/.test(comparable)
    || /^(?:дистант|улица|музей)(?:$|\s)/.test(comparable);

  if (isNonCabinetPlace) return withoutCabinet;
  return /^каб/i.test(room) ? room : `каб. ${room}`;
}

return {
  accentColors,
  monthNames,
  months,
  normalizeRoomLabel,
  orangeAccent,
  weekdays,
  weekdaysFull
};
})();
