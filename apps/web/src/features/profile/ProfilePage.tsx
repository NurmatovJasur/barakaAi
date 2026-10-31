import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { isTelegram } from '../../lib/telegram';
import { Badge, Button, Card, SectionTitle } from '../../components/ui';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  if (!user) return null;
  return (
    <div>
      <Card className="p-4">
        <p className="text-lg font-semibold">
          {user.firstName} {user.lastName}
        </p>
        {user.username && <p className="text-sm text-muted">@{user.username}</p>}
        <div className="mt-2 flex gap-1">
          <Badge tone="primary">{isTelegram() ? 'Вход через Telegram' : 'DEV_MODE: тестовый вход'}</Badge>
        </div>
      </Card>

      <SectionTitle>Бизнес</SectionTitle>
      <Card className="divide-y divide-line text-sm">
        <div className="flex justify-between px-3 py-2.5">
          <span className="text-muted">Название</span>
          <span>{user.business?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between px-3 py-2.5">
          <span className="text-muted">Район доставки</span>
          <span>{user.business?.district ?? '—'}</span>
        </div>
      </Card>

      <Card className="mt-3">
        <Link to="/purchases" className="flex items-center gap-3 px-3 py-3 text-sm">
          <Receipt className="size-4 text-primary" /> Мои закупки
          <ChevronRight className="ml-auto size-4 text-muted" />
        </Link>
      </Card>

      <SectionTitle>О данных</SectionTitle>
      <Card className="p-3 text-xs text-muted">
        Все поставщики, цены, история цен, отзывы и метрики в этой версии — демонстрационные (DEMO DATA) и не
        отражают реальный рынок. Экономия — расчётная оценка, не подтверждённая сделками. Помощник работает по правилам,
        без генеративной модели.
      </Card>

      {!isTelegram() && (
        <Button
          variant="danger"
          className="mt-4 w-full"
          onClick={async () => {
            await api.auth.logout().catch(() => undefined);
            qc.clear();
            logout();
          }}
        >
          <LogOut className="size-4" /> Выйти
        </Button>
      )}
    </div>
  );
}
