import clsx from 'clsx';
import { BarChart3, Bot, ChevronLeft, Home, LayoutGrid, ShoppingCart, Truck, User, WifiOff } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useBackButton } from '../hooks/useTelegramButtons';
import { useOnline } from '../hooks/useOnline';
import { useBasket } from '../hooks/useBasket';
import { DemoBadge } from '../components/ui';
import { haptic, isTelegram } from '../lib/telegram';

const TABS = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/catalog', label: 'Каталог', icon: LayoutGrid },
  { to: '/basket', label: 'Закупка', icon: ShoppingCart },
  { to: '/suppliers', label: 'Поставщики', icon: Truck, end: true },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
];
const ROOTS = new Set(TABS.map((t) => t.to));

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const basket = useBasket();
  const count = basket.data?.items.length ?? 0;
  const isRoot = ROOTS.has(location.pathname);

  useBackButton(!isRoot, () => navigate(-1));

  return (
    <div className="mx-auto flex min-h-[var(--app-height)] max-w-xl flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 pt-[calc(var(--safe-top)+var(--content-top))] backdrop-blur">
        <div className="flex h-12 items-center gap-2 px-4">
          {!isRoot && !isTelegram() && (
            <button onClick={() => navigate(-1)} className="-ml-2 flex size-8 items-center justify-center text-primary" aria-label="Назад">
              <ChevronLeft className="size-6" />
            </button>
          )}
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-white">
            <svg viewBox="0 0 32 32" className="size-4" aria-hidden>
              <path d="M6 22l6-7 5 4 9-11" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="truncate text-[15px] font-semibold tracking-tight">Smart Market Prices</span>
          <DemoBadge className="ml-1" />
          <NavLink to="/profile" aria-label="Профиль" className="ml-auto flex size-8 items-center justify-center rounded-full bg-surface-2 text-muted">
            <User className="size-4" />
          </NavLink>
        </div>
        {!online && (
          <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft py-1.5 text-xs font-medium text-warning">
            <WifiOff className="size-3.5" /> Нет подключения к интернету
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-3 pb-[calc(140px+var(--safe-bottom))]">
        <Outlet />
      </main>

      {/* Hidden where a sticky primary action occupies the same spot */}
      {!['/assistant', '/basket'].includes(location.pathname) && !location.pathname.startsWith('/optimizer/') && (
        <NavLink
          to="/assistant"
          onClick={() => haptic.impact('medium')}
          aria-label="AI-помощник"
          className="fixed right-4 bottom-[calc(76px+var(--safe-bottom))] z-30 flex h-12 items-center gap-2 rounded-full bg-primary pr-4 pl-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/30"
        >
          <Bot className="size-5" /> Помощник
        </NavLink>
      )}

      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[var(--safe-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => haptic.select()}
              className={({ isActive }) =>
                clsx('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')
              }
            >
              <Icon className="size-5" />
              {label}
              {to === '/basket' && count > 0 && (
                <span className="absolute top-2 left-1/2 ml-2 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white">
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
