import { describe, expect, it } from "vitest";
import { resolveFeedFeedbackPersistence } from "@/features/discovery/feed-feedback-policy";

describe("Feed feedback persistence", () => {
  it("uses Core only for an authenticated live session", () => {
    expect(resolveFeedFeedbackPersistence("live", true)).toBe("core");
    expect(resolveFeedFeedbackPersistence("live", false)).toBe("session");
    expect(resolveFeedFeedbackPersistence("demo", true)).toBe("session");
    expect(resolveFeedFeedbackPersistence("demo", false)).toBe("session");
  });
});
