import {
  availabilityResponseSchema,
  discoveryResponseSchema,
  searchSuggestionsResponseSchema,
  storeSummarySchema,
  type AvailabilityResponse,
  type CustomerStoreSummary,
  type DiscoveryResponse
} from "@/contracts/customer";
import {
  traceDeeActionResponseSchema,
  traceDeeActivityResponseSchema,
  traceDeeCommentResponseSchema,
  traceDeeCommentsResponseSchema,
  traceDeeCommunityPostsResponseSchema,
  traceDeeContentMutationResponseSchema,
  traceDeeDetailResponseSchema,
  traceDeeFeedResponseSchema,
  traceDeeJourneyMutationResponseSchema,
  traceDeeJourneyResponseSchema,
  traceDeeNotificationReadResponseSchema,
  traceDeeNotificationsResponseSchema,
  traceDeeFeedInteractionResponseSchema,
  traceDeeProfilePreferencesResponseSchema,
  traceDeePreferenceUpdateResponseSchema,
  traceDeePostResponseSchema,
  traceDeeProfileExpertiseResponseSchema,
  traceDeeRatingResponseSchema,
  traceDeeReportResponseSchema,
  traceDeeHelpfulResponseSchema,
  traceDeeLineageResponseSchema,
  traceDeePlaceSearchResponseSchema,
  traceDeeRemixDraftResponseSchema,
  traceDeeRemixPublishResponseSchema,
  traceDeeRemixResponseSchema,
  traceDeeRemixUpdateResponseSchema,
  traceDeeTracerFollowResponseSchema,
  traceDeeUserRelationResponseSchema,
  type TraceDeeFeedResponse,
  type TraceDeeJourneyCompletionVerification,
  type TraceDeeJourneyAction,
  type TraceDeeJourneyDetail,
  type TraceDeeTraceAction,
  type TraceDeeTraceDetail
} from "@/contracts/tracedee";
import { requestJson } from "@/lib/api-client";

function parseContract<T>(payload: unknown, parser: { parse: (value: unknown) => T }): T {
  return parser.parse(payload);
}

export interface DiscoveryQuery {
  query?: string;
  category?: string;
  categoryIds?: string[];
  area?: string;
  bbox?: string;
  zoom?: number;
  priceLevels?: number[];
  availableAt?: string;
  reservableOnly?: boolean;
  partySize?: number;
  ratingMin?: number;
  tasteMatch?: boolean;
  savedOnly?: boolean;
  followingOnly?: boolean;
  sort?: "relevant" | "nearest" | "rating";
  cursor?: string;
  limit?: number;
}

function queryString(query: DiscoveryQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function getDiscovery(query: DiscoveryQuery = {}, options: { signal?: AbortSignal } = {}): Promise<DiscoveryResponse> {
  const params = { ...query, q: query.query };
  delete params.query;
  const payload = await requestJson<unknown>(`/api/v1/public/discovery${queryString(params)}`, { signal: options.signal });
  return parseContract(payload, discoveryResponseSchema);
}

export async function searchStores(query: DiscoveryQuery = {}, options: { signal?: AbortSignal } = {}): Promise<DiscoveryResponse> {
  const params = { ...query, q: query.query };
  delete params.query;
  const payload = await requestJson<unknown>(`/api/v1/public/search${queryString(params)}`, { signal: options.signal });
  return parseContract(payload, discoveryResponseSchema);
}

export async function getPublicSearchSuggestions(query: string, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ q: query });
  const payload = await requestJson<unknown>(`/api/v1/public/search/suggestions?${params.toString()}`, { signal: options.signal });
  return parseContract(payload, searchSuggestionsResponseSchema);
}

export async function getStoreBySlug(slug: string): Promise<CustomerStoreSummary> {
  const payload = await requestJson<unknown>(`/api/v1/public/stores/${encodeURIComponent(slug)}`);
  const storePayload = typeof payload === "object" && payload !== null && "store" in payload
    ? payload.store
    : payload;
  return parseContract(storePayload, storeSummarySchema);
}

