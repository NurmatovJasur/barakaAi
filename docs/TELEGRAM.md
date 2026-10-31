# Telegram Mini App

## 1. Создать бота (BotFather)

1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot` → имя и username.
2. Сохраните токен в `.env` как `TELEGRAM_BOT_TOKEN` (только на сервере, никогда во фронтенде).
3. `/setdomain` — не нужен для web_app-кнопок, но при использовании Login Widget укажите домен.
4. Опционально `/newapp` — создать Mini App с прямой ссылкой `t.me/<bot>/<app>`, URL = адрес фронтенда.

## 2. Публичный HTTPS

Telegram открывает Mini App только по HTTPS. Для разработки — туннель:

```bash
npx cloudflared tunnel --url http://localhost:5173
```

Получите URL вида `https://xxx.trycloudflare.com`. Одного туннеля достаточно: Vite проксирует `/api` на API (порт 4000), поэтому `VITE_API_URL=/api`.

В `.env`:

```
WEB_APP_URL=https://<tunnel>
```

Пока туннель открыт, приложение доступно из интернета. Поставьте `DEV_MODE=false`, чтобы никто не мог войти через `/api/auth/dev`, и перезапустите API.

## 3. Запуск бота

```bash
npm run dev:bot
```

Бот отвечает на `/start` приветствием и кнопкой **Open Smart Market Prices** (`web_app`), а также ставит кнопку меню чата.

## 4. Авторизация

1. Mini App вызывает `Telegram.WebApp.ready()` и `expand()`.
2. Фронтенд отправляет `Telegram.WebApp.initData` (подписанную строку) на `POST /api/auth/telegram`.
3. Сервер ([`integrations/telegram.ts`](../apps/api/src/integrations/telegram.ts)):
   - строит data-check-string из всех полей, кроме `hash`, отсортированных по ключу;
   - `secret = HMAC_SHA256("WebAppData", bot_token)`, `hash = HMAC_SHA256(secret, data_check_string)`;
   - сравнивает через `timingSafeEqual`;
   - проверяет `auth_date` (по умолчанию не старше 24 ч, `TELEGRAM_INITDATA_MAX_AGE`);
   - создаёт/обновляет пользователя и выдаёт JWT (HS256, `JWT_EXPIRES_IN`).
4. `initDataUnsafe` используется только для приветствия в UI.

## 5. SDK во фронтенде

[`apps/web/src/lib/telegram.ts`](../apps/web/src/lib/telegram.ts) и [`hooks/useTelegramButtons.ts`](../apps/web/src/hooks/useTelegramButtons.ts):

- theme params → CSS-переменные (фон, поверхности, текст), тёмная тема;
- `viewportStableHeight` → `--app-height`; safe area через `env(safe-area-inset-*)` и `--tg-safe-area-inset-*`;
- **MainButton**: «Оптимизировать закупку» в корзине, «Сохранить план закупки» в результате;
- **BackButton**: на всех вложенных экранах;
- **Haptic feedback**: добавление, оптимизация, сохранение, ошибки;
- контакты поставщика в Telegram открываются через `openTelegramLink`.

Вне Telegram (`VITE_DEV_MODE=true`) те же действия показываются обычными кнопками.

## 6. Деплой (кратко)

- API: любой Node-хостинг (Render, Railway, VPS) + управляемый PostgreSQL; `npm run db:deploy`, затем `npm start -w @smp/api`.
- Web: `npm run build -w @smp/web` → статика `apps/web/dist` на Vercel/Netlify/Cloudflare Pages; `VITE_API_URL` задаётся на этапе сборки.
- Бот: отдельный процесс `npm start -w @smp/bot` (long polling).
- Не запускайте seed в продакшене и не включайте `DEV_MODE` (API откажется стартовать при `NODE_ENV=production` и `DEV_MODE=true`).
