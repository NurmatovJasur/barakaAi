import type {
  AvailabilityStatus,
  CategorySlug,
  DataQualityStatus,
  FreshnessLevel,
  OptimizationStatus,
  PurchaseStatus,
  ScenarioKind,
  Unit,
  VerificationStatus,
} from '../constants/index';

/** Money and quantity values are transported as decimal strings to avoid float errors. */
export type DecimalString = string;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface UserDto {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  business: { id: string; name: string; district: string | null } | null;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface CategoryDto {
  id: string;
  slug: CategorySlug;
  name: string;
}

export interface ProductSummaryDto {
  id: string;
  name: string;
  description: string | null;
  category: CategoryDto;
  unit: Unit;
  imageUrl: string | null;
  offerCount: number;
  minPrice: DecimalString | null;
  avgPrice: DecimalString | null;
  priceUpdatedAt: string | null;
}

export interface ProductDetailDto extends ProductSummaryDto {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfferDto {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  supplierVerification: VerificationStatus;
  price: DecimalString;
  currency: string;
  unit: Unit;
  minOrderQuantity: DecimalString;
  availableQuantity: DecimalString;
  deliveryCost: DecimalString;
  deliveryZones: string[];
  estimatedDeliveryDays: number;
  lastUpdated: string;
  expiresAt: string | null;
  availabilityStatus: AvailabilityStatus;
  verificationStatus: VerificationStatus;
  dataQualityStatus: DataQualityStatus;
  dataQualityNotes: string[];
  freshness: FreshnessLevel;
  isDemo: boolean;
}

export interface TrustScoreDto {
  status: 'OK' | 'INSUFFICIENT_DATA';
  score: number | null;
  components: {
    deliveryReliability: number | null;
    priceAccuracy: number | null;
    completedOrderRate: number | null;
    customerRating: number | null;
    dataFreshness: number | null;
  };
  sampleSize: { orders: number; reviews: number };
  isDemo: boolean;
}

export interface SupplierSummaryDto {
  id: string;
  companyName: string;
  description: string | null;
  district: string;
  deliveryZones: string[];
  rating: DecimalString | null;
  reviewCount: number;
  verificationStatus: VerificationStatus;
  offerCount: number;
  isDemo: boolean;
  isActive: boolean;
}

export interface SupplierDetailDto extends SupplierSummaryDto {
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  telegramUsername: string | null;
  address: string | null;
  createdAt: string;
  trust: TrustScoreDto;
  dealHistory: { purchaseId: string; createdAt: string; status: PurchaseStatus; total: DecimalString }[];
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
  isDemo: boolean;
}

export interface BasketItemDto {
  id: string;
  productId: string;
  productName: string;
  unit: Unit;
  quantity: DecimalString;
  addedAt: string;
  minPrice: DecimalString | null;
  estimatedCost: DecimalString | null;
  offerCount: number;
}

export interface BasketDto {
  id: string;
  items: BasketItemDto[];
  estimatedTotal: DecimalString;
  hasUnpricedItems: boolean;
}

export interface AllocationDto {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  offerId: string;
  unit: Unit;
  quantity: DecimalString;
  unitPrice: DecimalString;
  totalPrice: DecimalString;
}

export interface SupplierGroupDto {
  supplierId: string;
  supplierName: string;
  deliveryCost: DecimalString;
  productsCost: DecimalString;
  estimatedDeliveryDays: number;
  allocations: AllocationDto[];
}

export interface ScenarioResultDto {
  kind: ScenarioKind;
  title: string;
  optimizationStatus: OptimizationStatus;
  feasible: boolean;
  productsCost: DecimalString | null;
  deliveryCost: DecimalString | null;
  totalCost: DecimalString | null;
  supplierCount: number;
  allocations: AllocationDto[];
  suppliers: SupplierGroupDto[];
  baselineCost: DecimalString | null;
  savings: DecimalString | null;
  message: string | null;
}

export interface OptimizerWarningDto {
  code: string;
  message: string;
  productId?: string;
  supplierId?: string;
  offerId?: string;
}

export interface OptimizationRunDto {
  id: string;
  createdAt: string;
  deliveryDistrict: string | null;
  optimizationStatus: OptimizationStatus;
  recommended: ScenarioKind | null;
  explanation: string[];
  scenarios: ScenarioResultDto[];
  warnings: OptimizerWarningDto[];
  evaluations: number;
  items: { productId: string; productName: string; quantity: DecimalString; unit: Unit }[];
  savedPurchaseId: string | null;
}

export interface PurchaseItemDto {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  unit: Unit;
  quantity: DecimalString;
  unitPrice: DecimalString;
  totalPrice: DecimalString;
}

export interface PurchaseDto {
  id: string;
  status: PurchaseStatus;
  scenario: ScenarioKind | null;
  productsCost: DecimalString;
  deliveryCost: DecimalString;
  totalCost: DecimalString;
  estimatedSavings: DecimalString | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  supplierCount: number;
  itemCount: number;
  items?: PurchaseItemDto[];
  suppliers?: { id: string; companyName: string; phone: string | null; telegramUsername: string | null; email: string | null }[];
}

export interface DashboardStatsDto {
  totalProcurementValue: DecimalString;
  availableSuppliers: number;
  availableProducts: number;
  estimatedSavings: DecimalString;
  totalPurchases: number;
  activeOffers: number;
  isDemoData: boolean;
}

export interface PriceChangeDto {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  unit: Unit;
  currency: string;
  previousPrice: DecimalString;
  currentPrice: DecimalString;
  changePercent: number;
  changedAt: string;
}

export interface PriceSeriesPointDto {
  date: string;
  price: DecimalString;
}

export interface PriceSeriesDto {
  offerId: string;
  supplierId: string;
  supplierName: string;
  unit: Unit;
  currency: string;
  current: DecimalString;
  min: DecimalString;
  max: DecimalString;
  avg: DecimalString;
  changePercent: number | null;
  lastUpdated: string;
  points: PriceSeriesPointDto[];
}

export interface ProductPriceAnalyticsDto {
  productId: string;
  productName: string;
  range: number;
  series: PriceSeriesDto[];
  isDemo: boolean;
}

export interface AnalyticsOverviewDto {
  spendingByMonth: { month: string; total: DecimalString }[];
  spendingBySupplier: { supplierId: string; supplierName: string; total: DecimalString }[];
  spendingByCategory: { category: string; total: DecimalString }[];
  priceIndex: { date: string; index: number }[];
  isDemo: boolean;
}

export interface SavingsAnalyticsDto {
  totalEstimatedSavings: DecimalString;
  purchasesWithBaseline: number;
  purchasesWithoutBaseline: number;
  byPurchase: { purchaseId: string; createdAt: string; savings: DecimalString; totalCost: DecimalString }[];
  disclaimer: string;
}

export interface AssistantReplyDto {
  intent: string;
  answer: string;
  facts: { label: string; value: string }[];
  links: { label: string; to: string }[];
  dataSufficient: boolean;
  engine: 'rule-based';
}
