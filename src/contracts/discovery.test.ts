import { describe, expect, it } from "vitest";
import {
  discoveryCandidateBoundarySchema,
  discoveryContractVersion,
  discoveryEvidenceBlockSchema,
  discoverySignalClassByName,
  discoverySignalSchema,
  mapLegacyFeedEventToDiscoverySignal,
} from "@/contracts/discovery";

describe("Discovery contract v1", () => {
  it("rejects POST and TRACER as first-class candidate types", () => {
    expect(discoveryContractVersion).toBe("v1");
    expect(discoveryCandidateBoundarySchema.parse({ itemType: "TRACE", id: "trace-1" })).toEqual({
      itemType: "TRACE",
      id: "trace-1",
    });
    expect(() => discoveryCandidateBoundarySchema.parse({ itemType: "POST", id: "post-1" })).toThrow();
    expect(() => discoveryCandidateBoundarySchema.parse({ itemType: "TRACER", id: "tracer-1" })).toThrow();
  });

  it("keeps signal confidence separate from legacy Feed events", () => {
    expect(discoverySignalSchema.parse({
      signalName: "DISCOVERY_IMPRESSION",
      signalClass: discoverySignalClassByName.DISCOVERY_IMPRESSION,
    })).toEqual({
      signalName: "DISCOVERY_IMPRESSION",
      signalClass: "VERY_WEAK",
    });
    expect(discoverySignalClassByName.BOOKING_COMPLETED).toBe("STRONG_POSITIVE");
    expect(() => discoverySignalSchema.parse({ signalName: "impression", signalClass: "VERY_WEAK" })).toThrow();
    expect(mapLegacyFeedEventToDiscoverySignal("save", "PLACE")).toBe("SAVE_PLACE");
    expect(mapLegacyFeedEventToDiscoverySignal("share", "TRACE")).toBeNull();
  });

  it("accepts only the public-safe evidence fields", () => {
    const evidence = discoveryEvidenceBlockSchema.parse({
      aggregateRating: 4.8,
      ratingCount: 120,
      ratingConfidence: "high",
      verifiedExperienceRatio: 0.72,
      popularAspects: ["quiet"],
      selectedReview: {
        reviewId: "review-1",
        excerpt: "สงบและเดินทางง่าย",
        aspects: ["quiet"],
      },
      photoCount: 8,
      recentUsefulFeedbackAt: "2026-09-25T00:00:00Z",
      evidenceVersion: "evidence-v1",
    });

    expect(evidence.selectedReview?.reviewId).toBe("review-1");
    expect(() => discoveryEvidenceBlockSchema.parse({
      ...evidence,
      rawScore: 0.99,
    })).toThrow();
    expect(() => discoveryEvidenceBlockSchema.parse({
      ...evidence,
      moderationReason: "internal",
    })).toThrow();
  });
});
