import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Coffee,
  Check,
  CircleHelp,
  Clock3,
  Dumbbell,
  Hotel,
  Landmark,
  LocateFixed,
  MapPinned,
  Route,
  Search,
  SlidersHorizontal,
  Star,
  Ticket,
  Utensils,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { GlidingGroup } from "@/components/gliding-group";
import type { CustomerStoreSummary } from "@/contracts/customer";
import type { TraceDeeFeedItem } from "@/contracts/tracedee";
import { areas, categories, demoStores, type StoreSummary } from "@/data/demo";
import { getTraceDeeFeed } from "@/lib/customer-api";
import { ApiClientError, isGatewayOfflineError } from "@/lib/api-client";
import {
  customerDataMode,
  mapStyleUrl,
  osmOverpassMode,
  osmOverpassUrl,
  placeApiMode,
} from "@/lib/env";
import { getPlaceMapOverlay } from "@/lib/place-api";
import { beginGoSignIn } from "@/lib/sso";
import { mapAttribution, mapProviderPolicy } from "./provider-policy";
import { createPlatformBridge } from "@/platform";
import type { GeoPoint } from "@/platform";
import {
  MapLibreMap,
  type MapInteractionSignal,
  type MapProviderStatus,
} from "./maplibre-map";
import { MapBookingDrawer } from "./map-booking-drawer";
import {
  isStoreSelection,
  serializeMapBounds,
  toStoreMapSummary,
  type MapBounds,
  type StoreMapSummary,
  type TraceMapSummary,
} from "./contracts";
import { useMapDiscovery } from "./use-map-discovery";
import {
  getOsmPlaces,
  normalizePlaceName,
  toOsmMapSummary,
} from "./osm-service";
import {
  canonicalPlaceDetailPath,
  toCanonicalCategoryIds,
  toCanonicalOverlayStore,
} from "./canonical-place-adapter";
import {
  shouldQueryOsmPlaces,
  shouldUseCanonicalMapOverlay,
} from "./map-data-policy";

const DEFAULT_VIEW = {
  longitude: 100.523,
  latitude: 13.746,
  zoom: 11.5,
} as const;
const DEMO_COORDINATES: Record<string, GeoPoint> = {
  "north-star-coffee": { latitude: 13.7797, longitude: 100.5448 },
  "sora-table": { latitude: 13.7301, longitude: 100.5687 },
  "calm-house-studio": { latitude: 13.7204, longitude: 100.5313 },
  "talat-noi-roastery": { latitude: 13.7337, longitude: 100.5102 },
  "chao-phraya-table": { latitude: 13.7219, longitude: 100.5139 },
  "siam-discovery-hall": { latitude: 13.7468, longitude: 100.5301 },
  "yaowarat-night-food": { latitude: 13.7394, longitude: 100.5102 },
  "ari-ceramic-house": { latitude: 13.7793, longitude: 100.5441 },
};

type SheetState = "peek" | "half" | "full";
type MapListStore = Omit<StoreMapSummary, "point"> & {
  point?: StoreMapSummary["point"];
};

const categoryIcons: Readonly<Record<string, LucideIcon>> = {
  cafe: Coffee,
  dining: Utensils,
  restaurant: Utensils,
  bar: Wine,
  wellness: Dumbbell,
  fitness: Dumbbell,
  activities: Landmark,
  attraction: Landmark,
  stay: Hotel,
  hotel: Hotel,
};

function PlaceCategoryIcon({
  store,
  size = 17,
}: {
  store: Pick<StoreMapSummary, "category" | "categoryIconKey">;
  size?: number;
}) {
  const Icon =
    categoryIcons[store.categoryIconKey.toLocaleLowerCase()] ??
    categoryIcons[store.category.toLocaleLowerCase()] ??
    MapPinned;
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" />;
}

function toggleStringValue(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function toggleNumberValue(values: readonly number[], value: number): number[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value].sort((left, right) => left - right);
}

function MapFilterChoice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`map-filter-choice${selected ? " is-selected" : ""}`}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      {selected && <Check size={14} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

function boundsAroundPoint(point: GeoPoint, radiusMeters = 5_000): MapBounds {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeScale = Math.max(
    Math.cos((point.latitude * Math.PI) / 180),
    0.2,
  );
  const longitudeDelta = radiusMeters / (111_320 * longitudeScale);
  return {
    west: Math.max(-180, point.longitude - longitudeDelta),
    south: Math.max(-90, point.latitude - latitudeDelta),
    east: Math.min(180, point.longitude + longitudeDelta),
    north: Math.min(90, point.latitude + latitudeDelta),
  };
}

function boundsForRoute(route: readonly GeoPoint[]): MapBounds | null {
  if (route.length === 0) return null;
  const longitudes = route.map((point) => point.longitude);
  const latitudes = route.map((point) => point.latitude);
  const padding = 0.004;
  return {
    west: Math.min(...longitudes) - padding,
    south: Math.min(...latitudes) - padding,
    east: Math.max(...longitudes) + padding,
    north: Math.max(...latitudes) + padding,
  };
}

function centerOfBounds(bounds: MapBounds): {
  longitude: number;
  latitude: number;
} {
  return {
    longitude: (bounds.west + bounds.east) / 2,
    latitude: (bounds.south + bounds.north) / 2,
  };
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

function toDemoMapSummary(store: StoreSummary): StoreMapSummary | null {
  const point = DEMO_COORDINATES[store.slug];
  if (!point) return null;
  return {
    id: store.id ?? store.slug,
    slug: store.slug,
    name: store.name,
    point,
    category: store.category,
    categoryIconKey: store.categoryIconKey ?? store.category.toLowerCase(),
    rating: store.rating,
    reviewCount: store.reviewCount,
    priceLevel: store.priceLevel ?? priceLevelFromRange(store.priceRange),
    priceRange: store.priceRange,
    availableToday: store.availableToday ?? true,
    availabilityLabel: store.availability,
    area: store.area,
    imageUrl: store.imageUrl ?? null,
    source: "customer",
    isAevoPlayPartner: store.isAevoPlayPartner === true,
    ...(store.venueSlug ? { venueSlug: store.venueSlug } : {}),
    ...(store.publicBookingRoute !== undefined
      ? { publicBookingRoute: store.publicBookingRoute }
      : {}),
  };
}

function toListStoreSummary(store: CustomerStoreSummary): MapListStore {
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    category: store.category,
    categoryIconKey: store.categoryIconKey ?? store.category.toLowerCase(),
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
    ...(store.latitude !== null &&
    store.longitude !== null &&
    store.latitude !== undefined &&
    store.longitude !== undefined
      ? { point: { latitude: store.latitude, longitude: store.longitude } }
      : {}),
  };
}

function sortMapResults<
  T extends Pick<StoreMapSummary, "rating" | "distanceMeters">,
>(items: readonly T[], sort: "relevant" | "nearest" | "rating"): T[] {
  if (sort === "relevant") return [...items];
  return [...items].sort((left, right) => {
    if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1);
    return (
      (left.distanceMeters ?? Number.POSITIVE_INFINITY) -
      (right.distanceMeters ?? Number.POSITIVE_INFINITY)
    );
  });
}

