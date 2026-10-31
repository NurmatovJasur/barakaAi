import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthGate } from './AuthGate';
import { Toaster } from '../components/Toaster';
import { Button, EmptyState } from '../components/ui';
import { ApiError } from '../services/api';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { CatalogPage } from '../features/products/CatalogPage';
import { ProductPage } from '../features/products/ProductPage';
import { BasketPage } from '../features/basket/BasketPage';
import { OptimizationPage } from '../features/optimizer/OptimizationPage';
import { SuppliersPage } from '../features/suppliers/SuppliersPage';
import { SupplierPage } from '../features/suppliers/SupplierPage';
import { AnalyticsPage } from '../features/analytics/AnalyticsPage';
import { PurchasesPage } from '../features/purchases/PurchasesPage';
import { PurchasePage } from '../features/purchases/PurchasePage';
import { AssistantPage } from '../features/assistant/AssistantPage';
import { ProfilePage } from '../features/profile/ProfilePage';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
      },
    },
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <EmptyState
          title="Что-то сломалось"
          text="Обновите страницу. Если ошибка повторится — напишите нам."
          action={<Button onClick={() => window.location.reload()}>Обновить</Button>}
        />
      );
    }
    return this.props.children;
  }
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="products/:id" element={<ProductPage />} />
        <Route path="basket" element={<BasketPage />} />
        <Route path="optimizer/:id" element={<OptimizationPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/:id" element={<SupplierPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="purchases/:id" element={<PurchasePage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<EmptyState title="Страница не найдена" />} />
      </Route>
    </Routes>
  );
}

const queryClient = createQueryClient();

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Toaster />
          <AuthGate>
            <AppRoutes />
          </AuthGate>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
