# Расписание НТТЭК

Фронтенд расписания для студентов и преподавателей. Проект сделан на обычных `HTML`, `CSS` и `JavaScript`, без сборщика.

## Что умеет сервис

- Показывает календарь с датами расписания.
- Позволяет выбрать группу или преподавателя.
- Загружает расписание из legacy API `https://erp.nttek.ru/api/schedule/legacy`.
- Показывает расписание внизу страницы или в модальном окне.
- Поддерживает занятость аудиторий по корпусам и парам.
- Сохраняет пользовательские настройки: тему, цвет, размер, формат вывода, избранное и последний выбор.
- Поддерживает праздничные оформления.
- Показывает короткие пользовательские ошибки и скрывает технические детали за кодами.

## Структура

- `index.html` - разметка страницы и подключение модулей.
- `css/base/` - базовые стили интерфейса, адаптив и модальные окна.
- `css/holidays/` - праздничные оформления.
- `js/app.js` - основная логика интерфейса.
- `js/modules/api-client.js` - общий клиент запросов.
- `js/modules/public-api.js` - методы публичного и legacy API.
- `js/modules/schedule-request.js` - слой получения данных.
- `js/modules/schedule-service.js` - кеширование и сервисная логика.
- `js/modules/schedule-transform.js` - преобразование данных API в формат интерфейса.
- `js/modules/schedule-time-store.js` - временное хранилище звонков и исключений по датам.
- `js/modules/error-catalog.js` - справочник пользовательских кодов ошибок.
- `docs/error-codes.md` - расшифровка кодов ошибок для администратора.
- `tests/static-checks.js` - статические проверки проекта.
- `tests/responsive-audit.html` - браузерный стенд для визуальной проверки адаптива.

## Запуск

Можно открыть `index.html` через любой статический сервер.

Пример:

```bash
node dev-server.js
```

После этого открыть локальный адрес, который выведет сервер.

## API

По умолчанию используется legacy API:

```text
https://erp.nttek.ru/api/schedule/legacy
https://erp.nttek.ru/api/schedule/legacy/YYYY-MM-DD
https://erp.nttek.ru/api/schedule/legacy/YYYY-MM-DD/group/ГРУППА
https://erp.nttek.ru/api/schedule/legacy/YYYY-MM-DD/teacher/ПРЕПОДАВАТЕЛЬ
https://erp.nttek.ru/api/schedule/legacy/YYYY-MM-DD/all
```

Настройки находятся в `js/modules/config.js`.

## Ошибки

Простые пользовательские ошибки выводятся без кодов, например:

- `Сначала выберите группу`
- `Сначала выберите преподавателя`
- `На данную дату нет расписания`

Технические ошибки выводятся с кодом:

```text
Нет подключения к сервису расписания. Код: NTT-NET-001
```

Подробности сохраняются скрыто в браузере:

```js
window.ScheduleErrorCatalog.getDiagnostics()
window.ScheduleErrorCatalog.clearDiagnostics()
```

Расшифровка кодов лежит в `docs/error-codes.md`.

## Временные исключения времени занятий

Если на конкретную дату время занятий отличается, можно добавить точечный override:

```js
window.ScheduleTimeStore.setDateSlots("2026-09-15", [
  { name: "1 пара", lessons: "1-2 урок", time: "8:00-9:20" },
  { name: "3 урок", time: "9:30-10:10" }
]);
```

Такое изменение действует только на указанную дату и не меняет весь день недели.

## Проверки

```bash
node tests/static-checks.js
node --check js/app.js
node --check js/modules/error-catalog.js
node --check js/modules/schedule-time-store.js
```
