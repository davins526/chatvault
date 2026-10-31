# ChatVault

**Local-first ChatGPT backup and version history for Brave/Chrome.**

> **Experimental MVP 0.1.0.** ChatVault is independent from OpenAI and is **not** a full account migration utility. It relies on undocumented ChatGPT internal endpoints; they may change or reject requests. Use the official OpenAI data export where possible.

ChatVault is a browser extension for preserving accessible ChatGPT conversations as local, versioned snapshots. Each subsequent backup retains unchanged revisions rather than duplicating them. Each ZIP contains complete accessible raw conversation graphs for a given snapshot, readable Markdown for the active branch and a coverage/error manifest.

## Что уже работает в v0.1

- Manifest V3 для **Brave / Chrome**.
- Автоматическая недельная проверка: **воскресенье, 20:00 по времени компьютера** (включена по умолчанию).
- Ручная кнопка «Сделать копию сейчас».
- Сканирование доступных переписок авторизованной вкладки `chatgpt.com` без хранения access token.
- Локальная база **IndexedDB**: полные исходные JSON-графы сообщений, SHA-256, дедупликация неизменённых ревизий.
- Отдельные снимки (snapshots), история изменений и журнал ошибок.
- **Автоматическое скачивание ZIP** после успешного снимка (включено по умолчанию).
- Ошибки и прерывания не удаляют старые ревизии и не маскируются под успешный полный бэкап.

## Чего ещё нет

- Содержимое файлов вложений: исходный JSON может включать ссылки/метаданные, но **сами файлы не скачиваются**.
- Отдельный экспорт инструкций проектов, памяти, пользовательских настроек и неприкреплённых файлов Библиотеки.
- Импорт с автоматическим воссозданием бесед в другом ChatGPT-аккаунте (официально не поддерживается).
- Шифрование локальных данных, облачная синхронизация, запуск при полностью закрытом браузере.
- Строгая проверка полного покрытия аккаунта; ChatVault сохраняет **только доступные текущей сессии беседы**.
- Настройка другого дня/времени в пользовательском интерфейсе (в v0.1 расписание фиксировано).
- Миграция всех альтернативных вариантов в Markdown: они присутствуют в `conversation.raw.json` как исходный граф, а Markdown включает только активную ветку.

## Установка в Brave / Chrome

1. Скачайте [сборку](./dist/) из релиза или ZIP репозитория и распакуйте её.
2. Откройте `brave://extensions` (Chrome: `chrome://extensions`).
3. Включите **«Режим разработчика»**.
4. Нажмите **«Загрузить распакованное расширение»** и выберите папку **`dist`**, где лежит `manifest.json`.
5. Войдите в ChatGPT в этом же профиле браузера. Откройте `chatgpt.com` во вкладке.
6. Нажмите иконку ChatVault и **«Сделать копию сейчас»**. После завершения появится запись в журнале, а ZIP попадёт в папку загрузок.

**Важно:** при закрытом браузере, выключенном ПК или неавторизованной сессии еженедельный запуск не гарантируется. Если он пропущен, расширение попробует начать резервирование при следующем открытии ChatGPT после назначенного времени.

### Безопасность локального архива

Переписки могут содержать исходный код, секреты и личные сведения. **IndexedDB и ZIP в v0.1 не шифруются.** Не устанавливайте расширение для личных данных на компьютер, которым управляют третьи лица или к которому имеют доступ другие пользователи. Защитите профиль ОС и храните копии ZIP на доверенном устройстве/носителе. Расширение не загружает переписки на сервер автора, не сохраняет ключи авторизации и не синхронизирует данные через сторонние службы. Доступ к ChatGPT нужен только для чтения содержимого текущей сессии.

## Схема

