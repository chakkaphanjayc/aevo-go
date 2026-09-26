import { describe, expect, it } from "vitest";
import { isMapBoundsEqual, parseMapBounds, serializeMapBounds, toStoreFeatureCollection, toStoreMapSummary } from "@/features/map/contracts";

describe("map contracts", () => {
  it("round-trips a viewport without leaking map-library types", () => {
    const bounds = parseMapBounds("100.480000,13.700000,100.560000,13.790000");
    expect(bounds).toEqual({ west: 100.48, south: 13.7, east: 100.56, north: 13.79 });
    expect(serializeMapBounds(bounds!)).toBe("100.480000,13.700000,100.560000,13.790000");
    expect(isMapBoundsEqual(bounds, parseMapBounds(serializeMapBounds(bounds!)))).toBe(true);
  });

  it("converts only geocoded public stores into map features", () => {
    const summary = toStoreMapSummary({
      id: "store-1",
      slug: "north-star-coffee",
      name: "North Star Coffee",
      area: "Ari",
      category: "Cafe",
      rating: 4.8,
      reviewCount: 214,
      priceRange: "฿฿",
      imageUrl: null,
      availabilityLabel: "โต๊ะว่างวันนี้",
      description: null,
      latitude: 13.78,
      longitude: 100.54
    });
    expect(summary?.point).toEqual({ latitude: 13.78, longitude: 100.54 });
    expect(toStoreFeatureCollection([summary!]).features[0]?.geometry.coordinates).toEqual([100.54, 13.78]);
    expect(toStoreMapSummary({
      id: "store-2",
      slug: "missing-location",
      name: "Missing Location",
      area: "Ari",
      category: "Cafe",
      rating: null,
      reviewCount: 0,
      priceRange: "฿",
      imageUrl: null,
      availabilityLabel: null,
      description: null,
      latitude: null,
      longitude: null
    })).toBeNull();
  });

  it("marks partner places distinctly in the public map projection", () => {
    const summary = toStoreMapSummary({
      id: "store-partner",
      slug: "partner-place",
      name: "Partner Place",
      area: "Ari",
      category: "Cafe",
      rating: 4.9,
      reviewCount: 12,
      priceRange: "฿฿",
      imageUrl: null,
      availabilityLabel: "จองได้วันนี้",
      isAevoPlayPartner: true,
      latitude: 13.78,
      longitude: 100.54,
    });
    const feature = toStoreFeatureCollection([summary!]).features[0];
    expect(feature?.properties.isAevoPlayPartner).toBe(true);
    expect(feature?.properties.categoryMark).toBe("C");
    expect(feature?.properties.markerIcon).toBe("aevocado-partner");
  });
});