function sortTraceResults(
  items: readonly TraceMapSummary[],
  sort: "relevant" | "nearest" | "rating",
): TraceMapSummary[] {
  if (sort === "relevant") return [...items];
  return [...items].sort((left, right) => {
    if (sort === "rating") return right.followerCount - left.followerCount;
    return (
      (left.distanceKm ?? Number.POSITIVE_INFINITY) -
      (right.distanceKm ?? Number.POSITIVE_INFINITY)
    );
  });
}

function matchesDemoFilters(
  store: StoreSummary,
  filters: ReturnType<typeof useMapDiscovery>["filters"],
): boolean {
  const query = filters.query?.toLocaleLowerCase() ?? "";
  const matchesQuery =
    !query ||
    `${store.name} ${store.area} ${store.category}`
      .toLocaleLowerCase()
      .includes(query);
  const matchesArea =
    !filters.area || filters.area === "ใกล้ฉัน" || store.area === filters.area;
  const matchesCategory =
    filters.categoryIds.length === 0 ||
    filters.categoryIds.includes(store.category);
  const priceLevel = store.priceLevel ?? priceLevelFromRange(store.priceRange);
  const matchesPrice =
    filters.priceLevels.length === 0 ||
    (priceLevel !== null && filters.priceLevels.includes(priceLevel));
  const matchesAvailability =
    !filters.availableAt ||
    store.availableToday === true ||
    Boolean(store.availability);
  const matchesRating =
    !filters.ratingMin ||
    (store.rating !== null && store.rating >= filters.ratingMin);
  const matchesTaste =
    !filters.tasteMatch ||
    store.category === "Cafe" ||
    store.category === "Wellness";
  const matchesReservable =
    !filters.reservableOnly || store.isAevoPlayPartner === true;
  return (
    matchesQuery &&
    matchesArea &&
    matchesCategory &&
    matchesPrice &&
    matchesAvailability &&
    matchesRating &&
    matchesTaste &&
    matchesReservable
  );
}

function matchesOsmFilters(
  store: StoreMapSummary,
  filters: ReturnType<typeof useMapDiscovery>["filters"],
): boolean {
  const query = filters.query?.toLocaleLowerCase() ?? "";
  const matchesQuery =
    !query ||
    `${store.name} ${store.category}`.toLocaleLowerCase().includes(query);
  const matchesCategory =
    filters.categoryIds.length === 0 || filters.categoryIds.includes(store.category);
  const hasUnavailableFilter = Boolean(
    filters.availableAt ||
      filters.reservableOnly ||
      filters.ratingMin ||
      filters.savedOnly ||
      filters.followingOnly ||
      filters.priceLevels.length,
  );
  return matchesQuery && matchesCategory && !hasUnavailableFilter;
}

