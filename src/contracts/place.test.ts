import { describe, expect, it } from "vitest";
import { placeMapOverlayResponseSchema, placeSummarySchema } from "@/contracts/place";

const baseSummary = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  slug: "baan-thai",
  name: "บ้านไทย",
  localizedNames: [
    { locale: "th", value: "บ้านไทย", kind: "canonical" },
    { locale: "en", value: "Baan Thai", kind: "transliteration" }
  ],
  category: { id: "restaurant", label: "Restaurant", localizedLabels: [] },
  status: "visible",
  displayPoint: { longitude: 100.54, latitude: 13.78 },
  labelPoint: null,
  area: "อารีย์ / Ari",
  address: {
    countryCode: "TH",
    country: "Thailand",
    administrativeArea1: "กรุงเทพมหานคร",
    administrativeArea2: "พญาไท",
    locality: "สามเสนใน",
    neighborhood: "อารีย์",
    street: "พหลโยธิน",
    houseNumber: "1",
    postalCode: "10400",
    formattedAddress: "1 ถนนพหลโยธิน กรุงเทพฯ 10400",
    localizedAddresses: []
  },
  parentPlaceId: null,
  verification: {
    status: "business_verified",
    label: "ยืนยันโดยธุรกิจ",
    verifiedAt: "2026-09-24T00:00:00.000Z",
    verificationRevision: "rev-1"
  },
  business: null,
  capabilities: {
    bookable: true,
    queueSupported: false,
    aevoPlayPartner: true,
    commerceEnabled: true,
    publicBookingRoute: "/stores/baan-thai/booking",
    freshness: {
      state: "fresh",
      observedAt: "2026-09-24T00:00:00.000Z",
      expiresAt: "2026-09-24T00:05:00.000Z",
      sourceRevision: "booking-rev-1"
    }
  },
  attribution: [],
  redirectFrom: null
};

describe("MAP-001 Go adapters", () => {
  it("accepts Thai/English semantic Place summaries", () => {
    expect(placeSummarySchema.parse(baseSummary).localizedNames).toHaveLength(2);
  });

  it("keeps live operational fields out of the strict map overlay", () => {
    const response = {
      contractVersion: "v1",
      schemaVersion: "1",
      projectionVersion: "places-public-v1",
      sourceRevision: "rev-1",
      generatedAt: "2026-09-24T00:00:00.000Z",
      freshness: {
        state: "fresh",
        observedAt: "2026-09-24T00:00:00.000Z",
        expiresAt: "2026-09-24T00:05:00.000Z",
        sourceRevision: "rev-1"
      },
      bounds: { west: 100, south: 13, east: 101, north: 14 },
      zoom: 12,
      features: [{
        type: "Feature",
        id: baseSummary.id,
        geometry: { type: "Point", coordinates: [100.54, 13.78] },
        properties: {
          featureKind: "place",
          placeId: baseSummary.id,
          name: baseSummary.name,
          categoryId: "restaurant",
          markerKind: "restaurant",
          verificationStatus: "business_verified",
          bookable: true,
          aevoPlayPartner: true,
          nextAvailableAt: "2026-09-24T01:00:00.000Z"
        }
      }],
      truncated: false,
      density: { mode: "points", featureCount: 1, clusterCount: 0, maxFeatures: 500 }
    };

    expect(() => placeMapOverlayResponseSchema.parse(response)).toThrow();
  });
});
