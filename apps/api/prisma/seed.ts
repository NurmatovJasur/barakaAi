/**
 * DEMO DATA seed. All suppliers, offers, prices, history and reviews are fictional and flagged isDemo.
 * Deterministic: same output on every run.
 */
import { PrismaClient, Prisma, type Unit } from '@prisma/client';
import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategorySlug } from '@smp/shared';
import { runDataQualityChecks } from '../src/services/dataQuality.service';

const prisma = new PrismaClient();

// Deterministic PRNG (mulberry32)
let seed = 20261030;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rnd() * (b - a);
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

const NOW = new Date();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

interface ProductSeed {
  name: string;
  category: CategorySlug;
  unit: Unit;
  base: number;
  description: string;
}

const PRODUCTS: ProductSeed[] = [
  { name: 'Potatoes', category: 'vegetables', unit: 'KG', base: 4000, description: 'Картофель столовый, мешки 25–50 кг' },
  { name: 'Onions', category: 'vegetables', unit: 'KG', base: 3500, description: 'Лук репчатый жёлтый' },
  { name: 'Tomatoes', category: 'vegetables', unit: 'KG', base: 12000, description: 'Томаты тепличные' },
  { name: 'Cucumbers', category: 'vegetables', unit: 'KG', base: 9000, description: 'Огурцы гладкие' },
  { name: 'Carrots', category: 'vegetables', unit: 'KG', base: 3000, description: 'Морковь жёлтая и красная' },
  { name: 'Cabbage', category: 'vegetables', unit: 'KG', base: 3000, description: 'Капуста белокочанная' },
  { name: 'Apples', category: 'fruits', unit: 'KG', base: 15000, description: 'Яблоки местные, сезонные сорта' },
  { name: 'Bananas', category: 'fruits', unit: 'KG', base: 25000, description: 'Бананы импортные' },
  { name: 'Rice', category: 'grains', unit: 'KG', base: 18000, description: 'Рис девзира / лазер' },
  { name: 'Lentils', category: 'grains', unit: 'KG', base: 20000, description: 'Чечевица красная' },
  { name: 'Beans', category: 'grains', unit: 'KG', base: 22000, description: 'Фасоль белая' },
  { name: 'Pasta', category: 'grains', unit: 'KG', base: 11000, description: 'Макаронные изделия, весовые' },
  { name: 'Flour', category: 'flour', unit: 'KG', base: 6500, description: 'Мука пшеничная высшего сорта' },
  { name: 'Sugar', category: 'sugar', unit: 'KG', base: 13000, description: 'Сахар-песок' },
  { name: 'Sunflower Oil', category: 'oil', unit: 'L', base: 22000, description: 'Масло подсолнечное рафинированное' },
  { name: 'Milk', category: 'dairy', unit: 'L', base: 11000, description: 'Молоко 3,2%' },
  { name: 'Butter', category: 'dairy', unit: 'KG', base: 85000, description: 'Масло сливочное 72,5%' },
  { name: 'Eggs', category: 'dairy', unit: 'PCS', base: 1500, description: 'Яйца куриные, категория С1' },
  { name: 'Chicken', category: 'other', unit: 'KG', base: 38000, description: 'Курица охлаждённая, тушка' },
  { name: 'Salt', category: 'other', unit: 'KG', base: 2500, description: 'Соль пищевая йодированная' },
];

interface SupplierSeed {
  name: string;
  district: string;
  zones: string[];
  delivery: number;
  days: number;
  categories: CategorySlug[];
  factor: Partial<Record<CategorySlug, number>> & { default: number };
  moq: [number, number];
  stock: [number, number];
  ageHours: [number, number];
  description: string;
}

