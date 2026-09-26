import { create } from "zustand";
import { localRepository } from "@/lib/local-repository";

export interface CartItem {
  lineId?: string;
  productId: string;
  variantId?: string;
  modifierIds?: string[];
  storeSlug: string;
  storeName: string;
  storeCode?: string;
  name: string;
  description: string;
  unitPriceMinor: number;
  currency: string;
  quantity: number;
}

interface CartState {
  storeSlug: string | null;
  storeName: string | null;
  storeCode: string | null;
  items: CartItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addItem: (item: CartItem) => "added" | "replaced-store";
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

type CartDraft = Pick<CartState, "storeSlug" | "storeName" | "storeCode" | "items">;

function persistDraft(state: CartDraft): void {
  void localRepository.saveCartDraft(state);
}

function itemKey(item: Pick<CartItem, "lineId" | "productId">): string {
  return item.lineId ?? item.productId;
}

export const useCartStore = create<CartState>()((set) => ({
  storeSlug: null,
  storeName: null,
  storeCode: null,
  items: [],
  hydrated: false,
  hydrate: async () => {
    const draft = await localRepository.getCartDraft<CartDraft>();
    set((state) => {
      if (!draft?.payload || state.items.length > 0) return { hydrated: true };
      return { ...draft.payload, hydrated: true };
    });
  },
  addItem: (item) => {
    let result: "added" | "replaced-store" = "added";
    set((state) => {
      const isDifferentStore = state.storeSlug !== null && state.storeSlug !== item.storeSlug;
      if (isDifferentStore) result = "replaced-store";
      const existingItems = isDifferentStore ? [] : state.items;
      const existing = existingItems.find((candidate) => itemKey(candidate) === itemKey(item));
      const items = existing
        ? existingItems.map((candidate) => itemKey(candidate) === itemKey(item)
          ? { ...candidate, quantity: candidate.quantity + 1 }
          : candidate)
        : [...existingItems, { ...item, quantity: Math.max(1, item.quantity) }];
      const nextState = { storeSlug: item.storeSlug, storeName: item.storeName, storeCode: item.storeCode ?? null, items };
      persistDraft(nextState);
      return nextState;
    });
    return result;
  },
  setQuantity: (productId, quantity) => set((state) => {
    const target = state.items.find((item) => itemKey(item) === productId || item.productId === productId);
    const targetKey = target ? itemKey(target) : productId;
    const items = quantity > 0
      ? state.items.map((item) => itemKey(item) === targetKey ? { ...item, quantity } : item)
      : state.items.filter((item) => itemKey(item) !== targetKey);
    const nextState = items.length > 0 ? { items } : { items, storeSlug: null, storeName: null, storeCode: null };
    persistDraft({ ...state, ...nextState });
    return nextState;
  }),
  removeItem: (productId) => set((state) => {
    const target = state.items.find((item) => itemKey(item) === productId || item.productId === productId);
    const targetKey = target ? itemKey(target) : productId;
    const items = state.items.filter((item) => itemKey(item) !== targetKey);
    const nextState = items.length > 0 ? { items } : { items, storeSlug: null, storeName: null, storeCode: null };
    persistDraft({ ...state, ...nextState });
    return nextState;
  }),
  clear: () => {
    set({ storeSlug: null, storeName: null, storeCode: null, items: [] });
    void localRepository.clearCartDraft();
  }
}));

export async function hydrateCart(): Promise<void> {
  await useCartStore.getState().hydrate();
}
