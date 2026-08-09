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

const accentColors = ["#f4ff00", "#ff4d4d", "#3f8cff", "#33c27f", "#ff9f1c", "#b17cff", "#00c2c7", "#ff70b8"];
const orangeAccent = "#ff9f1c";

return {
  accentColors,
  monthNames,
  months,
  orangeAccent,
  weekdays,
  weekdaysFull
};
})();
