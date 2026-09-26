import type { CustomerStoreSummary } from "@/contracts/customer";

export type GeoPoint = Readonly<{
  longitude: number;
  latitude: number;
}>;

export type MapBounds = Readonly<{
  west: number;
  south: number;
  east: number;
  north: number;
}>;

export type MapSearchFilters = Readonly<{
  query?: string;
  area?: string;
  categoryIds: string[];
  priceLevels: number[];
  availableAt?: string;
  reservableOnly?: boolean;
  partySize?: number;
  ratingMin?: number;
  tasteMatch?: boolean;
  savedOnly?: boolean;
  followingOnly?: boolean;
}>;

export type MapMode = "places" | "traces";
export type MapSort = "relevant" | "nearest" | "rating";

export type MapDiscoveryStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "offline";

export interface StoreMapSummary {
  id: string;
  slug: string;
  name: string;
  point: GeoPoint;
  category: string;
  categoryIconKey: string;
  rating: number | null;
  reviewCount: number;
  priceLevel: number | null;
  priceRange: string;
  availableToday: boolean | null;
  availabilityLabel: string | null;
  area: string;
  imageUrl: string | null;
  source?: "customer" | "osm";
  isAevoPlayPartner?: boolean;
  venueSlug?: string;
  publicBookingRoute?: string | null;
  website?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  osmId?: string;
  distanceMeters?: number;
}

export interface StoreFeatureProperties {
  storeId: string;
  slug: string;
  name: string;
  categoryIconKey: string;
  category: string;
  ratingLabel: string;
  priceLevel: number | null;
  availableToday: boolean | null;
  /** Kept as a text fallback for map styles that cannot load custom images. */
  categoryMark: string;
  markerIcon: string;
  source: "customer" | "osm";
  isAevoPlayPartner: boolean;
}

export interface StoreFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: StoreFeatureProperties;
}

export interface StoreFeatureCollection {
  type: "FeatureCollection";
  features: StoreFeature[];
}

export interface TraceMapSummary {
  id: string;
  slug: string;
  title: string;
  area: string;
  stopCount: number;
  durationMinutes: number | null;
  distanceKm: number | null;
  matchLabel: string | null;
  followerCount: number;
  remixCount: number;
  route: GeoPoint[];
}

export interface TraceFeatureProperties {
  traceId: string;
  slug: string;
  title: string;
  area: string;
  stopCount: number;
}

export interface TraceFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: TraceFeatureProperties;
}

export interface TraceFeatureCollection {
  type: "FeatureCollection";
  features: TraceFeature[];
}

export function parseMapBounds(
  value: string | null | undefined,
): MapBounds | null {
  if (!value) return null;
  const values = value.split(",").map((part) => Number(part.trim()));
  if (values.length !== 4 || values.some((part) => !Number.isFinite(part)))
    return null;
  const [west, south, east, north] = values;
  if (
    west < -180 ||
    west > 180 ||
    east < -180 ||
    east > 180 ||
    south < -90 ||
    south > 90 ||
    north < -90 ||
    north > 90
  )
    return null;
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

export function serializeMapBounds(bounds: MapBounds): string {
  return [bounds.west, bounds.south, bounds.east, bounds.north]
    .map((value) => value.toFixed(6))
    .join(",");
}

export function isMapBoundsEqual(
  left: MapBounds | null,
  right: MapBounds | null,
): boolean {
  if (!left || !right) return left === right;
  return (
    Math.abs(left.west - right.west) < 0.000001 &&
    Math.abs(left.south - right.south) < 0.000001 &&
    Math.abs(left.east - right.east) < 0.000001 &&
    Math.abs(left.north - right.north) < 0.000001
  );
}

function priceLevelFromRange(value: string): number | null {
  const digits = value.replace(/[^0-9]/gu, "");
  if (digits) {
    const parsed = Number(digits);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4
      ? parsed
      : null;
  }
  const symbols = value.match(/[฿$€£]/gu);
  return symbols && symbols.length >= 1 && symbols.length <= 4
    ? symbols.length
    : null;
}

export function toStoreMapSummary(
  store: CustomerStoreSummary,
): StoreMapSummary | null {
  if (typeof store.latitude !== "number" || typeof store.longitude !== "number")
    return null;
  if (!Number.isFinite(store.latitude) || !Number.isFinite(store.longitude))
    return null;
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    point: { latitude: store.latitude, longitude: store.longitude },
    category: store.category,
    categoryIconKey:
      store.categoryIconKey ??
      store.category.toLocaleLowerCase().replace(/\s+/gu, "-"),
    rating: store.rating,
    reviewCount: store.reviewCount,
    priceLevel: store.priceLevel ?? priceLevelFromRange(store.priceRange),
    priceRange: store.priceRange,
    availableToday:
      store.availableToday ?? (store.availabilityLabel ? true : null),
    availabilityLabel: store.availabilityLabel,
    area: store.area,
    imageUrl: store.imageUrl,
    source: "customer",
    isAevoPlayPartner: store.isAevoPlayPartner === true,
    ...(store.venueSlug ? { venueSlug: store.venueSlug } : {}),
    ...(store.publicBookingRoute !== undefined
      ? { publicBookingRoute: store.publicBookingRoute }
      : {}),
    ...(store.distanceMeters === undefined
      ? {}
      : { distanceMeters: store.distanceMeters }),
  };
}

