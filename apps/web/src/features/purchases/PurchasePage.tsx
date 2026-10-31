import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PURCHASE_TRANSITIONS, type PurchaseStatus } from '@smp/shared';
import { api, errorMessage } from '../../services/api';
import { useBasketMutations } from '../../hooks/useBasket';
import { haptic, openExternal } from '../../lib/telegram';
import { toast } from '../../stores/toast';
import { Badge, Button, Card, ConfirmDialog, ErrorState, SectionTitle, Skeleton } from '../../components/ui';
import { date, quantity, uzs } from '../../utils/format';
import { PURCHASE_STATUS } from './PurchasesPage';

const ACTION_LABEL: Partial<Record<PurchaseStatus, string>> = {
  PLANNED: 'Запланировать',
  CONFIRMED: 'Подтвердить',
  COMPLETED: 'Отметить выполненной',
  CANCELLED: 'Отменить',
};

export function PurchasePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['purchase', id], queryFn: () => api.purchases.get(id) });
  const { replace } = useBasketMutations();
  const [pending, setPending] = useState<PurchaseStatus | null>(null);
  const [confirmRepeat, setConfirmRepeat] = useState(false);

  const setStatus = useMutation({
    mutationFn: (s: PurchaseStatus) => api.purchases.setStatus(id, s),
    onSuccess: (p) => {
      haptic.success();
      qc.setQueryData(['purchase', id], p);
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Статус: ${PURCHASE_STATUS[p.status].label}`);
      setPending(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const repeat = useMutation({
    mutationFn: () => api.purchases.repeat(id),
    onSuccess: (b) => {
      replace(b);
      haptic.success();
      toast.success('Товары перенесены в корзину');
      navigate('/basket');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton className="h-64" />;
  const p = q.data;
  const st = PURCHASE_STATUS[p.status];
  const bySupplier = new Map<string, NonNullable<typeof p.items>>();
  for (const i of p.items ?? []) bySupplier.set(i.supplierId, [...(bySupplier.get(i.supplierId) ?? []), i]);

  return (
    <div>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Закупка от {date(p.createdAt)}</p>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <p className="tabular mt-1 text-3xl font-semibold">{uzs(p.totalCost)}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <span className="text-muted">Товары: <b className="text-ink">{uzs(p.productsCost)}</b></span>
          <span className="text-muted">Доставка: <b className="text-ink">{uzs(p.deliveryCost)}</b></span>
        </div>
        {p.estimatedSavings && (
          <p className="mt-2 text-xs text-muted">
            Расчётная экономия: <b className={Number(p.estimatedSavings) >= 0 ? 'text-success' : 'text-danger'}>{uzs(p.estimatedSavings)}</b> (не подтверждена)
          </p>
        )}
        {p.note && <p className="mt-2 text-xs text-muted">{p.note}</p>}
        <p className="mt-2 text-[11px] text-muted">Оплата в приложении не производится. Свяжитесь с поставщиками напрямую.</p>
      </Card>

      {PURCHASE_TRANSITIONS[p.status].length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {PURCHASE_TRANSITIONS[p.status].map((s) => (
            <Button key={s} size="sm" variant={s === 'CANCELLED' ? 'danger' : 'secondary'} onClick={() => setPending(s)}>
              {ACTION_LABEL[s]}
            </Button>
          ))}
        </div>
      )}

      <SectionTitle>Состав по поставщикам</SectionTitle>
      <div className="space-y-2">
        {[...bySupplier.entries()].map(([sid, items]) => {
          const contact = p.suppliers?.find((s) => s.id === sid);
          return (
            <Card key={sid} className="overflow-hidden">
              <Link to={`/suppliers/${sid}`} className="block border-b border-line bg-surface-2 px-3 py-2 font-semibold">
                {items[0].supplierName}
              </Link>
              {items.map((i) => (
                <div key={i.id} className="tabular flex items-center justify-between border-b border-line px-3 py-2 text-sm last:border-0">
                  <span>{i.productName}</span>
                  <span className="text-muted">{quantity(i.quantity, i.unit)}</span>
                  <span className="font-medium">{uzs(i.totalPrice)}</span>
                </div>
              ))}
              {contact && (
                <div className="flex gap-3 border-t border-line px-3 py-2 text-xs font-medium text-primary">
                  {contact.phone && (
                    <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="flex items-center gap-1">
                      <Phone className="size-3.5" /> Позвонить
                    </a>
                  )}
                  {contact.telegramUsername && (
                    <button onClick={() => openExternal(`https://t.me/${contact.telegramUsername}`)} className="flex items-center gap-1">
                      <MessageCircle className="size-3.5" /> Telegram
                    </button>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1">
                      <Mail className="size-3.5" /> Email
                    </a>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Button variant="secondary" className="mt-4 w-full" onClick={() => setConfirmRepeat(true)}>
        <RotateCcw className="size-4" /> Повторить закупку
      </Button>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${ACTION_LABEL[pending]}?` : ''}
        text={pending === 'CANCELLED' ? 'Отменённую закупку нельзя вернуть в работу.' : undefined}
        danger={pending === 'CANCELLED'}
        loading={setStatus.isPending}
        onConfirm={() => pending && setStatus.mutate(pending)}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={confirmRepeat}
        title="Повторить закупку?"
        text="Текущая корзина будет заменена товарами из этой закупки. Затем запустите оптимизацию — цены могли измениться."
        loading={repeat.isPending}
        onConfirm={() => repeat.mutate()}
        onClose={() => setConfirmRepeat(false)}
      />
    </div>
  );
}
