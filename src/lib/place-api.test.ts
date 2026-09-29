import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNearbyPlaces,
  getPlaceDetail,
  getPlaceMapOverlay,
  listSavedCanonicalPlaces,
  searchPlaces,
  setCanonicalPlaceSaved,
} from "@/lib/place-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

const metadata = {
  contractVersion: "v1",
  schemaVersion: "1",
  projectionVersion: "places-public-v1",
  sourceRevision: "revision-1",
  generatedAt: "2026-09-24T00:00:00.000Z",
  freshness: {
    state: "fresh",
    observedAt: "2026-09-24T00:00:00.000Z",
    expiresAt: "2026-09-24T00:05:00.000Z",
    sourceRevision: "revision-1"
  }
};

describe("canonical Place API adapter", () => {
  it("uses the bounded map overlay route and query names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...metadata,
      bounds: { west: 100, south: 13, east: 101, north: 14 },
      zoom: 12,
      features: [],
      truncated: false,
      density: { mode: "points", featureCount: 0, clusterCount: 0, maxFeatures: 300 }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await getPlaceMapOverlay({
      west: 100,
      south: 13,
      east: 101,
      north: 14,
      zoom: 12,
      categoryIds: ["cafe", "restaurant"],
      limit: 300,
      savedOnly: true
    });

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("/api/v1/public/places/map?");
    expect(requestUrl).toContain("categoryId=cafe%2Crestaurant");
    expect(requestUrl).toContain("limit=300");
    expect(requestUrl).toContain("savedOnly=true");
  });

  it("keeps Search, Nearby, and Detail on separate routes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...metadata, data: [], nextCursor: null, totalApproximate: 0, truncated: false }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...metadata, origin: { longitude: 100.54, latitude: 13.78 }, radiusMeters: 1000, data: [], nextCursor: null, truncated: false }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...metadata, place: { id: "123e4567-e89b-12d3-a456-426614174000", slug: "sample", name: "Sample", localizedNames: [], category: { id: "cafe", label: "Cafe", localizedLabels: [] }, status: "visible", displayPoint: null, labelPoint: null, area: null, address: null, parentPlaceId: null, verification: { status: "unverified", label: null, verifiedAt: null, verificationRevision: null }, business: null, capabilities: { bookable: false, queueSupported: false, aevoPlayPartner: false, commerceEnabled: false, publicBookingRoute: null, freshness: metadata.freshness }, attribution: [], redirectFrom: null, canonicalGeometry: null, centroid: null, boundingGeometry: null, children: [], businessLinks: [], fieldProvenance: [], legacyReferences: [] } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await searchPlaces({ query: "cafe" });
    await getNearbyPlaces({ longitude: 100.54, latitude: 13.78, radiusMeters: 1000 });
    await getPlaceDetail("123e4567-e89b-12d3-a456-426614174000");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/places/search?q=cafe");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/v1/public/places/nearby?");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/api/v1/public/places/123e4567-e89b-12d3-a456-426614174000");
  });

  it("uses the authenticated canonical Place save projection routes", async () => {
    const placeId = "123e4567-e89b-12d3-a456-426614174000";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        savedPlaces: [{ placeId, savedAt: "2026-09-27T00:00:00.000Z" }],
        requestId: "saved-list-1",
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        placeId,
        saved: true,
        changed: true,
        updatedAt: "2026-09-27T00:00:00.000Z",
        requestId: "saved-1",
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        placeId,
        saved: false,
        changed: true,
        updatedAt: "2026-09-27T00:01:00.000Z",
        requestId: "saved-2",
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const savedPlaces = await listSavedCanonicalPlaces();
    const saved = await setCanonicalPlaceSaved(placeId, true, "explore-place-save-1");
    const removed = await setCanonicalPlaceSaved(placeId, false, "explore-place-save-2");

    expect(savedPlaces[0]?.placeId).toBe(placeId);
    expect(saved.saved).toBe(true);
    expect(removed.saved).toBe(false);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/me/saved-places");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`/api/v1/public/places/${placeId}/save`);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("DELETE");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("idempotency-key")).toBe("explore-place-save-1");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("idempotency-key")).toBe("explore-place-save-2");
  });
});
