import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BasketItemInput } from '@smp/shared';

/**
 * Local snapshot of the basket. The server basket is the source of truth; this snapshot lets the app
 * restore the basket after re-opening (e.g. new Telegram session) and works as an offline cache.
 */
interface BasketSnapshotState {
  items: BasketItemInput[];
  setItems: (items: BasketItemInput[]) => void;
  clear: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useBasketSnapshot = create<BasketSnapshotState>()(
  persist(
    (set) => ({
      items: [],
      setItems: (items) => set({ items }),
      clear: () => set({ items: [] }),
    }),
    { name: 'smp.basket', storage: safeStorage, version: 1 },
  ),
);
