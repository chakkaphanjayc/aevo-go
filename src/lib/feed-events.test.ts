import { describe, expect, it, vi } from "vitest";
import { FeedEventQueue } from "@/lib/feed-events";

describe("Core Feed event queue", () => {
  it("batches events and preserves event IDs after a failed send", async () => {
    const sender = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ accepted: 2, duplicates: 0, sampledOut: 0, rejected: 0, results: [] });
    const queue = new FeedEventQueue(sender);

    queue.enqueue({ eventName: "impression", feedSessionId: "session-1", itemToken: "token-1", source: "TRACE" });
    queue.enqueue({ eventName: "open", feedSessionId: "session-1", itemToken: "token-1", source: "TRACE" });
    expect(queue.pendingCount).toBe(2);

    await queue.flush();
    expect(queue.pendingCount).toBe(2);
    await queue.flush();
    expect(queue.pendingCount).toBe(0);
    expect(sender).toHaveBeenCalledTimes(2);
    expect(sender.mock.calls[1]?.[0].events[0].eventId).toBe(sender.mock.calls[0]?.[0].events[0].eventId);
  });
});
