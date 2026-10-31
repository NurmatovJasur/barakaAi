import type { BasketDto, OptimizationRunDto, Paginated, ProductSummaryDto } from '@smp/shared';

export const products: ProductSummaryDto[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Картофель',
    description: null,
    category: { id: 'c1', slug: 'vegetables', name: 'Овощи' },
    unit: 'KG',
    imageUrl: null,
    offerCount: 3,
    minPrice: '3300.00',
    avgPrice: '3600.00',
    priceUpdatedAt: new Date().toISOString(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Лук',
    description: null,
    category: { id: 'c1', slug: 'vegetables', name: 'Овощи' },
    unit: 'KG',
    imageUrl: null,
    offerCount: 2,
    minPrice: '2900.00',
    avgPrice: '3100.00',
    priceUpdatedAt: new Date().toISOString(),
  },
];

export const page = (items: ProductSummaryDto[]): Paginated<ProductSummaryDto> => ({
  items,
  page: 1,
  pageSize: 12,
  total: items.length,
  totalPages: 1,
});

export const basketWith = (qtys: Record<string, number>): BasketDto => {
  const items = products
    .filter((p) => qtys[p.id])
    .map((p, i) => ({
      id: `item-${i}`,
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      quantity: String(qtys[p.id]),
      addedAt: new Date().toISOString(),
      minPrice: p.minPrice,
      estimatedCost: String(Number(p.minPrice) * qtys[p.id]),
      offerCount: p.offerCount,
    }));
  return {
    id: 'b1',
    items,
    estimatedTotal: String(items.reduce((s, i) => s + Number(i.estimatedCost), 0)),
    hasUnpricedItems: false,
  };
};

export const run: OptimizationRunDto = {
  id: '33333333-3333-4333-8333-333333333333',
  createdAt: new Date().toISOString(),
  deliveryDistrict: 'Chilonzor',
  optimizationStatus: 'OPTIMAL',
  recommended: 'MULTI',
  explanation: ['Рекомендован сценарий «Несколько поставщиков».'],
  warnings: [],
  evaluations: 42,
  savedPurchaseId: null,
  items: [],
  scenarios: [
    {
      kind: 'MULTI',
      title: 'Несколько поставщиков',
      optimizationStatus: 'OPTIMAL',
      feasible: true,
      productsCost: '475000.00',
      deliveryCost: '65000.00',
      totalCost: '540000.00',
      supplierCount: 2,
      baselineCost: '600000.00',
      savings: '60000.00',
      message: null,
      allocations: [],
      suppliers: [
        {
          supplierId: 's-a',
          supplierName: 'Supplier A',
          deliveryCost: '25000.00',
          productsCost: '330000.00',
          estimatedDeliveryDays: 1,
          allocations: [
            {
              productId: products[0].id,
              productName: 'Картофель',
              supplierId: 's-a',
              supplierName: 'Supplier A',
              offerId: 'o1',
              unit: 'KG',
              quantity: '100',
              unitPrice: '3300.00',
              totalPrice: '330000.00',
            },
          ],
        },
        {
          supplierId: 's-b',
          supplierName: 'Supplier B',
          deliveryCost: '40000.00',
          productsCost: '145000.00',
          estimatedDeliveryDays: 1,
          allocations: [
            {
              productId: products[1].id,
              productName: 'Лук',
              supplierId: 's-b',
              supplierName: 'Supplier B',
              offerId: 'o2',
              unit: 'KG',
              quantity: '50',
              unitPrice: '2900.00',
              totalPrice: '145000.00',
            },
          ],
        },
      ],
    },
    ...(['SINGLE', 'BALANCED_2', 'BALANCED_3'] as const).map((kind) => ({
      kind,
      title: kind,
      optimizationStatus: 'OPTIMAL' as const,
      feasible: kind !== 'SINGLE',
      productsCost: kind === 'SINGLE' ? null : '475000.00',
      deliveryCost: kind === 'SINGLE' ? null : '65000.00',
      totalCost: kind === 'SINGLE' ? null : '540000.00',
      supplierCount: kind === 'SINGLE' ? 0 : 2,
      baselineCost: null,
      savings: null,
      message: kind === 'SINGLE' ? 'Ни один поставщик не может выполнить весь заказ целиком.' : null,
      allocations: [],
      suppliers: [],
    })),
  ],
};
