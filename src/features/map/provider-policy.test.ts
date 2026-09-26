import { describe, expect, it } from "vitest";
import { isProductionSafeMapPolicy, mapAttribution } from "@/features/map/provider-policy";

describe("map provider policy", () => {
  it("keeps provider attribution and direct external place requests explicit", () => {
    const policy = {
      environment: "production",
      styleUrl: "https://tiles.example.invalid/style.json",
      styleAttribution: "© Example Tiles",
      placeDataAttribution: "Aevo public Place projection",
      geocoderMode: "disabled" as const,
      geocoder: null,
      allowDirectExternalPlaceRequests: false as const
    };

    expect(isProductionSafeMapPolicy(policy)).toBe(true);
    expect(mapAttribution(policy)).toContain("© Example Tiles");
    expect(mapAttribution(policy)).toContain("Aevo public Place projection");
  });

  it("rejects a client policy that would call an external POI source directly", () => {
    expect(isProductionSafeMapPolicy({
      environment: "production",
      styleUrl: "https://tiles.example.invalid/style.json",
      styleAttribution: "© Example Tiles",
      placeDataAttribution: "External POI",
      geocoderMode: "disabled",
      geocoder: null,
      allowDirectExternalPlaceRequests: true
    })).toBe(false);
  });
});
