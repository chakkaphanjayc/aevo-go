import { z } from "zod";
import { feedPlaceReferenceSchema } from "@/contracts/feed";

export const traceDeeFeedItemSchema = z.object({
  itemType: z.literal("TRACE"),
  itemId: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  creatorId: z.string().uuid(),
  creatorName: z.string().min(1),
  status: z.literal("PUBLISHED"),
  visibility: z.literal("PUBLIC"),
  coverPlaceId: z.string().uuid().nullable(),
  area: z.string(),
  topicTags: z.array(z.string()),
  stopCount: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
  saveCount: z.number().int().nonnegative(),
  rankScore: z.number(),
  reasonCode: z.enum(["FOLLOWING_TRACER", "TASTE_MATCH", "POPULAR", "NEW_TRACE"]),
  reasonParams: z.record(z.string(), z.unknown()),
  trackingToken: z.string().uuid(),
  publishedAt: z.string().min(1)
});

export const traceDeeFeedResponseSchema = z.object({
  items: z.array(traceDeeFeedItemSchema),
  nextCursor: z.string().nullable(),
  requestId: z.string().optional()
});

export const traceDeePlaceSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  area: z.string(),
  category: z.string(),
  description: z.string(),
  imageUrl: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /** Optional during the TraceDee-to-Place migration; never inferred by Go. */
  placeReference: feedPlaceReferenceSchema.nullable().optional()
});

export const traceDeeStopSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  note: z.string(),
  durationMinutes: z.number().int().positive().nullable(),
  transportMode: z.string().nullable(),
  budgetMinor: z.number().int().nonnegative().nullable(),
  place: traceDeePlaceSchema
});

export const traceDeeDetailSchema = traceDeeFeedItemSchema.extend({
  revision: z.number().int().positive(),
  estimatedMinutes: z.number().int().positive().nullable(),
  estimatedBudgetMinor: z.number().int().nonnegative().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  saved: z.boolean(),
  followed: z.boolean(),
  tracerFollowing: z.boolean(),
  tracerFollowerCount: z.number().int().nonnegative(),
  stops: z.array(traceDeeStopSchema)
});

export const traceDeeDetailResponseSchema = z.object({
  trace: traceDeeDetailSchema,
  requestId: z.string().optional()
});

export const traceDeeLineageNodeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  creatorId: z.string().uuid(),
  status: z.enum(["DRAFT", "PUBLISHED", "UNDER_REVIEW", "REMOVED", "ARCHIVED"]),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
  revision: z.number().int().positive(),
  rootTraceId: z.string().uuid().nullable(),
  sourceTraceId: z.string().uuid().nullable(),
  lineageDepth: z.number().int().nonnegative(),
  publishedAt: z.string().nullable(),
  createdAt: z.string().min(1)
});

export const traceDeeTraceLineageSchema = z.object({
  ok: z.literal(true),
  trace: traceDeeLineageNodeSchema,
  source: traceDeeLineageNodeSchema.nullable(),
  root: traceDeeLineageNodeSchema.nullable(),
  ancestors: z.array(traceDeeLineageNodeSchema),
  descendants: z.array(traceDeeLineageNodeSchema)
});

export const traceDeeLineageResponseSchema = z.object({
  lineage: traceDeeTraceLineageSchema,
  requestId: z.string().optional()
});

export const traceDeeRemixStopDraftSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  place: traceDeePlaceSchema,
  note: z.string(),
  durationMinutes: z.number().int().positive().nullable(),
  transportMode: z.enum(["WALK", "BIKE", "TRANSIT", "CAR", "RIDE_HAIL", "OTHER"]).nullable(),
  budgetMinor: z.number().int().nonnegative().nullable()
});

export const traceDeeRemixDraftSchema = z.object({
  ok: z.literal(true),
  traceId: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  area: z.string(),
  topicTags: z.array(z.string()),
  estimatedMinutes: z.number().int().positive().nullable(),
  estimatedBudgetMinor: z.number().int().nonnegative().nullable(),
  status: z.literal("DRAFT"),
  visibility: z.literal("PRIVATE"),
  revision: z.number().int().positive(),
  sourceTraceId: z.string().uuid(),
  rootTraceId: z.string().uuid(),
  lineageDepth: z.number().int().positive(),
  stops: z.array(traceDeeRemixStopDraftSchema).min(1)
});

export const traceDeeRemixDraftResponseSchema = z.object({
  draft: traceDeeRemixDraftSchema,
  requestId: z.string().optional()
});

export const traceDeePlaceSearchResponseSchema = z.object({
  places: z.array(traceDeePlaceSchema),
  requestId: z.string().optional()
});

