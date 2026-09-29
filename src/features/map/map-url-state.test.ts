import { describe, expect, it } from "vitest";
import {
  readMapUrlState,
  updateMapUrlState,
} from "@/features/map/map-url-state";

describe("map URL state", () => {
  it("parses shareable map filters and viewport state", () => {
    const state = readMapUrlState(
      new URLSearchParams(
        "q=coffee&categoryIds=Cafe,Wellness&priceLevels=2,3&partySize=4&bbox=100.48,13.70,100.56,13.79&zoom=14&searched=1&selected=north-star-coffee",
      ),
    );
    expect(state.filters).toEqual({
      query: "coffee",
      categoryIds: ["Cafe", "Wellness"],
      priceLevels: [2, 3],
      partySize: 4,
    });
    expect(state.searched).toBe(true);
    expect(state.selectedSlug).toBe("north-star-coffee");
  });

  it("preserves a canonical UUID selection as an opaque URL identity", () => {
    const placeId = "123e4567-e89b-12d3-a456-426614174000";
    const state = readMapUrlState(new URLSearchParams(`mode=places&selected=${placeId}`));

    expect(state.selectedSlug).toBe(placeId);
  });

  it("updates filters without dropping unrelated shareable state", () => {
    const next = updateMapUrlState(
      new URLSearchParams("bbox=100.48,13.70,100.56,13.79&searched=1"),
      { categoryIds: ["Cafe"], priceLevels: [2] },
    );
    expect(next.get("bbox")).toBe("100.48,13.70,100.56,13.79");
    expect(next.get("searched")).toBe("1");
    expect(next.get("categoryIds")).toBe("Cafe");
    expect(next.get("priceLevels")).toBe("2");
  });

  it("ignores invalid party sizes from shared URLs", () => {
    const state = readMapUrlState(new URLSearchParams("partySize=0"));
    expect(state.filters.partySize).toBeUndefined();
  });

  it("preserves Trace Map mode, selection, and advanced filters in a shareable URL", () => {
    const state = readMapUrlState(
      new URLSearchParams(
        "mode=traces&sort=rating&ratingMin=4.5&tasteMatch=1&saved=1&following=1&trace=old-town-light-walk",
      ),
    );
    expect(state.mode).toBe("traces");
    expect(state.sort).toBe("rating");
    expect(state.filters.ratingMin).toBe(4.5);
    expect(state.filters.tasteMatch).toBe(true);
    expect(state.filters.savedOnly).toBe(true);
    expect(state.filters.followingOnly).toBe(true);
    expect(state.selectedSlug).toBe("old-town-light-walk");
  });

  it("round-trips the Aevo Play availability filter", () => {
    const state = readMapUrlState(new URLSearchParams("reservable=1"));
    expect(state.filters.reservableOnly).toBe(true);

    const next = updateMapUrlState(new URLSearchParams(), {
      reservableOnly: true,
    });
    expect(next.get("reservable")).toBe("1");

    expect(
      updateMapUrlState(next, { reservableOnly: false }).has("reservable"),
    ).toBe(false);
  });
});