export function toStoreFeatureCollection(
  stores: readonly StoreMapSummary[],
): StoreFeatureCollection {
  const markerIcon = (store: StoreMapSummary): string => {
    if (store.isAevoPlayPartner) return "aevocado-partner";
    const iconKey = store.categoryIconKey.toLocaleLowerCase();
    const category = store.category.toLocaleLowerCase();
    if (iconKey === "cafe" || category === "cafe") return "aevocado-cafe";
    if (iconKey === "bar" || category === "bar") return "aevocado-bar";
    if (
      iconKey === "restaurant" ||
      iconKey === "dining" ||
      category === "restaurant" ||
      category === "dining"
    )
      return "aevocado-dining";
    if (
      iconKey === "fitness" ||
      iconKey === "wellness" ||
      category === "fitness" ||
      category === "wellness"
    )
      return "aevocado-wellness";
    if (
      iconKey === "hotel" ||
      iconKey === "stay" ||
      category === "hotel" ||
      category === "stay"
    )
      return "aevocado-stay";
    if (
      iconKey === "attraction" ||
      iconKey === "activities" ||
      category === "attraction" ||
      category === "activities"
    )
      return "aevocado-activities";
    return "aevocado-default";
  };
  const categoryMark = (store: StoreMapSummary): string => {
    const iconKey = store.categoryIconKey.toLocaleLowerCase();
    const category = store.category.toLocaleLowerCase();
    if (iconKey === "cafe" || category === "cafe") return "C";
    if (iconKey === "bar" || category === "bar") return "B";
    if (
      iconKey === "restaurant" ||
      iconKey === "dining" ||
      category === "restaurant" ||
      category === "dining"
    )
      return "D";
    if (
      iconKey === "fitness" ||
      iconKey === "wellness" ||
      category === "fitness" ||
      category === "wellness"
    )
      return "W";
    if (
      iconKey === "hotel" ||
      iconKey === "stay" ||
      category === "hotel" ||
      category === "stay"
    )
      return "S";
    return "A";
  };
  return {
    type: "FeatureCollection",
    features: stores.map((store) => ({
      type: "Feature",
      id: store.id,
      geometry: {
        type: "Point",
        coordinates: [store.point.longitude, store.point.latitude],
      },
      properties: {
        storeId: store.id,
        slug: store.slug,
        name: store.name,
        categoryIconKey: store.categoryIconKey,
        category: store.category,
        ratingLabel: store.rating === null ? "" : store.rating.toFixed(1),
        priceLevel: store.priceLevel,
        availableToday: store.availableToday,
        categoryMark: categoryMark(store),
        markerIcon: markerIcon(store),
        source: store.source ?? "customer",
        isAevoPlayPartner: store.isAevoPlayPartner === true,
      },
    })),
  };
}

export function toTraceFeatureCollection(
  traces: readonly TraceMapSummary[],
): TraceFeatureCollection {
  return {
    type: "FeatureCollection",
    features: traces
      .filter((trace) => trace.route.length > 1)
      .map((trace) => ({
        type: "Feature",
        id: trace.id,
        geometry: {
          type: "LineString",
          coordinates: trace.route.map((point) => [
            point.longitude,
            point.latitude,
          ]),
        },
        properties: {
          traceId: trace.id,
          slug: trace.slug,
          title: trace.title,
          area: trace.area,
          stopCount: trace.stopCount,
        },
      })),
  };
}
