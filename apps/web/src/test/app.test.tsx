import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BasketDto } from '@smp/shared';
import { basketWith, page, products, run } from './fixtures';

const apiMock = vi.hoisted(() => ({
  products: { list: vi.fn(), get: vi.fn(), offers: vi.fn() },
  basket: { get: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn(), clear: vi.fn() },
  optimizer: { calculate: vi.fn(), get: vi.fn(), save: vi.fn() },
  dashboard: { stats: vi.fn(), recentPurchases: vi.fn(), priceChanges: vi.fn() },
  analytics: { overview: vi.fn(), savings: vi.fn(), prices: vi.fn() },
  suppliers: { list: vi.fn(), get: vi.fn(), offers: vi.fn(), reviews: vi.fn() },
  purchases: { list: vi.fn(), get: vi.fn(), setStatus: vi.fn(), repeat: vi.fn() },
  assistant: { chat: vi.fn() },
  auth: { me: vi.fn(), dev: vi.fn(), telegram: vi.fn(), logout: vi.fn() },
}));

vi.mock('../services/api', async (orig) => {
  const actual = await orig<typeof import('../services/api')>();
  return { ...actual, api: apiMock };
});

// recharts needs layout APIs that jsdom lacks
vi.mock('recharts', async (orig) => {
  const actual = await orig<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

import { AppRoutes, createQueryClient } from '../app/App';
import { useAuth } from '../stores/auth';
import { ApiError } from '../services/api';
import { Toaster } from '../components/Toaster';

function renderApp(path: string) {
  const qc = createQueryClient();
  qc.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Toaster />
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let basket: BasketDto;

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.setState({
    token: 't',
    user: { id: 'u', telegramId: '1', firstName: 'Demo', lastName: null, username: null, business: { id: 'b', name: 'Demo Shop', district: 'Chilonzor' } },
  });
  basket = basketWith({});
  apiMock.basket.get.mockImplementation(async () => basket);
  apiMock.basket.add.mockImplementation(async (i: { productId: string; quantity: number }) => {
    basket = basketWith({ ...Object.fromEntries(basket.items.map((x) => [x.productId, Number(x.quantity)])), [i.productId]: i.quantity });
    return basket;
  });
  apiMock.basket.update.mockImplementation(async (id: string, q: number) => {
    const item = basket.items.find((x) => x.id === id)!;
    basket = basketWith({ ...Object.fromEntries(basket.items.map((x) => [x.productId, Number(x.quantity)])), [item.productId]: q });
    return basket;
  });
  apiMock.basket.remove.mockImplementation(async (id: string) => {
    basket = basketWith(Object.fromEntries(basket.items.filter((x) => x.id !== id).map((x) => [x.productId, Number(x.quantity)])));
    return basket;
  });
  apiMock.products.list.mockImplementation(async (q: { search?: string }) =>
    page(products.filter((p) => !q.search || p.name.toLowerCase().includes(q.search.toLowerCase()))),
  );
  apiMock.optimizer.calculate.mockResolvedValue(run);
  apiMock.optimizer.get.mockResolvedValue(run);
  apiMock.suppliers.list.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 });
});

describe('Navigation', () => {
  it('renders the bottom navigation with five tabs and the assistant button', async () => {
    renderApp('/suppliers');
    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    for (const label of ['Главная', 'Каталог', 'Закупка', 'Поставщики', 'Аналитика']) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('AI-помощник')).toBeInTheDocument();
    expect(screen.getAllByText('DEMO DATA').length).toBeGreaterThan(0);
    await userEvent.click(within(nav).getByText('Каталог'));
    expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
  });
});

