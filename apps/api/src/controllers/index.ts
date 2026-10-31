import type { Request, Response } from 'express';
import {
  assistantChatSchema,
  basketItemInputSchema,
  basketItemPatchSchema,
  createPurchaseSchema,
  devAuthSchema,
  optimizerRequestSchema,
  paginationSchema,
  priceAnalyticsQuerySchema,
  productListQuerySchema,
  purchaseStatusPatchSchema,
  savePurchaseSchema,
  supplierListQuerySchema,
  telegramAuthSchema,
} from '@smp/shared';
import { services as s } from '../container';
import { parse, userId, uuidParam } from '../utils/http';

export const authController = {
  telegram: async (req: Request, res: Response) => {
    const { initData } = parse(telegramAuthSchema, req.body);
    res.json(await s.auth.telegram(initData));
  },
  dev: async (req: Request, res: Response) => {
    parse(devAuthSchema, req.body ?? {});
    res.json(await s.auth.dev());
  },
  me: async (req: Request, res: Response) => res.json(await s.auth.me(userId(req))),
  // JWT is stateless: the client drops the token. Endpoint exists for a uniform API.
  logout: async (_req: Request, res: Response) => res.status(204).end(),
};

export const dashboardController = {
  stats: async (req: Request, res: Response) => res.json(await s.dashboard.stats(userId(req))),
  recentPurchases: async (req: Request, res: Response) =>
    res.json((await s.purchases.list(userId(req), { page: 1, pageSize: 5 })).items),
  priceChanges: async (req: Request, res: Response) => {
    const dir = req.query.direction === 'up' || req.query.direction === 'down' ? req.query.direction : undefined;
    res.json(await s.prices.latestChanges(10, dir));
  },
};

export const productController = {
  list: async (req: Request, res: Response) =>
    res.json(await s.products.list(parse(productListQuerySchema, req.query))),
  get: async (req: Request, res: Response) => res.json(await s.products.get(uuidParam(req))),
  offers: async (req: Request, res: Response) => res.json(await s.offers.forProduct(uuidParam(req))),
};

export const supplierController = {
  list: async (req: Request, res: Response) =>
    res.json(await s.suppliers.list(parse(supplierListQuerySchema, req.query))),
  get: async (req: Request, res: Response) => res.json(await s.suppliers.get(uuidParam(req), userId(req))),
  offers: async (req: Request, res: Response) => res.json(await s.offers.forSupplier(uuidParam(req))),
  reviews: async (req: Request, res: Response) =>
    res.json(await s.suppliers.reviews(uuidParam(req), parse(paginationSchema, req.query))),
};

export const basketController = {
  get: async (req: Request, res: Response) => res.json(await s.basket.get(userId(req))),
  add: async (req: Request, res: Response) =>
    res.status(201).json(await s.basket.addItem(userId(req), parse(basketItemInputSchema, req.body))),
  update: async (req: Request, res: Response) =>
    res.json(
      await s.basket.updateItem(userId(req), uuidParam(req), parse(basketItemPatchSchema, req.body).quantity),
    ),
  remove: async (req: Request, res: Response) => res.json(await s.basket.removeItem(userId(req), uuidParam(req))),
  clear: async (req: Request, res: Response) => res.json(await s.basket.clear(userId(req))),
};

export const optimizerController = {
  calculate: async (req: Request, res: Response) =>
    res.status(201).json(await s.optimizer.calculate(userId(req), parse(optimizerRequestSchema, req.body))),
  get: async (req: Request, res: Response) => res.json(await s.optimizer.get(userId(req), uuidParam(req))),
  save: async (req: Request, res: Response) => {
    const body = parse(savePurchaseSchema, req.body);
    res.status(201).json(
      await s.purchases.createFromRun(userId(req), { ...body, optimizationRunId: uuidParam(req) }),
    );
  },
};

export const analyticsController = {
  prices: async (req: Request, res: Response) => {
    const { range } = parse(priceAnalyticsQuerySchema, req.query);
    res.json(await s.prices.forProduct(uuidParam(req, 'productId'), Number(range)));
  },
  overview: async (req: Request, res: Response) => res.json(await s.dashboard.overview(userId(req))),
  savings: async (req: Request, res: Response) => res.json(await s.dashboard.savings(userId(req))),
};

export const assistantController = {
  chat: async (req: Request, res: Response) => {
    const { message, optimizationRunId } = parse(assistantChatSchema, req.body);
    res.json(await s.assistant.reply(message, { userId: userId(req), optimizationRunId }));
  },
};

export const purchaseController = {
  list: async (req: Request, res: Response) =>
    res.json(await s.purchases.list(userId(req), parse(paginationSchema, req.query))),
  get: async (req: Request, res: Response) => res.json(await s.purchases.get(userId(req), uuidParam(req))),
  create: async (req: Request, res: Response) =>
    res.status(201).json(await s.purchases.createFromRun(userId(req), parse(createPurchaseSchema, req.body))),
  status: async (req: Request, res: Response) =>
    res.json(
      await s.purchases.updateStatus(userId(req), uuidParam(req), parse(purchaseStatusPatchSchema, req.body).status),
    ),
  repeat: async (req: Request, res: Response) => {
    const uid = userId(req);
    const items = await s.purchases.repeatItems(uid, uuidParam(req));
    res.json(await s.basket.replace(uid, items));
  },
};