export async function getStoreAvailability(venueSlug: string, date: string): Promise<AvailabilityResponse> {
  const payload = await requestJson<unknown>(`/api/v1/public/venues/${encodeURIComponent(venueSlug)}/availability?date=${encodeURIComponent(date)}`);
  return parseContract(payload, availabilityResponseSchema);
}

export interface TraceDeeFeedQuery {
  tab?: "for_you" | "following" | "nearby";
  query?: string;
  area?: string;
  cursor?: string;
  limit?: number;
}

function traceDeeQueryString(query: TraceDeeFeedQuery): string {
  const params = new URLSearchParams();
  if (query.tab) params.set("tab", query.tab);
  if (query.query) params.set("q", query.query);
  if (query.area) params.set("area", query.area);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function getTraceDeeFeed(query: TraceDeeFeedQuery = {}, options: { signal?: AbortSignal } = {}): Promise<TraceDeeFeedResponse> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/feed${traceDeeQueryString(query)}`, { signal: options.signal });
  return parseContract(payload, traceDeeFeedResponseSchema);
}

export async function getTraceDeeTrace(traceIdOrSlug: string, options: { signal?: AbortSignal } = {}): Promise<TraceDeeTraceDetail> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}`, { signal: options.signal });
  return parseContract(payload, traceDeeDetailResponseSchema).trace;
}

export async function getTraceDeeTraceLineage(traceIdOrSlug: string, options: { signal?: AbortSignal } = {}) {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}/lineage`, { signal: options.signal });
  return parseContract(payload, traceDeeLineageResponseSchema).lineage;
}

export async function getTraceDeeProfilePreferences(options: { signal?: AbortSignal } = {}) {
  const payload = await requestJson<unknown>("/api/v1/public/tracedee/preferences", { signal: options.signal });
  return parseContract(payload, traceDeeProfilePreferencesResponseSchema).preferences;
}

export async function updateTraceDeeProfilePreferences(
  input: {
    personalizationEnabled: boolean;
    interests: Array<{ dimensionType: "TOPIC" | "AREA" | "CATEGORY"; dimensionKey: string }>;
  },
  idempotencyKey: string
) {
  const payload = await requestJson<unknown>(
    "/api/v1/public/tracedee/preferences",
    { method: "PATCH", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeePreferenceUpdateResponseSchema).preferences;
}

export async function recordTraceDeeFeedInteraction(
  itemId: string,
  input: { interactionType: "OPENED" | "DISMISSED" | "QUICK_BACK"; trackingToken?: string; metadata?: Record<string, unknown> },
  idempotencyKey: string
) {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/feed/items/${encodeURIComponent(itemId)}/interactions`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeFeedInteractionResponseSchema).interaction;
}

export async function searchTraceDeePlaces(query: string, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  params.set("limit", "24");
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/places/search?${params.toString()}`, { signal: options.signal });
  return parseContract(payload, traceDeePlaceSearchResponseSchema).places;
}

export async function createTraceDeeRemix(
  traceIdOrSlug: string,
  input: { title?: string; description?: string; slug?: string },
  idempotencyKey: string
) {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}/remix`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeRemixResponseSchema);
}

export async function getTraceDeeRemixDraft(traceId: string, options: { signal?: AbortSignal } = {}) {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/remixes/${encodeURIComponent(traceId)}`, { signal: options.signal });
  return parseContract(payload, traceDeeRemixDraftResponseSchema).draft;
}

export async function updateTraceDeeRemix(
  traceId: string,
  input: {
    expectedRevision?: number;
    title?: string;
    description?: string;
    area?: string;
    topicTags?: string[];
    estimatedMinutes?: number;
    estimatedBudgetMinor?: number;
    stops?: Array<{
      placeId: string;
      note?: string;
      durationMinutes?: number;
      transportMode?: "WALK" | "BIKE" | "TRANSIT" | "CAR" | "RIDE_HAIL" | "OTHER";
      budgetMinor?: number;
    }>;
  },
  idempotencyKey: string
) {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/remixes/${encodeURIComponent(traceId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeRemixUpdateResponseSchema);
}

export async function publishTraceDeeRemix(traceId: string, idempotencyKey: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/remixes/${encodeURIComponent(traceId)}/publish`,
    { method: "POST" },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeRemixPublishResponseSchema);
}

