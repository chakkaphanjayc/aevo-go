import { afterEach, describe, expect, it, vi } from "vitest";
import { getCoreFeedFeedbackHistory, getCoreFeedPage, postCoreFeedEvents, postCoreFeedFeedback } from "@/lib/feed-api";

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

  it("sends explicit discovery intent as request-local context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(corePage), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getCoreFeedPage({
      tab: "for_you",
      vibe: "art",
      category: "cafe",
      date: "2026-09-26",
      partySize: 2,
    });

    const requestUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestUrl).toContain("vibe=art");
    expect(requestUrl).toContain("category=cafe");
    expect(requestUrl).toContain("date=2026-09-26");
    expect(requestUrl).toContain("party=2");
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

  it("posts authenticated negative feedback to the Core route", async () => {
    const feedbackResponse = {
      itemType: "TRACE",
      itemId: "trace-1",
      action: "HIDE",
      active: true,
      updatedAt: "2026-09-26T00:00:00.000Z",
      requestId: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(feedbackResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postCoreFeedFeedback({
      schemaVersion: "1",
      feedSessionId: "feed-session-1",
      itemToken: "opaque-token",
      action: "hide",
      reasonCode: "TOO_FAR",
    });

    expect(result.itemType).toBe("TRACE");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/feed/feedback");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: "hide",
      reasonCode: "TOO_FAR",
    });

    const restoreResponse = {
      ...feedbackResponse,
      active: false,
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(restoreResponse), { status: 200 }));
    const restored = await postCoreFeedFeedback({
      schemaVersion: "1",
      feedSessionId: "feed-session-1",
      itemToken: "opaque-token",
      action: "unhide",
    });
    expect(restored.active).toBe(false);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).action).toBe("unhide");
  });

  it("reads the authenticated private feedback history without exposing tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      entries: [{
        itemType: "TRACE",
        itemId: "trace-1",
        action: "HIDE",
        reasonCode: "TOO_FAR",
        active: true,
        createdAt: "2026-09-26T00:00:00.000Z",
      }],
      requestId: null,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCoreFeedFeedbackHistory(5);

    expect(result.entries).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/public/feed/feedback/history?limit=5",
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body ?? "")).not.toContain("itemToken");
  });
});
