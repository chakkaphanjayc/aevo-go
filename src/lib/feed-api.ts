import {
  feedEventBatchResponseSchema,
  feedNegativeFeedbackHistoryResponseSchema,
  feedNegativeFeedbackResponseSchema,
  feedResponseSchema,
  type FeedEventBatch,
  type FeedEventBatchResponse,
  type FeedNegativeFeedbackRequest,
  type FeedNegativeFeedbackHistoryResponse,
  type FeedNegativeFeedbackResponse,
  type FeedResponse,
  type FeedTab,
} from "@/contracts/feed";
import { requestJson } from "@/lib/api-client";
import { createIdempotencyKey } from "@/lib/idempotency";

export interface ExploreFeedQuery {
  tab?: FeedTab;
  query?: string;
  area?: string;
  vibe?: string;
  category?: string;
  date?: string;
  partySize?: number;
  cursor?: string;
  limit?: number;
}

function coreFeedQueryString(query: ExploreFeedQuery): string {
  const params = new URLSearchParams({ surface: "explore" });
  if (query.tab) params.set("tab", query.tab);
  if (query.query) params.set("q", query.query);
  if (query.area) params.set("area", query.area);
  if (query.vibe) params.set("vibe", query.vibe);
  if (query.category) params.set("category", query.category);
  if (query.date) params.set("date", query.date);
  if (query.partySize) params.set("party", String(query.partySize));
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  return `?${params.toString()}`;
}

export async function getCoreFeedPage(
  query: ExploreFeedQuery = {},
  options: { signal?: AbortSignal } = {},
): Promise<FeedResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/feed${coreFeedQueryString(query)}`,
    { signal: options.signal },
  );
  return feedResponseSchema.parse(payload);
}

export async function postCoreFeedEvents(
  batch: FeedEventBatch,
): Promise<FeedEventBatchResponse> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/feed/events",
    { method: "POST", body: JSON.stringify(batch) },
    { idempotencyKey: createIdempotencyKey("feed-events") },
  );
  return feedEventBatchResponseSchema.parse(payload);
}

export async function postCoreFeedFeedback(
  request: FeedNegativeFeedbackRequest,
): Promise<FeedNegativeFeedbackResponse> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/feed/feedback",
    { method: "POST", body: JSON.stringify(request) },
    { idempotencyKey: createIdempotencyKey("feed-feedback") },
  );
  return feedNegativeFeedbackResponseSchema.parse(payload);
}

export async function getCoreFeedFeedbackHistory(
  limit = 20,
  options: { signal?: AbortSignal } = {},
): Promise<FeedNegativeFeedbackHistoryResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  const payload = await requestJson<unknown>(
    `/api/v1/public/feed/feedback/history?${params.toString()}`,
    { signal: options.signal },
  );
  return feedNegativeFeedbackHistoryResponseSchema.parse(payload);
}