const SUPPLIERS: SupplierSeed[] = [
  {
    name: 'Supplier A',
    district: 'Chilonzor',
    zones: ['Chilonzor', 'Uchtepa', 'Yakkasaroy', 'Olmazor', 'Sergeli', 'Shaykhontohur'],
    delivery: 25000,
    days: 1,
    categories: [...CATEGORY_SLUGS],
    factor: { default: 1.0 },
    moq: [1, 5],
    stock: [150, 800],
    ageHours: [1, 18],
    description: 'Демо-поставщик широкого ассортимента для розницы.',
  },
  {
    name: 'Supplier B',
    district: 'Yunusobod',
    zones: ['ALL'],
    delivery: 40000,
    days: 1,
    categories: ['vegetables', 'fruits', 'grains'],
    factor: { default: 1.04, vegetables: 0.86, fruits: 0.95 },
    moq: [10, 20],
    stock: [200, 1500],
    ageHours: [2, 20],
    description: 'Демо-оптовик овощей и фруктов, доставка по всему Ташкенту.',
  },
  {
    name: 'Supplier C',
    district: 'Sergeli',
    zones: ['Sergeli', 'Chilonzor', 'Yangihayot', 'Bektemir'],
    delivery: 15000,
    days: 2,
    categories: ['dairy', 'other', 'oil', 'flour', 'sugar'],
    factor: { default: 0.97, dairy: 0.9, other: 0.92 },
    moq: [5, 20],
    stock: [60, 400],
    ageHours: [3, 22],
    description: 'Демо-поставщик молочной продукции, мяса птицы и бакалеи.',
  },
  {
    name: 'Supplier D',
    district: 'Mirzo Ulugbek',
    zones: ['Mirzo Ulugbek', 'Yunusobod', 'Yashnobod', 'Mirobod'],
    delivery: 20000,
    days: 1,
    categories: ['grains', 'flour', 'sugar', 'oil', 'other'],
    factor: { default: 0.88 },
    moq: [5, 10],
    stock: [100, 900],
    ageHours: [6, 40],
    description: 'Демо-поставщик бакалеи. Доставляет только в восточные районы.',
  },
  {
    name: 'Supplier E',
    district: 'Yakkasaroy',
    zones: ['ALL'],
    delivery: 30000,
    days: 3,
    categories: ['vegetables', 'grains', 'flour', 'sugar', 'oil', 'fruits'],
    factor: { default: 0.84 },
    moq: [50, 100],
    stock: [300, 3000],
    ageHours: [20, 60],
    description: 'Демо-крупный оптовик: низкие цены, высокий минимальный заказ, цены обновляются реже.',
  },
];