export async function applyTraceDeeTraceAction(
  traceIdOrSlug: string,
  action: TraceDeeTraceAction,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeActionResponseSchema.parse>> {
  const isAdd = action === "save" || action === "follow";
  const resource = action === "save" || action === "unsave" ? "save" : "follow";
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}/${resource}`,
    { method: isAdd ? "POST" : "DELETE" },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeActionResponseSchema);
}

export async function setTraceDeeTracerFollow(
  profileId: string,
  following: boolean,
  idempotencyKey: string
) {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/profiles/${encodeURIComponent(profileId)}/follow`,
    { method: following ? "POST" : "DELETE" },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeTracerFollowResponseSchema);
}

export async function recordTraceDeeFeedImpression(input: {
  entityId: string;
  trackingToken: string;
  position: number;
  tab: "for_you" | "following" | "nearby";
}): Promise<ReturnType<typeof traceDeeActivityResponseSchema.parse>> {
  const payload = await requestJson<unknown>("/api/v1/public/tracedee/activity/events", {
    method: "POST",
    body: JSON.stringify({
      eventType: "feed_item_impressed",
      entityType: "TRACE",
      entityId: input.entityId,
      trackingToken: input.trackingToken,
      dedupeKey: `feed-impression:${input.trackingToken}:${input.entityId}`,
      metadata: { position: input.position, tab: input.tab, viewportThreshold: 0.5 }
    })
  });
  return parseContract(payload, traceDeeActivityResponseSchema);
}

export async function createTraceDeeJourney(traceIdOrSlug: string, idempotencyKey: string): Promise<ReturnType<typeof traceDeeJourneyMutationResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}/journeys`,
    { method: "POST" },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeJourneyMutationResponseSchema);
}

export async function getTraceDeeJourney(journeyId: string): Promise<TraceDeeJourneyDetail> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/journeys/${encodeURIComponent(journeyId)}`);
  return parseContract(payload, traceDeeJourneyResponseSchema).journey;
}

export async function getTraceDeeJourneyForTrace(traceIdOrSlug: string): Promise<TraceDeeJourneyDetail> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}/journey`);
  return parseContract(payload, traceDeeJourneyResponseSchema).journey;
}

export async function applyTraceDeeJourneyAction(
  journeyId: string,
  action: TraceDeeJourneyAction,
  idempotencyKey: string,
  verification?: TraceDeeJourneyCompletionVerification
): Promise<ReturnType<typeof traceDeeJourneyMutationResponseSchema.parse>> {
  const body = action === "complete" && verification ? JSON.stringify(verification) : undefined;
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/journeys/${encodeURIComponent(journeyId)}/${action}`,
    { method: "POST", ...(body ? { body } : {}) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeJourneyMutationResponseSchema);
}

export async function updateTraceDeeJourneyStop(
  journeyId: string,
  stopId: string,
  status: "COMPLETED" | "SKIPPED",
  expectedVersion: number,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeJourneyMutationResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/journeys/${encodeURIComponent(journeyId)}/stops/${encodeURIComponent(stopId)}`,
    { method: "PATCH", body: JSON.stringify({ status, expectedVersion }) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeJourneyMutationResponseSchema);
}

export async function rateTraceDeeJourney(
  journeyId: string,
  input: { rating: number; tags?: string[]; review?: string },
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeRatingResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/journeys/${encodeURIComponent(journeyId)}/rating`,
    {
      method: "POST",
      body: JSON.stringify({
        rating: input.rating,
        tags: input.tags ?? [],
        review: input.review ?? ""
      })
    },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeRatingResponseSchema);
}

