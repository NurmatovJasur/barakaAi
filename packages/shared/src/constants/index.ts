export const CATEGORY_SLUGS = [
  'vegetables',
  'fruits',
  'grains',
  'flour',
  'sugar',
  'oil',
  'dairy',
  'other',
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  vegetables: 'Овощи',
  fruits: 'Фрукты',
  grains: 'Крупы',
  flour: 'Мука',
  sugar: 'Сахар',
  oil: 'Масло',
  dairy: 'Молочное',
  other: 'Другое',
};

export const UNITS = ['KG', 'L', 'PCS', 'PACK', 'DOZEN'] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  KG: 'кг',
  L: 'л',
  PCS: 'шт',
  PACK: 'уп',
  DOZEN: 'дюж',
};

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const AVAILABILITY_STATUSES = ['AVAILABLE', 'LIMITED', 'OUT_OF_STOCK'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const DATA_QUALITY_STATUSES = ['VALID', 'WARNING', 'INVALID', 'EXPIRED'] as const;
export type DataQualityStatus = (typeof DATA_QUALITY_STATUSES)[number];

export const PURCHASE_STATUSES = ['DRAFT', 'PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/** Allowed purchase status transitions */
export const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const OPTIMIZATION_STATUSES = ['OPTIMAL', 'FEASIBLE_LIMIT_REACHED', 'INFEASIBLE'] as const;
export type OptimizationStatus = (typeof OPTIMIZATION_STATUSES)[number];

export const SCENARIO_KINDS = ['SINGLE', 'MULTI', 'BALANCED_2', 'BALANCED_3'] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const FRESHNESS_LEVELS = ['FRESH', 'ATTENTION', 'STALE'] as const;
export type FreshnessLevel = (typeof FRESHNESS_LEVELS)[number];

export const DEFAULT_FRESHNESS_POLICY = { freshHours: 24, staleHours: 72 };

export const TASHKENT_DISTRICTS = [
  'Chilonzor',
  'Yunusobod',
  'Mirzo Ulugbek',
  'Yakkasaroy',
  'Shaykhontohur',
  'Olmazor',
  'Sergeli',
  'Uchtepa',
  'Yashnobod',
  'Mirobod',
  'Bektemir',
  'Yangihayot',
] as const;

export const MAX_BASKET_QUANTITY = 100_000;
export const MAX_BASKET_ITEMS = 30;
export const CURRENCY = 'UZS';

/** Russian display names for catalog products (DB names are English). */
export const PRODUCT_NAMES_RU: Record<string, string> = {
  Potatoes: 'Картофель',
  Onions: 'Лук',
  Tomatoes: 'Помидоры',
  Cucumbers: 'Огурцы',
  Carrots: 'Морковь',
  Cabbage: 'Капуста',
  Apples: 'Яблоки',
  Bananas: 'Бананы',
  Rice: 'Рис',
  Lentils: 'Чечевица',
  Beans: 'Фасоль',
  Pasta: 'Макароны',
  Flour: 'Мука',
  Sugar: 'Сахар',
  'Sunflower Oil': 'Подсолнечное масло',
  Milk: 'Молоко',
  Butter: 'Сливочное масло',
  Eggs: 'Яйца',
  Chicken: 'Курица',
  Salt: 'Соль',
};

export const productLabel = (name: string) => PRODUCT_NAMES_RU[name] ?? name;
