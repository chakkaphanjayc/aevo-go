import { describe, expect, it } from "vitest";
import {
  canonicalPlaceDetailPath,
  toCanonicalCategoryIds,
  toCanonicalOverlayStore,
} from "@/features/map/canonical-place-adapter";
import type { PlaceMapOverlayResponse } from "@/contracts/place";
import type { StoreMapSummary } from "@/features/map/contracts";

const placeId = "123e4567-e89b-12d3-a456-426614174000";

const feature: PlaceMapOverlayResponse["features"][number] = {
  type: "Feature",
  id: placeId,
  geometry: { type: "Point", coordinates: [100.54, 13.78] },
  properties: {
    featureKind: "place",
    placeId,
    name: "Baan Thai",
    categoryId: "restaurant",
    markerKind: "restaurant",
    verificationStatus: "business_verified",
    bookable: true,
    aevoPlayPartner: true,
  },
};

const knownStore: StoreMapSummary = {
  id: placeId,
  slug: "baan-thai",
  name: "Old name",
  point: { longitude: 100.53, latitude: 13.77 },
  category: "Restaurant",
  categoryIconKey: "restaurant",
  rating: 4.8,
  reviewCount: 4,
  priceLevel: 2,
  priceRange: "฿฿",
  availableToday: null,
  availabilityLabel: null,
  area: "Ari",
  imageUrl: null,
  source: "customer",
};

describe("canonical Place map adapter", () => {
  it("normalizes UI category labels to canonical category IDs", () => {
    expect(toCanonicalCategoryIds(["Cafe", "Dining", "Wellness"])).toEqual([
      "cafe",
      "restaurant",
      "wellness",
    ]);
  });

  it("keeps canonical IDs and overlay coordinates while enriching known results", () => {
    const store = toCanonicalOverlayStore(feature, new Map([[placeId, knownStore]]));
    expect(store).toMatchObject({
      id: placeId,
      slug: "baan-thai",
      name: "Baan Thai",
      point: { longitude: 100.54, latitude: 13.78 },
      isAevoPlayPartner: true,
    });
  });

  it("creates a detail target for overlay-only Places", () => {
    const store = toCanonicalOverlayStore(feature, new Map());
    expect(store?.slug).toBe(placeId);
    expect(canonicalPlaceDetailPath(placeId)).toBe(`/places/${placeId}`);
  });
});
