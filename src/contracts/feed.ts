import { z } from "zod";

export const feedTabSchema = z.enum(["for_you", "following", "nearby"]);
export const feedItemTypeSchema = z.enum(["TRACE", "PLACE"]);
export const feedReasonCodeSchema = z.enum([
  "FOLLOWING_TRACER",
  "TASTE_MATCH",
  "POPULAR",
  "NEW_TRACE",
  "NEARBY_PLACE",
  "POPULAR_PLACE",
]);
export const feedEventNameSchema = z.enum([
  "impression",
  "engaged_view",
  "open",
  "click",
  "save",
  "share",
  "trace_start",
  "trace_complete",
  "place_open",
  "booking_click",
]);

const feedTraceItemSchema = z
  .object({
    itemType: z.literal("TRACE"),
    id: z.string().min(1),
    itemToken: z.string().min(1),
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    creatorName: z.string().min(1),
    area: z.string(),
    topicTags: z.array(z.string()),
    stopCount: z.number().int().nonnegative(),
    reasonCode: z.enum(["FOLLOWING_TRACER", "TASTE_MATCH", "POPULAR", "NEW_TRACE"]),
    publishedAt: z.string().min(1),
  })
  .strict();

const feedPlaceReferenceSchema = z
  .object({
    namespace: z.string().min(1),
    externalId: z.string().min(1),
    sourceVersion: z.string().min(1),
    canonicalPlaceId: z.string().uuid().nullable(),
    resolutionStatus: z.enum([
      "resolved",
      "redirected",
      "unresolved",
      "rejected",
      "unsafe_redirect",
      "invalid",
      "unavailable",
    ]),
    redirected: z.boolean(),
    redirectReason: z.string().nullable(),
    resolverVersion: z.string().min(1),
  })
  .strict();

const feedPlaceItemSchema = z
  .object({
    itemType: z.literal("PLACE"),
    id: z.string().min(1),
    itemToken: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    area: z.string(),
    category: z.string(),
    imageUrl: z.string().nullable(),
    reasonCode: z.enum(["NEARBY_PLACE", "POPULAR_PLACE"]),
    placeReference: feedPlaceReferenceSchema.nullable().optional(),
  })
  .strict();

export const feedItemSchema = z.discriminatedUnion("itemType", [
  feedTraceItemSchema,
  feedPlaceItemSchema,
]);

export const feedResponseSchema = z
  .object({
    feedSessionId: z.string().min(1),
    configVersion: z.string().min(1),
    rankingVersion: z.string().min(1),
    items: z.array(feedItemSchema),
    nextCursor: z.string().nullable(),
    degraded: z.boolean(),
    requestId: z.string().nullable().optional(),
  })
  .strict();

export const feedEventMetadataSchema = z
  .object({
    clientPlatform: z.enum(["web", "pwa", "capacitor"]).optional(),
    surface: z.literal("explore").optional(),
    tab: feedTabSchema.optional(),
    reasonCode: feedReasonCodeSchema.optional(),
    visibleRatio: z.number().min(0).max(1).optional(),
    visibleDurationMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export const feedEventSchema = z
  .object({
    schemaVersion: z.literal("1"),
    eventId: z.string().min(1),
    eventName: feedEventNameSchema,
    feedSessionId: z.string().min(1),
    itemToken: z.string().min(1),
    occurredAt: z.string().min(1),
    position: z.number().int().nonnegative().optional(),
    source: feedItemTypeSchema.optional(),
    metadata: feedEventMetadataSchema.optional(),
  })
  .strict();

export const feedEventBatchSchema = z
  .object({ events: z.array(feedEventSchema).min(1).max(100) })
  .strict();

export const feedEventBatchResponseSchema = z
  .object({
    accepted: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    sampledOut: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    results: z.array(
      z
        .object({
          eventId: z.string().min(1),
          status: z.enum(["ACCEPTED", "DUPLICATE", "SAMPLED_OUT", "REJECTED"]),
          errorCode: z.string().nullable().optional(),
        })
        .strict(),
    ),
    requestId: z.string().nullable().optional(),
  })
  .strict();

export type FeedTab = z.infer<typeof feedTabSchema>;
export type FeedItemType = z.infer<typeof feedItemTypeSchema>;
export type FeedReasonCode = z.infer<typeof feedReasonCodeSchema>;
export type FeedEventName = z.infer<typeof feedEventNameSchema>;
export type FeedTraceItem = z.infer<typeof feedTraceItemSchema>;
export type FeedPlaceReference = z.infer<typeof feedPlaceReferenceSchema>;
export type FeedPlaceItem = z.infer<typeof feedPlaceItemSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type FeedEventMetadata = z.infer<typeof feedEventMetadataSchema>;
export type FeedEvent = z.infer<typeof feedEventSchema>;
export type FeedEventBatch = z.infer<typeof feedEventBatchSchema>;
export type FeedEventBatchResponse = z.infer<typeof feedEventBatchResponseSchema>;
