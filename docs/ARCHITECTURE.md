# Architecture

Модульный монолит: один API-процесс, одна БД, SPA-клиент, отдельный маленький процесс бота.

```
apps/
  web/        React SPA (Telegram Mini App)
    src/app/          App, роутинг, AuthGate (Telegram initData → JWT)
    src/layouts/      AppLayout: шапка с DEMO DATA, нижняя навигация, кнопка помощника, offline-баннер
    src/features/     dashboard, products, basket, optimizer, suppliers, analytics, purchases, assistant, profile
    src/components/   UI-кит (Card, Badge, Skeleton, EmptyState, ErrorState, ConfirmDialog, Toaster …)
    src/hooks/        useBasket, useMainButton/useBackButton, useOnline
    src/lib/          telegram.ts — обёртка WebApp SDK (ready, expand, theme, viewport, haptics)
    src/services/     api.ts — типизированный HTTP-клиент
    src/stores/       Zustand: auth, локальный снимок корзины (persist), toasts
  api/        Express REST API
    src/config/       env (Zod), prisma client
    src/routes/       маршруты + rate limits
    src/controllers/  разбор запроса (Zod) → вызов сервиса → DTO
    src/services/     бизнес-логика (см. ниже)
    src/repositories/ запросы к SupplierOffer, общий фильтр «пригодных» предложений
    src/algorithms/   optimizer.ts, offerEligibility.ts — чистые функции без БД/HTTP
    src/integrations/ telegram.ts — проверка подписи initData
    src/middleware/   auth (JWT), errorHandler
    prisma/           schema, migrations, seed
  bot/        grammY: /start → кнопка web_app
packages/
  shared/     константы, Zod-схемы запросов, DTO-типы — общие для web и api
```

## Сервисы API

| Сервис | Ответственность |
| --- | --- |
| `ProductService` | каталог: поиск (RU/EN), фильтр, сортировка по цене, пагинация; min/avg цена только по пригодным предложениям |
| `SupplierOfferService` | DTO предложений, свежесть цены, преобразование в вход оптимизатора |
| `SupplierService` | список/профиль, история сделок пользователя, отзывы |
| `TrustScoreService` | формула 0.30/0.25/0.20/0.15/0.10, `INSUFFICIENT_DATA` при < 5 заказов или < 3 отзывов |
| `BasketService` | серверная корзина, валидация товара/единицы/наличия предложений |
| `OptimizerService` | загрузка предложений одним запросом, запуск алгоритма, объяснение, сохранение `OptimizationRun` + `OptimizationAllocation` |
| `PurchaseService` | сохранение сценария в транзакции, статусы с допустимыми переходами, повтор закупки |
| `PriceIntelligenceService` | ряды цен по предложению (товар+поставщик+единица+валюта), изменения, индекс цен |
| `DashboardService` | показатели из БД, расходы, экономия |
| `DataQualityService` | VALID/WARNING/INVALID/EXPIRED; дубликаты, аномалии > 30%, устаревание; ничего не удаляет |
| `RuleBasedAssistant` | реализация `ProcurementAssistantService`; отвечает только фактами из БД и расчётов |

## Основной поток

1. Telegram открывает Mini App → `AuthGate` отправляет `initData` на `POST /api/auth/telegram` → сервер проверяет HMAC и `auth_date` → JWT.
2. Каталог → `POST /api/basket/items` (серверная корзина; снимок в localStorage для восстановления).
3. «Оптимизировать» (Telegram MainButton) → `POST /api/optimizer/calculate` → сценарии A/B/C, рекомендация, объяснение.
4. «Сохранить план» → `POST /api/optimizer/:id/save` → `Purchase` + `PurchaseItem` в одной транзакции.
5. Закупка → контакты поставщиков (tel/mailto/Telegram), смена статуса, повтор.

## Решения

- **Деньги** — `Decimal(14,2)` в БД, `decimal.js` в расчётах, строки в DTO. Никаких float.
- **Корзина** — источник истины на сервере; Zustand хранит снимок для восстановления при новом открытии.
- **Тяжёлые вычисления** — только на сервере.
- **N+1** — оптимизатор грузит все предложения корзины одним запросом; каталог агрегирует цены одним SQL с `GROUP BY`.
