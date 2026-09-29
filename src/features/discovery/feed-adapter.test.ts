import { describe, expect, it } from "vitest";
import {
  coreFeedItemToDiscovery,
  feedModulesToDiscovery,
} from "@/features/discovery/feed-adapter";
import { isDiscoveryCandidateItem } from "@/features/discovery/types";

describe("Core Feed discovery adapter", () => {
  it("returns only entity candidates from the Core TRACE/PLACE union", () => {
    const trace = coreFeedItemToDiscovery({
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
      publishedAt: "2026-09-25T00:00:00Z",
    }, "feed-session-1");

    const place = coreFeedItemToDiscovery({
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
    }, "feed-session-1");

    expect([trace, place].map((item) => item.itemType)).toEqual(["TRACE", "PLACE"]);
    expect(isDiscoveryCandidateItem(trace)).toBe(true);
    expect(isDiscoveryCandidateItem(place)).toBe(true);
    expect(trace.trackingToken).toBe("opaque.trace.token");
    if (place.itemType === "PLACE") {
      expect(place.venueSlug).toBeUndefined();
    }
  });

  it("uses only an explicitly resolved Feed reference for canonical Place navigation", () => {
    const canonicalId = "123e4567-e89b-12d3-a456-426614174000";
    const resolved = coreFeedItemToDiscovery({
      itemType: "PLACE",
      id: "legacy-place-1",
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
        externalId: "legacy-place-1",
        sourceVersion: "unversioned",
        canonicalPlaceId: canonicalId,
        resolutionStatus: "redirected",
        redirected: true,
        redirectReason: "merged",
        resolverVersion: "place-resolver-v1",
      },
    }, "feed-session-1");
    const unresolved = coreFeedItemToDiscovery({
      itemType: "PLACE",
      id: "legacy-place-2",
      itemToken: "opaque.place.token-2",
      slug: "same-name-different-place",
      name: "River Coffee",
      description: "A coffee stop",
      area: "Talat Noi",
      category: "Cafe",
      imageUrl: null,
      reasonCode: "NEARBY_PLACE",
      placeReference: {
        namespace: "aevo.store",
        externalId: "legacy-place-2",
        sourceVersion: "unversioned",
        canonicalPlaceId: null,
        resolutionStatus: "unresolved",
        redirected: false,
        redirectReason: null,
        resolverVersion: "place-resolver-v1",
      },
    }, "feed-session-1");

    expect(resolved.itemType).toBe("PLACE");
    expect(unresolved.itemType).toBe("PLACE");
    if (resolved.itemType === "PLACE" && unresolved.itemType === "PLACE") {
      expect(resolved.canonicalPlaceId).toBe(canonicalId);
      expect(
        coreFeedItemToDiscovery(
          {
            itemType: "PLACE",
            id: "legacy-place-1",
            itemToken: "opaque.place.token",
            slug: "river-coffee",
            name: "River Coffee",
            description: "A coffee stop",
            area: "Talat Noi",
            category: "Cafe",
            imageUrl: null,
            reasonCode: "NEARBY_PLACE",
            placeReference: resolved.itemType === "PLACE"
              ? {
                  namespace: "aevo.store",
                  externalId: "legacy-place-1",
                  sourceVersion: "unversioned",
                  canonicalPlaceId: canonicalId,
                  resolutionStatus: "redirected",
                  redirected: true,
                  redirectReason: "merged",
                  resolverVersion: "place-resolver-v1",
                }
              : null,
          },
          "feed-session-1",
          new Set([canonicalId]),
        ).saved,
      ).toBe(true);
      expect(resolved.saved).toBe(false);
      expect(unresolved.canonicalPlaceId).toBeUndefined();
      expect(unresolved.saved).toBe(false);
    }
  });

  it("resolves module references only when type, id, and server token match", () => {
    const trace = coreFeedItemToDiscovery({
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
      publishedAt: "2026-09-25T00:00:00Z",
    }, "feed-session-1");
    const place = coreFeedItemToDiscovery({
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
    }, "feed-session-1");

    const modules = feedModulesToDiscovery([
      {
        moduleId: "FOR_YOU",
        reasonCode: "BECAUSE_CATEGORY",
        items: [
          { itemType: "PLACE", itemId: "place-1", itemToken: "opaque.place.token" },
          { itemType: "TRACE", itemId: "trace-1", itemToken: "wrong-token" },
          { itemType: "TRACE", itemId: "missing", itemToken: "opaque.missing.token" },
        ],
      },
      {
        moduleId: "NEW_AND_USEFUL",
        reasonCode: "NEW_IN_AREA",
        items: [{ itemType: "TRACE", itemId: "missing", itemToken: "opaque.missing.token" }],
      },
    ], [trace, place]);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.items.map((item) => item.itemType)).toEqual(["PLACE"]);
    expect(modules[0]?.reasonCode).toBe("BECAUSE_CATEGORY");
  });

  it("keeps distinct server-allocated shelves visible without repeating entities", () => {
    const trace = coreFeedItemToDiscovery({
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
      reasonCode: "NEW_TRACE",
      publishedAt: "2026-09-25T00:00:00Z",
    }, "feed-session-1");
    const place = coreFeedItemToDiscovery({
      itemType: "PLACE",
      id: "place-1",
      itemToken: "opaque.place.token",
      slug: "river-coffee",
      name: "River Coffee",
      description: "A coffee stop",
      area: "Talat Noi",
      category: "Cafe",
      imageUrl: null,
      reasonCode: "POPULAR_PLACE",
    }, "feed-session-1");

    const modules = feedModulesToDiscovery([
      {
        moduleId: "FOR_YOU",
        reasonCode: null,
        items: [{ itemType: "PLACE", itemId: "place-1", itemToken: "opaque.place.token" }],
      },
      {
        moduleId: "NEW_AND_USEFUL",
        reasonCode: "NEW_IN_AREA",
        items: [{ itemType: "TRACE", itemId: "trace-1", itemToken: "opaque.trace.token" }],
      },
    ], [trace, place]);

    expect(modules.map((module) => module.moduleId)).toEqual(["FOR_YOU", "NEW_AND_USEFUL"]);
    expect(modules.flatMap((module) => module.items)).toHaveLength(2);
  });
});
