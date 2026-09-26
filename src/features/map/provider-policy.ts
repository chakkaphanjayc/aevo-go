import { appEnvironment, mapStyleAttribution, mapStyleUrl, osmOverpassMode } from "@/lib/env";

export type GeocoderMode = "disabled" | "server";

export interface PlaceGeocoderResult {
  provider: string;
  displayName: string;
  point: { longitude: number; latitude: number };
  address: {
    countryCode: string | null;
    administrativeArea1: string | null;
    administrativeArea2: string | null;
    locality: string | null;
    neighborhood: string | null;
    street: string | null;
    houseNumber: string | null;
    postalCode: string | null;
    formattedAddress: string | null;
  };
  temporary: true;
  observedAt: string;
  expiresAt: string | null;
  attribution: string;
}

export interface PlaceGeocoderProvider {
  forward(query: string, options?: { signal?: AbortSignal }): Promise<PlaceGeocoderResult[]>;
  reverse(point: { longitude: number; latitude: number }, options?: { signal?: AbortSignal }): Promise<PlaceGeocoderResult | null>;
}

export interface MapProviderPolicy {
  environment: string;
  styleUrl: string;
  styleAttribution: string;
  placeDataAttribution: string;
  geocoderMode: GeocoderMode;
  geocoder: PlaceGeocoderProvider | null;
  allowDirectExternalPlaceRequests: boolean;
}

export const mapProviderPolicy: MapProviderPolicy = {
  environment: appEnvironment,
  styleUrl: mapStyleUrl,
  styleAttribution: mapStyleAttribution,
  placeDataAttribution: osmOverpassMode === "remote"
    ? "© OpenStreetMap contributors · temporary development source"
    : "Aevo public Place projection",
  geocoderMode: "disabled",
  geocoder: null,
  allowDirectExternalPlaceRequests: false
};

export function mapAttribution(policy: MapProviderPolicy = mapProviderPolicy): string {
  return [policy.styleAttribution, policy.placeDataAttribution]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
}

export function isProductionSafeMapPolicy(policy: MapProviderPolicy): boolean {
  return policy.allowDirectExternalPlaceRequests === false
    && policy.styleUrl.startsWith("https://")
    && policy.styleAttribution.trim().length > 0
    && (policy.geocoderMode === "disabled" || policy.geocoder !== null);
}
