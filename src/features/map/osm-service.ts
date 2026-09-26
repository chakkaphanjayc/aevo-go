import type { MapBounds, StoreMapSummary } from "./contracts";

export type OsmQueryMode = "disabled" | "mock" | "remote";

export interface OsmPlace {
  osmId: string;
  name: string;
  nameTh: string | null;
  category: string;
  categoryIconKey: string;
  openingHours: string | null;
  website: string | null;
  phone: string | null;
  point: Readonly<{ latitude: number; longitude: number }>;
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

interface OverpassResponse {
  elements?: unknown;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REMOTE_PLACES = 100;
const MAX_REMOTE_SPAN_DEGREES = 1.2;
const cache = new Map<string, { expiresAt: number; places: OsmPlace[] }>();
const inFlight = new Map<string, Promise<OsmPlace[]>>();

const mockPlaces: readonly OsmPlace[] = [
  {
    osmId: "node/100001",
    name: "River City Bangkok",
    nameTh: "ริเวอร์ ซิตี้ แบงค็อก",
    category: "Activities",
    categoryIconKey: "attraction",
    openingHours: "Mo-Su 10:00-22:00",
    website: "https://www.rivercitybangkok.com",
    phone: null,
    point: { latitude: 13.7307, longitude: 100.5112 },
  },
  {
    osmId: "node/100002",
    name: "Bangkok Art and Culture Centre",
    nameTh: "หอศิลปวัฒนธรรมแห่งกรุงเทพมหานคร",
    category: "Activities",
    categoryIconKey: "attraction",
    openingHours: "Tu-Su 10:00-20:00",
    website: "https://www.bacc.or.th",
    phone: null,
    point: { latitude: 13.7465, longitude: 100.5301 },
  },
  {
    osmId: "node/100003",
    name: "Yaowarat Street Food",
    nameTh: "สตรีทฟู้ดย่านเยาวราช",
    category: "Dining",
    categoryIconKey: "restaurant",
    openingHours: "Mo-Su 17:00-00:00",
    website: null,
    phone: null,
    point: { latitude: 13.7396, longitude: 100.5099 },
  },
  {
    osmId: "node/100004",
    name: "Ari Community Market",
    nameTh: "อารีย์คอมมูนิตี้มาร์เก็ต",
    category: "Dining",
    categoryIconKey: "restaurant",
    openingHours: "Mo-Su 09:00-21:00",
    website: null,
    phone: null,
    point: { latitude: 13.7791, longitude: 100.5449 },
  },
  {
    osmId: "node/100005",
    name: "Lumphini Fitness Centre",
    nameTh: "ศูนย์กีฬาและฟิตเนสลุมพินี",
    category: "Wellness",
    categoryIconKey: "fitness",
    openingHours: "Mo-Su 06:00-20:00",
    website: null,
    phone: null,
    point: { latitude: 13.7307, longitude: 100.5417 },
  },
  {
    osmId: "node/100006",
    name: "Warehouse 30",
    nameTh: "แวร์เฮ้าส์ 30",
    category: "Activities",
    categoryIconKey: "attraction",
    openingHours: "Mo-Su 10:00-19:00",
    website: "https://www.warehouse30.com",
    phone: null,
    point: { latitude: 13.7285, longitude: 100.5141 },
  },
];

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tagValue(tags: Record<string, unknown> | undefined, key: string): string | null {
  const value = tags?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function areaKey(bounds: MapBounds): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return [round(bounds.west), round(bounds.south), round(bounds.east), round(bounds.north)].join(",");
}

function inBounds(place: OsmPlace, bounds: MapBounds): boolean {
  return place.point.longitude >= bounds.west &&
    place.point.longitude <= bounds.east &&
    place.point.latitude >= bounds.south &&
    place.point.latitude <= bounds.north;
}

function distanceBetweenPlaces(left: OsmPlace, right: OsmPlace): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(right.point.latitude - left.point.latitude);
  const longitudeDelta = toRadians(right.point.longitude - left.point.longitude);
  const leftLatitude = toRadians(left.point.latitude);
  const rightLatitude = toRadians(right.point.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function dedupePlaces(places: readonly OsmPlace[]): OsmPlace[] {
  const unique: OsmPlace[] = [];
  for (const place of places) {
    if (
      unique.some(
        (existing) =>
          existing.osmId === place.osmId ||
          (normalizePlaceName(existing.name) === normalizePlaceName(place.name) &&
            distanceBetweenPlaces(existing, place) < 15) ||
          distanceBetweenPlaces(existing, place) < 15,
      )
    )
      continue;
    unique.push(place);
  }
  return unique;
}

function categoryFromTags(tags: Record<string, unknown> | undefined): Pick<OsmPlace, "category" | "categoryIconKey"> {
  const amenity = tagValue(tags, "amenity");
  const leisure = tagValue(tags, "leisure");
  const tourism = tagValue(tags, "tourism");
  if (amenity === "cafe") return { category: "Cafe", categoryIconKey: "cafe" };
  if (amenity === "bar") return { category: "Dining", categoryIconKey: "bar" };
  if (amenity === "restaurant") return { category: "Dining", categoryIconKey: "restaurant" };
  if (leisure === "fitness_centre" || leisure === "sports_centre") {
    return { category: "Wellness", categoryIconKey: "fitness" };
  }
  if (tourism === "hotel") return { category: "Stay", categoryIconKey: "hotel" };
  return { category: "Activities", categoryIconKey: "attraction" };
}

function parseElement(element: OverpassElement): OsmPlace | null {
  const type = typeof element.type === "string" ? element.type : null;
  const id = typeof element.id === "number" || typeof element.id === "string"
    ? String(element.id)
    : null;
  const latitude = numeric(element.lat) ?? numeric(element.center?.lat);
  const longitude = numeric(element.lon) ?? numeric(element.center?.lon);
  const name = tagValue(element.tags, "name") ?? tagValue(element.tags, "name:en");
  const normalizedName = name?.toLocaleLowerCase() ?? "";
  if (
    !type ||
    !id ||
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !name ||
    /^(unnamed|unknown|no name|ไม่มีชื่อ|ไม่ระบุ)$/u.test(normalizedName)
  )
    return null;
  return {
    osmId: `${type}/${id}`,
    name,
    nameTh: tagValue(element.tags, "name:th"),
    ...categoryFromTags(element.tags),
    openingHours: tagValue(element.tags, "opening_hours"),
    website: safeHttpUrl(
      tagValue(element.tags, "website") ?? tagValue(element.tags, "contact:website"),
    ),
    phone: tagValue(element.tags, "phone") ?? tagValue(element.tags, "contact:phone"),
    point: { latitude, longitude },
  };
}

function overpassQuery(bounds: MapBounds): string {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:15];(${[
    `nwr["amenity"~"restaurant|cafe|bar"](${box});`,
    `nwr["leisure"~"sports_centre|fitness_centre"](${box});`,
    `nwr["tourism"~"attraction|hotel"](${box});`,
  ].join("")});out center tags;`;
}

function isRemoteBoundsSafe(bounds: MapBounds): boolean {
  return (
    bounds.east - bounds.west <= MAX_REMOTE_SPAN_DEGREES &&
    bounds.north - bounds.south <= MAX_REMOTE_SPAN_DEGREES
  );
}

async function fetchRemotePlaces(
  bounds: MapBounds,
  endpoint: string,
  signal?: AbortSignal,
): Promise<OsmPlace[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ data: overpassQuery(bounds) }),
    signal,
  });
  if (!response.ok) throw new Error(`Overpass request failed (${response.status})`);
  const payload = (await response.json()) as OverpassResponse;
  if (!Array.isArray(payload.elements)) return [];
  const places = payload.elements
    .filter((element): element is OverpassElement => typeof element === "object" && element !== null)
    .map(parseElement)
    .filter((place): place is OsmPlace => place !== null)
    .sort((left, right) => left.name.localeCompare(right.name))
  return dedupePlaces(places).slice(0, MAX_REMOTE_PLACES);
}

export async function getOsmPlaces(
  bounds: MapBounds,
  options: { mode: OsmQueryMode; endpoint: string; signal?: AbortSignal },
): Promise<OsmPlace[]> {
  if (options.mode === "disabled") return [];
  if (options.mode === "remote" && !isRemoteBoundsSafe(bounds)) return [];
  const key = `${options.mode}:${options.endpoint}:${areaKey(bounds)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now())
    return cached.places.filter((place) => inBounds(place, bounds));
  if (options.mode === "mock") {
    const places = dedupePlaces(
      mockPlaces.filter((place) => inBounds(place, bounds)),
    ).slice(0, MAX_REMOTE_PLACES);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, places });
    return places;
  }
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = fetchRemotePlaces(bounds, options.endpoint, options.signal)
    .then((places) => {
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, places });
      return places;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

export function toOsmMapSummary(place: OsmPlace): StoreMapSummary {
  return {
    id: place.osmId,
    slug: `osm-${place.osmId.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "")}`,
    name: place.nameTh ?? place.name,
    point: place.point,
    category: place.category,
    categoryIconKey: place.categoryIconKey,
    rating: null,
    reviewCount: 0,
    priceLevel: null,
    priceRange: "—",
    availableToday: null,
    availabilityLabel: "ข้อมูลสถานที่จาก OpenStreetMap",
    area: "OpenStreetMap",
    imageUrl: null,
    source: "osm",
    isAevoPlayPartner: false,
    website: place.website,
    phone: place.phone,
    openingHours: place.openingHours,
    osmId: place.osmId,
  };
}

export function normalizePlaceName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
