import {
  parseMapBounds,
  serializeMapBounds,
  type MapBounds,
  type MapMode,
  type MapSearchFilters,
  type MapSort,
} from "./contracts";

export interface MapUrlState {
  filters: MapSearchFilters;
  mode: MapMode;
  sort: MapSort;
  cameraBounds: MapBounds | null;
  zoom: number;
  searched: boolean;
  selectedSlug: string | null;
}

function parseIntegerList(value: string | null): number[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((item) => Number.isInteger(item) && item >= 1 && item <= 4),
    ),
  ];
}

function parseStringList(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

function parsePartySize(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20
    ? parsed
    : undefined;
}

function parseRating(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) &&
    parsed >= 1 &&
    parsed <= 5 &&
    Math.round(parsed * 2) === parsed * 2
    ? parsed
    : undefined;
}

export function readMapUrlState(params: URLSearchParams): MapUrlState {
  const legacyCategory = params.get("category")?.trim() ?? "";
  const categoryIds = parseStringList(params.get("categoryIds"));
  const partySize = parsePartySize(params.get("partySize"));
  const ratingMin = parseRating(params.get("ratingMin"));
  const mode = params.get("mode") === "traces" ? "traces" : "places";
  const rawSort = params.get("sort");
  const sort: MapSort =
    rawSort === "nearest" || rawSort === "rating" ? rawSort : "relevant";
  return {
    filters: {
      ...(params.get("q")?.trim() ? { query: params.get("q")!.trim() } : {}),
      ...(params.get("area")?.trim()
        ? { area: params.get("area")!.trim() }
        : {}),
      categoryIds:
        categoryIds.length > 0
          ? categoryIds
          : legacyCategory
            ? [legacyCategory]
            : [],
      priceLevels: parseIntegerList(params.get("priceLevels")),
      ...(params.get("availableAt")?.trim()
        ? { availableAt: params.get("availableAt")!.trim() }
        : {}),
      ...(params.get("reservable") === "1" ? { reservableOnly: true } : {}),
      ...(partySize === undefined ? {} : { partySize }),
      ...(ratingMin === undefined ? {} : { ratingMin }),
      ...(params.get("tasteMatch") === "1" ? { tasteMatch: true } : {}),
      ...(params.get("saved") === "1" ? { savedOnly: true } : {}),
      ...(params.get("following") === "1" ? { followingOnly: true } : {}),
    },
    mode,
    sort,
    cameraBounds: parseMapBounds(params.get("bbox")),
    zoom: Math.min(22, Math.max(0, Number(params.get("zoom") ?? 12) || 12)),
    searched: params.get("searched") === "1",
    selectedSlug:
      params.get("selected")?.trim() || params.get("trace")?.trim() || null,
  };
}

export interface MapUrlUpdates {
  query?: string;
  area?: string;
  categoryIds?: string[];
  priceLevels?: number[];
  availableAt?: string;
  reservableOnly?: boolean;
  partySize?: number;
  ratingMin?: number;
  tasteMatch?: boolean;
  savedOnly?: boolean;
  followingOnly?: boolean;
  mode?: MapMode;
  sort?: MapSort;
  cameraBounds?: MapBounds | null;
  zoom?: number;
  searched?: boolean;
  selectedSlug?: string | null;
}

export function updateMapUrlState(
  current: URLSearchParams,
  updates: MapUrlUpdates,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const setOrDelete = (key: string, value: string | undefined) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };

  if (updates.query !== undefined) setOrDelete("q", updates.query.trim());
  if (updates.area !== undefined) setOrDelete("area", updates.area.trim());
  if (updates.categoryIds !== undefined) {
    setOrDelete("categoryIds", updates.categoryIds.filter(Boolean).join(","));
    next.delete("category");
  }
  if (updates.priceLevels !== undefined)
    setOrDelete("priceLevels", updates.priceLevels.join(","));
  if (updates.availableAt !== undefined)
    setOrDelete("availableAt", updates.availableAt);
  if (updates.reservableOnly !== undefined)
    setOrDelete("reservable", updates.reservableOnly ? "1" : undefined);
  if (updates.partySize !== undefined)
    setOrDelete(
      "partySize",
      updates.partySize > 0 ? String(updates.partySize) : undefined,
    );
  if (updates.ratingMin !== undefined)
    setOrDelete(
      "ratingMin",
      updates.ratingMin >= 1 ? String(updates.ratingMin) : undefined,
    );
  if (updates.tasteMatch !== undefined)
    setOrDelete("tasteMatch", updates.tasteMatch ? "1" : undefined);
  if (updates.savedOnly !== undefined)
    setOrDelete("saved", updates.savedOnly ? "1" : undefined);
  if (updates.followingOnly !== undefined)
    setOrDelete("following", updates.followingOnly ? "1" : undefined);
  if (updates.mode !== undefined)
    setOrDelete("mode", updates.mode === "places" ? undefined : updates.mode);
  if (updates.sort !== undefined)
    setOrDelete("sort", updates.sort === "relevant" ? undefined : updates.sort);
  if (updates.cameraBounds !== undefined) {
    if (updates.cameraBounds)
      next.set("bbox", serializeMapBounds(updates.cameraBounds));
    else next.delete("bbox");
  }
  if (updates.zoom !== undefined)
    next.set("zoom", String(Math.round(updates.zoom)));
  if (updates.searched !== undefined) {
    if (updates.searched) next.set("searched", "1");
    else next.delete("searched");
  }
  if (updates.selectedSlug !== undefined) {
    setOrDelete("selected", updates.selectedSlug ?? undefined);
    next.delete("trace");
  }
  return next;
}
