window.ScheduleData = (() => {
const groupsByBuilding = {
  "1 корпус": ["ИС-21", "ДИ-12", "ХДЧЫ-24", "ТОП-11", "ПК-19"],
  "2 корпус": ["БУ-31", "ПИ-42", "ЮР-22", "ЭК-14", "МД-11"]
};

const groups = Object.values(groupsByBuilding).flat();

const teachers = [
  "Репьев Е. Д.",
  "Полякова Н. А.",
  "Савин И. Р.",
  "Кириллова М. С.",
  "Титов А. П.",
  "Орлова И. В."
];

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

const lessonPairs = {
  1: { label: "1 пара", lessons: "1-2 урок", time: "8:30-10:00" },
  2: { label: "2 пара", lessons: "3-4 урок", time: "10:10-11:40" },
  3: { label: "5 урок", lessons: "обед / окно", time: "12:10-12:55" },
  4: { label: "3 пара", lessons: "6-7 урок", time: "13:50-15:20" }
};

return {
  accentColors,
  groups,
  groupsByBuilding,
  lessonPairs,
  monthNames,
  months,
  orangeAccent,
  teachers,
  weekdays,
  weekdaysFull
};
})();
