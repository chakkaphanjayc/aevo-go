import { describe, expect, it } from "vitest";
import { shouldQueryOsmPlaces, shouldUseCanonicalMapOverlay } from "@/features/map/map-data-policy";

describe("Map data policy", () => {
  it("keeps OSM out of the canonical Place path", () => {
    expect(shouldQueryOsmPlaces("canonical", "places", "remote")).toBe(false);
    expect(shouldQueryOsmPlaces("legacy", "places", "remote")).toBe(true);
    expect(shouldQueryOsmPlaces("legacy", "traces", "remote")).toBe(false);
  });

  it("enables the Core map overlay only for live canonical Places", () => {
    expect(shouldUseCanonicalMapOverlay("canonical", "live", "places")).toBe(true);
    expect(shouldUseCanonicalMapOverlay("canonical", "demo", "places")).toBe(false);
    expect(shouldUseCanonicalMapOverlay("legacy", "live", "places")).toBe(false);
  });
});
