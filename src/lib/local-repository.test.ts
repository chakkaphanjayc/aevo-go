import { afterEach, describe, expect, it } from "vitest";
import { localRepository } from "@/lib/local-repository";

const favoriteSlug = `test-favorite-${Date.now()}`;

afterEach(async () => {
  await localRepository.removeFavorite(favoriteSlug);
  await localRepository.clearCartDraft();
});

describe("local customer repository", () => {
  it("keeps recent searches ordered and normalized", async () => {
    await localRepository.addRecentSearch("  ร้าน   ใกล้บ้าน  ");

    const recent = await localRepository.listRecentSearches();

    expect(recent[0]).toBe("ร้าน ใกล้บ้าน");
  });

  it("stores guest favorites as recoverable snapshots", async () => {
    await localRepository.saveFavorite({
      slug: favoriteSlug,
      name: "Test Place",
      area: "Ari",
      category: "Cafe"
    });

    const favorites = await localRepository.listFavorites();

    expect(favorites.some((favorite) => favorite.slug === favoriteSlug)).toBe(true);
    await localRepository.removeFavorite(favoriteSlug);
    expect((await localRepository.listFavorites()).some((favorite) => favorite.slug === favoriteSlug)).toBe(false);
  });

  it("recovers a cart draft without treating it as server truth", async () => {
    const payload = {
      storeSlug: "test-store",
      storeName: "Test Store",
      storeCode: "TEST",
      items: [{ productId: "product-1", quantity: 2, unitPriceMinor: 1000 }]
    };

    await localRepository.saveCartDraft(payload);

    expect((await localRepository.getCartDraft<typeof payload>())?.payload).toEqual(payload);
    await localRepository.clearCartDraft();
    expect(await localRepository.getCartDraft()).toBeUndefined();
  });
});
