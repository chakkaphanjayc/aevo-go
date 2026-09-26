import { describe, expect, it } from "vitest";
import { ApiClientError, isGatewayOfflineError } from "@/lib/api-client";

describe("isGatewayOfflineError", () => {
  it("classifies fetch connection failures as offline", () => {
    expect(isGatewayOfflineError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not turn HTTP or cancelled requests into offline fallback", () => {
    expect(isGatewayOfflineError(new ApiClientError(503, "UNAVAILABLE", "Unavailable"))).toBe(false);
    expect(isGatewayOfflineError(new DOMException("Cancelled", "AbortError"))).toBe(false);
  });
});

