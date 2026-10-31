# API

Base URL: `http://localhost:4000/api`. Формат ошибок:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Количество должно быть больше нуля", "details": {} } }
```

Все эндпоинты, кроме `/health` и `/auth/telegram|dev`, требуют `Authorization: Bearer <jwt>`. Пользователь видит только свои корзину, расчёты и закупки (иначе 404). Деньги и количества — десятичные строки. Пагинация: `page` (≥ 1), `pageSize` (1–50), ответ `{ items, page, pageSize, total, totalPages }`.

Rate limits: 600 запросов / 15 мин на IP, auth 20/мин, optimizer и assistant 30/мин. Тело запроса ≤ 100 KB.

## Auth

| Метод | Путь | Описание |
| --- | --- | --- |
| POST | `/auth/telegram` | `{ initData }` → проверка HMAC-SHA256 и `auth_date`, upsert пользователя, `{ token, user }` |
| POST | `/auth/dev` | только `DEV_MODE=true`: вход под демо-пользователем |
| GET | `/auth/me` | текущий пользователь |
| POST | `/auth/logout` | 204; токен удаляется клиентом |

## Dashboard

| GET | Описание |
| --- | --- |
| `/dashboard/stats` | объём закупок, поставщики, товары, расчётная экономия, закупки, активные предложения |
| `/dashboard/recent-purchases` | 5 последних закупок |
| `/dashboard/price-changes?direction=up\|down` | последние изменения цен по предложениям |

## Products

| GET | Описание |
| --- | --- |
| `/products?search&category&sort=name\|price_asc\|price_desc&page&pageSize` | каталог с `offerCount`, `minPrice`, `avgPrice`, `priceUpdatedAt` |
| `/products/:id` | карточка |
| `/products/:id/offers` | все предложения, включая непригодные, с `freshness` и `dataQualityStatus` |

## Suppliers

| GET | Описание |
| --- | --- |
| `/suppliers?search&page&pageSize` | список |
| `/suppliers/:id` | профиль, контакты, Trust Score, история сделок пользователя |
| `/suppliers/:id/offers` | предложения поставщика |
| `/suppliers/:id/reviews?page` | отзывы |

## Basket

| Метод | Путь | Тело |
| --- | --- | --- |
| GET | `/basket` | — |
| POST | `/basket/items` | `{ productId, quantity, unit }` (добавить или заменить количество) |
| PATCH | `/basket/items/:id` | `{ quantity }` |
| DELETE | `/basket/items/:id` | — |
| DELETE | `/basket` | очистить |

Валидация: `0 < quantity ≤ 100000`, ≤ 3 знаков после запятой, единица = единице товара, у товара есть пригодные предложения, ≤ 30 позиций.

## Optimizer

| Метод | Путь | Описание |
| --- | --- | --- |
| POST | `/optimizer/calculate` | `{ items: [{productId, quantity, unit}], deliveryDistrict? }` → `OptimizationRunDto` (201) |
| GET | `/optimizer/:id` | сохранённый расчёт |
| POST | `/optimizer/:id/save` | `{ scenario, status?: DRAFT\|PLANNED, note? }` → `PurchaseDto` (201); повторно — 409 |

`OptimizationRunDto`: `optimizationStatus`, `recommended`, `explanation[]`, `warnings[]`, `scenarios[]` с полями `productsCost`, `deliveryCost`, `totalCost`, `supplierCount`, `allocations`, `suppliers` (группировка), `baselineCost`, `savings`, `message`.

## Analytics

| GET | Описание |
| --- | --- |
| `/analytics/prices/:productId?range=7\|30\|90` | ряды по каждому предложению: current/min/max/avg/change, точки |
| `/analytics/overview` | расходы по месяцам/поставщикам/категориям, индекс цен |
| `/analytics/savings` | расчётная экономия по закупкам + дисклеймер |

## Assistant

`POST /assistant/chat` `{ message, optimizationRunId? }` → `{ intent, answer, facts[], links[], dataSufficient, engine: "rule-based" }`.

## Purchases

| Метод | Путь | Описание |
| --- | --- | --- |
| GET | `/purchases?page` | история |
| GET | `/purchases/:id` | детали + контакты поставщиков |
| POST | `/purchases` | `{ optimizationRunId, scenario, status?, note? }` |
| PATCH | `/purchases/:id/status` | `{ status }`; переходы: DRAFT→PLANNED/CANCELLED, PLANNED→CONFIRMED/CANCELLED, CONFIRMED→COMPLETED/CANCELLED |
| POST | `/purchases/:id/repeat` | заменяет корзину товарами закупки |
