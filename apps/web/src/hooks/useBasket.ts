import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BasketDto, BasketItemInput } from '@smp/shared';
import { api, errorMessage } from '../services/api';
import { useBasketSnapshot } from '../stores/basket';
import { toast } from '../stores/toast';
import { haptic } from '../lib/telegram';

const snapshotOf = (b: BasketDto): BasketItemInput[] =>
  b.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unit: i.unit }));

export function useBasket() {
  return useQuery({ queryKey: ['basket'], queryFn: api.basket.get });
}

const MUTATION_KEY = ['basket-mutation'];

export function useBasketMutations() {
  const qc = useQueryClient();
  const setSnapshot = useBasketSnapshot((s) => s.setItems);
  // Responses of overlapping mutations can arrive out of order, so a later-arriving response may be
  // stale. Apply a response only when no other basket mutation is in flight (the current one still
  // counts as pending here); after the last one settles, refetch the server state.
  const isOnlyMutation = () => qc.isMutating({ mutationKey: MUTATION_KEY }) <= 1;
  const onSuccess = (b: BasketDto) => {
    if (!isOnlyMutation()) return;
    qc.setQueryData(['basket'], b);
    setSnapshot(snapshotOf(b));
  };
  const onSettled = () => {
    if (isOnlyMutation()) qc.invalidateQueries({ queryKey: ['basket'] });
  };
  const onError = (e: unknown) => {
    haptic.error();
    toast.error(errorMessage(e));
  };
  const common = { mutationKey: MUTATION_KEY, onError, onSettled };

  const add = useMutation({
    ...common,
    mutationFn: api.basket.add,
    onSuccess: (b) => {
      onSuccess(b);
      haptic.success();
      toast.success('Добавлено в закупку');
    },
  });
  const update = useMutation({
    ...common,
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.basket.update(id, quantity),
    onSuccess,
  });
  const remove = useMutation({
    ...common,
    mutationFn: api.basket.remove,
    onSuccess: (b) => {
      onSuccess(b);
      haptic.impact('light');
    },
  });
  const clear = useMutation({
    ...common,
    mutationFn: api.basket.clear,
    onSuccess: (b) => {
      onSuccess(b);
      toast.info('Корзина очищена');
    },
  });
  const replace = (b: BasketDto) => {
    qc.setQueryData(['basket'], b);
    setSnapshot(snapshotOf(b));
  };
  return { add, update, remove, clear, replace };
}

/** After login: if the server basket is empty but a local snapshot exists, restore it. */
export async function restoreBasketFromSnapshot(): Promise<BasketDto | null> {
  const snapshot = useBasketSnapshot.getState().items;
  const server = await api.basket.get();
  if (server.items.length > 0 || snapshot.length === 0) {
    useBasketSnapshot.getState().setItems(snapshotOf(server));
    return server;
  }
  let last = server;
  for (const item of snapshot) {
    try {
      last = await api.basket.add(item);
    } catch {
      // product no longer available — skip silently, basket page shows what was restored
    }
  }
  useBasketSnapshot.getState().setItems(snapshotOf(last));
  return last;
}
