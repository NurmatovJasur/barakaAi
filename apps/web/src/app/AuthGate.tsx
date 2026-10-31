import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../stores/auth';
import { getInitData, isTelegram } from '../lib/telegram';
import { restoreBasketFromSnapshot } from '../hooks/useBasket';
import { Button, Skeleton } from '../components/ui';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

/**
 * Inside Telegram: exchanges signed initData for a session token (verified on the server).
 * Outside Telegram: uses the dev login only when VITE_DEV_MODE=true.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { token, user, setSession, setUser } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        if (token && !user) {
          try {
            const me = await api.auth.me();
            if (!cancelled) setUser(me);
            return;
          } catch {
            /* token expired — fall through to a fresh login */
          }
        }
        if (token && user) return;
        let res;
        if (isTelegram()) res = await api.auth.telegram(getInitData());
        else if (DEV_MODE) res = await api.auth.dev();
        else throw new Error('Откройте приложение через Telegram-бота.');
        if (cancelled) return;
        setSession(res.token, res.user);
        const basket = await restoreBasketFromSnapshot();
        if (basket) qc.setQueryData(['basket'], basket);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && !('status' in e) ? e.message : errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, attempt]);

  if (error) {
    return (
      <div className="flex min-h-[var(--app-height)] flex-col items-center justify-center px-8 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldAlert className="size-6" />
        </div>
        <p className="font-semibold">Ошибка авторизации</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
          Повторить
        </Button>
      </div>
    );
  }
  if (!token || !user) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }
  return <>{children}</>;
}