describe('Catalog', () => {
  it('searches products and always shows price with unit', async () => {
    renderApp('/catalog');
    expect(await screen.findByText('Картофель')).toBeInTheDocument();
    expect(screen.getByText('3 300 UZS/кг')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Поиск товара'), 'лук');
    await waitFor(() => expect(screen.queryByText('Картофель')).not.toBeInTheDocument());
    expect(screen.getByText('Лук')).toBeInTheDocument();
  });

  it('adds a product to the basket', async () => {
    renderApp('/catalog');
    await userEvent.click(await screen.findByLabelText('Добавить Картофель'));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('Количество');
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    await userEvent.click(within(dialog).getByText('В закупку'));
    await waitFor(() => expect(apiMock.basket.add).toHaveBeenCalled());
    expect(apiMock.basket.add.mock.calls[0][0]).toEqual({ productId: products[0].id, quantity: 100, unit: 'KG' });
    expect(await screen.findByText('Добавлено в закупку')).toBeInTheDocument();
  });

  it('rejects an invalid quantity', async () => {
    renderApp('/catalog');
    await userEvent.click(await screen.findByLabelText('Добавить Лук'));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('Количество');
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(within(dialog).getByText('Количество должно быть больше нуля')).toBeInTheDocument();
    expect(within(dialog).getByText('В закупку').closest('button')).toBeDisabled();
  });
});

describe('Basket', () => {
  beforeEach(() => {
    basket = basketWith({ [products[0].id]: 100, [products[1].id]: 50 });
  });

  it('updates quantity and removes items', async () => {
    renderApp('/basket');
    const input = await screen.findByLabelText('Количество Картофель');
    await userEvent.clear(input);
    await userEvent.type(input, '120{enter}');
    await waitFor(() => expect(apiMock.basket.update).toHaveBeenCalledWith('item-0', 120));
    await userEvent.click(screen.getByLabelText('Удалить Лук'));
    await waitFor(() => expect(screen.queryByText('Лук')).not.toBeInTheDocument());
  });

  it('runs optimization and shows the result', async () => {
    renderApp('/basket');
    await userEvent.click(await screen.findByRole('button', { name: /Оптимизировать закупку/ }));
    await waitFor(() => expect(apiMock.optimizer.calculate).toHaveBeenCalled());
    const body = apiMock.optimizer.calculate.mock.calls[0][0];
    expect(body.items).toHaveLength(2);
    expect(await screen.findByText('Результат оптимизации')).toBeInTheDocument();
    expect(screen.getByText('Рекомендуем')).toBeInTheDocument();
    expect(screen.getAllByText('540 000 UZS').length).toBeGreaterThan(0);
    expect(screen.getByText('Supplier A')).toBeInTheDocument();
    expect(screen.getByText('Supplier B')).toBeInTheDocument();
    expect(screen.getByText('60 000 UZS')).toBeInTheDocument();
  });

  it('shows an empty state when the basket is empty', async () => {
    basket = basketWith({});
    renderApp('/basket');
    expect(await screen.findByText('Корзина закупки пуста')).toBeInTheDocument();
  });
});

describe('Error states', () => {
  it('shows a readable error and retry when the backend is unavailable', async () => {
    apiMock.products.list.mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/catalog');
    expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.getByText(/Сервер недоступен/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Повторить/ })).toBeInTheDocument();
  });

  it('shows an infeasible optimization result clearly', async () => {
    apiMock.optimizer.get.mockResolvedValue({
      ...run,
      optimizationStatus: 'INFEASIBLE',
      recommended: null,
      warnings: [{ code: 'NO_ELIGIBLE_OFFERS', message: 'Лук: нет допустимых предложений.' }],
    });
    renderApp(`/optimizer/${run.id}`);
    expect(await screen.findByText('Допустимый план не найден')).toBeInTheDocument();
    expect(screen.getByText('Лук: нет допустимых предложений.')).toBeInTheDocument();
  });

  it('shows API error messages from the server', async () => {
    apiMock.optimizer.get.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Расчёт не найден'));
    renderApp(`/optimizer/${run.id}`);
    expect(await screen.findByText('Расчёт не найден')).toBeInTheDocument();
  });
});
