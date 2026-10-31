import { z } from 'zod';
import {
  CATEGORY_SLUGS,
  MAX_BASKET_ITEMS,
  MAX_BASKET_QUANTITY,
  PURCHASE_STATUSES,
  UNITS,
} from '../constants/index';

export const unitSchema = z.enum(UNITS);

export const quantitySchema = z.coerce
  .number({ invalid_type_error: 'Количество должно быть числом' })
  .finite()
  .positive('Количество должно быть больше нуля')
  .max(MAX_BASKET_QUANTITY, `Максимум ${MAX_BASKET_QUANTITY}`)
  .refine(
    (v) => Math.abs(Math.round(v * 1000) - v * 1000) < 1e-6,
    'Не более 3 знаков после запятой',
  );

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const productListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORY_SLUGS).optional(),
  sort: z.enum(['name', 'price_asc', 'price_desc']).default('name'),
});

export const supplierListQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
});

export const basketItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantitySchema,
  unit: unitSchema,
});

export const basketItemPatchSchema = z.object({
  quantity: quantitySchema,
});

export const optimizerRequestSchema = z.object({
  items: z
    .array(basketItemInputSchema)
    .min(1, 'Корзина пуста')
    .max(MAX_BASKET_ITEMS)
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      'Товары в корзине не должны повторяться',
    ),
  deliveryDistrict: z.string().trim().min(1).max(60).optional(),
});

export const savePurchaseSchema = z.object({
  scenario: z.enum(['SINGLE', 'MULTI', 'BALANCED_2', 'BALANCED_3']),
  status: z.enum(['DRAFT', 'PLANNED']).default('PLANNED'),
  note: z.string().max(500).optional(),
});

export const createPurchaseSchema = z.object({
  optimizationRunId: z.string().uuid(),
  scenario: z.enum(['SINGLE', 'MULTI', 'BALANCED_2', 'BALANCED_3']),
  status: z.enum(['DRAFT', 'PLANNED']).default('PLANNED'),
  note: z.string().max(500).optional(),
});

export const purchaseStatusPatchSchema = z.object({
  status: z.enum(PURCHASE_STATUSES),
});

export const assistantChatSchema = z.object({
  message: z.string().trim().min(1).max(500),
  optimizationRunId: z.string().uuid().optional(),
});

export const priceAnalyticsQuerySchema = z.object({
  range: z.enum(['7', '30', '90']).default('30'),
});

export const devAuthSchema = z.object({
  telegramId: z.coerce.number().int().positive().optional(),
  firstName: z.string().max(64).optional(),
});

export const telegramAuthSchema = z.object({
  initData: z.string().min(1).max(4096),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type BasketItemInput = z.infer<typeof basketItemInputSchema>;
export type OptimizerRequest = z.infer<typeof optimizerRequestSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
