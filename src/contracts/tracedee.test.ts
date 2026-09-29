import { describe, expect, it } from "vitest";
import {
  traceDeeJourneyDetailSchema,
  traceDeeFeedInteractionResponseSchema,
  traceDeePlaceSearchResponseSchema,
  traceDeeProfilePreferencesResponseSchema,
  traceDeeRemixDraftResponseSchema,
  traceDeePostResponseSchema,
  traceDeeRatingResponseSchema,
  traceDeeRemixPublishResponseSchema,
  traceDeeRemixResponseSchema,
  traceDeeTraceLineageSchema
} from "@/contracts/tracedee";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("TraceDee community contracts", () => {
  it("accepts a server-authoritative rating with moderation state", () => {
    const response = traceDeeRatingResponseSchema.parse({
      rating: {
        ok: true,
        ratingId: uuid,
        completionId: uuid,
        journeyId: uuid,
        traceId: uuid,
        rating: 5,
        tags: ["worth_it"],
        review: "",
        moderationStatus: "VISIBLE",
        changed: true,
        eventId: uuid,
        correlationId: uuid,
        trackingToken: uuid
      },
      eventCorrelationId: uuid
    });

    expect(response.rating.moderationStatus).toBe("VISIBLE");
  });

  it("accepts a contribution that is held for review", () => {
    const response = traceDeePostResponseSchema.parse({
      post: {
        ok: true,
        postId: uuid,
        threadId: uuid,
        journeyId: uuid,
        traceId: uuid,
        placeId: null,
        status: "UNDER_REVIEW",
        body: "A contribution",
        changed: true,
        eventId: uuid,
        correlationId: uuid,
        trackingToken: uuid
      },
      eventCorrelationId: uuid
    });

    expect(response.post.status).toBe("UNDER_REVIEW");
  });

  it("requires rating state on a hydrated journey detail", () => {
    expect(() => traceDeeJourneyDetailSchema.parse({
      ok: true,
      journeyId: uuid,
      traceId: uuid,
      traceSlug: "trace",
      status: "COMPLETED",
      version: 2,
      traceRevision: 1,
      stopCount: 1,
      completedStopCount: 1,
      skippedStopCount: 0,
      pendingStopCount: 0,
      completionId: uuid,
      changed: false,
      eventId: null,
      correlationId: uuid,
      trackingToken: null,
      createdAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
      startedAt: "2026-09-21T00:00:00.000Z",
      completedAt: "2026-09-21T01:00:00.000Z",
      stops: []
    })).toThrow();
  });

  it("accepts a replay-safe remix draft and bounded lineage", () => {
    const draft = traceDeeRemixResponseSchema.parse({
      remix: {
        ok: true,
        remixTraceId: uuid,
        remixSlug: "trace-remix-abc12345",
        sourceTraceId: uuid,
        rootTraceId: uuid,
        remixerId: uuid,
        lineageDepth: 1,
        status: "DRAFT",
        revision: 1,
        stopCount: 3,
        eventId: uuid,
        correlationId: uuid,
        trackingToken: uuid
      },
      eventCorrelationId: uuid
    });

    expect(draft.remix.status).toBe("DRAFT");
    expect(() => traceDeeRemixPublishResponseSchema.parse({
      remix: {
        ok: true,
        traceId: uuid,
        status: "PUBLISHED",
        revision: 2,
        sourceTraceId: uuid,
        rootTraceId: uuid,
        lineageDepth: 1,
        stopCount: 3,
        changed: true,
        eventId: uuid,
        correlationId: uuid,
        trackingToken: uuid
      },
      eventCorrelationId: uuid
    })).not.toThrow();
  });

  it("keeps lineage nodes explicit about source and descendants", () => {
    const lineage = traceDeeTraceLineageSchema.parse({
      ok: true,
      trace: {
        id: uuid,
        slug: "trace",
        title: "Trace",
        creatorId: uuid,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        revision: 2,
        rootTraceId: uuid,
        sourceTraceId: uuid,
        lineageDepth: 1,
        publishedAt: "2026-09-22T00:00:00.000Z",
        createdAt: "2026-09-22T00:00:00.000Z"
      },
      source: null,
      root: null,
      ancestors: [],
      descendants: []
    });

    expect(lineage.trace.lineageDepth).toBe(1);
  });

  it("validates the remix editor read model with place and stop fields", () => {
    const place = {
      id: uuid,
      slug: "talad-noi-coffee",
      name: "Talad Noi coffee stop",
      area: "Talat Noi",
      category: "Cafe",
      description: "A coffee stop",
      imageUrl: null,
      latitude: null,
      longitude: null
    };
    const draft = traceDeeRemixDraftResponseSchema.parse({
      draft: {
        ok: true,
        traceId: uuid,
        slug: "trace-remix-abc12345",
        title: "Remix",
        description: "A draft",
        area: "Talat Noi",
        topicTags: ["coffee"],
        estimatedMinutes: 90,
        estimatedBudgetMinor: 500,
        status: "DRAFT",
        visibility: "PRIVATE",
        revision: 2,
        sourceTraceId: uuid,
        rootTraceId: uuid,
        lineageDepth: 1,
        stops: [{
          id: uuid,
          position: 0,
          place,
          note: "Start here",
          durationMinutes: 30,
          transportMode: "WALK",
          budgetMinor: 250
        }]
      }
    });

    expect(draft.draft.stops[0]?.place.category).toBe("Cafe");
    expect(() => traceDeeRemixDraftResponseSchema.parse({ draft: { ...draft.draft, stops: [] } })).toThrow();
  });

  it("validates explicit personalization opt-out and feed interaction contracts", () => {
    const preferences = traceDeeProfilePreferencesResponseSchema.parse({
      preferences: {
        ok: true,
        profileId: uuid,
        personalizationEnabled: false,
        onboardingCompleted: false,
        interests: []
      }
    });
    const interaction = traceDeeFeedInteractionResponseSchema.parse({
      interaction: {
        ok: true,
        itemType: "TRACE",
        itemId: uuid,
        interactionType: "DISMISSED",
        changed: true,
        eventId: uuid,
        correlationId: uuid,
        trackingToken: uuid
      },
      eventCorrelationId: uuid
    });

    expect(preferences.preferences.personalizationEnabled).toBe(false);
    expect(interaction.interaction.interactionType).toBe("DISMISSED");
  });

  it("accepts an explicit canonical Place reference without changing TraceDee source IDs", () => {
    const place = traceDeePlaceSearchResponseSchema.parse({
      places: [{
        id: uuid,
        slug: "legacy-coffee",
        name: "Legacy Coffee",
        area: "Talat Noi",
        category: "Cafe",
        description: "A coffee stop",
        imageUrl: null,
        latitude: 13.73,
        longitude: 100.51,
        placeReference: {
          namespace: "aevo.tracedee",
          externalId: uuid,
          sourceVersion: "unversioned",
          canonicalPlaceId: "123e4567-e89b-12d3-a456-426614174000",
          resolutionStatus: "redirected",
          redirected: true,
          redirectReason: "merged",
          resolverVersion: "place-resolver-v1",
        },
      }],
      requestId: "request-1",
    });

    expect(place.places[0]?.id).toBe(uuid);
    expect(place.places[0]?.placeReference?.canonicalPlaceId).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("keeps place search results bounded to the public place contract", () => {
    const result = traceDeePlaceSearchResponseSchema.parse({ places: [] });
    expect(result.places).toHaveLength(0);
  });
});
