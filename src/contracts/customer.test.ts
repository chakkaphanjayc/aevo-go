import { describe, expect, it } from "vitest";
import { availabilityResponseSchema, discoveryResponseSchema } from "@/contracts/customer";

describe("customer API contracts", () => {
  it("accepts explicit currency, cursor and server-time availability data", () => {
    expect(discoveryResponseSchema.parse({ data: [], nextCursor: null })).toEqual({ data: [], nextCursor: null });
    expect(availabilityResponseSchema.parse({
      timezone: "Asia/Bangkok",
      slots: [{ id: "slot-1", startsAt: "2026-09-22T11:30:00+07:00", endsAt: "2026-09-22T12:30:00+07:00", status: "AVAILABLE", remaining: 2 }],
      serverTime: "2026-09-19T15:00:00+07:00"
    }).timezone).toBe("Asia/Bangkok");
  });

  it("rejects a response that tries to omit the stable pagination contract", () => {
    expect(() => discoveryResponseSchema.parse({ data: [] })).toThrow();
  });
});
