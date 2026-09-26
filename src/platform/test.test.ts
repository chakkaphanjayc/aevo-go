import { describe, expect, it } from "vitest";
import { TestPlatformBridge } from "@/platform/test";

describe("TestPlatformBridge", () => {
  it("keeps secure values behind the platform adapter contract", async () => {
    const bridge = new TestPlatformBridge();
    await bridge.setSecure("guest-session", "session-value");

    expect(await bridge.getSecure("guest-session")).toBe("session-value");
    await bridge.removeSecure("guest-session");
    expect(await bridge.getSecure("guest-session")).toBeNull();
    expect(bridge.calls).toEqual(["setSecure:guest-session", "getSecure:guest-session", "removeSecure:guest-session", "getSecure:guest-session"]);
  });
});
