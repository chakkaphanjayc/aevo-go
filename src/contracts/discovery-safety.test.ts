import { describe, expect, it } from "vitest";
import { isPublicDiscoveryUgc } from "@/contracts/discovery-safety";

describe("Discovery UGC safety contract", () => {
  it("fails closed until an approved public variant exists", () => {
    const base = {
      kind: "PHOTO",
      status: "APPROVED",
      publicVariantAvailable: true,
    } as const;
    expect(isPublicDiscoveryUgc(base)).toBe(true);
    expect(isPublicDiscoveryUgc({ ...base, status: "QUARANTINED" })).toBe(false);
    expect(isPublicDiscoveryUgc({ ...base, publicVariantAvailable: false })).toBe(false);
    expect(isPublicDiscoveryUgc({ ...base, reasonCode: "MODERATION_UNAVAILABLE" })).toBe(false);
  });

  it("rejects unsafe and unknown payloads", () => {
    expect(isPublicDiscoveryUgc({
      kind: "PHOTO",
      status: "REJECTED",
      publicVariantAvailable: false,
      reasonCode: "SEXUAL_OR_EXPLICIT",
    })).toBe(false);
    expect(isPublicDiscoveryUgc({ kind: "UNKNOWN", status: "APPROVED", publicVariantAvailable: true })).toBe(false);
  });
});