function mergeMapPlaces<T extends MapListStore>(
  customerPlaces: readonly T[],
  osmPlaces: readonly T[],
): T[] {
  const distanceBetweenPlaces = (
    left: NonNullable<T["point"]>,
    right: NonNullable<T["point"]>,
  ): number => {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const latitudeDelta = toRadians(right.latitude - left.latitude);
    const longitudeDelta = toRadians(right.longitude - left.longitude);
    const leftLatitude = toRadians(left.latitude);
    const rightLatitude = toRadians(right.latitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(leftLatitude) *
        Math.cos(rightLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
  };
  const isDuplicate = (place: T, existing: T): boolean => {
    if (normalizePlaceName(place.name) === normalizePlaceName(existing.name))
      return true;
    if (!place.point || !existing.point) return false;
    return distanceBetweenPlaces(place.point, existing.point) < 15;
  };
  const uniqueOsmPlaces: T[] = [];
  for (const place of osmPlaces) {
    if (customerPlaces.some((customer) => isDuplicate(place, customer))) continue;
    if (uniqueOsmPlaces.some((existing) => isDuplicate(place, existing))) continue;
    uniqueOsmPlaces.push(place);
  }
  return [...customerPlaces, ...uniqueOsmPlaces];
}

function mapTraceFromFeed(item: TraceDeeFeedItem): TraceMapSummary {
  return {
    id: item.itemId,
    slug: item.slug,
    title: item.title,
    area: item.area,
    stopCount: item.stopCount,
    durationMinutes: null,
    distanceKm: null,
    matchLabel:
      item.reasonCode === "TASTE_MATCH"
        ? "เหมาะกับความสนใจของคุณ"
        : item.reasonCode === "FOLLOWING_TRACER"
          ? "จาก Tracer ที่คุณติดตาม"
          : "กำลังเป็นที่สนใจ",
    followerCount: item.followerCount,
    remixCount: 0,
    route: [],
  };
}

const demoTraceRoutes: TraceMapSummary[] = [
  {
    id: "trace-ari-design",
    slug: "ari-design-morning",
    title: "Ari เช้าเบา ๆ กับกาแฟและงานออกแบบ",
    area: "Ari",
    stopCount: 5,
    durationMinutes: 180,
    distanceKm: 2.4,
    matchLabel: "เพราะคุณชอบกาแฟและงานออกแบบ",
    followerCount: 32,
    remixCount: 8,
    route: [
      { latitude: 13.7797, longitude: 100.5448 },
      { latitude: 13.782, longitude: 100.551 },
      { latitude: 13.786, longitude: 100.557 },
      { latitude: 13.789, longitude: 100.562 },
    ],
  },
  {
    id: "trace-old-town-light",
    slug: "old-town-light-walk",
    title: "แสงบ่ายในเมืองเก่า",
    area: "Old Town",
    stopCount: 6,
    durationMinutes: 240,
    distanceKm: 4.1,
    matchLabel: "กำลังเป็นที่สนใจใกล้คุณ",
    followerCount: 57,
    remixCount: 14,
    route: [
      { latitude: 13.751, longitude: 100.498 },
      { latitude: 13.75, longitude: 100.505 },
      { latitude: 13.755, longitude: 100.511 },
      { latitude: 13.761, longitude: 100.509 },
    ],
  },
  {
    id: "trace-sathorn-reset",
    slug: "sathorn-slow-reset",
    title: "พักใจใน Sathorn หลังเลิกงาน",
    area: "Sathorn",
    stopCount: 4,
    durationMinutes: 150,
    distanceKm: 2.1,
    matchLabel: "จาก Tracer ที่คุณติดตาม",
    followerCount: 21,
    remixCount: 3,
    route: [
      { latitude: 13.721, longitude: 100.531 },
      { latitude: 13.724, longitude: 100.536 },
      { latitude: 13.719, longitude: 100.543 },
    ],
  },
];

function MapResultCard({
  store,
  selected,
  hovered,
  onSelect,
  onHover,
  onBook,
  onOpenExternal,
  canonicalMode,
}: {
  store: MapListStore;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onBook?: () => void;
  onOpenExternal?: () => void;
  canonicalMode?: boolean;
}) {
  const canOpenBooking =
    store.isAevoPlayPartner === true &&
    (!canonicalMode ||
      Boolean(store.venueSlug || store.publicBookingRoute?.startsWith("/stores/")));
  return (
    <article
      className={`map-result-card${selected ? " map-result-card--selected" : ""}${hovered ? " map-result-card--hovered" : ""}`}
      aria-current={selected ? "true" : undefined}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <button
        className="map-result-card__main"
        type="button"
        onClick={onSelect}
        aria-label={`เลือก ${store.name} บนแผนที่`}
      >
        <span className="map-result-card__visual" aria-hidden="true">
          {store.imageUrl ? (
            <img src={store.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : null}
          <span className="map-result-card__category-mark">
            <PlaceCategoryIcon store={store} />
          </span>
        </span>
        <span className="map-result-card__content">
          <span className="map-result-card__title-row">
            <strong>{store.name}</strong>
            <span>
              {store.rating === null ? (
                ""
              ) : (
                <>
                  <Star size={12} fill="currentColor" aria-hidden="true" />
                  {store.rating.toFixed(1)}
                </>
              )}
            </span>
          </span>
          <span className="map-result-card__meta">
            {store.category} · {store.area} · {store.priceRange}
          </span>
          <span className="map-result-card__source">
            {canOpenBooking ? (
              <>
                <Zap size={12} aria-hidden="true" />จองผ่าน Aevo Play ได้ทันที
              </>
            ) : store.source === "osm" ? (
              "ข้อมูลสถานที่จาก OpenStreetMap"
            ) : (
              "Public place profile"
            )}
          </span>
          <span
            className={`map-result-card__availability${store.source === "osm" ? " map-result-card__availability--source" : ""}`}
          >
            {store.source === "osm" ? (
              <MapPinned size={12} aria-hidden="true" />
            ) : (
              <span className="availability__dot" aria-hidden="true" />
            )}
            {store.availabilityLabel ?? "ดู availability"}
          </span>
        </span>
      </button>
      {canOpenBooking && onBook && (
        <button
          className="map-result-card__book"
          type="button"
          onClick={onBook}
        >
          จองทันที
        </button>
      )}
      {store.source === "osm" ? (
        <button
          className="map-result-card__open"
          type="button"
          onClick={onOpenExternal}
          aria-label={`เปิดแผนที่ภายนอกสำหรับ ${store.name}`}
        >
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : (
        <Link
          className="map-result-card__open"
          to={canonicalMode ? canonicalPlaceDetailPath(store.id) : `/stores/${store.slug}`}
          aria-label={`เปิดรายละเอียด ${store.name}`}
        >
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

function TraceResultCard({
  trace,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  trace: TraceMapSummary;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) {
  return (
    <article
      className={`map-result-card map-result-card--trace${selected ? " map-result-card--selected" : ""}${hovered ? " map-result-card--hovered" : ""}`}
      aria-current={selected ? "true" : undefined}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <button
        className="map-result-card__main"
        type="button"
        onClick={onSelect}
        aria-label={`เลือก Trace ${trace.title} บนแผนที่`}
      >
        <span
          className="map-result-card__visual map-result-card__visual--route"
          aria-hidden="true"
        >
          <Route size={18} />
        </span>
        <span className="map-result-card__content">
          <span className="map-result-card__title-row">
            <strong>{trace.title}</strong>
            <span>{trace.matchLabel}</span>
          </span>
          <span className="map-result-card__meta">
            {trace.area} · {trace.stopCount} stops ·{" "}
            {trace.distanceKm ? `${trace.distanceKm} km` : "ไม่ระบุระยะทาง"}
          </span>
          <span className="map-result-card__availability">
            <Clock3 size={13} aria-hidden="true" />
            {trace.durationMinutes
              ? `${trace.durationMinutes / 60} ชั่วโมง`
              : "เวลาไม่ระบุ"}{" "}
            · {trace.followerCount} คนตามรอย
          </span>
        </span>
      </button>
      <Link
        className="map-result-card__open"
        to={`/traces/${trace.slug}`}
        aria-label={`เปิด Trace ${trace.title}`}
      >
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

export function MapPage() {
  const map = useMapDiscovery();
  const platform = useMemo(() => createPlatformBridge(), []);
  const [queryInput, setQueryInput] = useState(map.filters.query ?? "");
  const [locationPending, setLocationPending] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [focusBounds, setFocusBounds] = useState<MapBounds | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>("half");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [bookingPlace, setBookingPlace] = useState<MapListStore | null>(null);
  const [mapProviderStatus, setMapProviderStatus] =
    useState<MapProviderStatus>("loading");
  const isMapInteractingRef = useRef(false);
  const mapUiRevealTimerRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{
    startY: number;
    offset: number;
    pointerId: number;
  } | null>(null);
  const fallbackBounds = useMemo(
    () => boundsAroundPoint(DEFAULT_VIEW, 5_000),
    [],
  );
  const initialSearchCommittedRef = useRef(false);
  const selectedResultRef = useRef<HTMLElement | null>(null);

  const traceQuery = useQuery({
    queryKey: ["tracedee-map", map.filters.query ?? "", map.filters.area ?? ""],
    queryFn: ({ signal }) =>
      getTraceDeeFeed(
        {
          tab: "nearby",
          ...(map.filters.query ? { query: map.filters.query } : {}),
          ...(map.filters.area ? { area: map.filters.area } : {}),
          limit: 24,
        },
        { signal },
      ),
    enabled: map.mode === "traces" && customerDataMode === "live",
    staleTime: 30_000,
  });
  const traceGatewayOffline =
    customerDataMode === "live" && isGatewayOfflineError(traceQuery.error);

  // OSM is a committed search surface. Camera movement only marks the map
  // dirty; it must not start a network request until Search this area is used.
  const osmBounds = map.committedBounds ?? fallbackBounds;
  const osmQuery = useQuery({
    queryKey: [
      "openstreetmap-places",
      osmOverpassMode,
      osmOverpassUrl,
      serializeMapBounds(osmBounds),
    ],
    queryFn: ({ signal }) =>
      getOsmPlaces(osmBounds, {
        mode: osmOverpassMode,
        endpoint: osmOverpassUrl,
        signal,
      }),
    enabled:
      shouldQueryOsmPlaces(placeApiMode, map.mode, osmOverpassMode) &&
      Boolean(osmBounds),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const canonicalOverlayEnabled = shouldUseCanonicalMapOverlay(
    placeApiMode,
    customerDataMode,
    map.mode,
  );
  const canonicalMapQuery = useQuery({
    queryKey: [
      "canonical-place-overlay",
      map.committedBounds ? serializeMapBounds(map.committedBounds) : null,
      map.zoom,
      map.filters.query ?? "",
      map.filters.categoryIds,
      map.filters.savedOnly ?? false,
    ],
    queryFn: ({ signal }) =>
      getPlaceMapOverlay(
        {
          ...map.committedBounds!,
          zoom: map.zoom,
          ...(map.filters.query ? { query: map.filters.query } : {}),
          ...(map.filters.categoryIds.length > 0
            ? { categoryIds: toCanonicalCategoryIds(map.filters.categoryIds) }
            : {}),
          limit: 300,
          ...(map.filters.savedOnly ? { savedOnly: true } : {}),
        },
        { signal },
      ),
    enabled: canonicalOverlayEnabled && Boolean(map.committedBounds),
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => setQueryInput(map.filters.query ?? ""), [map.filters.query]);
  useEffect(() => {
    if (
      initialSearchCommittedRef.current ||
      map.committedBounds ||
      (mapProviderStatus !== "ready" &&
        mapProviderStatus !== "unsupported" &&
        mapProviderStatus !== "error")
    )
      return;
    initialSearchCommittedRef.current = true;
    map.commitBounds(map.cameraBounds ?? fallbackBounds, map.zoom || DEFAULT_VIEW.zoom, {
      area: map.filters.area ?? "ใกล้ฉัน",
      // Preserve an explicit Feed/Trace selection while the initial bounded
      // map request is committed. Clearing it here makes canonical UUID deep
      // links appear to work but silently drops the selected Place.
      ...(map.selectedSlug ? { selectedSlug: map.selectedSlug } : {}),
    });
  }, [
    fallbackBounds,
    map.cameraBounds,
    map.commitBounds,
    map.committedBounds,
    map.filters.area,
    map.selectedSlug,
    map.zoom,
    mapProviderStatus,
  ]);
  useEffect(() => {
    selectedResultRef.current?.scrollIntoView({ block: "nearest" });
  }, [map.selectedSlug, map.mode]);

  const area = map.filters.area ?? "ใกล้ฉัน";
  const canonicalSavedSignInRequired =
    placeApiMode === "canonical" &&
    map.filters.savedOnly === true &&
    map.error instanceof ApiClientError &&
    map.error.status === 401;
  const liveMapStores = useMemo(
    () =>
      map.results
        .map(toStoreMapSummary)
        .filter((store): store is StoreMapSummary => store !== null),
    [map.results],
  );
  const liveListStores = useMemo(
    () => map.results.map(toListStoreSummary),
    [map.results],
  );
  const knownCanonicalMapStores = useMemo(
    () => new Map(liveMapStores.map((store) => [store.id, store] as const)),
    [liveMapStores],
  );
  const canonicalOverlayStores = useMemo(
    () =>
      (canonicalMapQuery.data?.features ?? [])
        .map((feature) => toCanonicalOverlayStore(feature, knownCanonicalMapStores))
        .filter((store): store is StoreMapSummary => store !== null)
        .filter(
          (store) =>
            !map.filters.area ||
            map.filters.area === "ใกล้ฉัน" ||
            knownCanonicalMapStores.has(store.id),
        ),
    [canonicalMapQuery.data?.features, knownCanonicalMapStores, map.filters.area],
  );
  const demoMapStores = useMemo(
    () =>
      demoStores
        .filter((store) => matchesDemoFilters(store, map.filters))
        .map(toDemoMapSummary)
        .filter((store): store is StoreMapSummary => store !== null),
    [map.filters],
  );
  const customerMapStores =
    customerDataMode === "demo" || map.usingDemoFallback
      ? demoMapStores
      : liveMapStores;
  const osmMapStores = useMemo(
    () =>
      (placeApiMode === "canonical" ? [] : osmQuery.data ?? [])
        .map(toOsmMapSummary)
        .filter((store) => matchesOsmFilters(store, map.filters)),
    [map.filters, osmQuery.data],
  );
  const mergedMapStores = useMemo(
    () => mergeMapPlaces(customerMapStores, osmMapStores),
    [customerMapStores, osmMapStores],
  );
  const mapStores = useMemo(
    () => {
      if (map.mode !== "places") return [];
      if (canonicalOverlayEnabled && canonicalMapQuery.isSuccess) {
        return sortMapResults(canonicalOverlayStores, map.sort);
      }
      return sortMapResults(mergedMapStores, map.sort);
    },
    [canonicalMapQuery.isSuccess, canonicalOverlayEnabled, canonicalOverlayStores, map.mode, map.sort, mergedMapStores],
  );
  const listStores = useMemo<MapListStore[]>(
    () =>
      map.mode === "places"
        ? sortMapResults(
            placeApiMode === "canonical"
              ? customerDataMode === "demo" || map.usingDemoFallback
                ? demoMapStores
                : liveListStores
              : mergeMapPlaces(
                  customerDataMode === "demo" || map.usingDemoFallback
                    ? demoMapStores
                    : liveListStores,
                  osmMapStores,
                ),
            map.sort,
          )
        : [],
    [demoMapStores, liveListStores, map.mode, map.sort, map.usingDemoFallback, osmMapStores],
  );
  const liveTraces = useMemo(
    () => traceQuery.data?.items.map(mapTraceFromFeed) ?? [],
    [traceQuery.data],
  );
  const mapTraces = useMemo(() => {
    if (map.mode !== "traces") return [];
    const traces =
      customerDataMode === "demo" || traceGatewayOffline
        ? demoTraceRoutes.filter(
            (trace) =>
              !map.filters.area ||
              map.filters.area === "ใกล้ฉัน" ||
              trace.area === map.filters.area,
          )
        : liveTraces;
    return sortTraceResults(traces, map.sort);
  }, [liveTraces, map.filters.area, map.mode, map.sort, traceGatewayOffline]);
  const selectedPlace =
    listStores.find((store) => isStoreSelection(store, map.selectedSlug)) ??
    mapStores.find((store) => isStoreSelection(store, map.selectedSlug)) ??
    null;
  const selectedTrace =
    mapTraces.find((trace) => trace.slug === map.selectedSlug) ?? null;
  const selectedRoute = selectedTrace
    ? boundsForRoute(selectedTrace.route)
    : null;
  const hasCommittedSearch = map.committedBounds !== null;
  const mapCenter = map.committedBounds
    ? centerOfBounds(map.committedBounds)
    : DEFAULT_VIEW;
  const initialViewState = {
    ...mapCenter,
    zoom: map.committedBounds ? map.zoom : DEFAULT_VIEW.zoom,
  };
  const hasActiveFilters = Boolean(
    map.filters.query ||
      map.filters.area ||
      map.filters.categoryIds.length ||
      map.filters.priceLevels.length ||
      map.filters.availableAt ||
      map.filters.reservableOnly ||
      map.filters.partySize ||
      map.filters.ratingMin ||
      map.filters.tasteMatch ||
      map.filters.savedOnly ||
      map.filters.followingOnly ||
      map.sort !== "relevant",
  );
  const resultCount =
    map.mode === "places" ? listStores.length : mapTraces.length;
  const activeFilterCount =
    map.filters.categoryIds.length +
    map.filters.priceLevels.length +
    (map.filters.availableAt ? 1 : 0) +
    (map.filters.reservableOnly ? 1 : 0) +
    (map.filters.ratingMin ? 1 : 0) +
    (map.filters.tasteMatch ? 1 : 0) +
    (map.filters.savedOnly ? 1 : 0) +
    (map.filters.followingOnly ? 1 : 0);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    map.setFilters({ query: queryInput, selectedSlug: null });
  };
  const changeArea = (nextArea: string) => {
    map.resetArea(nextArea);
    setLocationNotice("");
  };
  const toggleCategory = (category: string) =>
    map.setFilters({
      categoryIds: toggleStringValue(map.filters.categoryIds, category),
      selectedSlug: null,
    });
  const toggleFoodCategories = () => {
    const foodCategories = ["Dining", "Cafe"];
    const isSelected = foodCategories.every((category) =>
      map.filters.categoryIds.includes(category),
    );
    map.setFilters({
      categoryIds: isSelected
        ? map.filters.categoryIds.filter(
            (category) => !foodCategories.includes(category),
          )
        : [...new Set([...map.filters.categoryIds, ...foodCategories])],
      selectedSlug: null,
    });
  };
  const togglePriceLevel = (priceLevel: number) =>
    map.setFilters({
      priceLevels: toggleNumberValue(map.filters.priceLevels, priceLevel),
      selectedSlug: null,
    });
  const toggleRating = () =>
    map.setFilters({
      ratingMin: map.filters.ratingMin === 4.5 ? 0 : 4.5,
      selectedSlug: null,
    });
  const toggleReservable = () =>
    map.setFilters({
      reservableOnly: !map.filters.reservableOnly,
      selectedSlug: null,
    });
  const clearFilters = () => {
    setQueryInput("");
    map.setFilters({
      query: "",
      area: "",
      categoryIds: [],
      priceLevels: [],
      availableAt: "",
      reservableOnly: false,
      partySize: 0,
      ratingMin: 0,
      tasteMatch: false,
      savedOnly: false,
      followingOnly: false,
      sort: "relevant",
      selectedSlug: null,
    });
  };
  const useCurrentLocation = async () => {
    setLocationPending(true);
    setLocationNotice("");
    try {
      const permission = await platform.requestLocationPermission();
      if (
        permission === "denied" ||
        permission === "unsupported" ||
        permission === "unavailable"
      ) {
        setLocationNotice(
          "ไม่สามารถใช้ตำแหน่งปัจจุบันได้ เลือกย่านเองได้ทันที",
        );
        return;
      }
      const position = await platform.getCurrentPosition();
      const nextBounds = boundsAroundPoint(position);
      setFocusBounds(nextBounds);
      map.commitBounds(nextBounds, 13, { area: "ใกล้ฉัน", selectedSlug: null });
      setLocationNotice("ใช้ตำแหน่งปัจจุบันค้นหาในพื้นที่ใกล้เคียงแล้ว");
      await platform.haptic("selection");
    } catch {
      setLocationNotice("ไม่สามารถใช้ตำแหน่งปัจจุบันได้ เลือกย่านเองได้ทันที");
    } finally {
      setLocationPending(false);
    }
  };
  const selectTrace = (slug: string) => {
    map.selectStore(slug);
    const trace = mapTraces.find((item) => item.slug === slug);
    const bounds = trace ? boundsForRoute(trace.route) : null;
    if (bounds) setFocusBounds(bounds);
  };
  const toggleAvailability = () =>
    map.setFilters({
      availableAt: map.filters.availableAt ? "" : new Date().toISOString(),
      selectedSlug: null,
    });
  const closeBooking = useCallback(() => setBookingPlace(null), []);
  const resetSheetDrag = useCallback(() => {
    sheetDragRef.current = null;
    sheetRef.current?.style.removeProperty("--map-sheet-drag");
    sheetRef.current?.removeAttribute("data-dragging");
  }, []);
  const handleSheetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    sheetDragRef.current = {
      startY: event.clientY,
      offset: 0,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetRef.current?.setAttribute("data-dragging", "true");
  };
  const handleSheetPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const offset = event.clientY - drag.startY;
    drag.offset = offset;
    sheetRef.current?.style.setProperty("--map-sheet-drag", `${offset}px`);
  };
  const handleSheetPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const stateOrder: SheetState[] = ["peek", "half", "full"];
    const currentIndex = stateOrder.indexOf(sheetState);
    const nextIndex =
      drag.offset < -48
        ? Math.min(stateOrder.length - 1, currentIndex + 1)
        : drag.offset > 48
          ? Math.max(0, currentIndex - 1)
          : currentIndex;
    const nextState = stateOrder[nextIndex] ?? "half";
    setSheetState(nextState);
    if (nextState === "full") setFiltersOpen(true);
    resetSheetDrag();
  };
  const cycleSheetState = () => {
    const nextState: SheetState =
      sheetState === "full" ? "peek" : sheetState === "peek" ? "half" : "full";
    setSheetState(nextState);
    if (nextState === "full") setFiltersOpen(true);
  };
  const toggleDetailedFilters = () => {
    const nextOpen = !filtersOpen;
    setFiltersOpen(nextOpen);
    if (nextOpen) setSheetState("full");
  };
  const setMapInteracting = useCallback((nextValue: boolean) => {
    if (isMapInteractingRef.current === nextValue) return;
    isMapInteractingRef.current = nextValue;
    setIsMapInteracting(nextValue);
  }, []);
  const scheduleMapUiReveal = useCallback(() => {
    if (mapUiRevealTimerRef.current !== null) {
      window.clearTimeout(mapUiRevealTimerRef.current);
    }
    mapUiRevealTimerRef.current = window.setTimeout(() => {
      setMapInteracting(false);
      setSheetState((current) => (current === "peek" ? "half" : current));
      mapUiRevealTimerRef.current = null;
    }, 1_800);
  }, [setMapInteracting]);
  const handleMapInteraction = useCallback(
    (signal: MapInteractionSignal) => {
      if (signal === "start") {
        if (mapUiRevealTimerRef.current !== null) {
          window.clearTimeout(mapUiRevealTimerRef.current);
          mapUiRevealTimerRef.current = null;
        }
        setMapInteracting(true);
        setSheetState("peek");
        return;
      }
      if (signal === "tap") {
        if (mapUiRevealTimerRef.current !== null) {
          window.clearTimeout(mapUiRevealTimerRef.current);
          mapUiRevealTimerRef.current = null;
        }
        setMapInteracting(false);
        setSheetState((current) => (current === "peek" ? "half" : current));
        return;
      }
      scheduleMapUiReveal();
    },
    [scheduleMapUiReveal, setMapInteracting],
  );

  useEffect(
    () => () => {
      if (mapUiRevealTimerRef.current !== null) {
        window.clearTimeout(mapUiRevealTimerRef.current);
      }
      resetSheetDrag();
    },
    [resetSheetDrag],
  );

  return (
    <div
      className={`trace-map-page${isMapInteracting ? " is-map-interacting" : ""}`}
    >
      <section
        className={`trace-map-panel trace-map-panel--${sheetState}`}
        aria-label="Trace Map results"
      >
        <h1 className="sr-only">Trace Map ของ Aevocado GO</h1>
        <div className="map-sheet" ref={sheetRef} data-sheet-state={sheetState}>
          <button
            className="map-sheet__handle"
            type="button"
            aria-label="ลากเพื่อปรับระดับรายการแผนที่"
            aria-controls="map-results-sheet"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={resetSheetDrag}
          >
            <span aria-hidden="true" />
          </button>
          <div className="trace-map-panel__chrome">
          <form
          className="search-field map-search-field"
          onSubmit={submitSearch}
          role="search"
          >
            <Search size={18} aria-hidden="true" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              inputMode="search"
              autoComplete="off"
              placeholder="ค้นหา Place หรือ Trace"
              aria-label="ค้นหา Place หรือ Trace"
            />
            <button
              className="search-field__submit"
              type="submit"
              aria-label="ค้นหา"
            >
              <Search size={17} aria-hidden="true" />
            </button>
          </form>
          <header className="trace-map-panel__header">
            <div>
              <p className="eyebrow">TRACE MAP / {map.mode === "places" ? "PLACES" : "TRACES"}</p>
              <span className="muted-label" aria-live="polite">
                {map.isRefreshing
                  ? "กำลังอัปเดตผลลัพธ์เดิม…"
                  : `พบ ${resultCount} ${map.mode === "places" ? "สถานที่" : "เส้นทาง"}`}
              </span>
            </div>
            <button
              className="map-sheet__toggle"
              type="button"
              onClick={cycleSheetState}
              aria-expanded={sheetState === "full"}
              aria-controls="map-results-sheet"
            >
              {sheetState === "full" ? "ย่อรายการ" : "ดูรายการ"}
            </button>
          </header>
          <GlidingGroup
          items={[
            { id: "places", label: "Places" },
            { id: "traces", label: "Traces" },
          ]}
          activeId={map.mode}
          onChange={(id) => {
            setFiltersOpen(false);
            if (id === "places" || id === "traces")
              map.setFilters({
                mode: id,
                selectedSlug: null,
                sort: id === "traces" ? "relevant" : map.sort,
              });
          }}
          ariaLabel="โหมด Trace Map"
          role="tablist"
          size="small"
          />
          <div className="map-filter-row map-filter-row--workspace">
          <div className="select-field">
            <MapPinned size={15} aria-hidden="true" />
            <select
              value={area}
              onChange={(event) => changeArea(event.target.value)}
              aria-label="เลือกพื้นที่"
            >
              <option value="ใกล้ฉัน">ใกล้ฉัน</option>
              {areas
                .filter((item) => item !== "ใกล้ฉัน")
                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </div>
          {map.mode === "places" && (
            <>
              <button
                className={`button button--filter${map.filters.availableAt ? " is-active" : ""}`}
                type="button"
                onClick={toggleAvailability}
                aria-pressed={Boolean(map.filters.availableAt)}
              >
                {map.filters.availableAt ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <span className="availability__dot" aria-hidden="true" />
                )}
                เปิดอยู่
              </button>
              <button
                className={`button button--filter${map.filters.reservableOnly ? " is-active" : ""}`}
                type="button"
                onClick={toggleReservable}
                aria-pressed={Boolean(map.filters.reservableOnly)}
              >
                {map.filters.reservableOnly ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Ticket size={14} aria-hidden="true" />
                )}
                Aevo Play
              </button>
              <button
                className={`button button--filter${map.filters.categoryIds.includes("Dining") && map.filters.categoryIds.includes("Cafe") ? " is-active" : ""}`}
                type="button"
                onClick={toggleFoodCategories}
                aria-pressed={map.filters.categoryIds.includes("Dining") && map.filters.categoryIds.includes("Cafe")}
              >
                {map.filters.categoryIds.includes("Dining") && map.filters.categoryIds.includes("Cafe") && (
                  <Check size={14} aria-hidden="true" />
                )}
                ร้านอาหาร / คาเฟ่
              </button>
              <button
                className={`button button--filter${map.filters.ratingMin === 4.5 ? " is-active" : ""}`}
                type="button"
                onClick={toggleRating}
                aria-pressed={map.filters.ratingMin === 4.5}
              >
                {map.filters.ratingMin === 4.5 ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Star size={14} fill="currentColor" aria-hidden="true" />
                )}
                4.5+
              </button>
              <button
                className={`button button--filter${filtersOpen ? " is-active" : ""}`}
                type="button"
                onClick={toggleDetailedFilters}
                aria-expanded={filtersOpen}
                aria-controls="map-filter-drawer"
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="map-filter-count" aria-label={`${activeFilterCount} ตัวกรองที่เลือก`}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </>
          )}
          </div>
          {filtersOpen && map.mode === "places" && (
          <div
            className="map-filter-drawer"
            id="map-filter-drawer"
            role="region"
            aria-label="ตัวกรองสถานที่"
          >
            <div className="map-filter-drawer__section">
              <div className="map-filter-drawer__heading">
                <strong>หมวดหมู่</strong>
                <span>เลือกได้หลายรายการ</span>
              </div>
              <div
                className="map-filter-drawer__choices"
                role="group"
                aria-label="เลือกหมวดหมู่หลายรายการ"
              >
                <MapFilterChoice
                  label="ทุกหมวดหมู่"
                  selected={map.filters.categoryIds.length === 0}
                  onClick={() =>
                    map.setFilters({ categoryIds: [], selectedSlug: null })
                  }
                />
                {categories.map((category) => (
                  <MapFilterChoice
                    key={category}
                    label={category}
                    selected={map.filters.categoryIds.includes(category)}
                    onClick={() => toggleCategory(category)}
                  />
                ))}
              </div>
            </div>
            <div className="map-filter-drawer__section">
              <div className="map-filter-drawer__heading">
                <strong>งบประมาณ</strong>
                <span>เลือกได้หลายระดับ</span>
              </div>
              <div
                className="map-filter-drawer__choices"
                role="group"
                aria-label="เลือกระดับงบประมาณหลายรายการ"
              >
                <MapFilterChoice
                  label="ทุกระดับ"
                  selected={map.filters.priceLevels.length === 0}
                  onClick={() =>
                    map.setFilters({ priceLevels: [], selectedSlug: null })
                  }
                />
                {[1, 2, 3, 4].map((value) => (
                  <MapFilterChoice
                    key={value}
                    label={"฿".repeat(value)}
                    selected={map.filters.priceLevels.includes(value)}
                    onClick={() => togglePriceLevel(value)}
                  />
                ))}
              </div>
            </div>
            <div className="map-filter-drawer__section">
              <div className="map-filter-drawer__heading">
                <strong>คุณภาพและสิทธิ์</strong>
                <span>เลือกได้มากกว่า 1 ตัวเลือก</span>
              </div>
              <div
                className="map-filter-drawer__choices"
                role="group"
                aria-label="ตัวกรองเพิ่มเติม"
              >
                <MapFilterChoice
                  label="จองผ่าน Aevo Play"
                  selected={map.filters.reservableOnly === true}
                  onClick={toggleReservable}
                />
                <MapFilterChoice
                  label="Taste Match"
                  selected={map.filters.tasteMatch === true}
                  onClick={() =>
                    map.setFilters({
                      tasteMatch: !map.filters.tasteMatch,
                      selectedSlug: null,
                    })
                  }
                />
                <MapFilterChoice
                  label="Saved"
                  selected={map.filters.savedOnly === true}
                  onClick={() =>
                    map.setFilters({
                      savedOnly: !map.filters.savedOnly,
                      selectedSlug: null,
                    })
                  }
                />
                <MapFilterChoice
                  label="Following"
                  selected={map.filters.followingOnly === true}
                  onClick={() =>
                    map.setFilters({
                      followingOnly: !map.filters.followingOnly,
                      selectedSlug: null,
                    })
                  }
                />
              </div>
            </div>
            <label className="map-filter-drawer__select">
              <span>คะแนนขั้นต่ำ</span>
              <select
                value={map.filters.ratingMin ?? ""}
                onChange={(event) =>
                  map.setFilters({
                    ratingMin: Number(event.target.value) || 0,
                    selectedSlug: null,
                  })
                }
              >
                <option value="">ทุกคะแนน</option>
                {[4, 4.5, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} ขึ้นไป
                  </option>
                ))}
              </select>
            </label>
            <div className="map-filter-drawer__footer">
              <span className="muted-label">
                {activeFilterCount > 0
                  ? `${activeFilterCount} ตัวกรองที่เลือก`
                  : "ยังไม่ได้เลือกตัวกรอง"}
              </span>
              {hasActiveFilters && (
                <button
                  className="text-link text-link--button"
                  type="button"
                  onClick={clearFilters}
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>
          </div>
          )}
          <div className="trace-map-panel__actions">
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void useCurrentLocation()}
            disabled={locationPending}
            aria-busy={locationPending}
          >
            <LocateFixed size={16} aria-hidden="true" />
            {locationPending ? "กำลังค้นหา…" : "ใกล้ฉัน"}
          </button>
          <label className="map-sort">
            เรียง
            <select
              value={map.sort}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "relevant" ||
                  value === "nearest" ||
                  value === "rating"
                )
                  map.setFilters({ sort: value });
              }}
              aria-label="เรียงผลลัพธ์"
            >
              <option value="relevant">เกี่ยวข้อง</option>
              <option value="nearest">ใกล้ที่สุด</option>
              <option value="rating">
                {map.mode === "places" ? "คะแนน" : "นิยม"}
              </option>
            </select>
          </label>
          {map.isDirty && (
            <button
              className="button button--dark"
              type="button"
              onClick={map.searchThisArea}
              disabled={map.isSearching}
              aria-busy={map.isSearching}
            >
              <Search size={15} aria-hidden="true" />
              {map.isSearching ? "กำลังค้นหา…" : "Search this area"}
            </button>
          )}
          </div>
          {locationNotice && (
          <p className="inline-notice map-page__notice" role="status">
            <LocateFixed size={16} aria-hidden="true" />
            {locationNotice}
          </p>
          )}
          {map.mode === "places" && map.isTruncated && (
          <p className="map-result-limit-notice" role="status">
            <CircleHelp size={14} aria-hidden="true" />
            แสดงสถานที่บางส่วนในพื้นที่นี้ · ขยับแผนที่เพื่อดูจุดอื่น
          </p>
          )}
          {(map.usingDemoFallback || traceGatewayOffline) && (
          <div className="stale-data-notice" role="status">
            Customer Gateway ยังไม่พร้อม · แสดงข้อมูลตัวอย่างในเครื่อง
            <button
              className="text-link text-link--button"
              type="button"
              onClick={() => {
                void map.retry();
                void traceQuery.refetch();
              }}
            >
              ลองเชื่อมต่อใหม่
            </button>
          </div>
          )}
          {customerDataMode === "live" &&
            map.isOffline &&
            !map.usingDemoFallback &&
            !traceGatewayOffline && (
          <div className="stale-data-notice" role="status">
            กำลังออฟไลน์ · แสดงผลลัพธ์ล่าสุดที่มีอยู่
          </div>
          )}
          {osmOverpassMode === "remote" && osmQuery.isError && (
          <p className="inline-notice map-page__notice" role="status">
            <CircleHelp size={15} aria-hidden="true" />
            ชั้นข้อมูล OpenStreetMap ยังโหลดไม่ได้ · แสดงเฉพาะสถานที่จาก Aevo
            <button
              className="text-link text-link--button"
              type="button"
              onClick={() => void osmQuery.refetch()}
            >
              ลองใหม่
            </button>
          </p>
          )}
        </div>
        <div className="map-sheet__body" id="map-results-sheet">
          {map.mode === "traces" &&
          traceQuery.isError &&
          mapTraces.length === 0 ? (
            <div
              className="map-result-state map-result-state--error"
              role="alert"
            >
              <CircleHelp size={17} aria-hidden="true" />
              <span>โหลด Trace ล่าสุดไม่ได้ กำลังแสดงข้อมูลที่บันทึกไว้</span>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void traceQuery.refetch()}
              >
                ลองใหม่
              </button>
            </div>
          ) : customerDataMode === "live" &&
            map.mode === "places" &&
            map.error &&
            listStores.length === 0 ? (
            <div
              className="map-result-state map-result-state--error"
              role="alert"
            >
              <CircleHelp size={17} aria-hidden="true" />
              <span>
                {canonicalSavedSignInRequired
                  ? "เข้าสู่ระบบเพื่อใช้ตัวกรอง Saved ของ canonical Place"
                  : "โหลดสถานที่ล่าสุดไม่ได้ ลองใหม่หรือเลือกย่านอื่น"}
              </span>
              {canonicalSavedSignInRequired ? (
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => void beginGoSignIn(window.location.pathname + window.location.search)}
                >
                  เข้าสู่ระบบ
                </button>
              ) : (
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => void map.retry()}
                >
                  ลองใหม่
                </button>
              )}
            </div>
          ) : map.isSearching ||
            (map.mode === "traces" && traceQuery.isLoading) ? (
            <div className="map-result-state" role="status">
              <span className="loading-dot" aria-hidden="true" />
              กำลังค้นหาผลลัพธ์…
            </div>
          ) : map.mode === "places" ? (
            listStores.length > 0 ? (
              <div className="map-result-list">
                {listStores.map((store) => (
                  <div
                    key={store.id}
                    ref={(element) => {
                      if (isStoreSelection(store, map.selectedSlug))
                        selectedResultRef.current = element;
                    }}
                  >
                    <MapResultCard
                      store={store}
                      selected={isStoreSelection(store, map.selectedSlug)}
                      hovered={store.slug === map.hoveredSlug}
                      onSelect={() => map.selectStore(store.slug)}
                      onHover={(hovered) =>
                        map.hoverStore(hovered ? store.slug : null)
                      }
                      onBook={
                        (placeApiMode !== "canonical" ||
                          Boolean(store.venueSlug || store.publicBookingRoute?.startsWith("/stores/"))) &&
                        store.isAevoPlayPartner
                          ? () => {
                              map.selectStore(store.slug);
                              setBookingPlace(store);
                            }
                          : undefined
                      }
                      canonicalMode={placeApiMode === "canonical"}
                      onOpenExternal={
                        store.source === "osm"
                          ? () => {
                              const query = `${store.name}, Bangkok`;
                              void platform.openExternalUrl(
                                `https://maps.google.com/?q=${encodeURIComponent(query)}`,
                              );
                            }
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="map-result-state" role="status">
                <MapPinned size={18} aria-hidden="true" />
                <span>
                  {hasCommittedSearch
                    ? "ยังไม่มี Place ในพื้นที่นี้ ลองขยับแผนที่หรือปรับ Filters"
                    : "ขยับแผนที่แล้วกด Search this area เพื่อโหลดผลลัพธ์"}
                </span>
              </div>
            )
          ) : mapTraces.length > 0 ? (
            <div className="map-result-list">
              {mapTraces.map((trace) => (
                <div
                  key={trace.id}
                  ref={(element) => {
                    if (trace.slug === map.selectedSlug)
                      selectedResultRef.current = element;
                  }}
                >
                  <TraceResultCard
                    trace={trace}
                    selected={trace.slug === map.selectedSlug}
                    hovered={trace.slug === map.hoveredSlug}
                    onSelect={() => selectTrace(trace.slug)}
                    onHover={(hovered) =>
                      map.hoverStore(hovered ? trace.slug : null)
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="map-result-state" role="status">
              <Route size={18} aria-hidden="true" />
              <span>ยังไม่มี Trace ที่ตรงกับพื้นที่นี้ ลองล้าง Filters</span>
            </div>
          )}
        </div>
        </div>
      </section>
      <section className="trace-map-canvas" aria-label="Trace Map canvas">
        <div className="trace-map-canvas__header">
          <span className="eyebrow">
            {map.mode === "places" ? "PLACES" : "TRACE ROUTES"}
          </span>
          <div className="trace-map-canvas__header-meta">
            {map.mode === "places" && (
              <div className="map-canvas-legend" aria-label="คำอธิบายหมุด">
                <span>
                  <i className="map-canvas-legend__dot map-canvas-legend__dot--partner" aria-hidden="true" />
                  Aevo Play
                </span>
                <span>
                  <i className="map-canvas-legend__dot" aria-hidden="true" />
                  Public place
                </span>
              </div>
            )}
            <span>
              {map.isDirty
                ? "ขยับแผนที่แล้ว · ผลลัพธ์เดิมยังอยู่"
                : `${resultCount} ผลลัพธ์`}
            </span>
          </div>
        </div>
        <MapLibreMap
          stores={mapStores}
          traces={mapTraces}
          styleUrl={mapStyleUrl}
          selectedSlug={map.selectedSlug}
          hoveredSlug={map.hoveredSlug}
          initialViewState={initialViewState}
          focusBounds={focusBounds ?? selectedRoute}
          onSelect={map.selectStore}
          onSelectTrace={selectTrace}
          onHover={map.hoverStore}
          onViewportChange={map.onViewportChange}
          onInteraction={handleMapInteraction}
          onStatus={setMapProviderStatus}
        />
        {map.isDirty && (
          <button
            className="map-stage__search-cta"
            type="button"
            onClick={map.searchThisArea}
            disabled={map.isSearching}
            aria-busy={map.isSearching}
          >
            <Search size={15} aria-hidden="true" />
            {map.isSearching ? "กำลังค้นหา…" : "Search this area"}
          </button>
        )}
        {selectedPlace && (
          <div className="map-preview-card map-preview-card--place">
            <span className="eyebrow">SELECTED PLACE</span>
            <strong>{selectedPlace.name}</strong>
            <span>
              {selectedPlace.source === "osm"
                ? "OpenStreetMap place"
                : `${selectedPlace.area} · `}
              {selectedPlace.availabilityLabel ?? "ดู availability"}
            </span>
            {selectedPlace.isAevoPlayPartner &&
              (placeApiMode !== "canonical" ||
                Boolean(
                  selectedPlace.venueSlug ||
                    selectedPlace.publicBookingRoute?.startsWith("/stores/"),
                )) && (
              <span className="map-preview-card__partner">
                <Zap size={13} aria-hidden="true" />จองผ่าน Aevo Play ได้ทันที
              </span>
            )}
            <div className="map-preview-card__actions">
              {selectedPlace.source === "osm" ? (
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => {
                    const query = `${selectedPlace.name}, Bangkok`;
                    void platform.openExternalUrl(
                      `https://maps.google.com/?q=${encodeURIComponent(query)}`,
                    );
                  }}
                >
                  เปิดในแผนที่ภายนอก <ArrowRight size={14} aria-hidden="true" />
                </button>
              ) : (
                <Link
                  className="button button--ghost"
                  to={
                    placeApiMode === "canonical"
                      ? canonicalPlaceDetailPath(selectedPlace.id)
                      : `/stores/${selectedPlace.slug}`
                  }
                >
                  ดูรายละเอียด <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
              {selectedPlace.isAevoPlayPartner &&
                (placeApiMode !== "canonical" ||
                  Boolean(
                    selectedPlace.venueSlug ||
                      selectedPlace.publicBookingRoute?.startsWith("/stores/"),
                  )) && (
                <button
                  className="button button--dark"
                  type="button"
                  onClick={() => setBookingPlace(selectedPlace)}
                >
                  จองทันที
                </button>
              )}
            </div>
          </div>
        )}
        {selectedTrace && (
          <Link
            className="map-preview-card"
            to={`/traces/${selectedTrace.slug}`}
            aria-label={`เปิด Trace ${selectedTrace.title}`}
          >
            <span className="eyebrow">SELECTED TRACE</span>
            <strong>{selectedTrace.title}</strong>
            <span>
              {selectedTrace.stopCount} stops ·{" "}
              {selectedTrace.durationMinutes
                ? `${selectedTrace.durationMinutes / 60} ชั่วโมง`
                : "เวลาไม่ระบุ"}
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
        <p className="map-stage__note">
          <MapPinned size={16} aria-hidden="true" />
          {mapProviderStatus === "unsupported"
            ? "แผนที่ไม่พร้อม · ใช้รายการผลลัพธ์ได้"
            : mapProviderStatus === "error"
              ? "แผนที่ขัดข้อง · ใช้รายการผลลัพธ์ได้"
              : "เลือก pin หรือผลลัพธ์เพื่อ sync selection"}
        </p>
        <span className="map-stage__attribution">
          {mapAttribution(mapProviderPolicy)}
        </span>
      </section>
      <p className="guardrail-note map-page__guardrail">
        <SlidersHorizontal size={15} aria-hidden="true" />
        แผนที่ใช้เฉพาะ public projection และคงผลลัพธ์เดิมไว้ระหว่าง refresh หรือ
        recovery
      </p>
      {bookingPlace && (
        <MapBookingDrawer place={bookingPlace} onClose={closeBooking} />
      )}
    </div>
  );
}
