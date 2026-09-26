import { afterEach, describe, expect, it, vi } from "vitest";
import { getCoreFeedPage, postCoreFeedEvents } from "@/lib/feed-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

const corePage = {
  feedSessionId: "feed-session-1",
  configVersion: "config-v1",
  rankingVersion: "deterministic-v1",
  items: [],
  nextCursor: "cursor-2",
  degraded: false,
  requestId: null,
};

describe("Explore Feed transport adapter", () => {
  it("uses the unified Core route with server pagination", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(corePage), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCoreFeedPage(
      { tab: "nearby", query: "coffee", area: "Ari", cursor: "cursor-1", limit: 24 },
    );

    expect(result.feedSessionId).toBe("feed-session-1");
    expect(result.nextCursor).toBe("cursor-2");
    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("/api/v1/public/feed?");
    expect(requestUrl).toContain("surface=explore");
    expect(requestUrl).toContain("tab=nearby");
    expect(requestUrl).toContain("q=coffee");
    expect(requestUrl).toContain("cursor=cursor-1");
  });

  it("posts a strict event batch to the Core route", async () => {
    const eventResponse = {
      accepted: 1,
      duplicates: 0,
      sampledOut: 0,
      rejected: 0,
      results: [{ eventId: "event-1", status: "ACCEPTED" }],
      requestId: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(eventResponse), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postCoreFeedEvents({
      events: [{
        schemaVersion: "1",
        eventId: "event-1",
        eventName: "impression",
        feedSessionId: "feed-session-1",
        itemToken: "opaque-token",
        occurredAt: "2026-09-25T00:00:00.000Z",
        source: "TRACE",
      }],
    });

    expect(result.accepted).toBe(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/feed/events");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).events[0].itemToken).toBe("opaque-token");
  });
});