```text
chrome.alarms (вс, 20:00)
       ↓
background service worker  ── popup / status
       ↓
content script в открытом ChatGPT (авторизованный запрос)
       ↓            429 → пауза и ошибка
каждая беседа отдельно
       ↓
IndexedDB: chats + revisions (SHA-256) + snapshots + logs
       ↓
offscreen document: ZIP из версии снимка
       ↓
chrome.downloads → локальный ChatVault-YYYY-MM-DD-N-chats.zip
```

### Модель данных

- `chats` — последний хеш и метаданные каждой беседы по ID.
- `revisions` — полные версии JSON-графа, ключ `chatId:sha256`.
- `snapshots` — снимки со списком `chatId + hash`, статусом и покрытием.
- `logs` — локальный журнал.

Объекты `running` после перезапуска маркируются как `partial` и не удаляются. Неполные копии можно экспортировать вручную для спасения уже доступных данных.

### Структура архива

```text
ChatVault-2026-11-01-69-chats.zip
├── manifest.json
├── README.txt
└── chats/
    └── Conversation_<id>/
        ├── conversation.raw.json    # полный доступный граф, главная копия
        └── conversation.md          # читаемый активный путь
```

Файл `manifest.json` содержит количество чатов, ошибки и явно указывает непокрытые области.

## Разработка

Нужны Node.js 20+ и TypeScript 5.8+.

```bash
npm install
npm run build
npm test
```

Если `tsc` уже есть в системе, можно собрать без `npm install`:

```bash
tsc -p tsconfig.json
node scripts/copy-public.mjs
```

**Не включайте личные ZIP, MBOX, секретные ключи или токены в публичный репозиторий.** Для проверки используйте тестовые беседы.

## Известные ограничения и риски

1. Эндпоинты `/api/auth/session`, `/backend-api/conversations` и `/backend-api/conversation/{id}` не являются публичным контрактом. При изменении API автосбор перестанет работать до обновления расширения.
2. Ошибка 429 ведёт к остановке, cooldown и записи в журнал. Расширение не пытается обходить ограничения сервиса.
3. Расширение не может запускать Chromium с закрытого состояния или пробуждать компьютер. `chrome.alarms` — **best-effort**.
4. Данные расширения в IndexedDB могут исчезнуть при удалении расширения или очистке данных браузера. Независимый ZIP — обязательная часть резервного копирования.
5. В v0.1 ZIP32 с несжатыми файлами ограничен размером **80 МиБ**. При превышении функция сообщает об ошибке; ревизии остаются в IndexedDB.
6. Архивы не позволяют «клонировать» память, подписку и историю аккаунта в интерфейсе нового ChatGPT.

## Roadmap

- [x] Manifest V3, popup, IndexedDB, недельный scheduler
- [x] История ревизий по SHA-256, ZIP, журнал ошибок
- [ ] Получение файлов вложений с проверкой контрольных сумм
- [ ] Экспорт project instructions / метаданных доступными методами
- [ ] Список и просмотр снимков / восстановление отдельной версии
- [ ] Настройка дня, времени и частоты
- [ ] AES-GCM шифрование архивов
- [ ] Официальный импорт ZIP/JSON OpenAI как fallback
- [ ] Полноценный Chrome/Brave integration test и аудит перед публикацией в магазин

## Кредиты и лицензия

Проект вдохновлён [ChatGPT Bulk Exporter](https://github.com/vrizo/chatgpt-bulk-exporter) Виталия Ризо (MIT). Подробнее — [NOTICE.md](NOTICE.md).

Код ChatVault распространяется под MIT ([LICENSE](LICENSE)). ChatGPT принадлежит OpenAI; проект независимый, не одобрен и не спонсируется OpenAI.

## English short description

Experimental local-first Chrome/Brave extension that snapshots accessible ChatGPT conversation graphs into IndexedDB, deduplicates revisions by SHA-256, and downloads weekly ZIP archives. Default: Sunday at 20:00 local time. It cannot run with the browser closed, bypass rate limits, or migrate full ChatGPT accounts.
