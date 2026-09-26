import { describe, expect, it } from "vitest";
import { getOsmPlaces, normalizePlaceName, toOsmMapSummary } from "@/features/map/osm-service";

const bangkokBounds = {
  west: 100.48,
  south: 13.70,
  east: 100.58,
  north: 13.80,
} as const;

describe("OSM place adapter", () => {
  it("returns deterministic local places inside the requested bounds", async () => {
    const places = await getOsmPlaces(bangkokBounds, {
      mode: "mock",
      endpoint: "https://example.test/overpass",
    });

    expect(places.length).toBeGreaterThan(0);
    expect(places.every((place) =>
      place.point.longitude >= bangkokBounds.west &&
      place.point.longitude <= bangkokBounds.east &&
      place.point.latitude >= bangkokBounds.south &&
      place.point.latitude <= bangkokBounds.north,
    )).toBe(true);
  });

  it("keeps OSM identity/source separate from Aevo business authority", async () => {
    const places = await getOsmPlaces(bangkokBounds, {
      mode: "mock",
      endpoint: "https://example.test/overpass",
    });
    const summary = toOsmMapSummary(places[0]!);

    expect(summary.source).toBe("osm");
    expect(summary.isAevoPlayPartner).toBe(false);
    expect(summary.rating).toBeNull();
    expect(summary.osmId).toBe(places[0]?.osmId);
    expect(normalizePlaceName("Ari Community Market")).toBe("aricommunitymarket");
  });
});
