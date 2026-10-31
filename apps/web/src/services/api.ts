import type {
  AnalyticsOverviewDto,
  AssistantReplyDto,
  AuthResponse,
  BasketDto,
  BasketItemInput,
  DashboardStatsDto,
  OfferDto,
  OptimizationRunDto,
  OptimizerRequest,
  Paginated,
  PriceChangeDto,
  ProductDetailDto,
  ProductPriceAnalyticsDto,
  ProductSummaryDto,
  PurchaseDto,
  PurchaseStatus,
  ReviewDto,
  SavingsAnalyticsDto,
  ScenarioKind,
  SupplierDetailDto,
  SupplierSummaryDto,
  UserDto,
} from '@smp/shared';
import { useAuth } from '../stores/auth';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Human-readable message for any thrown error (network, HTTP, unknown). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof TypeError) return 'Сервер недоступен. Проверьте интернет и попробуйте снова.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(0, 'OFFLINE', 'Нет подключения к интернету');
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) useAuth.getState().logout();
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? `Ошибка сервера (${res.status})`,
    );
  }
  return body as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    telegram: (initData: string) => request<AuthResponse>('/auth/telegram', { method: 'POST', json: { initData } }),
    dev: () => request<AuthResponse>('/auth/dev', { method: 'POST', json: {} }),
    me: () => request<UserDto>('/auth/me'),
    logout: () => request<void>('/auth/logout', { method: 'POST', json: {} }),
  },
  dashboard: {
    stats: () => request<DashboardStatsDto>('/dashboard/stats'),
    recentPurchases: () => request<PurchaseDto[]>('/dashboard/recent-purchases'),
    priceChanges: (direction?: 'up' | 'down') =>
      request<PriceChangeDto[]>(`/dashboard/price-changes${qs({ direction })}`),
  },
  products: {
    list: (q: { page?: number; pageSize?: number; search?: string; category?: string; sort?: string }) =>
      request<Paginated<ProductSummaryDto>>(`/products${qs(q)}`),
    get: (id: string) => request<ProductDetailDto>(`/products/${id}`),
    offers: (id: string) => request<OfferDto[]>(`/products/${id}/offers`),
  },
  suppliers: {
    list: (q: { page?: number; pageSize?: number; search?: string }) =>
      request<Paginated<SupplierSummaryDto>>(`/suppliers${qs(q)}`),
    get: (id: string) => request<SupplierDetailDto>(`/suppliers/${id}`),
    offers: (id: string) => request<OfferDto[]>(`/suppliers/${id}/offers`),
    reviews: (id: string, page = 1) => request<Paginated<ReviewDto>>(`/suppliers/${id}/reviews${qs({ page, pageSize: 10 })}`),
  },
  basket: {
    get: () => request<BasketDto>('/basket'),
    add: (item: BasketItemInput) => request<BasketDto>('/basket/items', { method: 'POST', json: item }),
    update: (id: string, quantity: number) =>
      request<BasketDto>(`/basket/items/${id}`, { method: 'PATCH', json: { quantity } }),
    remove: (id: string) => request<BasketDto>(`/basket/items/${id}`, { method: 'DELETE' }),
    clear: () => request<BasketDto>('/basket', { method: 'DELETE' }),
  },
  optimizer: {
    calculate: (body: OptimizerRequest) =>
      request<OptimizationRunDto>('/optimizer/calculate', { method: 'POST', json: body }),
    get: (id: string) => request<OptimizationRunDto>(`/optimizer/${id}`),
    save: (id: string, scenario: ScenarioKind, note?: string) =>
      request<PurchaseDto>(`/optimizer/${id}/save`, { method: 'POST', json: { scenario, note } }),
  },
  analytics: {
    prices: (productId: string, range: '7' | '30' | '90') =>
      request<ProductPriceAnalyticsDto>(`/analytics/prices/${productId}${qs({ range })}`),
    overview: () => request<AnalyticsOverviewDto>('/analytics/overview'),
    savings: () => request<SavingsAnalyticsDto>('/analytics/savings'),
  },
  assistant: {
    chat: (message: string, optimizationRunId?: string) =>
      request<AssistantReplyDto>('/assistant/chat', { method: 'POST', json: { message, optimizationRunId } }),
  },
  purchases: {
    list: (page = 1) => request<Paginated<PurchaseDto>>(`/purchases${qs({ page, pageSize: 20 })}`),
    get: (id: string) => request<PurchaseDto>(`/purchases/${id}`),
    setStatus: (id: string, status: PurchaseStatus) =>
      request<PurchaseDto>(`/purchases/${id}/status`, { method: 'PATCH', json: { status } }),
    repeat: (id: string) => request<BasketDto>(`/purchases/${id}/repeat`, { method: 'POST', json: {} }),
  },
};
