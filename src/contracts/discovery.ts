import { z } from "zod";
import type { FeedEventName } from "@/contracts/feed";

export const discoveryContractVersion = "v1" as const;

export const discoveryCandidateTypeSchema = z.enum(["TRACE", "PLACE"]);
export const discoveryEvidenceTypeSchema = z.enum([
  "RATING_SUMMARY",
  "SELECTED_REVIEW",
  "APPROVED_PHOTO",
  "VERIFIED_EXPERIENCE",
  "POPULAR_ASPECT",
  "USEFUL_TIP",
  "CREATOR_PROVENANCE",
  "TRACE_COMPLETION_SIGNAL",
]);
export const discoveryReasonCodeSchema = z.enum([
  "BECAUSE_VIBE",
  "BECAUSE_CATEGORY",
  "NEAR_SELECTED_AREA",
  "NEAR_CURRENT_COARSE_AREA",
  "SIMILAR_TO_SAVED",
  "NEW_IN_AREA",
  "POPULAR_IN_AREA",
  "AVAILABLE_NOW",
  "BASED_ON_COMPLETED_TRACE",
  "BECAUSE_YOU_VISITED",
  "CONTINUE_YOUR_TRACE",
  "COMMUNITY_CONFIDENCE",
]);
export const discoverySignalNameSchema = z.enum([
  "BOOKING_COMPLETED",
  "TRACE_COMPLETED",
  "SAVE_PLACE",
  "SAVE_TRACE",
  "DIRECTIONS_OPENED",
  "PLACE_OPEN",
  "TRACE_OPEN",
  "BOOKING_OPEN",
  "MAP_OPEN",
  "REVIEW_EXPAND",
  "TRACE_STARTED",
  "PHOTO_VIEW",
  "DISCOVERY_IMPRESSION",
  "HIDE",
  "NOT_INTERESTED",
  "BLOCK",
  "MUTE",
  "QUALIFIED_SKIP",
  "STALE_AVAILABILITY_REJECTION",
  "REPORT_SUBMITTED",
  "FAKE_ENGAGEMENT_ANOMALY",
  "DUPLICATE_DETECTED",
  "CONTENT_CORRECTION",
  "VERIFIED_VISIT",
]);
export const discoverySignalClassSchema = z.enum([
  "STRONG_POSITIVE",
  "MEDIUM_POSITIVE",
  "WEAK_POSITIVE",
  "VERY_WEAK",
  "STRONG_NEGATIVE",
  "CAUTIOUS_NEGATIVE",
  "TRUST_QUALITY",
]);

export const discoverySignalClassByName = {
  BOOKING_COMPLETED: "STRONG_POSITIVE",
  TRACE_COMPLETED: "STRONG_POSITIVE",
  SAVE_PLACE: "STRONG_POSITIVE",
  SAVE_TRACE: "STRONG_POSITIVE",
  DIRECTIONS_OPENED: "STRONG_POSITIVE",
  PLACE_OPEN: "MEDIUM_POSITIVE",
  TRACE_OPEN: "MEDIUM_POSITIVE",
  BOOKING_OPEN: "MEDIUM_POSITIVE",
  MAP_OPEN: "MEDIUM_POSITIVE",
  REVIEW_EXPAND: "MEDIUM_POSITIVE",
  TRACE_STARTED: "MEDIUM_POSITIVE",
  PHOTO_VIEW: "WEAK_POSITIVE",
  DISCOVERY_IMPRESSION: "VERY_WEAK",
  HIDE: "STRONG_NEGATIVE",
  NOT_INTERESTED: "STRONG_NEGATIVE",
  BLOCK: "STRONG_NEGATIVE",
  MUTE: "STRONG_NEGATIVE",
  QUALIFIED_SKIP: "CAUTIOUS_NEGATIVE",
  STALE_AVAILABILITY_REJECTION: "CAUTIOUS_NEGATIVE",
  REPORT_SUBMITTED: "TRUST_QUALITY",
  FAKE_ENGAGEMENT_ANOMALY: "TRUST_QUALITY",
  DUPLICATE_DETECTED: "TRUST_QUALITY",
  CONTENT_CORRECTION: "TRUST_QUALITY",
  VERIFIED_VISIT: "TRUST_QUALITY",
} as const;

export function mapLegacyFeedEventToDiscoverySignal(
  eventName: FeedEventName,
  itemType: DiscoveryCandidateType,
): DiscoverySignalName | null {
  switch (eventName) {
    case "impression":
      return "DISCOVERY_IMPRESSION";
    case "open":
      return itemType === "PLACE" ? "PLACE_OPEN" : "TRACE_OPEN";
    case "save":
      return itemType === "PLACE" ? "SAVE_PLACE" : "SAVE_TRACE";
    case "trace_start":
      return itemType === "TRACE" ? "TRACE_STARTED" : null;
    case "trace_complete":
      return itemType === "TRACE" ? "TRACE_COMPLETED" : null;
    case "place_open":
      return itemType === "PLACE" ? "PLACE_OPEN" : null;
    case "booking_click":
      return itemType === "PLACE" ? "BOOKING_OPEN" : null;
    case "engaged_view":
    case "click":
    case "share":
      return null;
  }
}

