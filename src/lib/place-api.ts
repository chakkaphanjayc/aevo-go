import {
  placeDetailResponseSchema,
  placeMapOverlayResponseSchema,
  placeNearbyResponseSchema,
  placeSaveResponseSchema,
  placeSearchResponseSchema,
  savedPlacesResponseSchema,
  type PlaceDetail,
  type PlaceMapOverlayResponse,
  type PlaceNearbyResponse,
  type PlaceSaveResponse,
  type PlaceSearchResponse,
  type SavedPlacesResponse
} from "@/contracts/place";
import { requestJson } from "@/lib/api-client";

export interface PlaceBoundsQuery {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface PlaceMapOverlayQuery extends PlaceBoundsQuery {
  zoom: number;
  query?: string;
  categoryIds?: string[];
  limit?: number;
  savedOnly?: boolean;
}

export interface PlaceSearchQuery {
  query?: string;
  area?: string;
  bounds?: PlaceBoundsQuery;
  categoryIds?: string[];
  sort?: "relevance" | "distance" | "rating" | "updated";
  cursor?: string;
  limit?: number;
  savedOnly?: boolean;
}

export interface PlaceNearbyQuery {
  longitude: number;
  latitude: number;
  radiusMeters: number;
  categoryIds?: string[];
  cursor?: string;
  limit?: number;
}

function toQueryString(entries: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? "?" + encoded : "";
}

function boundsEntries(bounds: PlaceBoundsQuery | undefined): Record<string, number | undefined> {
  return bounds
    ? { west: bounds.west, south: bounds.south, east: bounds.east, north: bounds.north }
    : {};
}

function parse<T>(payload: unknown, parser: { parse(value: unknown): T }): T {
  return parser.parse(payload);
}

export async function getPlaceMapOverlay(
  query: PlaceMapOverlayQuery,
  options: { signal?: AbortSignal } = {}
): Promise<PlaceMapOverlayResponse> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/places/map" + toQueryString({
      ...boundsEntries(query),
      zoom: query.zoom,
      q: query.query,
      categoryId: query.categoryIds?.join(","),
      limit: query.limit,
      savedOnly: query.savedOnly ? "true" : undefined
    }),
    { signal: options.signal }
  );
  return parse(payload, placeMapOverlayResponseSchema);
}

export async function searchPlaces(
  query: PlaceSearchQuery,
  options: { signal?: AbortSignal } = {}
): Promise<PlaceSearchResponse> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/places/search" + toQueryString({
      q: query.query,
      area: query.area,
      ...boundsEntries(query.bounds),
      categoryId: query.categoryIds?.join(","),
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
      savedOnly: query.savedOnly ? "true" : undefined
    }),
    { signal: options.signal }
  );
  return parse(payload, placeSearchResponseSchema);
}

export async function getNearbyPlaces(
  query: PlaceNearbyQuery,
  options: { signal?: AbortSignal } = {}
): Promise<PlaceNearbyResponse> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/places/nearby" + toQueryString({
      longitude: query.longitude,
      latitude: query.latitude,
      radiusMeters: query.radiusMeters,
      categoryId: query.categoryIds?.join(","),
      cursor: query.cursor,
      limit: query.limit
    }),
    { signal: options.signal }
  );
  return parse(payload, placeNearbyResponseSchema);
}

export async function getPlaceDetail(
  placeId: string,
  options: { signal?: AbortSignal } = {}
): Promise<PlaceDetail> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/places/" + encodeURIComponent(placeId),
    { signal: options.signal }
  );
  return parse(payload, placeDetailResponseSchema).place;
}

export async function listSavedCanonicalPlaces(
  options: { signal?: AbortSignal } = {}
): Promise<SavedPlacesResponse["savedPlaces"]> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/me/saved-places",
    { signal: options.signal }
  );
  return parse(payload, savedPlacesResponseSchema).savedPlaces;
}

export async function setCanonicalPlaceSaved(
  placeId: string,
  saved: boolean,
  idempotencyKey: string
): Promise<PlaceSaveResponse> {
  const payload = await requestJson<unknown>(
    "/api/v1/public/places/" + encodeURIComponent(placeId) + "/save",
    { method: saved ? "POST" : "DELETE" },
    { idempotencyKey }
  );
  return parse(payload, placeSaveResponseSchema);
}
