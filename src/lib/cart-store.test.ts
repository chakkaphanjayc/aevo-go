import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore, type CartItem } from "@/lib/cart-store";

const coffee: CartItem = {
  productId: "coffee-1",
  storeSlug: "north-star-coffee",
  storeName: "North Star Coffee",
  name: "House selection",
  description: "House roast",
  unitPriceMinor: 18000,
  currency: "THB",
  quantity: 1
};

beforeEach(() => {
  useCartStore.getState().clear();
});

describe("guest cart draft", () => {
  it("merges repeated products locally without claiming a server price", () => {
    expect(useCartStore.getState().addItem(coffee)).toBe("added");
    useCartStore.getState().addItem(coffee);

    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
    expect(useCartStore.getState().items[0]?.unitPriceMinor).toBe(18000);
  });

  it("keeps one merchant per draft and explicitly replaces a different merchant", () => {
    useCartStore.getState().addItem(coffee);
    const result = useCartStore.getState().addItem({ ...coffee, productId: "sora-1", storeSlug: "sora-table", storeName: "Sora Table" });

    expect(result).toBe("replaced-store");
    expect(useCartStore.getState().storeSlug).toBe("sora-table");
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("clears the merchant identity when the last item is removed", () => {
    useCartStore.getState().addItem(coffee);
    useCartStore.getState().setQuantity("coffee-1", 0);

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().storeSlug).toBeNull();
  });

  it("keeps product variants as separate draft lines", () => {
    useCartStore.getState().addItem({ ...coffee, lineId: "coffee-1:small", variantId: "small" });
    useCartStore.getState().addItem({ ...coffee, lineId: "coffee-1:large", variantId: "large", unitPriceMinor: 24000 });

    expect(useCartStore.getState().items).toHaveLength(2);
    useCartStore.getState().setQuantity("coffee-1:large", 3);
    expect(useCartStore.getState().items.find((item) => item.lineId === "coffee-1:large")?.quantity).toBe(3);
    expect(useCartStore.getState().items.find((item) => item.lineId === "coffee-1:small")?.quantity).toBe(1);
  });
});
