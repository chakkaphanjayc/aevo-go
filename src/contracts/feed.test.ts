import { describe, expect, it } from "vitest";
import { feedResponseSchema } from "@/contracts/feed";

describe("Core Feed contract", () => {
  it("accepts a mixed server-ordered page and opaque item tokens", () => {
    const response = feedResponseSchema.parse({
      feedSessionId: "feed-session-1",
      configVersion: "config-v1",
      rankingVersion: "deterministic-v1",
      items: [
        {
          itemType: "TRACE",
          id: "trace-1",
          itemToken: "opaque.trace.token",
          slug: "old-town-walk",
          title: "Old town walk",
          description: "A slow route",
          creatorName: "Ari",
          area: "Talat Noi",
          topicTags: ["heritage"],
          stopCount: 3,
          reasonCode: "TASTE_MATCH",
          publishedAt: "2026-09-25T00:00:00+00:00",
        },
        {
          itemType: "PLACE",
          id: "place-1",
          itemToken: "opaque.place.token",
          slug: "river-coffee",
          name: "River Coffee",
          description: "A coffee stop",
          area: "Talat Noi",
          category: "Cafe",
          imageUrl: null,
          reasonCode: "NEARBY_PLACE",
        },
      ],
      nextCursor: "signed-cursor",
      degraded: false,
      requestId: null,
    });

    expect(response.items.map((item) => item.itemType)).toEqual(["TRACE", "PLACE"]);
    expect(response.items[0]?.itemToken).toBe("opaque.trace.token");
  });

  it("accepts an explicit legacy-to-canonical Place reference on Feed items", () => {
    const response = feedResponseSchema.parse({
      feedSessionId: "feed-session-1",
      configVersion: "config-v1",
      rankingVersion: "deterministic-v1",
      items: [{
        itemType: "PLACE",
        id: "store-1",
        itemToken: "opaque.place.token",
        slug: "river-coffee",
        name: "River Coffee",
        description: "A coffee stop",
        area: "Talat Noi",
        category: "Cafe",
        imageUrl: null,
        reasonCode: "NEARBY_PLACE",
        placeReference: {
          namespace: "aevo.store",
          externalId: "store-1",
          sourceVersion: "unversioned",
          canonicalPlaceId: "123e4567-e89b-12d3-a456-426614174000",
          resolutionStatus: "redirected",
          redirected: true,
          redirectReason: "merged",
          resolverVersion: "place-reference-v1",
        },
      }],
      nextCursor: null,
      degraded: false,
    });

    expect(response.items[0]?.itemType).toBe("PLACE");
    if (response.items[0]?.itemType === "PLACE") {
      expect(response.items[0].placeReference?.canonicalPlaceId).toBe("123e4567-e89b-12d3-a456-426614174000");
    }
  });

  it("rejects a response without the server-issued item token", () => {
    expect(() => feedResponseSchema.parse({
      feedSessionId: "feed-session-1",
      configVersion: "config-v1",
      rankingVersion: "deterministic-v1",
      items: [{
        itemType: "TRACE",
        id: "trace-1",
        slug: "old-town-walk",
        title: "Old town walk",
        description: "A slow route",
        creatorName: "Ari",
        area: "Talat Noi",
        topicTags: [],
        stopCount: 1,
        reasonCode: "NEW_TRACE",
        publishedAt: "2026-09-25T00:00:00+00:00",
      }],
      nextCursor: null,
      degraded: false,
    })).toThrow();
  });
});
