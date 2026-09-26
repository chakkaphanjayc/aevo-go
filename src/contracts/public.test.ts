import { describe, expect, it } from "vitest";
import { publicAvailabilityResponseSchema, publicCatalogResponseSchema } from "@/contracts/public";

describe("canonical public Gateway contracts", () => {
  it("accepts the catalog projection used by customer menu screens", () => {
    const catalog = publicCatalogResponseSchema.parse({
      success: true,
      store: { id: "store-1", code: "DEMO", name: "Demo Store", currency: "THB" },
      channel: "QR",
      categories: [{ id: "category-1", name: "Coffee", sortOrder: 1 }],
      products: [{
        id: "product-1",
        categoryId: "category-1",
        name: "Americano",
        description: "House roast",
        basePriceMinor: 12000,
        effectivePriceMinor: 12000,
        currency: "THB",
        soldOut: false,
        variants: [],
        modifierGroups: []
      }]
    });

    expect(catalog.products[0]?.effectivePriceMinor).toBe(12000);
  });

  it("keeps venue timezone and server slot identity at the boundary", () => {
    const availability = publicAvailabilityResponseSchema.parse({
      date: "2026-09-22",
      venueId: "venue-1",
      timezone: "Asia/Bangkok",
      slotDurationMinutes: 60,
      serverTime: "2026-09-19T00:00:00.000Z",
      slots: [{
        id: "resource-1-11:00",
        venueId: "venue-1",
        resourceId: "resource-1",
        startAt: "2026-09-22T11:00:00.000Z",
        endAt: "2026-09-22T12:00:00.000Z",
        localStartTime: "11:00",
        localEndTime: "12:00",
        priceMinor: 50000,
        available: true
      }]
    });

    expect(availability.slots[0]?.resourceId).toBe("resource-1");
    expect(availability.timezone).toBe("Asia/Bangkok");
  });

  it("rejects a catalog response without the explicit success envelope", () => {
    expect(() => publicCatalogResponseSchema.parse({ store: {}, products: [] })).toThrow();
  });

  it("accepts the Gateway empty-catalog response without fabricating store metadata", () => {
    const catalog = publicCatalogResponseSchema.parse({ success: true, categories: [], products: [] });
    expect(catalog.store).toBeUndefined();
    expect(catalog.products).toEqual([]);
  });
});