export const traceDeeProfileInterestSchema = z.object({
  dimensionType: z.enum(["TOPIC", "AREA", "CATEGORY"]),
  dimensionKey: z.string().min(1),
  position: z.number().int().nonnegative()
});

export const traceDeeProfilePreferencesSchema = z.object({
  ok: z.literal(true),
  profileId: z.string().uuid(),
  personalizationEnabled: z.boolean(),
  onboardingCompleted: z.boolean(),
  interests: z.array(traceDeeProfileInterestSchema)
});

export const traceDeeProfilePreferencesResponseSchema = z.object({
  preferences: traceDeeProfilePreferencesSchema,
  requestId: z.string().optional()
});

export const traceDeePreferenceUpdateSchema = traceDeeProfilePreferencesSchema.extend({
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeePreferenceUpdateResponseSchema = z.object({
  preferences: traceDeePreferenceUpdateSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeFeedInteractionSchema = z.object({
  ok: z.literal(true),
  itemType: z.literal("TRACE"),
  itemId: z.string().uuid(),
  interactionType: z.enum(["OPENED", "DISMISSED", "QUICK_BACK"]),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeFeedInteractionResponseSchema = z.object({
  interaction: traceDeeFeedInteractionSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeRemixSchema = z.object({
  ok: z.literal(true),
  remixTraceId: z.string().uuid(),
  remixSlug: z.string().min(1),
  sourceTraceId: z.string().uuid(),
  rootTraceId: z.string().uuid(),
  remixerId: z.string().uuid(),
  lineageDepth: z.number().int().positive(),
  status: z.literal("DRAFT"),
  revision: z.number().int().positive(),
  stopCount: z.number().int().positive(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeRemixResponseSchema = z.object({
  remix: traceDeeRemixSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeRemixUpdateSchema = z.object({
  ok: z.literal(true),
  traceId: z.string().uuid(),
  status: z.literal("DRAFT"),
  revision: z.number().int().positive(),
  stopCount: z.number().int().positive(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeRemixUpdateResponseSchema = z.object({
  remix: traceDeeRemixUpdateSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeRemixPublishSchema = z.object({
  ok: z.literal(true),
  traceId: z.string().uuid(),
  status: z.literal("PUBLISHED"),
  revision: z.number().int().positive(),
  sourceTraceId: z.string().uuid(),
  rootTraceId: z.string().uuid(),
  lineageDepth: z.number().int().positive(),
  stopCount: z.number().int().positive(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeRemixPublishResponseSchema = z.object({
  remix: traceDeeRemixPublishSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeActionStateSchema = z.object({
  ok: z.literal(true),
  traceId: z.string().uuid(),
  action: z.enum(["save", "unsave", "follow", "unfollow"]),
  saved: z.boolean(),
  followed: z.boolean(),
  changed: z.boolean(),
  stateVersion: z.number().int().positive(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeActionResponseSchema = z.object({
  state: traceDeeActionStateSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeTracerFollowSchema = z.object({
  ok: z.literal(true),
  tracerId: z.string().uuid(),
  following: z.boolean(),
  followerCount: z.number().int().nonnegative(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeTracerFollowResponseSchema = z.object({
  follow: traceDeeTracerFollowSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeActivityResponseSchema = z.object({
  event: z.object({
    ok: z.literal(true),
    eventId: z.string().uuid(),
    trackingToken: z.string().uuid(),
    correlationId: z.string().uuid(),
    deduped: z.boolean()
  }),
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeRatingSchema = z.object({
  ok: z.literal(true),
  ratingId: z.string().uuid(),
  completionId: z.string().uuid(),
  journeyId: z.string().uuid(),
  traceId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
  review: z.string(),
  moderationStatus: z.enum(["VISIBLE", "LIMITED", "UNDER_REVIEW", "REMOVED"]),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeRatingResponseSchema = z.object({
  rating: traceDeeRatingSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeePostSchema = z.object({
  ok: z.literal(true),
  postId: z.string().uuid(),
  threadId: z.string().uuid(),
  journeyId: z.string().uuid(),
  traceId: z.string().uuid(),
  placeId: z.string().uuid().nullable(),
  status: z.enum(["VISIBLE", "LIMITED", "UNDER_REVIEW", "REMOVED"]),
  body: z.string(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeePostResponseSchema = z.object({
  post: traceDeePostSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeCommentSchema = z.object({
  commentId: z.string().uuid(),
  threadId: z.string().uuid(),
  postId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string().min(1),
  parentId: z.string().uuid().nullable(),
  depth: z.number().int().min(0).max(1),
  status: z.enum(["VISIBLE", "LIMITED"]),
  body: z.string(),
  helpful: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const traceDeeCommentsResponseSchema = z.object({
  comments: z.array(traceDeeCommentSchema),
  requestId: z.string().optional()
});

export const traceDeeCommentResultSchema = z.object({
  ok: z.literal(true),
  commentId: z.string().uuid(),
  threadId: z.string().uuid(),
  postId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  depth: z.number().int().min(0).max(1),
  status: z.enum(["VISIBLE", "LIMITED", "UNDER_REVIEW", "REMOVED"]),
  body: z.string(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeCommentResponseSchema = z.object({
  comment: traceDeeCommentResultSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeContentMutationSchema = z.object({
  ok: z.literal(true),
  entityType: z.enum(["POST", "COMMENT"]),
  entityId: z.string().uuid(),
  status: z.enum(["VISIBLE", "LIMITED", "UNDER_REVIEW", "REMOVED"]),
  body: z.string().optional(),
  editedAt: z.string().nullable().optional(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeContentMutationResponseSchema = z.object({
  content: traceDeeContentMutationSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeCommunityPostSchema = z.object({
  postId: z.string().uuid(),
  threadId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string().min(1),
  traceId: z.string().uuid().nullable(),
  placeId: z.string().uuid().nullable(),
  status: z.enum(["VISIBLE", "LIMITED"]),
  body: z.string(),
  commentCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const traceDeeCommunityPostsResponseSchema = z.object({
  posts: z.array(traceDeeCommunityPostSchema),
  requestId: z.string().optional()
});

export const traceDeeHelpfulSchema = z.object({
  ok: z.literal(true),
  commentId: z.string().uuid(),
  active: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeHelpfulResponseSchema = z.object({
  helpful: traceDeeHelpfulSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeUserRelationSchema = z.object({
  ok: z.literal(true),
  targetId: z.string().uuid(),
  relation: z.enum(["BLOCK", "MUTE"]),
  active: z.boolean(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeUserRelationResponseSchema = z.object({
  relation: traceDeeUserRelationSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeNotificationSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().uuid().nullable(),
  actorId: z.string().uuid().nullable(),
  lastActorId: z.string().uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  aggregationCount: z.number().int().positive(),
  readAt: z.string().nullable(),
  createdAt: z.string().min(1)
});

export const traceDeeNotificationsResponseSchema = z.object({
  notifications: z.array(traceDeeNotificationSchema),
  requestId: z.string().optional()
});

export const traceDeeNotificationReadSchema = z.object({
  ok: z.literal(true),
  notificationId: z.string().uuid(),
  read: z.boolean(),
  changed: z.boolean()
});

export const traceDeeNotificationReadResponseSchema = z.object({
  notification: traceDeeNotificationReadSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.null()
});

export const traceDeeReportSchema = z.object({
  ok: z.literal(true),
  reportId: z.string().uuid(),
  entityType: z.enum(["TRACE", "PLACE", "POST", "COMMENT", "PROFILE"]),
  entityId: z.string().uuid(),
  status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid()
});

export const traceDeeReportResponseSchema = z.object({
  report: traceDeeReportSchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export const traceDeeProfileExpertiseSchema = z.object({
  enabled: z.boolean(),
  profileId: z.string().uuid(),
  scoreVersion: z.number().int().positive(),
  expertise: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  topics: z.array(z.object({
    topic: z.string().min(1),
    score: z.number(),
    evidenceCount: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1)
  })),
  calculatedAt: z.string().nullable()
});

export const traceDeeProfileExpertiseResponseSchema = z.object({
  expertise: traceDeeProfileExpertiseSchema,
  requestId: z.string().optional()
});

export const traceDeeJourneySummarySchema = z.object({
  ok: z.literal(true),
  journeyId: z.string().uuid(),
  traceId: z.string().uuid(),
  traceSlug: z.string().min(1),
  status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "ABANDONED"]),
  version: z.number().int().positive(),
  traceRevision: z.number().int().positive(),
  stopCount: z.number().int().nonnegative(),
  completedStopCount: z.number().int().nonnegative(),
  skippedStopCount: z.number().int().nonnegative(),
  pendingStopCount: z.number().int().nonnegative(),
  completionId: z.string().uuid().nullable(),
  changed: z.boolean(),
  eventId: z.string().uuid().nullable(),
  correlationId: z.string().uuid(),
  trackingToken: z.string().uuid().nullable(),
  verificationStatus: z.enum(["SELF_REPORTED", "PARTIAL", "VERIFIED", "REJECTED"]).nullable(),
  verificationSummary: z.record(z.string(), z.unknown()).nullable(),
  verificationEventId: z.string().uuid().nullable(),
  verificationTrackingToken: z.string().uuid().nullable()
});

export const traceDeeJourneyStopSchema = z.object({
  id: z.string().uuid(),
  traceStopId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]),
  version: z.number().int().positive(),
  completedAt: z.string().nullable(),
  place: traceDeePlaceSchema,
  note: z.string()
});

export const traceDeeJourneyDetailSchema = traceDeeJourneySummarySchema.extend({
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  rating: z.object({
    ratingId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    tags: z.array(z.string()),
    review: z.string(),
    moderationStatus: z.enum(["VISIBLE", "LIMITED", "UNDER_REVIEW", "REMOVED"]),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  }).nullable(),
  stops: z.array(traceDeeJourneyStopSchema)
});

export const traceDeeJourneyResponseSchema = z.object({
  journey: traceDeeJourneyDetailSchema,
  requestId: z.string().optional()
});

export const traceDeeJourneyMutationResponseSchema = z.object({
  journey: traceDeeJourneySummarySchema,
  requestId: z.string().optional(),
  eventCorrelationId: z.string().uuid()
});

export type TraceDeeFeedItem = z.infer<typeof traceDeeFeedItemSchema>;
export type TraceDeeFeedResponse = z.infer<typeof traceDeeFeedResponseSchema>;
export type TraceDeeTraceDetail = z.infer<typeof traceDeeDetailSchema>;
export type TraceDeeTraceAction = z.infer<typeof traceDeeActionStateSchema>["action"];
export type TraceDeeTracerFollowResponse = z.infer<typeof traceDeeTracerFollowResponseSchema>;
export type TraceDeeJourneyDetail = z.infer<typeof traceDeeJourneyDetailSchema>;
export type TraceDeeJourneyAction = "start" | "pause" | "abandon" | "complete";
export type TraceDeeJourneyCompletionVerification = {
  clientStartedAt?: string;
  clientCompletedAt?: string;
  locationPermission?: boolean;
  coarseLatitude?: number;
  coarseLongitude?: number;
};
export type TraceDeeLineageNode = z.infer<typeof traceDeeLineageNodeSchema>;
export type TraceDeeTraceLineage = z.infer<typeof traceDeeTraceLineageSchema>;
export type TraceDeeRemixDraft = z.infer<typeof traceDeeRemixDraftSchema>;
export type TraceDeeRemixStopDraft = z.infer<typeof traceDeeRemixStopDraftSchema>;
export type TraceDeePlaceSearchResponse = z.infer<typeof traceDeePlaceSearchResponseSchema>;
export type TraceDeeProfilePreferences = z.infer<typeof traceDeeProfilePreferencesSchema>;
export type TraceDeePreferenceUpdateResponse = z.infer<typeof traceDeePreferenceUpdateResponseSchema>;
export type TraceDeeFeedInteractionResponse = z.infer<typeof traceDeeFeedInteractionResponseSchema>;
export type TraceDeeRemixResponse = z.infer<typeof traceDeeRemixResponseSchema>;
export type TraceDeeRemixUpdateResponse = z.infer<typeof traceDeeRemixUpdateResponseSchema>;
export type TraceDeeRemixPublishResponse = z.infer<typeof traceDeeRemixPublishResponseSchema>;
export type TraceDeeRatingResponse = z.infer<typeof traceDeeRatingResponseSchema>;
export type TraceDeePostResponse = z.infer<typeof traceDeePostResponseSchema>;
export type TraceDeeComment = z.infer<typeof traceDeeCommentSchema>;
export type TraceDeeCommentsResponse = z.infer<typeof traceDeeCommentsResponseSchema>;
export type TraceDeeCommentResponse = z.infer<typeof traceDeeCommentResponseSchema>;
export type TraceDeeContentMutationResponse = z.infer<typeof traceDeeContentMutationResponseSchema>;
export type TraceDeeCommunityPost = z.infer<typeof traceDeeCommunityPostSchema>;
export type TraceDeeCommunityPostsResponse = z.infer<typeof traceDeeCommunityPostsResponseSchema>;
export type TraceDeeHelpfulResponse = z.infer<typeof traceDeeHelpfulResponseSchema>;
export type TraceDeeUserRelationResponse = z.infer<typeof traceDeeUserRelationResponseSchema>;
export type TraceDeeNotificationsResponse = z.infer<typeof traceDeeNotificationsResponseSchema>;
export type TraceDeeNotificationReadResponse = z.infer<typeof traceDeeNotificationReadResponseSchema>;
export type TraceDeeReportResponse = z.infer<typeof traceDeeReportResponseSchema>;
export type TraceDeeProfileExpertiseResponse = z.infer<typeof traceDeeProfileExpertiseResponseSchema>;
