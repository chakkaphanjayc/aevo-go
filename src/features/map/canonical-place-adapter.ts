import type { PlaceMapOverlayResponse } from "@/contracts/place";
import type { StoreMapSummary } from "./contracts";

const canonicalCategoryIds: Readonly<Record<string, string>> = {
  Activities: "activities",
  Cafe: "cafe",
  Dining: "restaurant",
  Stay: "hotel",
  Wellness: "wellness",
};

export function toCanonicalCategoryIds(categoryLabels: readonly string[]): string[] {
  return categoryLabels.map((label) => canonicalCategoryIds[label] ?? label);
}

export function toCanonicalOverlayStore(
  feature: PlaceMapOverlayResponse["features"][number],
  knownStores: ReadonlyMap<string, StoreMapSummary>,
): StoreMapSummary | null {
  if (feature.properties.featureKind !== "place" || feature.geometry.type !== "Point") {
    return null;
  }

  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const knownStore = knownStores.get(feature.properties.placeId);
  if (knownStore) {
    return {
      ...knownStore,
      point: { longitude, latitude },
      name: feature.properties.name,
      categoryIconKey: feature.properties.markerKind,
      isAevoPlayPartner: feature.properties.aevoPlayPartner,
    };
  }

  return {
    id: feature.properties.placeId,
    slug: feature.properties.placeId,
    name: feature.properties.name,
    point: { longitude, latitude },
    category: feature.properties.categoryId,
    categoryIconKey: feature.properties.markerKind,
    rating: null,
    reviewCount: 0,
    priceLevel: null,
    priceRange: "—",
    availableToday: null,
    availabilityLabel: null,
    area: "Public place",
    imageUrl: null,
    source: "customer",
    isAevoPlayPartner: feature.properties.aevoPlayPartner,
  };
}

export function canonicalPlaceDetailPath(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}`;
}
