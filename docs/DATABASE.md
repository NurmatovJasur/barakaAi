# Database

PostgreSQL + Prisma. Схема: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma), миграции: `apps/api/prisma/migrations`.

## Модели

| Модель | Назначение |
| --- | --- |
| `User` | пользователь Telegram (`telegramId` unique) |
| `Business` | бизнес пользователя, район доставки |
| `ProductCategory`, `Product` | каталог; `unit` — enum `KG/L/PCS/PACK/DOZEN` |
| `Supplier` | поставщик, зоны доставки, `verificationStatus`, `isDemo` |
| `SupplierOffer` | цена, MOQ, остаток, доставка, зоны, срок, свежесть, `dataQualityStatus` + заметки. Unique `(supplierId, productId, unit, currency)` |
| `PriceHistory` | история цены конкретного предложения (товар + поставщик + единица + валюта) |
| `Basket`, `BasketItem` | серверная корзина, unique `(basketId, productId)` |
| `OptimizationRun`, `OptimizationAllocation` | расчёт (запрос + результат JSON) и распределения по сценариям |
| `Purchase`, `PurchaseItem` | сохранённая закупка; создаётся в транзакции |
| `Review`, `SupplierMetrics` | отзывы и метрики для Trust Score |
| `Notification` | заготовка (P2) |

Все ключи — UUID; деньги `Decimal(14,2)`, количества `Decimal(12,3)`; `createdAt/updatedAt`; индексы на внешних ключах и датах.

## Seed

`npm run db:seed` — детерминированный (фиксированный PRNG):

- 8 категорий, 20 товаров, 5 поставщиков `Supplier A–E` (все `UNVERIFIED`, `isDemo`).
- 62 предложения с разными ценами, MOQ, остатками, доставкой, зонами и свежестью.
- Пограничные случаи: устаревшие цены (Supplier E: рис, яблоки > 72 ч), истёкшее предложение (Supplier E: сахар), нет в наличии (Supplier B: огурцы), ограниченный остаток (Supplier A: помидоры 40 кг), аномальный скачок цены (Supplier E: бананы), поставщик без доставки в Chilonzor (Supplier D).
- 90 дней истории цен по каждому предложению.
- Отзывы и метрики; у Supplier C и D данных мало → `Insufficient Data`.
- Демо-пользователь `100000001` и 6 выполненных демо-закупок без baseline (экономия не заявляется).
- В конце запускается `DataQualityService`.

Seed очищает все таблицы перед заполнением — **не запускайте его на базе с реальными данными**.

## Тестовая БД

Интеграционные тесты используют `TEST_DATABASE_URL` (`smart_market_prices_test`): `prisma migrate deploy` + seed перед прогоном.
