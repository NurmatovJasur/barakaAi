# Smart Market Prices

B2B Telegram Mini App для оптимизации закупок малого бизнеса (Ташкент). Пользователь собирает закупочную корзину, а **Smart Basket Optimizer** точным перебором находит самое дешёвое распределение между поставщиками с учётом цен, минимальных объёмов, остатков, зон доставки, актуальности цен и доставки (один раз на поставщика).

> ⚠️ **DEMO DATA.** Все поставщики (Supplier A–E), цены, история цен, отзывы и метрики — вымышленные. Поставщики не верифицированы. Экономия — расчётная оценка, не подтверждённая сделками. Помощник — rule-based, без LLM.

## Стек

| Слой | Технологии |
| --- | --- |
| Web | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query 5, Zustand, Recharts, lucide-react, Telegram WebApp SDK |
| API | Node.js, Express 5, TypeScript, Zod, Prisma 6, decimal.js, helmet, express-rate-limit, JWT |
| DB | PostgreSQL 17 (embedded, без Docker) или PostgreSQL 16 в Docker |
| Bot | grammY |
| Tests | Vitest, Supertest, React Testing Library, Playwright |

Монорепо на npm workspaces: `apps/api`, `apps/web`, `apps/bot`, `packages/shared`. Подробнее — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Запуск локально

Требуется Node.js ≥ 20 (проверено на 24).

```bash
npm install
```

npm 11 блокирует install-скрипты, пока они не одобрены. Список одобренных пакетов (Prisma, esbuild, embedded-postgres) уже лежит в `package.json → allowScripts`. Если npm всё же предупредит, выполните `npm approve-scripts --allow-scripts-pending` и затем `npm rebuild`.

```bash
cp .env.example .env
```

В `.env` задайте `JWT_SECRET` (длинная случайная строка):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

База данных — **в отдельном терминале** (держите его открытым):

```bash
npm run db:start
```

Это настоящий PostgreSQL 17 из npm (`embedded-postgres`), данные в `.data/pg`, порт **5433**. Альтернатива с Docker: `npm run db:up`.

Миграции и демо-данные:

```bash
npm run db:deploy
```

```bash
npm run db:seed
```

Приложение (API :4000 + web :5173):

```bash
npm run dev
```

Откройте http://localhost:5173. В `DEV_MODE=true` вход выполняется автоматически под тестовым пользователем.

### Тестовый пользователь (DEV_MODE)

| Поле | Значение |
| --- | --- |
| Вход | `POST /api/auth/dev` (автоматически во фронтенде при `VITE_DEV_MODE=true`) |
| Telegram ID | `100000001` |
| Имя | Demo Owner (`@demo_shop_owner`) |
| Бизнес | Demo Shop, район **Chilonzor** |

## Тесты

```bash
npm test
```

- `apps/api`: 21 unit-тест оптимизатора (все 12 сценариев из ТЗ + инварианты + сверка с полным перебором на случайных данных) и 24 интеграционных теста API (Supertest) на отдельной БД `smart_market_prices_test`.
- `apps/web`: 10 тестов React Testing Library (навигация, поиск, добавление/изменение/удаление, оптимизация, результаты, ошибки).

E2E (Playwright, 22 сценария, реальный API + БД; нужен запущенный `db:start`). Тесты входят так же, как Telegram: подписывают `initData` токеном `TELEGRAM_BOT_TOKEN` из `.env` и нажимают нативные MainButton/BackButton через SDK. Без токена сценарии пропускаются. Для локальных прогонов поднимите `AUTH_RATE_LIMIT` и `API_RATE_LIMIT` в `.env` (в продакшене оставьте 20 и 600):

```bash
npx -w @smp/web playwright install chromium
```

```bash
npm run test:e2e
```

## Telegram

Настройка бота, BotFather и деплой — [docs/TELEGRAM.md](docs/TELEGRAM.md).

## Документация

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — модули и потоки данных
- [API.md](docs/API.md) — все эндпоинты
- [OPTIMIZER.md](docs/OPTIMIZER.md) — математическая модель и алгоритм
- [DATABASE.md](docs/DATABASE.md) — схема, seed, политика данных
- [TELEGRAM.md](docs/TELEGRAM.md) — бот, Mini App, авторизация, деплой

## Известные ограничения

- Все данные демонстрационные; реальных интеграций с поставщиками нет (P2).
- Точный перебор рассчитан на небольшой каталог (≤ ~15 поставщиков на корзину, ≤ 10 предложений на товар). Выше лимита вычислений возвращается статус `FEASIBLE_LIMIT_REACHED`.
- Стоимость доставки поставщика = максимальная ставка среди его допустимых предложений в корзине (консервативно, начисляется один раз).
- Помощник отвечает по шаблонам (rule-based); LLM-интеграция — только интерфейс-заготовка.
- Оплаты нет; связь с поставщиком — через телефон/email/Telegram из профиля.
- JWT без серверного отзыва: `logout` удаляет токен на клиенте.
- Для настоящего Telegram нужен публичный HTTPS URL фронтенда и API (ngrok, Cloudflare Tunnel или хостинг).
