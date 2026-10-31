import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  analyticsController as analytics,
  assistantController as assistant,
  authController as auth,
  basketController as basket,
  dashboardController as dashboard,
  optimizerController as optimizer,
  productController as products,
  purchaseController as purchases,
  supplierController as suppliers,
} from '../controllers/index';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';

const isTest = process.env.NODE_ENV === 'test';
const limiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit: isTest ? 10_000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Слишком много запросов, попробуйте позже' } },
  });

export function apiRouter() {
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const authRouter = Router();
  // Throttle only the credential exchanges; /me and /logout already require a valid token.
  const loginLimiter = limiter(60_000, env.AUTH_RATE_LIMIT);
  authRouter.post('/telegram', loginLimiter, auth.telegram);
  authRouter.post('/dev', loginLimiter, auth.dev);
  authRouter.get('/me', requireAuth, auth.me);
  authRouter.post('/logout', requireAuth, auth.logout);
  r.use('/auth', authRouter);

  // Everything below requires authentication
  r.use(requireAuth);

  r.get('/dashboard/stats', dashboard.stats);
  r.get('/dashboard/recent-purchases', dashboard.recentPurchases);
  r.get('/dashboard/price-changes', dashboard.priceChanges);

  r.get('/products', products.list);
  r.get('/products/:id', products.get);
  r.get('/products/:id/offers', products.offers);

  r.get('/suppliers', suppliers.list);
  r.get('/suppliers/:id', suppliers.get);
  r.get('/suppliers/:id/offers', suppliers.offers);
  r.get('/suppliers/:id/reviews', suppliers.reviews);

  r.get('/basket', basket.get);
  r.post('/basket/items', basket.add);
  r.patch('/basket/items/:id', basket.update);
  r.delete('/basket/items/:id', basket.remove);
  r.delete('/basket', basket.clear);

  r.post('/optimizer/calculate', limiter(60_000, 30), optimizer.calculate);
  r.get('/optimizer/:id', optimizer.get);
  r.post('/optimizer/:id/save', optimizer.save);

  r.get('/analytics/prices/:productId', analytics.prices);
  r.get('/analytics/overview', analytics.overview);
  r.get('/analytics/savings', analytics.savings);

  r.post('/assistant/chat', limiter(60_000, 30), assistant.chat);

  r.get('/purchases', purchases.list);
  r.get('/purchases/:id', purchases.get);
  r.post('/purchases', purchases.create);
  r.patch('/purchases/:id/status', purchases.status);
  r.post('/purchases/:id/repeat', purchases.repeat);

  return r;
}
