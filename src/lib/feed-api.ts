import {
  feedEventBatchResponseSchema,
  feedResponseSchema,
  type FeedEventBatch,
  type FeedEventBatchResponse,
  type FeedResponse,
  type FeedTab,
} from "@/contracts/feed";
import { requestJson } from "@/lib/api-client";
import { createIdempotencyKey } from "@/lib/idempotency";

export interface ExploreFeedQuery {
  tab?: FeedTab;
  query?: string;
  area?: string;
  cursor?: string;
  limit?: number;
}

function coreFeedQueryString(query: ExploreFeedQuery): string {
  const params = new URLSearchParams({ surface: "explore" });
  if (query.tab) params.set("tab", query.tab);
  if (query.query) params.set("q", query.query);
  if (query.area) params.set("area", query.area);
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
