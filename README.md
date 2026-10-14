# MAX Chat — GREEN-API

Минималистичный веб-клиент для текстовой переписки в MAX через GREEN-API. Интерфейс собран на React + TypeScript + Vite и стилизован как компактный современный мессенджер.

## Возможности

- подключение инстанса GREEN-API по `apiUrl`, `idInstance` и `apiTokenInstance`;
- проверка авторизации инстанса через `GetStateInstance`;
- создание личного чата по номеру телефона через `CheckAccount`;
- отправка текстовых сообщений через `SendMessage`;
- приём входящих текстовых уведомлений через HTTP API (`ReceiveNotification`) с подтверждением через `DeleteNotification`;
- список диалогов, поиск и адаптивный интерфейс;
- ключи API остаются в памяти вкладки и не записываются в `localStorage`.

Поддерживаемый формат номеров для проверки аккаунта: `+7XXXXXXXXXX` и `+375XXXXXXXXX`, согласно документации GREEN-API для MAX. Вложения намеренно не реализованы: тестовое задание требует только текст.

## Требования

- Node.js 20 или новее;
- аккаунт и авторизованный MAX-инстанс в [личном кабинете GREEN-API](https://console.green-api.com/).

## Локальный запуск

```bash
npm install
npm run dev
```

Откройте адрес, который напечатает Vite (обычно `http://localhost:5173`). Для production-сборки:

```bash
npm run build
npm run preview
```

## Настройка GREEN-API

1. В личном кабинете GREEN-API откройте параметры вашего MAX-инстанса и скопируйте `apiUrl`, `idInstance` и `apiTokenInstance`.
2. Убедитесь, что инстанс авторизован и его состояние — `authorized`.
3. Для приёма уведомлений через HTTP API оставьте `webhookUrl` пустым и включите получение входящих сообщений в настройках инстанса (`incomingWebhook`). Если инстанс ранее использовался с webhook endpoint, переключите его на HTTP API.
4. Откройте приложение, введите три параметра и нажмите «Подключиться».
5. Введите номер в международном формате. После успешного ответа `CheckAccount` чат появится в списке.
6. Отправьте сообщение. Входящие текстовые ответы появятся в диалоге автоматически.

GREEN-API возвращает `chatId` для номера методом `CheckAccount`. Это важно для MAX: для последующих отправок приложение использует полученный `chatId`, а не формирует идентификатор самостоятельно.

## Структура

```text
src/
  api.ts       типизированный HTTP-клиент GREEN-API
  App.tsx      экран чатов, подключение, отправка и polling уведомлений
  main.tsx     запуск React
  styles.css   адаптивные стили
```

## API и ссылки

- [MAX API и начало работы](https://green-api.com/max)
- [Отправка текста — SendMessage](https://green-api.com/v3/docs/api/sending/SendMessage/)
- [Проверка аккаунта — CheckAccount](https://green-api.com/v3/docs/api/service/CheckAccount/)
- [Получение уведомления — ReceiveNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/)
- [Удаление уведомления — DeleteNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/)
- [Технология HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/)
- [Идентификатор чата MAX](https://green-api.com/v3/docs/api/chat-id/)