async function main() {
  console.log('Seeding DEMO DATA…');
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.optimizationAllocation.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchase.deleteMany(),
    prisma.optimizationRun.deleteMany(),
    prisma.basketItem.deleteMany(),
    prisma.basket.deleteMany(),
    prisma.priceHistory.deleteMany(),
    prisma.supplierOffer.deleteMany(),
    prisma.review.deleteMany(),
    prisma.supplierMetrics.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.product.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.business.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const categories = new Map<CategorySlug, string>();
  for (const [i, slug] of CATEGORY_SLUGS.entries()) {
    const c = await prisma.productCategory.create({
      data: { slug, name: CATEGORY_LABELS[slug], sortOrder: i },
    });
    categories.set(slug, c.id);
  }

  const products = new Map<string, { id: string; seed: ProductSeed }>();
  for (const p of PRODUCTS) {
    const row = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        unit: p.unit,
        categoryId: categories.get(p.category)!,
      },
    });
    products.set(p.name, { id: row.id, seed: p });
  }

  const supplierIds = new Map<string, string>();
  for (const [i, s] of SUPPLIERS.entries()) {
    const letter = s.name.slice(-1).toLowerCase();
    const row = await prisma.supplier.create({
      data: {
        companyName: s.name,
        description: s.description,
        contactPerson: `Demo Contact ${s.name.slice(-1)}`,
        phone: `+998 90 000 00 0${i + 1}`,
        email: `supplier-${letter}@example.com`,
        telegramUsername: null,
        address: `${s.district}, Tashkent (demo address)`,
        district: s.district,
        deliveryZones: s.zones,
        verificationStatus: 'UNVERIFIED',
        isDemo: true,
      },
    });
    supplierIds.set(s.name, row.id);
  }

  // Offers + 90 days of price history
  const historyRows: Prisma.PriceHistoryCreateManyInput[] = [];
  for (const s of SUPPLIERS) {
    for (const { id: productId, seed: p } of products.values()) {
      if (!s.categories.includes(p.category)) continue;
      // Not every supplier carries everything even within its categories
      if (s.name !== 'Supplier A' && rnd() < 0.15) continue;

      const factor = (s.factor[p.category] ?? s.factor.default) * between(0.95, 1.05);
      const step = p.base >= 10000 ? 100 : 50;
      const price = roundTo(p.base * factor, step);
      const unitScale = p.unit === 'PCS' ? 30 : 1;
      let moq = Math.round(between(s.moq[0], s.moq[1])) * unitScale;
      let stock = Math.round(between(s.stock[0], s.stock[1])) * unitScale;
      if (p.name === 'Butter' || p.name === 'Chicken') {
        moq = Math.max(1, Math.round(moq / 5));
        stock = Math.round(stock / 4);
      }
      let lastUpdated = hoursAgo(between(s.ageHours[0], s.ageHours[1]));
      let expiresAt: Date | null = new Date(NOW.getTime() + between(3, 14) * 86_400_000);
      let availabilityStatus: 'AVAILABLE' | 'LIMITED' | 'OUT_OF_STOCK' =
        stock < 100 * unitScale ? 'LIMITED' : 'AVAILABLE';

      // Edge cases for demonstration of validation
      if (s.name === 'Supplier E' && (p.name === 'Rice' || p.name === 'Apples')) {
        lastUpdated = hoursAgo(between(80, 110)); // stale
      }
      if (s.name === 'Supplier E' && p.name === 'Sugar') {
        expiresAt = hoursAgo(5); // expired
      }
      if (s.name === 'Supplier B' && p.name === 'Cucumbers') {
        availabilityStatus = 'OUT_OF_STOCK';
        stock = 0;
      }
      if (s.name === 'Supplier A' && p.name === 'Tomatoes') {
        stock = 40; // limited stock forces split for large tomato orders
        availabilityStatus = 'LIMITED';
      }

      const offer = await prisma.supplierOffer.create({
        data: {
          supplierId: supplierIds.get(s.name)!,
          productId,
          price,
          currency: 'UZS',
          unit: p.unit,
          minOrderQuantity: moq,
          availableQuantity: stock,
          deliveryCost: s.delivery,
          deliveryZones: s.zones,
          estimatedDeliveryDays: s.days,
          lastUpdated,
          expiresAt,
          availabilityStatus,
          verificationStatus: 'UNVERIFIED',
          isDemo: true,
        },
      });

      // Random walk backwards from the current price
      let hp = price;
      const points: { date: Date; price: number }[] = [{ date: lastUpdated, price }];
      for (let d = 1; d <= 90; d++) {
        const drift = p.category === 'vegetables' ? 0.025 : 0.012;
        hp = roundTo(hp * (1 + between(-drift, drift * 0.9)), step);
        // History is anchored to the offer's last update, one point per day before it
        points.push({ date: new Date(lastUpdated.getTime() - d * 86_400_000), price: Math.max(step, hp) });
      }
      // Anomalous jump to be flagged by DataQualityService
      if (s.name === 'Supplier E' && p.name === 'Bananas') {
        points[1] = { ...points[1], price: roundTo(price * 0.6, step) };
      }
      for (const pt of points) {
        historyRows.push({
          offerId: offer.id,
          productId,
          supplierId: offer.supplierId,
          price: pt.price,
          currency: 'UZS',
          unit: p.unit,
          recordedAt: pt.date,
          isDemo: true,
        });
      }
    }
  }
  await prisma.priceHistory.createMany({ data: historyRows });

  // Reviews & metrics (demo). Supplier D has none → trust score shows Insufficient Data.
  const reviewPlan: Record<string, number[]> = {
    'Supplier A': [5, 4, 5, 4, 4, 5, 3, 5],
    'Supplier B': [4, 4, 3, 5, 4, 4],
    'Supplier C': [5, 4, 4],
    'Supplier E': [3, 4, 2, 4, 3],
  };
  const comments = [
    'Привезли вовремя, качество соответствует.',
    'Цены как в прайсе, без сюрпризов.',
    'Была задержка на полдня, но предупредили.',
    'Хорошая упаковка, всё целое.',
    'Минимальный заказ высоковат для маленькой точки.',
  ];
  for (const [name, ratings] of Object.entries(reviewPlan)) {
    const supplierId = supplierIds.get(name)!;
    for (const [i, rating] of ratings.entries()) {
      await prisma.review.create({
        data: {
          supplierId,
          authorName: `Demo buyer ${i + 1}`,
          rating,
          comment: comments[(i + name.length) % comments.length],
          isDemo: true,
          createdAt: daysAgo(3 + i * 9),
        },
      });
    }
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    await prisma.supplier.update({ where: { id: supplierId }, data: { rating: avg.toFixed(2) } });
  }
  const metricsPlan: Record<string, [number, number, number, number, number, number]> = {
    // completed, cancelled, onTime, totalDeliveries, priceMatched, priceChecked
    'Supplier A': [42, 2, 39, 42, 40, 42],
    'Supplier B': [31, 4, 26, 31, 27, 31],
    'Supplier C': [3, 0, 3, 3, 3, 3],
    'Supplier E': [18, 3, 13, 18, 14, 18],
  };
  for (const [name, m] of Object.entries(metricsPlan)) {
    await prisma.supplierMetrics.create({
      data: {
        supplierId: supplierIds.get(name)!,
        completedOrders: m[0],
        cancelledOrders: m[1],
        onTimeDeliveries: m[2],
        totalDeliveries: m[3],
        priceMatchedOrders: m[4],
        priceCheckedOrders: m[5],
        isDemo: true,
      },
    });
  }

  // Dev user (used by POST /api/auth/dev)
  const user = await prisma.user.create({
    data: {
      telegramId: 100000001n,
      firstName: 'Demo',
      lastName: 'Owner',
      username: 'demo_shop_owner',
      isDevUser: true,
      business: { create: { name: 'Demo Shop', type: 'Продуктовый магазин', district: 'Chilonzor' } },
    },
  });

  // Historical demo purchases for charts (no baseline → no savings claimed)
  const offers = await prisma.supplierOffer.findMany({ where: { supplier: { companyName: 'Supplier A' } } });
  for (let k = 0; k < 6; k++) {
    const picked = offers.filter((_, i) => (i + k) % 4 === 0).slice(0, 4);
    const items = picked.map((o) => {
      const quantity = new Prisma.Decimal(Math.round(between(10, 60)));
      const unitPrice = new Prisma.Decimal(o.price).times(between(0.94, 1.04)).toDecimalPlaces(0);
      return { o, quantity, unitPrice, total: unitPrice.times(quantity) };
    });
    const productsCost = items.reduce((s, i) => s.plus(i.total), new Prisma.Decimal(0));
    const deliveryCost = new Prisma.Decimal(25000);
    await prisma.purchase.create({
      data: {
        userId: user.id,
        status: 'COMPLETED',
        productsCost,
        deliveryCost,
        totalCost: productsCost.plus(deliveryCost),
        isDemo: true,
        note: 'Демонстрационная закупка',
        createdAt: daysAgo(85 - k * 14),
        items: {
          create: items.map((i) => ({
            productId: i.o.productId,
            supplierId: i.o.supplierId,
            unit: i.o.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.total,
          })),
        },
      },
    });
  }

  const dq = await runDataQualityChecks(prisma, NOW);
  console.log('Data quality:', dq);

  const counts = {
    products: await prisma.product.count(),
    suppliers: await prisma.supplier.count(),
    offers: await prisma.supplierOffer.count(),
    priceHistory: await prisma.priceHistory.count(),
    reviews: await prisma.review.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