export async function createTraceDeePost(
  journeyId: string,
  input: { body: string; traceId?: string; placeId?: string },
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeePostResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/journeys/${encodeURIComponent(journeyId)}/posts`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeePostResponseSchema);
}

export async function getTraceDeeComments(threadId: string, options: { signal?: AbortSignal } = {}): Promise<ReturnType<typeof traceDeeCommentsResponseSchema.parse>> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/threads/${encodeURIComponent(threadId)}/comments`, { signal: options.signal });
  return parseContract(payload, traceDeeCommentsResponseSchema);
}

export async function getTraceDeePosts(traceIdOrSlug: string, options: { signal?: AbortSignal } = {}): Promise<ReturnType<typeof traceDeeCommunityPostsResponseSchema.parse>> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/traces/${encodeURIComponent(traceIdOrSlug)}/posts`, { signal: options.signal });
  return parseContract(payload, traceDeeCommunityPostsResponseSchema);
}

export async function createTraceDeeComment(
  threadId: string,
  input: { body: string; parentId?: string },
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeCommentResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/threads/${encodeURIComponent(threadId)}/comments`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeCommentResponseSchema);
}

export async function editTraceDeeContent(
  entityType: "POST" | "COMMENT",
  entityId: string,
  body: string,
  expectedUpdatedAt: string | undefined,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeContentMutationResponseSchema.parse>> {
  const resource = entityType === "POST" ? "posts" : "comments";
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/${resource}/${encodeURIComponent(entityId)}`,
    { method: "PATCH", body: JSON.stringify({ body, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) }) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeContentMutationResponseSchema);
}

export async function deleteTraceDeeContent(
  entityType: "POST" | "COMMENT",
  entityId: string,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeContentMutationResponseSchema.parse>> {
  const resource = entityType === "POST" ? "posts" : "comments";
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/${resource}/${encodeURIComponent(entityId)}`,
    { method: "DELETE" },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeContentMutationResponseSchema);
}

export async function setTraceDeeCommentHelpful(
  commentId: string,
  active: boolean,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeHelpfulResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/comments/${encodeURIComponent(commentId)}/helpful`,
    { method: "POST", body: JSON.stringify({ active }) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeHelpfulResponseSchema);
}

export async function setTraceDeeUserRelation(
  profileId: string,
  relation: "BLOCK" | "MUTE",
  active: boolean,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeUserRelationResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/profiles/${encodeURIComponent(profileId)}/relations`,
    { method: "POST", body: JSON.stringify({ relation, active }) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeUserRelationResponseSchema);
}

export async function getTraceDeeNotifications(options: { unreadOnly?: boolean; signal?: AbortSignal } = {}): Promise<ReturnType<typeof traceDeeNotificationsResponseSchema.parse>> {
  const params = new URLSearchParams();
  if (options.unreadOnly) params.set("unreadOnly", "true");
  const query = params.toString();
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/notifications${query ? `?${query}` : ""}`, { signal: options.signal });
  return parseContract(payload, traceDeeNotificationsResponseSchema);
}

export async function markTraceDeeNotificationRead(
  notificationId: string,
  read: boolean,
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeNotificationReadResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/tracedee/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST", body: JSON.stringify({ read }) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeNotificationReadResponseSchema);
}

export async function reportTraceDeeContent(
  input: { entityType: "TRACE" | "PLACE" | "POST" | "COMMENT" | "PROFILE"; entityId: string; reason: string; details?: string },
  idempotencyKey: string
): Promise<ReturnType<typeof traceDeeReportResponseSchema.parse>> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/tracedee/reports",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, traceDeeReportResponseSchema);
}

export async function getTraceDeeProfileExpertise(profileId: string, options: { signal?: AbortSignal } = {}): Promise<ReturnType<typeof traceDeeProfileExpertiseResponseSchema.parse>> {
  const payload = await requestJson<unknown>(`/api/v1/public/tracedee/profiles/${encodeURIComponent(profileId)}/expertise`, { signal: options.signal });
  return parseContract(payload, traceDeeProfileExpertiseResponseSchema);
}
