import { afterEach, describe, expect, it, vi } from "vitest";
import { getDiscovery, getStoreBySlug, searchStores } from "@/lib/customer-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

const store = {
  id: "store-1",
  slug: "north-star-coffee",
  storeCode: "NORTH-STAR",
  venueSlug: "north-star-venue",
  name: "North Star Coffee",
  area: "Ari",
  category: "Cafe",
  rating: 4.8,
  reviewCount: 214,
  priceRange: "฿฿",
  imageUrl: null,
  availabilityLabel: "โต๊ะว่างวันนี้",
  description: "Slow coffee",
  latitude: 13.7801,
  longitude: 100.5447
};

describe("customer discovery adapter", () => {
  it("serializes discovery filters to the canonical public route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [store], nextCursor: "24" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDiscovery({ query: "coffee", category: "Cafe", area: "Ari", limit: 24 });

    expect(result.data[0]?.slug).toBe("north-star-coffee");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/discovery?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=coffee");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("category=Cafe");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("area=Ari");
  });

  it("unwraps the public store detail envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ store }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getStoreBySlug("north-star-coffee");

    expect(result.storeCode).toBe("NORTH-STAR");
    expect(result.venueSlug).toBe("north-star-venue");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/stores/north-star-coffee");
  });

  it("uses the search alias without changing the response contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], nextCursor: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await searchStores({ query: "wellness" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/search?q=wellness");
  });

  it("serializes map viewport bounds into the public discovery query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], nextCursor: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await getDiscovery({ bbox: "100.48,13.70,100.56,13.79", category: "Cafe", limit: 48 });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("bbox=100.48%2C13.70%2C100.56%2C13.79");
  });

  it("serializes map filters and capacity hints for the spatial endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], nextCursor: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await getDiscovery({ categoryIds: ["Cafe", "Wellness"], priceLevels: [2, 3], availableAt: "2026-09-21T10:00:00.000Z", partySize: 4, bbox: "100.48,13.70,100.56,13.79" });

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("categoryIds=Cafe%2CWellness");
    expect(requestUrl).toContain("priceLevels=2%2C3");
    expect(requestUrl).toContain("partySize=4");
  });
});
