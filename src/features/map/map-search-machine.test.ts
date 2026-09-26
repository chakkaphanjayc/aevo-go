import { describe, expect, it } from "vitest";
import { createInitialMapDiscoveryState, isMapSearchDirty, mapDiscoveryReducer } from "@/features/map/map-search-machine";

const firstBounds = { west: 100.48, south: 13.7, east: 100.56, north: 13.79 };
const secondBounds = { west: 100.52, south: 13.71, east: 100.6, north: 13.8 };

describe("map discovery state machine", () => {
  it("keeps viewport movement dirty until the user commits Search this area", () => {
    const initial = createInitialMapDiscoveryState(firstBounds);
    const moved = mapDiscoveryReducer(initial, { type: "camera-moved", bounds: secondBounds, userOriginated: true });
    expect(isMapSearchDirty(moved)).toBe(true);
    const committed = mapDiscoveryReducer(moved, { type: "search-requested" });
    expect(committed.committedBounds).toEqual(secondBounds);
    expect(isMapSearchDirty(committed)).toBe(false);
  });

  it("preserves old results while a fresh search enters loading", () => {
    const initial = createInitialMapDiscoveryState(firstBounds);
    const moved = mapDiscoveryReducer(initial, { type: "camera-moved", bounds: secondBounds, userOriginated: true });
    const loading = mapDiscoveryReducer(moved, { type: "search-requested" });
    expect(loading.status).toBe("loading");
    expect(loading.cameraBounds).toEqual(secondBounds);
    expect(loading.committedBounds).toEqual(secondBounds);
  });

  it("does not show Search this area for a tiny camera nudge", () => {
    const initial = createInitialMapDiscoveryState(firstBounds);
    const tinyMove = {
      west: firstBounds.west + 0.0002,
      south: firstBounds.south + 0.0002,
      east: firstBounds.east + 0.0002,
      north: firstBounds.north + 0.0002,
    };
    const moved = mapDiscoveryReducer(initial, {
      type: "camera-moved",
      bounds: tinyMove,
      userOriginated: true,
    });
    expect(isMapSearchDirty(moved)).toBe(false);
  });
});