export const discoveryOutcomeMetricSchema = z.enum([
  "QUALIFIED_PLACE_OPEN",
  "QUALIFIED_TRACE_OPEN",
  "SAVE_PLACE",
  "SAVE_TRACE",
  "MAP_OPEN",
  "DIRECTIONS_OPENED",
  "MENU_OPEN",
  "BOOKING_OPEN",
  "BOOKING_STARTED",
  "BOOKING_COMPLETED",
  "TRACE_STARTED",
  "TRACE_COMPLETED",
  "REVIEW_EXPAND",
  "REVIEW_HELPFUL",
  "VALID_RETURN",
]);
export const discoveryGuardrailMetricSchema = z.enum([
  "UNSAFE_CONTENT_EXPOSURE",
  "REPORT_RATE",
  "HIDE_RATE",
  "NOT_INTERESTED_RATE",
  "DUPLICATE_CONTENT_RATE",
  "REPETITIVE_ENTITY_RATE",
  "REVIEW_MANIPULATION_ANOMALY_RATE",
  "FAKE_VISIT_ANOMALY_RATE",
  "SOURCE_CONCENTRATION",
  "REASON_PRIVACY_LEAK_RATE",
  "LATENCY_P95_MS",
  "DEGRADED_RESPONSE_RATE",
  "EMPTY_SAFE_INVENTORY_RATE",
]);
export const discoveryOperationalMetricSchema = z.enum([
  "GENERATOR_LATENCY_MS",
  "GENERATOR_ERROR_RATE",
  "ELIGIBILITY_FRESHNESS_SECONDS",
  "FEATURE_FRESHNESS_SECONDS",
  "EVENT_ACCEPTANCE_RATE",
  "EVENT_DUPLICATE_RATE",
  "EVENT_DEAD_LETTER_RATE",
  "MODULE_FILL_RATE",
  "BOOKING_DEPENDENCY_HEALTH",
]);

export const discoveryCandidateBoundarySchema = z
  .object({
    itemType: discoveryCandidateTypeSchema,
    id: z.string().min(1),
  })
  .strict();

export const discoverySignalSchema = z
  .object({
    signalName: discoverySignalNameSchema,
    signalClass: discoverySignalClassSchema,
  })
  .strict();

export const discoverySafeReviewHighlightSchema = z
  .object({
    reviewId: z.string().min(1),
    excerpt: z.string().min(1),
    aspects: z.array(z.string().min(1)),
  })
  .strict();

export const discoveryEvidenceBlockSchema = z
  .object({
    aggregateRating: z.number().min(0).max(5).nullable(),
    ratingCount: z.number().int().nonnegative(),
    ratingConfidence: z.enum(["none", "low", "medium", "high"]),
    verifiedExperienceRatio: z.number().min(0).max(1).nullable(),
    popularAspects: z.array(z.string().min(1)),
    selectedReview: discoverySafeReviewHighlightSchema.nullable(),
    photoCount: z.number().int().nonnegative(),
    recentUsefulFeedbackAt: z.string().min(1).nullable(),
    evidenceVersion: z.string().min(1),
  })
  .strict();

export type DiscoveryCandidateType = z.infer<typeof discoveryCandidateTypeSchema>;
export type DiscoveryEvidenceType = z.infer<typeof discoveryEvidenceTypeSchema>;
export type DiscoveryReasonCode = z.infer<typeof discoveryReasonCodeSchema>;
export type DiscoverySignalName = z.infer<typeof discoverySignalNameSchema>;
export type DiscoverySignalClass = z.infer<typeof discoverySignalClassSchema>;
export type DiscoveryOutcomeMetric = z.infer<typeof discoveryOutcomeMetricSchema>;
export type DiscoveryGuardrailMetric = z.infer<typeof discoveryGuardrailMetricSchema>;
export type DiscoveryOperationalMetric = z.infer<typeof discoveryOperationalMetricSchema>;
export type DiscoveryCandidateBoundary = z.infer<typeof discoveryCandidateBoundarySchema>;
export type DiscoverySignal = z.infer<typeof discoverySignalSchema>;
export type DiscoverySafeReviewHighlight = z.infer<typeof discoverySafeReviewHighlightSchema>;
export type DiscoveryEvidenceBlock = z.infer<typeof discoveryEvidenceBlockSchema>;
