import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Gift,
  Heart,
  LocateFixed,
  MapPinned,
  Moon,
  Navigation,
  PackageCheck,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Ticket,
  User,
  WalletCards,
  X
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ConnectionStatusCard } from "@/components/connection-status";
import { GlidingGroup } from "@/components/gliding-group";
import { SubpageNavigation } from "@/components/subpage-navigation";
import type { CustomerStoreSummary } from "@/contracts/customer";
import type { PlaceDetail } from "@/contracts/place";
import { publicBookingDetailsSchema, type PublicAvailabilitySlot, type PublicBookingDetails, type PublicBookingHold, type PublicCatalogProduct } from "@/contracts/public";
import { areas, categories, demoStores, getStore, type StoreSummary } from "@/data/demo";
import { ApiClientError } from "@/lib/api-client";
import { getPublicSearchSuggestions, getStoreBySlug, getTraceDeeNotifications, markTraceDeeNotificationRead, searchStores } from "@/lib/customer-api";
import { safeReturnTo } from "@/lib/deep-link";
import { customerDataMode, placeApiMode } from "@/lib/env";
import { useCartStore } from "@/lib/cart-store";
import { localRepository, type FavoriteStoreRecord, type LocalOrderRecord, type LocalReservationRecord } from "@/lib/local-repository";
import { getPlaceDetail, listSavedCanonicalPlaces, setCanonicalPlaceSaved } from "@/lib/place-api";
import { confirmPublicBookingHold, createPublicBookingHold, createPublicOrder, createPublicPaymentSession, getPublicBookingTracking, getPublicCatalog, getPublicOrderTracking, getPublicVenueAvailability, listCustomerFavorites, pricePublicCart, removeCustomerFavorite, saveCustomerFavorite } from "@/lib/public-api";
import { createIdempotencyKey } from "@/lib/idempotency";
import { completeCustomerSignIn, getCustomerSession, logoutCustomer } from "@/lib/session";
import { beginGoSignIn, clearGoSsoFlow, readGoSsoFlow } from "@/lib/sso";
import { createPlatformBridge } from "@/platform";
import { useUiStore } from "@/lib/ui-store";
import { ExplorePage as DiscoveryExplorePage } from "@/features/discovery/explore-page";
import { ProfileInsightCard } from "@/features/profile/profile-insight-card";

const activityTabs = [
  { id: "reservations", label: "Reservations" },
  { id: "orders", label: "Orders" }
] as const;

const fulfillmentTabs = [
  { id: "TAKEAWAY", label: "Takeaway" },
  { id: "DINE_IN", label: "Dine-in" }
] as const;

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className="body-copy">{description}</p>}
    </header>
  );
}

function SectionHeading({ id, title, action }: { id?: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><h2 id={id}>{title}</h2>{action}</div>;
}

function StoreCard({ store, compact = false }: { store: StoreSummary; compact?: boolean }) {
  return (
    <article className={`store-card${compact ? " store-card--compact" : ""}`}>
      <Link className={`store-card__visual store-card__visual--${store.accent}${store.imageUrl ? " store-card__visual--image" : ""}`} to={`/stores/${store.slug}`} aria-label={`เปิด ${store.name}`}>
        {store.imageUrl ? <img className="store-card__image" src={store.imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : <span className="store-card__initials" aria-hidden="true">{store.name.split(" ").map((part) => part[0]).join("")}</span>}
        <span className="store-card__tag">{store.category}</span>
      </Link>
      <div className="store-card__body">
        <div className="store-card__title-row"><h3><Link to={`/stores/${store.slug}`}>{store.name}</Link></h3><span className="rating">{store.rating === null ? "ยังไม่มีรีวิว" : `★ ${store.rating}`}</span></div>
        <p className="store-card__meta">{store.area} · {store.priceRange} · {store.reviewCount} reviews</p>
        {!compact && <p className="store-card__description">{store.description}</p>}
        <div className="store-card__footer"><span className="availability"><span className="availability__dot" aria-hidden="true" />{store.availability}</span><Link className="text-link" to={`/stores/${store.slug}`}>ดูรายละเอียด <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
    </article>
  );
}

function SavedStoreCard({ store }: { store: FavoriteStoreRecord }) {
  return (
    <article className="store-card store-card--saved-snapshot">
      <Link className="store-card__visual store-card__visual--mint" to={`/stores/${store.slug}`} aria-label={`เปิด ${store.name}`}>
        {store.imageUrl ? <img className="store-card__image" src={store.imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : <span className="store-card__initials" aria-hidden="true">{store.name.split(" ").map((part) => part[0]).join("")}</span>}
        <span className="store-card__tag">{store.category}</span>
      </Link>
      <div className="store-card__body">
        <div className="store-card__title-row"><h3><Link to={`/stores/${store.slug}`}>{store.name}</Link></h3><span className="muted-label">saved</span></div>
        <p className="store-card__meta">{store.area} · public profile snapshot</p>
        <div className="store-card__footer"><span className="availability"><span className="availability__dot" aria-hidden="true" />ข้อมูลจะ refresh เมื่อเปิดรายละเอียด</span><Link className="text-link" to={`/stores/${store.slug}`}>ดูรายละเอียด <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
    </article>
  );
}

interface CanonicalSavedPlaceRecord {
  place: PlaceDetail;
  savedAt: string;
}

function CanonicalSavedPlaceCard({
  record,
  onRemove,
  removing,
}: {
  record: CanonicalSavedPlaceRecord;
  onRemove: (placeId: string) => void;
  removing: boolean;
}) {
  const { place, savedAt } = record;
  const address = place.address?.formattedAddress ?? place.area ?? "ยังไม่มีที่อยู่สาธารณะ";
  const freshness = place.capabilities.freshness.state === "stale"
    ? "ข้อมูล capability อาจล้าสมัย"
    : place.capabilities.freshness.state === "fresh"
      ? "ข้อมูล capability ล่าสุด"
      : "ยังไม่ทราบ freshness ของ capability";

  return (
    <article className="store-card store-card--saved-snapshot">
      <Link
        className="store-card__visual store-card__visual--mint"
        to={`/places/${encodeURIComponent(place.id)}`}
        aria-label={`เปิด ${place.name}`}
      >
        <span className="store-card__initials" aria-hidden="true">
          {place.name.split(" ").map((part) => part[0]).join("")}
        </span>
        <span className="store-card__tag">{place.category.label}</span>
      </Link>
      <div className="store-card__body">
        <div className="store-card__title-row">
          <h3>
            <Link to={`/places/${encodeURIComponent(place.id)}`}>{place.name}</Link>
          </h3>
          <span className="muted-label">saved</span>
        </div>
        <p className="store-card__meta">{place.area ?? "ไม่ระบุพื้นที่"} · {address}</p>
        <div className="store-card__footer">
          <span className="availability">
            <span className="availability__dot" aria-hidden="true" />
            {freshness} · บันทึก {new Date(savedAt).toLocaleDateString("th-TH")}
          </span>
          <div className="button-row">
            <Link className="text-link" to={`/places/${encodeURIComponent(place.id)}`}>
              ดูรายละเอียด <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <button
              className="text-link text-link--button"
              type="button"
              onClick={() => onRemove(place.id)}
              disabled={removing}
            >
              {removing ? "กำลังนำออก…" : "นำออก"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Heart; title: string; description: string; action?: React.ReactNode }) {
  return (
    <section className="empty-state">
      <span className="icon-badge" aria-hidden="true"><Icon size={21} /></span>
      <h2>{title}</h2>
      <p className="body-copy">{description}</p>
      {action}
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <section className="loading-state" aria-busy="true" aria-live="polite">
      <p className="muted-label">{label}</p>
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton skeleton--wide" />
        <span className="skeleton" />
        <span className="skeleton skeleton--short" />
      </div>
    </section>
  );
}

function formatMinorAmount(amountMinor: number, currency = "THB"): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountMinor / 100);
}

function getRequestErrorCopy(error: unknown, notFoundCopy: string): string {
  if (error instanceof ApiClientError && error.status === 404) return notFoundCopy;
  return "Customer Gateway ยังไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง";
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const weekdayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"] as const;

function mapCustomerStore(store: CustomerStoreSummary): StoreSummary {
  return {
    slug: store.slug,
    ...(store.storeCode ? { publicStoreCode: store.storeCode } : {}),
    ...(store.venueSlug ? { venueSlug: store.venueSlug } : {}),
    isAevoPlayPartner: store.isAevoPlayPartner === true,
    name: store.name,
    area: store.area,
    category: store.category,
    rating: store.rating,
    reviewCount: store.reviewCount,
    priceRange: store.priceRange,
    availability: store.availabilityLabel ?? "ดู availability",
    description: store.description ?? "ข้อมูลสถานที่จาก Customer Gateway",
    imageUrl: store.imageUrl,
    latitude: store.latitude,
    longitude: store.longitude,
    mediaUrls: store.mediaUrls,
    facilities: store.facilities,
    policySummary: store.policySummary,
    address: store.address,
    timezone: store.timezone,
    operatingHours: store.operatingHours,
    accent: "mint"
  };
}

function mapCustomerStores(stores: CustomerStoreSummary[]): StoreSummary[] {
  return stores.map(mapCustomerStore);
}

function useCustomerStore(storeSlug: string | undefined): {
  store: StoreSummary | undefined;
  query: UseQueryResult<CustomerStoreSummary, Error>;
} {
  const query = useQuery({
    queryKey: ["public-store", storeSlug],
    queryFn: () => getStoreBySlug(storeSlug ?? ""),
    enabled: customerDataMode === "live" && Boolean(storeSlug),
    staleTime: 60_000
  });
  const demoStore = getStore(storeSlug);
  return {
    store: customerDataMode === "live" ? (query.data ? mapCustomerStore(query.data) : undefined) : demoStore,
    query
  };
}

function StoreProjectionFallback({
  storeSlug,
  onRetry,
  title = "ข้อมูลสถานที่ยังไม่พร้อม",
}: {
  storeSlug?: string;
  onRetry: () => void;
  title?: string;
}) {
  let label = "สถานที่นี้";
  if (storeSlug) {
    try {
      label = decodeURIComponent(storeSlug).replaceAll("-", " ");
    } catch {
      label = "สถานที่นี้";
    }
  }
  return (
    <section className="inline-projection-fallback" role="status">
      <span className="icon-badge" aria-hidden="true"><CircleHelp size={21} /></span>
      <div>
        <p className="eyebrow">PLACE DATA</p>
        <h2>{title}</h2>
        <p className="body-copy">{label} · ข้อมูลกำลังอยู่ระหว่างการอัปเดต จึงยังไม่เปิดรายละเอียดที่ยืนยันไม่ได้</p>
      </div>
      <div className="button-row">
        <button className="button button--ghost" type="button" onClick={onRetry}>ลองใหม่</button>
        <Link className="button button--dark" to="/">ย้อนกลับ</Link>
      </div>
    </section>
  );
}

export function ExplorePage() {
  return <DiscoveryExplorePage />;
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const area = searchParams.get("area") ?? "";
  const [input, setInput] = useState(query);
  const [suggestionTerm, setSuggestionTerm] = useState("");
  useEffect(() => setInput(query), [query]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSuggestionTerm(input.trim()), 240);
    return () => window.clearTimeout(timer);
  }, [input]);
  const suggestionQuery = useQuery({
    queryKey: ["public-search-suggestions", suggestionTerm],
    queryFn: ({ signal }) => getPublicSearchSuggestions(suggestionTerm, { signal }),
    enabled: customerDataMode === "live" && suggestionTerm.length >= 2,
    staleTime: 30_000
  });
  const discoveryQuery = useInfiniteQuery({
    queryKey: ["public-search", query, category, area],
    queryFn: ({ signal, pageParam }) => searchStores({
      ...(query ? { query } : {}),
      ...(category ? { category } : {}),
      ...(area ? { area } : {}),
      ...(pageParam ? { cursor: pageParam } : {})
    }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: customerDataMode === "live",
    staleTime: 30_000
  });
  const demoResults = demoStores.filter((store) => {
    const matchesText = !query || `${store.name} ${store.area} ${store.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || store.category === category;
    const matchesArea = !area || store.area === area;
    return matchesText && matchesCategory && matchesArea;
  });
  const results = customerDataMode === "live"
    ? mapCustomerStores(discoveryQuery.data?.pages.flatMap((page) => page.data) ?? [])
    : demoResults;
  const serverFacets = discoveryQuery.data?.pages[0]?.facets;
  const areaFilters = serverFacets?.areas.length ? serverFacets.areas : areas.map((value) => ({ value, count: 0 }));
  const categoryFilters = serverFacets?.categories.length ? serverFacets.categories : categories.map((value) => ({ value, count: 0 }));
  const suggestions = useMemo(() => {
    if (suggestionTerm.length < 2) return [];
    const options: Array<{ kind: "store" | "category" | "area"; label: string; value: string }> = [];
    for (const suggestion of suggestionQuery.data?.suggestions ?? []) {
      const kind = suggestion.kind === "STORE" ? "store" : suggestion.kind === "CATEGORY" ? "category" : "area";
      options.push({ kind, label: suggestion.label, value: suggestion.storeSlug ?? suggestion.value });
    }
    return options.filter((option, index, all) => all.findIndex((candidate) => candidate.kind === option.kind && candidate.value === option.value) === index).slice(0, 8);
  }, [suggestionQuery.data, suggestionTerm]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (input.trim()) void localRepository.addRecentSearch(input);
    const next = new URLSearchParams(searchParams);
    input ? next.set("q", input) : next.delete("q");
    setSearchParams(next);
  };
  const updateFilter = (key: "category" | "area", value: string) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    setSearchParams(next);
  };
  const clearFilters = () => setSearchParams({});

  return (
    <div className="page-frame">
      <PageHeading eyebrow="SEARCH / DISCOVER" title="ค้นพบสิ่งที่ใช่" description="ผลการค้นหาจะอยู่ใน URL เพื่อให้แชร์และกลับมาดูต่อได้" />
      <div className="search-composer"><form className="search-field search-field--page" onSubmit={submit} role="search"><Search size={19} aria-hidden="true" /><input inputMode="search" autoComplete="off" value={input} onChange={(event) => setInput(event.target.value)} placeholder="ร้าน หมวดหมู่ หรือพื้นที่" aria-label="ค้นหาในผลลัพธ์" aria-autocomplete="list" /><button className="search-field__submit" type="submit" aria-label="ค้นหา"><ArrowRight size={17} aria-hidden="true" /></button></form>{suggestions.length > 0 && <div className="search-suggestions" role="listbox" aria-label="คำแนะนำการค้นหา">{suggestions.map((suggestion) => <button className="search-suggestion" type="button" role="option" key={`${suggestion.kind}-${suggestion.value}`} onClick={() => { const next = new URLSearchParams(searchParams); if (suggestion.kind === "category") { next.set("category", suggestion.label); next.delete("q"); } else if (suggestion.kind === "area") { next.set("area", suggestion.label); next.delete("q"); } else { next.set("q", suggestion.label); } setInput(suggestion.label); setSearchParams(next); }}><Search size={14} aria-hidden="true" /><span>{suggestion.label}</span><small>{suggestion.kind === "store" ? "ร้าน" : suggestion.kind === "category" ? "หมวดหมู่" : "พื้นที่"}</small></button>)}</div>}</div>
      <div className="search-results-layout">
        <aside className="search-filter-panel" aria-label="ตัวกรองการค้นหา">
          <div className="search-filter-panel__heading"><span className="eyebrow">DISCOVERY CONTEXT</span><SlidersHorizontal size={18} aria-hidden="true" /></div>
          <div className="filter-panel__field"><label htmlFor="search-area">พื้นที่</label><div className="select-field"><MapPinned size={15} aria-hidden="true" /><select id="search-area" value={area} onChange={(event) => updateFilter("area", event.target.value)} aria-label="กรองตามพื้นที่"><option value="">ทุกพื้นที่</option>{areaFilters.map((item) => <option key={item.value} value={item.value}>{item.value}{item.count > 0 ? ` (${item.count})` : ""}</option>)}</select></div></div>
          <fieldset className="filter-panel__group"><legend>หมวดหมู่</legend><GlidingGroup size="small" ariaLabel="กรองตามหมวดหมู่" items={[{ id: "__all", label: "ทั้งหมด" }, ...categoryFilters.map((item) => ({ id: item.value, label: item.count > 0 ? `${item.value} · ${item.count}` : item.value }))]} activeId={category || "__all"} onChange={(id) => updateFilter("category", id === "__all" ? "" : id)} /></fieldset>
          {(query || category || area) && <button className="text-link text-link--button" type="button" onClick={clearFilters}>ล้างตัวกรอง</button>}
          <p className="guardrail-note"><Search size={15} aria-hidden="true" />Filters อยู่ใน URL เพื่อแชร์และกลับมาดูต่อได้</p>
        </aside>
        <section className="search-results-panel" aria-labelledby="search-results-title">
          <div className="results-summary"><div><strong id="search-results-title">{customerDataMode === "live" && discoveryQuery.isLoading ? "กำลังค้นหา…" : `${results.length} แห่ง`}</strong><span>{query || category || area ? "จากตัวกรองปัจจุบัน" : "แนะนำสำหรับคุณ"}</span></div><span className="muted-label">{customerDataMode === "live" ? "Customer Gateway" : "Demo discovery"}</span></div>
          {customerDataMode === "live" && discoveryQuery.isError ? <EmptyState icon={CircleHelp} title="ค้นหาไม่สำเร็จ" description={getRequestErrorCopy(discoveryQuery.error, "ยังไม่มี public store profile")} action={<button className="button button--ghost" type="button" onClick={() => void discoveryQuery.refetch()}>ลองใหม่</button>} /> : results.length > 0 ? <><div className="store-list">{results.map((store) => <StoreCard key={store.slug} store={store} />)}</div>{discoveryQuery.hasNextPage && <button className="button button--ghost load-more-button" type="button" onClick={() => void discoveryQuery.fetchNextPage()} disabled={discoveryQuery.isFetchingNextPage}>{discoveryQuery.isFetchingNextPage ? "กำลังโหลดเพิ่ม…" : "โหลดผลลัพธ์เพิ่ม"}</button>}</> : customerDataMode === "live" && discoveryQuery.isLoading ? <LoadingState label="กำลังโหลดผลการค้นหาจาก Customer Gateway…" /> : <EmptyState icon={Search} title="ยังไม่พบผลลัพธ์" description="ลองเปลี่ยนคำค้นหรือเอาตัวกรองบางรายการออก แล้วลองใหม่อีกครั้ง" action={<button className="button button--ghost" type="button" onClick={clearFilters}>รีเซ็ตการค้นหา</button>} />}
        </section>
      </div>
    </div>
  );
}

export function SavedPage() {
  const savedStoreSlugs = useUiStore((state) => state.savedStoreSlugs);
  const queryClient = useQueryClient();
  const [savedSnapshots, setSavedSnapshots] = useState<FavoriteStoreRecord[]>([]);
  const [canonicalNotice, setCanonicalNotice] = useState("");
  const [removingCanonicalPlaceId, setRemovingCanonicalPlaceId] = useState<string | null>(null);
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "saved"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const serverFavoritesQuery = useQuery({
    queryKey: ["customer-favorites", "saved"],
    queryFn: listCustomerFavorites,
    enabled: customerDataMode === "live" && placeApiMode !== "canonical" && Boolean(sessionQuery.data),
    retry: false,
    staleTime: 30_000
  });
  const serverStoreQueries = useQueries({
    queries: (serverFavoritesQuery.data ?? []).map((slug) => ({
      queryKey: ["public-store", "saved", slug],
      queryFn: () => getStoreBySlug(slug),
      staleTime: 60_000
    }))
  });
  const canonicalSavedPlacesQuery = useQuery<{
    records: CanonicalSavedPlaceRecord[];
    unavailableCount: number;
  }>({
    queryKey: ["feed", "saved-places", "saved-page", sessionQuery.data?.user.id ?? null],
    queryFn: async ({ signal }) => {
      const savedPlaces = await listSavedCanonicalPlaces({ signal });
      const resolvedPlaces = await Promise.allSettled(
        savedPlaces.map(async (entry) => ({
          place: await getPlaceDetail(entry.placeId, { signal }),
          savedAt: entry.savedAt,
        })),
      );
      const records = resolvedPlaces.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      return {
        records,
        unavailableCount: savedPlaces.length - records.length,
      };
    },
    enabled: customerDataMode === "live" && placeApiMode === "canonical" && Boolean(sessionQuery.data),
    retry: false,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (customerDataMode === "live" && placeApiMode === "canonical") return;
    let active = true;
    void localRepository.listFavorites().then((values) => { if (active) setSavedSnapshots(values); });
    return () => { active = false; };
  }, [savedStoreSlugs.length]);
  const savedStores = savedStoreSlugs.map((slug) => getStore(slug)).filter((store): store is StoreSummary => store !== undefined);
  const snapshotStores = savedSnapshots.filter((store) => !savedStores.some((saved) => saved.slug === store.slug));
  const serverStores = serverStoreQueries.map((query) => query.data ? mapCustomerStore(query.data) : undefined).filter((store): store is StoreSummary => store !== undefined);
  const allServerStores = serverStores.filter((store) => !savedStores.some((saved) => saved.slug === store.slug) && !snapshotStores.some((snapshot) => snapshot.slug === store.slug));
  const totalSaved = savedStores.length + snapshotStores.length + allServerStores.length;

  const signInToSeeCanonicalSavedPlaces = async () => {
    setCanonicalNotice("");
    try {
      await beginGoSignIn("/saved");
    } catch {
      setCanonicalNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
    }
  };

  const removeCanonicalSavedPlace = async (placeId: string) => {
    setCanonicalNotice("");
    setRemovingCanonicalPlaceId(placeId);
    try {
      const response = await setCanonicalPlaceSaved(
        placeId,
        false,
        createIdempotencyKey("saved-page-place-remove"),
      );
      if (response.placeId !== placeId || response.saved) {
        throw new Error("canonical-place-remove-state-mismatch");
      }
      await Promise.all([
        canonicalSavedPlacesQuery.refetch(),
        queryClient.invalidateQueries({
          queryKey: ["feed", "saved-places", "explore", sessionQuery.data?.user.id ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["feed", "saved-places", "profile", sessionQuery.data?.user.id ?? null],
        }),
      ]);
      setCanonicalNotice("นำ Place ออกจาก Saved แล้ว");
    } catch (error) {
      setCanonicalNotice(
        error instanceof ApiClientError
          ? error.message
          : "ยังไม่สามารถนำ Place ออกจาก Saved ได้ กรุณาลองใหม่",
      );
    } finally {
      setRemovingCanonicalPlaceId(null);
    }
  };

  if (customerDataMode === "live" && placeApiMode === "canonical") {
    const canonicalRecords = canonicalSavedPlacesQuery.data?.records ?? [];
    const unavailableCount = canonicalSavedPlacesQuery.data?.unavailableCount ?? 0;
    const canonicalLoading = sessionQuery.isLoading || canonicalSavedPlacesQuery.isLoading;

    return (
      <div className="page-frame">
        <PageHeading
          eyebrow="SAVED / YOUR PLACES"
          title="รายการที่บันทึกไว้"
          description="รายการนี้อ่านจาก Core canonical Place save projection ของบัญชีปัจจุบัน"
        />
        {canonicalLoading ? (
          <LoadingState label="กำลังตรวจสอบ session และโหลด Saved Places จาก Core…" />
        ) : !sessionQuery.data ? (
          <EmptyState
            icon={Heart}
            title="เข้าสู่ระบบเพื่อดูรายการที่บันทึก"
            description="Saved แบบ canonical ผูกกับ GO session และจะไม่อ่านข้อมูลจาก legacy favorites"
            action={
              <button className="button button--dark" type="button" onClick={() => void signInToSeeCanonicalSavedPlaces()}>
                เข้าสู่ระบบ <ArrowRight size={16} aria-hidden="true" />
              </button>
            }
          />
        ) : canonicalSavedPlacesQuery.isError ? (
          <EmptyState
            icon={CircleHelp}
            title="โหลดรายการที่บันทึกไม่สำเร็จ"
            description="Core ยังไม่สามารถส่งรายการ canonical Places กลับมาได้"
            action={<button className="button button--ghost" type="button" onClick={() => void canonicalSavedPlacesQuery.refetch()}>ลองใหม่</button>}
          />
        ) : canonicalRecords.length > 0 ? (
          <section className="content-section" aria-labelledby="canonical-saved-list-title">
            <SectionHeading id="canonical-saved-list-title" title={`${canonicalRecords.length} สถานที่ที่บันทึกไว้`} />
            <div className="store-list">
              {canonicalRecords.map((record) => (
                <CanonicalSavedPlaceCard
                  key={record.place.id}
                  record={record}
                  onRemove={(placeId) => void removeCanonicalSavedPlace(placeId)}
                  removing={removingCanonicalPlaceId === record.place.id}
                />
              ))}
            </div>
            {unavailableCount > 0 && <p className="guardrail-note" role="status">{unavailableCount} รายการไม่พร้อมแสดงใน public projection จึงถูกซ่อนไว้ชั่วคราว</p>}
            {canonicalNotice && <p className="inline-notice" role="status">{canonicalNotice}</p>}
          </section>
        ) : (
          <EmptyState
            icon={Heart}
            title="ยังไม่มีรายการที่บันทึก"
            description="กด Save บน canonical Place จาก Explore แล้วรายการจะมาอยู่ตรงนี้"
            action={<Link className="button button--dark" to="/">เริ่มสำรวจ <ArrowRight size={16} aria-hidden="true" /></Link>}
          />
        )}
        {!sessionQuery.data && canonicalNotice && <p className="inline-notice" role="alert">{canonicalNotice}</p>}
      </div>
    );
  }

  return <div className="page-frame"><PageHeading eyebrow="SAVED / YOUR PLACES" title="รายการที่บันทึกไว้" description="เก็บร้านและประสบการณ์ที่อยากกลับมาไว้ในที่เดียว" />{totalSaved > 0 ? <section className="content-section" aria-labelledby="saved-list-title"><SectionHeading id="saved-list-title" title={`${totalSaved} สถานที่ที่บันทึกไว้`} /><div className="store-list">{savedStores.map((store) => <StoreCard key={store.slug} store={store} />)}{snapshotStores.map((store) => <SavedStoreCard key={store.slug} store={store} />)}{allServerStores.map((store) => <StoreCard key={store.slug} store={store} />)}</div></section> : <EmptyState icon={Heart} title="ยังไม่มีรายการที่บันทึก" description="กด Save บนร้านที่คุณสนใจ แล้วรายการจะมาอยู่ตรงนี้" action={<Link className="button button--dark" to="/">เริ่มสำรวจ <ArrowRight size={16} aria-hidden="true" /></Link>} />}</div>;
}

export function ActivityPage() {
  const [tab, setTab] = useState<"reservations" | "orders">("reservations");
  const { orderId, reservationId } = useParams();
  const [orders, setOrders] = useState<LocalOrderRecord[]>([]);
  const [reservations, setReservations] = useState<LocalReservationRecord[]>([]);
  const [notificationNotice, setNotificationNotice] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([localRepository.listOrders(), localRepository.listReservations()]).then(([nextOrders, nextReservations]) => {
      if (!active) return;
      setOrders(nextOrders);
      setReservations(nextReservations);
    });
    if (orderId) setTab("orders");
    if (reservationId) setTab("reservations");
    return () => { active = false; };
  }, [orderId, reservationId]);
  const selectedOrder = orders.find((order) => order.trackingToken === orderId || order.id === orderId) ?? orders[0];
  const selectedReservation = reservations.find((reservation) => reservation.id === reservationId) ?? reservations[0];
  const orderQuery = useQuery({
    queryKey: ["public-order", selectedOrder?.storeCode, selectedOrder?.trackingToken],
    queryFn: () => getPublicOrderTracking(selectedOrder?.storeCode ?? "", selectedOrder?.trackingToken ?? ""),
    enabled: customerDataMode === "live" && tab === "orders" && Boolean(selectedOrder),
    refetchInterval: 30_000,
    retry: 1
  });
  const reservationQuery = useQuery({
    queryKey: ["public-booking", selectedReservation?.trackingToken],
    queryFn: () => getPublicBookingTracking(selectedReservation?.trackingToken ?? ""),
    enabled: customerDataMode === "live" && tab === "reservations" && Boolean(selectedReservation?.trackingToken),
    refetchInterval: 30_000,
    retry: 1
  });
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "activity"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const notificationsQuery = useQuery({
    queryKey: ["tracedee-notifications"],
    queryFn: ({ signal }) => getTraceDeeNotifications({ signal }),
    enabled: customerDataMode === "live" && Boolean(sessionQuery.data),
    retry: false,
    staleTime: 15_000
  });
  const markNotificationRead = async (notificationId: string, read: boolean): Promise<void> => {
    try {
      await markTraceDeeNotificationRead(notificationId, read, createIdempotencyKey("tracedee-notification-read"));
      await notificationsQuery.refetch();
    } catch (error) {
      setNotificationNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถอัปเดต notification ได้");
    }
  };
  return (
    <div className="page-frame">
      <PageHeading eyebrow="ACTIVITY / HISTORY" title="กิจกรรมของคุณ" description="รวม reservation และ order พร้อมสถานะล่าสุดจาก server หรือ local recovery snapshot" />
      {customerDataMode === "live" && sessionQuery.data && <section className="flow-card tracedee-notifications" aria-labelledby="tracedee-notifications-title" aria-busy={notificationsQuery.isLoading}>
        <div className="section-heading"><div><span className="eyebrow">TRACEDEE / NOTIFICATIONS</span><h2 id="tracedee-notifications-title">อัปเดตจาก TraceDee</h2></div><Bell size={18} aria-hidden="true" /></div>
        {notificationsQuery.isLoading && <LoadingState label="กำลังโหลด notification…" />}
        {notificationsQuery.isError && <EmptyState icon={CircleHelp} title="โหลด notification ไม่สำเร็จ" description="ลองอ่านสถานะจาก Gateway อีกครั้ง" action={<button className="button button--ghost" type="button" onClick={() => void notificationsQuery.refetch()}>ลองใหม่</button>} />}
        {!notificationsQuery.isLoading && !notificationsQuery.isError && (notificationsQuery.data?.notifications.length ?? 0) === 0 && <p className="muted-label">ยังไม่มี notification จาก community</p>}
        <div className="tracedee-notifications__list">{notificationsQuery.data?.notifications.map((notification) => <article className={`tracedee-notifications__item${notification.readAt ? " is-read" : ""}`} key={notification.id}><div><strong>{notification.eventType === "trace_post_created" ? "มี contribution ใหม่ใน Trace ของคุณ" : notification.eventType === "post_comment_created" ? "มีความคิดเห็นใหม่ใน thread ของคุณ" : "มีอัปเดตจาก TraceDee"}</strong><p>{notification.aggregationCount > 1 ? `${notification.aggregationCount} กิจกรรมรวมไว้เพื่อลดการแจ้งเตือนถี่เกินไป` : "กิจกรรมใหม่จาก community"}</p><small>{new Date(notification.createdAt).toLocaleString("th-TH")}</small></div>{!notification.readAt && <button className="button button--ghost button--small" type="button" onClick={() => void markNotificationRead(notification.id, true)}>อ่านแล้ว</button>}</article>)}</div>
        {notificationNotice && <p className="inline-notice" role="status">{notificationNotice}</p>}
      </section>}
      <GlidingGroup
        items={activityTabs}
        activeId={tab}
        role="tablist"
        ariaLabel="Activity type"
        onChange={(id) => {
          if (id === "reservations" || id === "orders") setTab(id);
        }}
      />
      {tab === "reservations" ? selectedReservation ? (
        <section className="flow-card" aria-labelledby="reservation-title" aria-busy={reservationQuery.isLoading}>
          {reservationQuery.isLoading ? <LoadingState label="กำลังตรวจสอบ reservation จาก Customer Gateway…" /> : reservationQuery.isError && selectedReservation.trackingToken ? <EmptyState icon={CircleHelp} title="ตรวจสอบ reservation ไม่สำเร็จ" description="ข้อมูล local snapshot ยังอยู่ และสามารถลองอ่านสถานะจาก server ได้อีกครั้ง" action={<button className="button button--ghost" type="button" onClick={() => void reservationQuery.refetch()}>ตรวจสอบอีกครั้ง</button>} /> : <>
            <div className="booking-review">
              <span className="eyebrow">RESERVATION / SERVER STATUS</span>
              <h2 id="reservation-title">{selectedReservation.storeName}</h2>
              <p>{reservationQuery.data?.booking.startAt ?? selectedReservation.startsAt} – {reservationQuery.data?.booking.endAt ?? selectedReservation.endsAt}</p>
              <p>สถานะ: {reservationQuery.data?.booking.status ?? selectedReservation.status} · {reservationQuery.data?.booking.partySize ?? selectedReservation.partySize ?? 1} คน</p>
              {reservationQuery.data?.booking.amountMinor !== undefined && <p>ยอดรวม: {formatMinorAmount(reservationQuery.data.booking.amountMinor)}</p>}
              {!selectedReservation.trackingToken && <small className="muted-label">รายการนี้เป็น recovery snapshot รุ่นเก่า จึงยังอ่านสถานะ server ไม่ได้</small>}
            </div>
            <div className="button-row"><Link className="button button--ghost" to={`/stores/${selectedReservation.storeSlug}`}>เปิดร้าน</Link>{selectedReservation.trackingToken && <button className="button button--ghost" type="button" onClick={() => void reservationQuery.refetch()}>Refresh status</button>}</div>
          </>}
        </section>
      ) : <EmptyState icon={CalendarDays} title="ยังไม่มี reservation" description="เมื่อคุณยืนยัน reservation สำเร็จ รายการจะถูกเก็บไว้เพื่อกู้คืนหลัง refresh" action={<ConnectionStatusCard compact />} /> : selectedOrder ? (
        <section className="flow-card" aria-labelledby="order-title" aria-busy={orderQuery.isLoading}>
          {orderQuery.isLoading ? <LoadingState label="กำลังตรวจสอบ order จาก Customer Gateway…" /> : orderQuery.isError ? <EmptyState icon={CircleHelp} title="ตรวจสอบ order ไม่สำเร็จ" description="ยังไม่แสดง success ใหม่จนกว่าจะอ่านสถานะจาก server ได้" action={<button className="button button--ghost" type="button" onClick={() => void orderQuery.refetch()}>ตรวจสอบอีกครั้ง</button>} /> : orderQuery.data ? <div className="booking-review"><span className="eyebrow">ORDER / SERVER STATUS</span><h2 id="order-title">{orderQuery.data.order.orderNumber}</h2><p>สถานะ: {orderQuery.data.order.status} · payment: {orderQuery.data.order.paymentStatus}</p><p>ยอดรวม: {formatMinorAmount(orderQuery.data.order.totalMinor, orderQuery.data.order.currency)}</p><Link className="button button--ghost" to={`/activity/orders/${selectedOrder.trackingToken}`}>Refresh status</Link></div> : <p className="muted-label">ยังไม่มีข้อมูล order</p>}
        </section>
      ) : <EmptyState icon={PackageCheck} title="ยังไม่มี order" description="เมื่อ checkout ผ่าน Customer Gateway แล้ว order tracking token จะถูกเก็บไว้ใน Activity" action={<ConnectionStatusCard compact />} />}
    </div>
  );
}

export function MyPage() {
  const theme = useUiStore((state) => state.theme);
  const savedStoreSlugs = useUiStore((state) => state.savedStoreSlugs);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const [notice, setNotice] = useState("");
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const session = sessionQuery.data;
  const localProfileQuery = useQuery({
    queryKey: ["profile", "local-insights", savedStoreSlugs.length],
    queryFn: async () => {
      const [favorites, reservations, orders] = await Promise.all([
        localRepository.listFavorites(),
        localRepository.listReservations(),
        localRepository.listOrders()
      ]);
      return {
        favoriteSlugs: favorites.map((favorite) => favorite.slug),
        reservationCount: reservations.length,
        orderCount: orders.length
      };
    },
    staleTime: 30_000
  });
  const serverFavoritesQuery = useQuery({
    queryKey: ["customer-favorites", "profile"],
    queryFn: listCustomerFavorites,
    enabled: customerDataMode === "live" && placeApiMode !== "canonical" && sessionQuery.isFetched && Boolean(session),
    retry: false,
    staleTime: 30_000
  });
  const canonicalSavedPlacesCountQuery = useQuery({
    queryKey: ["feed", "saved-places", "profile", session?.user.id ?? null],
    queryFn: ({ signal }: { signal: AbortSignal }) => listSavedCanonicalPlaces({ signal }),
    enabled: customerDataMode === "live" && placeApiMode === "canonical" && Boolean(session),
    retry: false,
    staleTime: 30_000,
  });
  const signOut = async () => {
    setNotice("");
    try {
      await logoutCustomer();
      await sessionQuery.refetch();
      setNotice("ออกจากระบบแล้ว");
    } catch {
      setNotice("ยังไม่สามารถออกจากระบบได้ กรุณาลองใหม่");
    }
  };
  const signIn = async () => {
    setNotice("");
    try {
      await beginGoSignIn("/profile");
    } catch {
      setNotice("ยังไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่");
    }
  };
  const profileName = session?.user.displayName || session?.user.email || "เริ่มสร้าง account ของคุณ";
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AG";
  const profileDataPending = localProfileQuery.isLoading
    || (customerDataMode === "live" && !sessionQuery.isFetched)
    || (placeApiMode === "canonical" ? canonicalSavedPlacesCountQuery.isLoading : serverFavoritesQuery.isLoading);
  const savedPlaceCount = profileDataPending
    ? null
    : placeApiMode === "canonical" && customerDataMode === "live"
      ? canonicalSavedPlacesCountQuery.isError ? null : canonicalSavedPlacesCountQuery.data?.length ?? 0
      : new Set([
        ...(localProfileQuery.data?.favoriteSlugs ?? []),
        ...(serverFavoritesQuery.data ?? [])
      ]).size;
  return (
    <div className="page-frame">
      <PageHeading eyebrow="MY PAGE / PROFILE" title="พื้นที่ของคุณ" description="จัดการ profile, preferences และความคืบหน้าจาก customer account" />
      <div className="profile-dashboard">
        <ProfileInsightCard
          name={profileName}
          email={session?.user.email}
          initials={profileInitials}
          accountLabel={session ? "CUSTOMER ACCOUNT" : "GUEST PROFILE"}
          accountDescription={session ? "session ใช้ secure HttpOnly cookie ผ่าน Customer Gateway" : "บันทึกสถานที่และติดตาม reservation ได้เมื่อ sign in"}
          isAuthenticated={Boolean(session)}
          savedPlaces={savedPlaceCount}
          reservations={localProfileQuery.isLoading ? null : localProfileQuery.data?.reservationCount ?? 0}
          orders={localProfileQuery.isLoading ? null : localProfileQuery.data?.orderCount ?? 0}
          localDataReady={localProfileQuery.isFetched}
          action={session ? <button className="button button--ghost" type="button" onClick={() => void signOut()}>ออกจากระบบ</button> : <button className="button button--dark" type="button" onClick={() => void signIn()}>เข้าสู่ระบบ <ArrowRight size={16} aria-hidden="true" /></button>}
        />
        <section className="profile-preview-grid" aria-label="Profile overview">
          <Link className="profile-preview-card" to="/profile/level"><span className="settings-row__icon"><Sparkles size={18} aria-hidden="true" /></span><span className="eyebrow">PROGRESSION</span><strong>Level & badges</strong><small>ดู progression ของคุณ <ChevronRight size={15} aria-hidden="true" /></small></Link>
          <Link className="profile-preview-card" to="/profile/quests"><span className="settings-row__icon"><Gift size={18} aria-hidden="true" /></span><span className="eyebrow">DISCOVERY</span><strong>Quests</strong><small>กิจกรรมที่ช่วยให้ค้นพบมากขึ้น <ChevronRight size={15} aria-hidden="true" /></small></Link>
          <Link className="profile-preview-card" to="/profile/coupons"><span className="settings-row__icon"><Ticket size={18} aria-hidden="true" /></span><span className="eyebrow">BENEFITS</span><strong>Coupons</strong><small>กระเป๋าส่วนลดของคุณ <ChevronRight size={15} aria-hidden="true" /></small></Link>
          <Link className="profile-preview-card" to="/activity"><span className="settings-row__icon"><CalendarDays size={18} aria-hidden="true" /></span><span className="eyebrow">HISTORY</span><strong>Recent activity</strong><small>เปิด reservation และ order <ChevronRight size={15} aria-hidden="true" /></small></Link>
        </section>
        <section className="settings-section" aria-labelledby="profile-preferences-title">
          <SectionHeading id="profile-preferences-title" title="Preferences" />
          <div className="settings-list"><button className="settings-row settings-row--button" type="button" onClick={toggleTheme}><span className="settings-row__icon">{theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}</span><span><strong>{theme === "light" ? "ใช้ dark theme" : "ใช้ light theme"}</strong><small>ปรับ theme สำหรับการใช้งานของคุณ</small></span><span className="settings-row__value">{theme}</span></button></div>
        </section>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </div>
    </div>
  );
}

export function StoreDetailPage() {
  const { storeSlug } = useParams();
  const { store, query: storeQuery } = useCustomerStore(storeSlug);
  const saved = useUiStore((state) => store ? state.savedStoreSlugs.includes(store.slug) : false);
  const setSavedStore = useUiStore((state) => state.setSavedStore);
  const [notice, setNotice] = useState("");
  const platform = useMemo(() => createPlatformBridge(), []);
  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "store-save"],
    queryFn: getCustomerSession,
    enabled: customerDataMode === "live",
    retry: false,
    staleTime: 60_000
  });
  const serverFavoritesQuery = useQuery({
    queryKey: ["customer-favorites"],
    queryFn: listCustomerFavorites,
    enabled: customerDataMode === "live" && Boolean(sessionQuery.data),
    retry: false,
    staleTime: 30_000
  });
  const mergedFavoritesRef = useRef(false);
  useEffect(() => {
    if (!store) return;
    void localRepository.saveViewedStore({
      slug: store.slug,
      name: store.name,
      area: store.area,
      category: store.category,
      imageUrl: store.imageUrl
    });
  }, [store]);
  useEffect(() => {
    if (!sessionQuery.data || !serverFavoritesQuery.data || mergedFavoritesRef.current) return;
    mergedFavoritesRef.current = true;
    void localRepository.listFavorites().then(async (localFavorites) => {
      const remoteFavorites = new Set(serverFavoritesQuery.data);
      const pending = localFavorites.filter((favorite) => !remoteFavorites.has(favorite.slug));
      if (pending.length === 0) return;
      await Promise.allSettled(pending.map((favorite) => saveCustomerFavorite(favorite.slug)));
      await serverFavoritesQuery.refetch();
    });
  }, [serverFavoritesQuery, sessionQuery.data]);
  if (customerDataMode === "live" && storeQuery.isLoading) return <div className="page-frame"><LoadingState label="กำลังโหลด public store profile…" /></div>;
  if (customerDataMode === "live" && storeQuery.isError) return <div className="page-frame"><StoreProjectionFallback storeSlug={storeSlug} onRetry={() => void storeQuery.refetch()} /></div>;
  if (!store) return <div className="page-frame"><EmptyState icon={CircleHelp} title="ไม่พบสถานที่นี้" description="ลิงก์อาจหมดอายุหรือร้านนี้ยังไม่เปิด public profile" action={<Link className="button button--dark" to="/">กลับ Explore</Link>} /></div>;
  const mapQuery = store.latitude !== null && store.latitude !== undefined && store.longitude !== null && store.longitude !== undefined
    ? `${store.latitude},${store.longitude}`
    : store.address || `${store.name}, ${store.area}`;
  const hours = store.operatingHours?.filter((hour) => hour.enabled) ?? [];
  const share = async () => { try { await platform.share({ title: store.name, text: store.description, url: window.location.href }); setNotice("คัดลอกลิงก์ของร้านแล้ว"); } catch { setNotice("ยังไม่สามารถแชร์จากอุปกรณ์นี้ได้"); } };
  const serverSaved = serverFavoritesQuery.data?.includes(store.slug) ?? false;
  const isSaved = saved || serverSaved;
  const toggleSave = () => {
    const nextSaved = !isSaved;
    setSavedStore(store.slug, nextSaved);
    if (nextSaved) {
      void localRepository.saveFavorite({ slug: store.slug, name: store.name, area: store.area, category: store.category, imageUrl: store.imageUrl });
    }
    if (sessionQuery.data) {
      void (nextSaved ? saveCustomerFavorite(store.slug) : removeCustomerFavorite(store.slug)).then(
        () => void serverFavoritesQuery.refetch()
      ).catch(async () => {
        setSavedStore(store.slug, !nextSaved);
        if (!nextSaved) {
          await localRepository.saveFavorite({ slug: store.slug, name: store.name, area: store.area, category: store.category, imageUrl: store.imageUrl });
        }
        setNotice("บันทึกกับบัญชีไม่สำเร็จ จึงคืนค่ารายการเดิม");
      });
    }
    setNotice(nextSaved ? "บันทึกสถานที่ไว้แล้ว" : "นำออกจากรายการบันทึกแล้ว");
  };
  return (
    <div className="page-frame">
      <Link className="back-link" to="/search"><ChevronRight size={16} className="back-link__icon" aria-hidden="true" />กลับผลการค้นหา</Link>
      <section className="store-media-grid" aria-label={`ภาพและข้อมูล ${store.name}`}>
        <div className={`store-hero store-hero--${store.accent}${store.imageUrl ? " store-hero--has-image" : ""}`}>
          {store.imageUrl && <img className="store-hero__image" src={store.imageUrl} alt="" aria-hidden="true" decoding="async" />}
          {!store.imageUrl && <span className="store-hero__initials" aria-hidden="true">{store.name.split(" ").map((part) => part[0]).join("")}</span>}
          <span className="store-hero__tag">{store.category} · {store.area}</span>
        </div>
        <div className="store-media-side">
          <div className="store-media-card"><span className="eyebrow">PROFILE SIGNAL</span><strong>{store.category}</strong><p>ข้อมูล public profile พร้อมสำหรับการวางแผน</p></div>
          <div className="store-media-card store-media-card--accent"><span className="eyebrow">AVAILABILITY</span><strong>{store.availability}</strong><p>ตรวจสอบ slot จริงอีกครั้งก่อนยืนยัน</p></div>
        </div>
      </section>
      {store.mediaUrls && store.mediaUrls.length > 0 && <section className="store-gallery" aria-label={`รูปภาพ ${store.name}`}><div className="section-heading"><h2>Photos</h2><span className="muted-label">ภาพจาก public profile</span></div><div className="store-gallery__grid">{store.mediaUrls.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${store.name} ภาพที่ ${index + 1}`} loading="lazy" decoding="async" />)}</div></section>}
      <div className="detail-title-row">
      <div><p className="eyebrow">{store.category} / {store.area}</p><h1>{store.name}</h1><p className="store-card__meta">{store.rating === null ? "ยังไม่มีรีวิว" : `★ ${store.rating}`} · {store.reviewCount} reviews · {store.priceRange}</p></div>
        <button className={`icon-button icon-button--large${isSaved ? " is-selected" : ""}`} type="button" aria-pressed={isSaved} aria-label={isSaved ? "ลบจากรายการบันทึก" : "บันทึกร้านนี้"} onClick={toggleSave}><Heart size={19} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" /></button>
      </div>
      <p className="detail-description">{store.description}</p>
      <div className="store-detail-layout">
        <div className="store-detail-main">
          <div className="detail-actions"><button className="button button--ghost" type="button" onClick={() => void share()}><Share2 size={16} aria-hidden="true" />Share</button><button className="button button--ghost" type="button" onClick={() => void platform.openExternalUrl(`https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`)}><Navigation size={16} aria-hidden="true" />Directions</button></div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}
          <div className="detail-tabs"><Link className="detail-tab detail-tab--active" to={`/stores/${store.slug}`}>Overview</Link><Link className="detail-tab" to={`/stores/${store.slug}/booking`}>Booking</Link><Link className="detail-tab" to={`/stores/${store.slug}/menu`}>Menu / Services</Link></div>
          <section className="detail-info-grid">
            <div className="info-card"><Clock3 size={18} aria-hidden="true" /><div><strong>Plan ahead</strong><span>ตรวจเวลาจริงก่อนยืนยัน booking</span></div></div>
            <div className="info-card"><MapPinned size={18} aria-hidden="true" /><div><strong>Location</strong><span>{store.address || `${store.area}, Bangkok`}</span></div></div>
            <div className="info-card"><WalletCards size={18} aria-hidden="true" /><div><strong>Availability</strong><span>{store.availability}</span></div></div>
          </section>
          {store.facilities && store.facilities.length > 0 && <section className="detail-content-section" aria-labelledby="store-facilities-title"><div className="section-heading"><h2 id="store-facilities-title">Facilities</h2></div><div className="chip-row">{store.facilities.map((facility) => <span className="chip" key={facility}>{facility}</span>)}</div></section>}
          {hours.length > 0 && <section className="detail-content-section" aria-labelledby="store-hours-title"><div className="section-heading"><h2 id="store-hours-title">Opening hours</h2><span className="muted-label">{store.timezone ?? "เวลาท้องถิ่นของร้าน"}</span></div><dl className="opening-hours">{hours.map((hour) => <div key={hour.dayOfWeek}><dt>{weekdayLabels[hour.dayOfWeek] ?? `วันที่ ${hour.dayOfWeek}`}</dt><dd>{hour.openTime} – {hour.closeTime}</dd></div>)}</dl></section>}
          {store.policySummary && <section className="detail-content-section" aria-labelledby="store-policy-title"><div className="section-heading"><h2 id="store-policy-title">Store policy</h2></div><p className="body-copy">{store.policySummary}</p></section>}
        </div>
        <aside className="store-booking-panel" aria-labelledby="store-booking-title">
          <span className="eyebrow">BOOKING / AVAILABILITY</span>
          <h2 id="store-booking-title">วางแผนเวลาที่เหมาะกับคุณ</h2>
          <p>{store.availability} · ตรวจสอบ slot ล่าสุดจาก server ก่อนยืนยัน</p>
          <Link className="button button--dark" to={`/stores/${store.slug}/booking`}><CalendarDays size={16} aria-hidden="true" />Check availability</Link>
          <div className="guardrail-note"><Clock3 size={15} aria-hidden="true" /><span>ราคา เวลา และ policy จะถูกตรวจซ้ำก่อนสร้าง hold</span></div>
        </aside>
      </div>
    </div>
  );
}

export function BookingPage() {
  const { storeSlug } = useParams();
  const { store, query: storeQuery } = useCustomerStore(storeSlug);
  const venueSlug = store?.venueSlug ?? store?.slug ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") ?? todayDate();
  const partySize = Math.max(1, Math.min(20, Number(searchParams.get("party") ?? "1") || 1));
  const [time, setTime] = useState(searchParams.get("time") ?? "");
  const [phase, setPhase] = useState<"select" | "details" | "holding" | "review" | "submitting" | "success" | "unknown">("select");
  const [details, setDetails] = useState<PublicBookingDetails>({ customerName: "", customerPhone: "", customerEmail: "", notes: "" });
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [hold, setHold] = useState<PublicBookingHold | null>(null);
  const [holdClock, setHoldClock] = useState(() => Date.now());
  const holdServerOffsetRef = useRef(0);
  const holdIdempotencyKey = useRef(createIdempotencyKey("booking-hold"));
  const confirmationIdempotencyKey = useRef(createIdempotencyKey("booking-confirm"));
  useEffect(() => {
    setTime(searchParams.get("time") ?? "");
  }, [searchParams]);
  const startNewBookingIntent = () => {
    holdIdempotencyKey.current = createIdempotencyKey("booking-hold");
    confirmationIdempotencyKey.current = createIdempotencyKey("booking-confirm");
    holdServerOffsetRef.current = 0;
    setHold(null);
  };
  const availabilityQuery = useQuery({
    queryKey: ["public-venue-availability", venueSlug, date, partySize],
    queryFn: () => getPublicVenueAvailability(venueSlug, date, partySize),
    enabled: customerDataMode === "live" && Boolean(venueSlug) && Boolean(store)
  });
  useEffect(() => {
    if (!hold) return;
    const timer = window.setInterval(() => setHoldClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [hold]);
  const holdSecondsRemaining = hold ? Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - (holdClock + holdServerOffsetRef.current)) / 1_000)) : 0;
  useEffect(() => {
    if (!hold || holdSecondsRemaining > 0 || phase === "success") return;
    setHold(null);
    holdServerOffsetRef.current = 0;
    setPhase("select");
    setTime("");
    setNotice("เวลาสำรองหมดอายุแล้ว กรุณาเลือก slot ใหม่");
    void availabilityQuery.refetch();
  }, [availabilityQuery, hold, holdSecondsRemaining, phase]);
  const liveTimeOptions = useMemo(() => {
    const grouped = new Map<string, PublicAvailabilitySlot[]>();
    for (const slot of availabilityQuery.data?.slots ?? []) {
      const current = grouped.get(slot.localStartTime) ?? [];
      current.push(slot);
      grouped.set(slot.localStartTime, current);
    }
    return [...grouped.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([label, slots]) => ({
      label,
      available: slots.some((slot) => slot.available),
      slots
    }));
  }, [availabilityQuery.data]);
  const selectedLiveSlot = useMemo(
    () => liveTimeOptions.find((option) => option.label === time)?.slots.find((slot) => slot.available) ?? null,
    [liveTimeOptions, time]
  );
  if (customerDataMode === "live" && storeQuery.isLoading) return <div className="page-frame"><p className="muted-label">กำลังโหลด public store profile…</p></div>;
  if (customerDataMode === "live" && storeQuery.isError) return <div className="page-frame"><StoreProjectionFallback storeSlug={storeSlug} title="ข้อมูลการจองยังไม่พร้อม" onRetry={() => void storeQuery.refetch()} /></div>;
  if (!store) return <div className="page-frame"><EmptyState icon={CalendarDays} title="ไม่พบร้านสำหรับการจอง" description="กลับไปค้นหาร้านอื่นแล้วลองใหม่อีกครั้ง" action={<Link className="button button--dark" to="/search">ค้นหาร้าน</Link>} /></div>;
  const updateDate = (nextDate: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("date", nextDate);
    setSearchParams(next);
    startNewBookingIntent();
    setTime("");
    setPhase("select");
    setNotice("");
  };
  const updatePartySize = (nextParty: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("party", String(Math.max(1, Math.min(20, Number(nextParty) || 1))));
    setSearchParams(next);
    startNewBookingIntent();
    setTime("");
    setPhase("select");
    setNotice("");
  };
  const continueToDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!time) {
      setNotice("เลือกช่วงเวลาก่อนดำเนินการต่อ");
      return;
    }
    if (customerDataMode === "live" && !selectedLiveSlot) {
      setNotice("ช่วงเวลานี้ไม่ว่างแล้ว กรุณาเลือก slot อื่น");
      return;
    }
    setNotice("");
    setPhase("details");
  };
  const reviewDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = publicBookingDetailsSchema.safeParse(details);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "ตรวจสอบข้อมูลอีกครั้ง");
      return;
    }
    setFormError("");
    startNewBookingIntent();
    if (customerDataMode !== "live" || !selectedLiveSlot || !storeSlug) {
      setPhase("review");
      return;
    }
    setPhase("holding");
    setNotice("");
    try {
      const nextHold = await createPublicBookingHold(venueSlug, {
        resourceId: selectedLiveSlot.resourceId,
        startsAt: selectedLiveSlot.startAt,
        endsAt: selectedLiveSlot.endAt,
        partySize
      }, holdIdempotencyKey.current);
      holdServerOffsetRef.current = Date.parse(nextHold.serverTime) - Date.now();
      setHoldClock(Date.now());
      setHold(nextHold);
      setPhase("review");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setPhase("select");
        setTime("");
        setNotice("ช่วงเวลานี้ถูกจองหรือกำลังถูกสำรองอยู่ กรุณาเลือก slot อื่น");
        void availabilityQuery.refetch();
        return;
      }
      setPhase("details");
      setNotice(error instanceof ApiClientError ? error.message : "ยังไม่สามารถสำรอง slot ได้ กรุณาลองใหม่");
    }
  };
  const confirmBooking = async () => {
    if (customerDataMode !== "live" || !selectedLiveSlot || !storeSlug || !hold) {
      setNotice("Demo mode ยังไม่ยืนยัน booking จริง และจะไม่แสดง success ปลอม");
      return;
    }
    setPhase("submitting");
    setNotice("");
    try {
      const result = await confirmPublicBookingHold(venueSlug, hold.id, {
        customerName: details.customerName,
        ...(details.customerPhone ? { customerPhone: details.customerPhone } : {}),
        ...(details.customerEmail ? { customerEmail: details.customerEmail } : {}),
        ...(details.notes ? { notes: details.notes } : {})
      }, confirmationIdempotencyKey.current);
      setBookingId(result.booking.id);
      await localRepository.saveReservation({
        id: result.booking.id,
        storeSlug: store.slug,
        storeName: store.name,
        startsAt: result.booking.startAt,
        endsAt: result.booking.endAt,
        status: result.booking.status,
        partySize: result.booking.partySize,
        ...(result.booking.publicTrackingToken ? { trackingToken: result.booking.publicTrackingToken } : {}),
        createdAt: Date.now()
      });
      setHold(null);
      holdServerOffsetRef.current = 0;
      setPhase("success");
      setNotice("ยืนยัน reservation สำเร็จจาก Customer Gateway");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        setPhase("select");
        setTime("");
        setHold(null);
        holdServerOffsetRef.current = 0;
        setNotice("ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือก slot อื่น");
        void availabilityQuery.refetch();
        return;
      }
      if (error instanceof ApiClientError && error.status === 422 && error.code === "BOOKING_VALIDATION_ERROR") {
        setHold(null);
        holdServerOffsetRef.current = 0;
        setPhase("select");
        setTime("");
        setNotice(error.message);
        void availabilityQuery.refetch();
        return;
      }
      if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
        setPhase("review");
        setNotice(error.message);
        return;
      }
      setPhase("unknown");
      setNotice("ยังไม่ทราบผลลัพธ์ของคำขอ การตรวจสอบอีกครั้งจะใช้ idempotency key เดิมเพื่อป้องกันการสร้างซ้ำ");
    }
  };
  const selectedLabel = time || "ยังไม่ได้เลือก";
  const bookingTime = selectedLiveSlot ? `${selectedLiveSlot.startAt} – ${selectedLiveSlot.endAt}` : `${date} ${selectedLabel}`;
  const holdCountdown = `${String(Math.floor(holdSecondsRemaining / 60)).padStart(2, "0")}:${String(holdSecondsRemaining % 60).padStart(2, "0")}`;
  const stepIndex = phase === "select" ? 1 : phase === "details" ? 2 : phase === "holding" || phase === "review" || phase === "submitting" || phase === "unknown" ? 3 : 4;
  return (
    <div className="page-frame">
      <Link className="back-link" to={`/stores/${store.slug}`}><ChevronRight size={16} className="back-link__icon" aria-hidden="true" />กลับ {store.name}</Link>
      <PageHeading eyebrow="BOOKING / AVAILABILITY" title={`จองเวลาที่ ${store.name}`} description="เลือก slot จาก server แล้วกรอกข้อมูลเพื่อยืนยัน reservation โดยใช้ idempotency key เดิมเมื่อจำเป็นต้องตรวจสอบซ้ำ" />
      <ol className="stepper" aria-label="Booking steps"><li className={stepIndex >= 1 ? "is-active" : ""}><span>1</span>Service</li><li className={stepIndex >= 2 ? "is-active" : ""}><span>2</span>Date & time</li><li className={stepIndex >= 3 ? "is-active" : ""}><span>3</span>Details / review</li><li className={stepIndex >= 4 ? "is-active" : ""}><span>4</span>Confirm</li></ol>
      {phase === "success" ? <section className="empty-state" aria-live="polite"><span className="icon-badge" aria-hidden="true"><Check size={22} /></span><h2>Reservation confirmed</h2><p className="body-copy">เลข reservation: {bookingId} · สถานะจาก server: CONFIRMED</p><div className="button-row"><Link className="button button--dark" to="/activity">เปิด Activity</Link><Link className="button button--ghost" to={`/stores/${store.slug}`}>กลับร้าน</Link></div></section> : phase === "details" ? <form className="flow-card" onSubmit={(event) => void reviewDetails(event)}><div className="booking-form-grid"><div className="field-group"><label htmlFor="booking-name">ชื่อผู้จอง</label><input id="booking-name" value={details.customerName} onChange={(event) => setDetails((current) => ({ ...current, customerName: event.target.value }))} autoComplete="name" required /></div><div className="field-group"><label htmlFor="booking-party">จำนวนผู้ใช้บริการ</label><input id="booking-party" type="number" min={1} max={20} value={partySize} onChange={(event) => updatePartySize(event.target.value)} /></div><div className="field-group"><label htmlFor="booking-phone">โทรศัพท์ (ถ้ามี)</label><input id="booking-phone" type="tel" inputMode="tel" value={details.customerPhone ?? ""} onChange={(event) => setDetails((current) => ({ ...current, customerPhone: event.target.value }))} autoComplete="tel" /></div><div className="field-group"><label htmlFor="booking-email">อีเมล (ถ้ามี)</label><input id="booking-email" type="email" inputMode="email" value={details.customerEmail ?? ""} onChange={(event) => setDetails((current) => ({ ...current, customerEmail: event.target.value }))} autoComplete="email" /></div><div className="field-group field-group--full"><label htmlFor="booking-notes">หมายเหตุ</label><textarea id="booking-notes" value={details.notes ?? ""} onChange={(event) => setDetails((current) => ({ ...current, notes: event.target.value }))} maxLength={500} /></div></div>{formError && <p className="inline-notice" role="alert">{formError}</p>}<div className="flow-card__footer"><button className="button button--ghost" type="button" onClick={() => setPhase("select")}>ย้อนกลับ</button><button className="button button--dark" type="submit">ตรวจสอบข้อมูล <ArrowRight size={16} aria-hidden="true" /></button></div></form> : phase === "holding" ? <section className="flow-card" aria-busy="true" aria-live="polite"><div className="booking-review"><span className="eyebrow">SLOT HOLD / SERVER AUTHORITY</span><h2>กำลังสำรองช่วงเวลา</h2><p>{bookingTime} · {partySize} คน</p><p className="muted-label">กำลังตรวจ availability และสร้าง hold ที่มีอายุจำกัด…</p></div><LoadingState label="กำลังยืนยัน slot กับ Customer Gateway…" /></section> : phase === "review" || phase === "submitting" || phase === "unknown" ? <section className="flow-card" aria-busy={phase === "submitting"}><div className="booking-review"><span className="eyebrow">REVIEW / SERVER AUTHORITY</span><h2>{store.name}</h2><p>{bookingTime} · {partySize} คน</p><p>{details.customerName}{details.customerPhone ? ` · ${details.customerPhone}` : ""}</p>{details.notes && <p>{details.notes}</p>}{hold && <p className="hold-countdown" aria-live="polite"><Clock3 size={15} aria-hidden="true" />เวลาสำรองเหลือ {holdCountdown}</p>}</div><div className="guardrail-note"><Clock3 size={16} aria-hidden="true" /><span>ราคา เวลา และ policy ถูกตรวจซ้ำโดย server; client ส่งเพียง hold token และรายละเอียดผู้จอง</span></div>{notice && <p className="inline-notice" role={phase === "unknown" ? "alert" : "status"}>{notice}</p>}<div className="flow-card__footer"><button className="button button--ghost" type="button" onClick={() => { setHold(null); setPhase("details"); }} disabled={phase === "submitting"}>แก้ไข</button><button className="button button--dark" type="button" onClick={() => void confirmBooking()} disabled={phase === "submitting" || !hold}>{phase === "submitting" ? "กำลังยืนยัน…" : phase === "unknown" ? "ตรวจสอบอีกครั้ง" : customerDataMode === "live" ? "ยืนยัน reservation" : "เชื่อมต่อ Gateway ก่อนยืนยัน"}</button></div></section> : <form className="flow-card" onSubmit={continueToDetails}><div className="booking-form-grid"><div className="field-group"><label htmlFor="booking-date">วันที่</label><input id="booking-date" type="date" value={date} min={todayDate()} onChange={(event) => updateDate(event.target.value)} /></div><div className="field-group"><label htmlFor="booking-party-select">จำนวนผู้ใช้บริการ</label><input id="booking-party-select" type="number" min={1} max={20} value={partySize} onChange={(event) => updatePartySize(event.target.value)} /></div></div><fieldset className="field-group"><legend>ช่วงเวลา</legend>{customerDataMode === "live" && availabilityQuery.isLoading && <LoadingState label="กำลังโหลด availability จาก Customer Gateway…" />}{customerDataMode === "live" && availabilityQuery.isError && <div className="guardrail-note"><CircleHelp size={16} aria-hidden="true" /><span>{getRequestErrorCopy(availabilityQuery.error, "ร้านนี้ยังไม่มี public venue availability")}</span><button className="text-link text-link--button" type="button" onClick={() => void availabilityQuery.refetch()}>ลองใหม่</button></div>}{customerDataMode === "live" && !availabilityQuery.isLoading && !availabilityQuery.isError && liveTimeOptions.length === 0 && <p className="muted-label">วันที่นี้ยังไม่มี slot ที่เปิดให้จอง</p>}{(customerDataMode === "demo" || (!availabilityQuery.isLoading && !availabilityQuery.isError && liveTimeOptions.length > 0)) && <div className="time-grid">{(customerDataMode === "live" ? liveTimeOptions.map((option) => ({ label: option.label, available: option.available })) : ["11:30", "13:00", "17:30", "19:30"].map((label) => ({ label, available: true }))).map((slot) => <button className={`time-option${time === slot.label ? " is-selected" : ""}`} type="button" key={slot.label} aria-pressed={time === slot.label} disabled={!slot.available} onClick={() => { setTime(slot.label); setNotice(""); }}>{slot.label}<small>{slot.available ? (slot.label === "19:30" && customerDataMode === "demo" ? "popular" : "available") : "เต็มแล้ว"}</small></button>)}</div>}</fieldset><div className="flow-card__footer"><p className="muted-label"><Clock3 size={15} aria-hidden="true" />{customerDataMode === "live" && selectedLiveSlot ? `ราคาเริ่มต้น ${formatMinorAmount(selectedLiveSlot.priceMinor)}` : "Server จะตรวจซ้ำก่อนยืนยัน"}</p><button className="button button--dark" type="submit" disabled={customerDataMode === "live" && (availabilityQuery.isLoading || availabilityQuery.isError)}>ต่อไป: รายละเอียด <ArrowRight size={16} aria-hidden="true" /></button></div>{notice && <p className="inline-notice" role="status">{notice}</p>}</form>}
    </div>
  );
}

function ProductOptionsDialog({ product, onClose, onConfirm }: { product: PublicCatalogProduct; onClose: () => void; onConfirm: (selection: { variantId?: string; modifierIds: string[] }) => void }) {
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.status === "ACTIVE")?.id);
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setVariantId(product.variants.find((variant) => variant.status === "ACTIVE")?.id);
    setModifierIds([]);
    setError("");
  }, [product]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleModifier = (groupId: string, modifierId: string, selectionType: "SINGLE" | "MULTIPLE", maxSelections: number) => {
    setModifierIds((current) => {
      const groupModifierIds = product.modifierGroups.find((group) => group.id === groupId)?.modifiers.map((modifier) => modifier.id) ?? [];
      const withoutGroup = current.filter((id) => !groupModifierIds.includes(id));
      if (selectionType === "SINGLE") return [...withoutGroup, modifierId];
      if (current.includes(modifierId)) return current.filter((id) => id !== modifierId);
      const selectedInGroup = current.filter((id) => groupModifierIds.includes(id));
      if (maxSelections > 0 && selectedInGroup.length >= maxSelections) return current;
      return [...current, modifierId];
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    for (const group of product.modifierGroups) {
      const modifierIdsInGroup = new Set(group.modifiers.map((modifier) => modifier.id));
      const selectedCount = modifierIds.filter((id) => modifierIdsInGroup.has(id)).length;
      if (selectedCount < group.minSelections || (group.required && selectedCount === 0)) {
        setError(`กรุณาเลือก ${group.name}`);
        return;
      }
    }
    onConfirm({ ...(variantId ? { variantId } : {}), modifierIds });
  };

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="options-dialog" role="dialog" aria-modal="true" aria-labelledby="product-options-title"><header className="options-dialog__header"><div><p className="eyebrow">CUSTOMIZE / CONTRACT VALIDATION</p><h2 id="product-options-title">{product.name}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="ปิดตัวเลือกรายการ"><X size={18} aria-hidden="true" /></button></header><form className="options-dialog__body" onSubmit={submit}>{product.variants.filter((variant) => variant.status === "ACTIVE").length > 0 && <fieldset className="field-group"><legend>ตัวเลือกหลัก</legend><div className="option-list">{product.variants.filter((variant) => variant.status === "ACTIVE").map((variant) => <label className="option-choice" key={variant.id}><input type="radio" name="product-variant" checked={variantId === variant.id} onChange={() => setVariantId(variant.id)} /><span>{variant.name}</span><small>{formatMinorAmount(variant.priceMinor, product.currency)}</small></label>)}</div></fieldset>}{product.modifierGroups.map((group) => <fieldset className="field-group" key={group.id}><legend>{group.name}{group.required ? " · จำเป็น" : ""}</legend><div className="option-list">{group.modifiers.filter((modifier) => modifier.status === "ACTIVE").map((modifier) => <label className="option-choice" key={modifier.id}><input type={group.selectionType === "SINGLE" ? "radio" : "checkbox"} name={`modifier-${group.id}`} checked={modifierIds.includes(modifier.id)} onChange={() => toggleModifier(group.id, modifier.id, group.selectionType, group.maxSelections)} /><span>{modifier.name}</span><small>{modifier.priceDeltaMinor === 0 ? "รวมแล้ว" : `${modifier.priceDeltaMinor > 0 ? "+" : "−"}${formatMinorAmount(Math.abs(modifier.priceDeltaMinor), product.currency)}`}</small></label>)}</div><small className="muted-label">เลือก {group.minSelections}{group.maxSelections > 0 ? `–${group.maxSelections}` : ""} รายการ</small></fieldset>)}{error && <p className="inline-notice" role="alert">{error}</p>}<footer className="options-dialog__footer"><button className="button button--ghost" type="button" onClick={onClose}>ยกเลิก</button><button className="button button--dark" type="submit">เพิ่มใน cart</button></footer></form></section></div>;
}

export function StoreMenuPage() {
  const { storeSlug } = useParams();
  const { store, query: storeQuery } = useCustomerStore(storeSlug);
  const addCartItem = useCartStore((state) => state.addItem);
  const storeCode = store?.publicStoreCode ?? store?.slug ?? "";
  const catalogQuery = useQuery({
    queryKey: ["public-catalog", storeCode],
    queryFn: () => getPublicCatalog(storeCode),
    enabled: customerDataMode === "live" && Boolean(storeCode)
  });
  const [notice, setNotice] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<PublicCatalogProduct | null>(null);
  if (customerDataMode === "live" && storeQuery.isLoading) return <div className="page-frame"><p className="muted-label">กำลังโหลด public store profile…</p></div>;
  if (customerDataMode === "live" && storeQuery.isError) return <div className="page-frame"><StoreProjectionFallback storeSlug={storeSlug} title="ข้อมูลเมนูยังไม่พร้อม" onRetry={() => void storeQuery.refetch()} /></div>;
  if (!store) return <div className="page-frame"><EmptyState icon={ShoppingBag} title="ไม่พบเมนู" description="กลับไปค้นหาร้านอื่นแล้วลองใหม่อีกครั้ง" action={<Link className="button button--dark" to="/search">ค้นหาร้าน</Link>} /></div>;
  const menuItems = [{ name: "House selection", price: "฿ 180", description: "เมนูแนะนำสำหรับเริ่มต้น" }, { name: "Seasonal pairing", price: "฿ 260", description: "เปลี่ยนตามวัตถุดิบของวัน" }, { name: "Takeaway set", price: "฿ 320", description: "จัดเตรียมสำหรับรับกลับ" }];
  const addItemToCart = (item: { productId: string; name: string; description: string; unitPriceMinor: number; currency: string; variantId?: string; modifierIds?: string[] }) => {
    const lineId = [item.productId, item.variantId ?? "base", ...(item.modifierIds ?? []).sort()].join(":");
    const result = addCartItem({ ...item, lineId, storeSlug: store.slug, storeName: store.name, storeCode: store.publicStoreCode ?? store.slug, quantity: 1 });
    setNotice(result === "replaced-store" ? "Cart เดิมเป็นของร้านอื่น จึงเริ่ม cart ใหม่สำหรับร้านนี้แล้ว" : `เพิ่ม ${item.name} ใน cart draft แล้ว`);
  };
  const demoMenu = <div className="menu-list">{menuItems.map((item) => <article className="menu-item" key={item.name}><div><span className="eyebrow">{store.category}</span><h2>{item.name}</h2><p>{item.description}</p></div><div className="menu-item__action"><strong>{item.price}</strong><button className="icon-button icon-button--subtle" type="button" aria-label={`เพิ่ม ${item.name} ไปยัง cart`} onClick={() => addItemToCart({ productId: `demo-${item.name.toLowerCase().replaceAll(" ", "-")}`, name: item.name, description: item.description, unitPriceMinor: item.name === "House selection" ? 18000 : item.name === "Seasonal pairing" ? 26000 : 32000, currency: "THB" })}><ArrowRight size={17} aria-hidden="true" /></button></div></article>)}</div>;
  const liveCatalog = catalogQuery.data;
  const liveMenu = catalogQuery.isLoading ? <div className="empty-state"><span className="icon-badge" aria-hidden="true"><ShoppingBag size={21} /></span><h2>กำลังโหลด catalog</h2><p className="body-copy">กำลังตรวจรายการและราคาจาก Customer Gateway</p></div> : catalogQuery.isError ? <EmptyState icon={CircleHelp} title="โหลดเมนูไม่สำเร็จ" description={getRequestErrorCopy(catalogQuery.error, "ร้านนี้ยังไม่มี public catalog")} action={<button className="button button--ghost" type="button" onClick={() => void catalogQuery.refetch()}>ลองใหม่</button>} /> : !liveCatalog ? <EmptyState icon={CircleHelp} title="ยังไม่มี catalog response" description="Customer Gateway ยังไม่ส่งข้อมูลเมนูกลับมา" /> : liveCatalog.products.length === 0 ? <EmptyState icon={ShoppingBag} title="ยังไม่มีรายการที่เปิดขาย" description="ร้านนี้ยังไม่มีสินค้าที่เปิดให้ลูกค้าดูผ่านช่องทาง QR" /> : <div className="menu-list">{liveCatalog.products.map((product) => <article className="menu-item" key={product.id}><div><span className="eyebrow">{liveCatalog.store?.name ?? store.name} · {product.currency}</span><h2>{product.name}</h2><p>{product.description || "รายละเอียดเมนูจะแสดงเมื่อร้านเผยแพร่ข้อมูล"}</p>{(product.modifierGroups.length > 0 || product.variants.length > 0) && <small className="muted-label">ปรับตัวเลือกก่อนเพิ่มใน cart</small>}</div><div className="menu-item__action"><strong>{formatMinorAmount(product.effectivePriceMinor, product.currency)}</strong><button className="icon-button icon-button--subtle" type="button" disabled={product.soldOut} aria-label={product.soldOut ? `${product.name} หมดแล้ว` : `เพิ่ม ${product.name} ไปยัง cart`} onClick={() => { if (product.soldOut) return; if (product.modifierGroups.length > 0 || product.variants.length > 0) setSelectedProduct(product); else addItemToCart({ productId: product.id, name: product.name, description: product.description, unitPriceMinor: product.effectivePriceMinor, currency: product.currency }); }}><ArrowRight size={17} aria-hidden="true" /></button></div></article>)}</div>;
  return <div className="page-frame"><Link className="back-link" to={`/stores/${store.slug}`}><ChevronRight size={16} className="back-link__icon" aria-hidden="true" />กลับ {store.name}</Link><PageHeading eyebrow="MENU / SERVICES" title="เมนูและบริการ" description="รายการจริง ราคา และ modifier จะโหลดจาก public catalog ผ่าน Customer Gateway" /><div className="menu-tabs"><button className="is-active" type="button">Recommended</button><button type="button">Menu</button><button type="button">Services</button></div>{customerDataMode === "live" ? liveMenu : demoMenu}<p className="inline-notice"><CircleHelp size={16} aria-hidden="true" />Cart draft เก็บไว้ในเครื่องเท่านั้น และจะ reprice/validate ใหม่จาก server ก่อน checkout</p>{notice && <p className="inline-notice" role="status">{notice} · <Link className="text-link" to="/cart">เปิด cart</Link></p>}{selectedProduct && <ProductOptionsDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onConfirm={({ variantId, modifierIds }) => { addItemToCart({ productId: selectedProduct.id, name: selectedProduct.name, description: selectedProduct.description, unitPriceMinor: selectedProduct.effectivePriceMinor, currency: selectedProduct.currency, ...(variantId ? { variantId } : {}), modifierIds }); setSelectedProduct(null); }} />}</div>;
}

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const storeSlug = useCartStore((state) => state.storeSlug);
  const storeName = useCartStore((state) => state.storeName);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const clear = useCartStore((state) => state.clear);
  const totalMinor = items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
  return (
    <div className="page-frame">
      <PageHeading eyebrow="CART / DRAFT" title="ตะกร้าของคุณ" description="Cart draft จะ recover ได้ แต่ยอดจริงต้องผ่าน server repricing ก่อน checkout" />
      {items.length === 0 ? <EmptyState icon={ShoppingBag} title="ยังไม่มีรายการใน cart" description="เปิดเมนูของร้านที่สนใจเพื่อเริ่มสร้าง cart draft" action={<Link className="button button--dark" to="/">กลับไปสำรวจ <ArrowRight size={16} aria-hidden="true" /></Link>} /> : <>
        <section className="flow-card" aria-labelledby="cart-items-title">
          <div className="section-heading"><h2 id="cart-items-title">{storeName ?? "รายการของคุณ"}</h2><button className="text-link text-link--button" type="button" onClick={clear}>ล้าง cart</button></div>
          <div className="cart-list">
            {items.map((item) => {
              const lineKey = item.lineId ?? item.productId;
              return <article className="cart-line" key={lineKey}>
                <div><strong>{item.name}</strong><small>{item.description}</small><span>{formatMinorAmount(item.unitPriceMinor, item.currency)} / รายการ</span></div>
                <div className="cart-line__actions"><div className="quantity-control" aria-label={`จำนวน ${item.name}`}><button className="icon-button" type="button" aria-label={`ลด ${item.name}`} onClick={() => setQuantity(lineKey, item.quantity - 1)}>−</button><span>{item.quantity}</span><button className="icon-button" type="button" aria-label={`เพิ่ม ${item.name}`} onClick={() => setQuantity(lineKey, item.quantity + 1)}>+</button></div><strong>{formatMinorAmount(item.unitPriceMinor * item.quantity, item.currency)}</strong></div>
              </article>;
            })}
          </div>
          <div className="cart-total"><span>ยอดแสดงเบื้องต้น</span><strong>{formatMinorAmount(totalMinor, items[0]?.currency ?? "THB")}</strong></div>
          <div className="button-row"><Link className="button button--dark" to="/checkout">ไป checkout <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button--ghost" to={storeSlug ? `/stores/${storeSlug}/menu` : "/"}>เลือกเพิ่ม</Link></div>
        </section>
        <div className="guardrail-note"><CircleHelp size={17} aria-hidden="true" /><span>ยอดนี้เป็น draft จาก client เท่านั้น server จะ reprice, ตรวจ availability และ policy ใหม่เสมอ</span></div>
      </>}
    </div>
  );
}

export function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const storeCode = useCartStore((state) => state.storeCode) ?? items[0]?.storeCode ?? "";
  const storeName = useCartStore((state) => state.storeName) ?? "ร้านของคุณ";
  const clear = useCartStore((state) => state.clear);
  const [fulfillmentType, setFulfillmentType] = useState<"TAKEAWAY" | "DINE_IN">("TAKEAWAY");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"review" | "submitting" | "success" | "unknown">("review");
  const [notice, setNotice] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const idempotencyKey = useRef(createIdempotencyKey("order"));
  const pricingItems = useMemo(() => items.map((item) => ({
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    ...(item.modifierIds && item.modifierIds.length > 0 ? { modifierIds: item.modifierIds } : {}),
    quantity: item.quantity
  })), [items]);
  const pricingQuery = useQuery({
    queryKey: ["public-cart-price", storeCode, fulfillmentType, pricingItems],
    queryFn: () => pricePublicCart(storeCode, { channel: "QR", fulfillmentType, items: pricingItems }),
    enabled: customerDataMode === "live" && Boolean(storeCode) && pricingItems.length > 0,
    staleTime: 0,
    retry: 1
  });
  const draftTotalMinor = items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
  const totalMinor = pricingQuery.data?.totalMinor ?? draftTotalMinor;
  const submit = async () => {
    if (customerDataMode !== "live" || !storeCode || items.length === 0) {
      setNotice("Demo mode ยังไม่ส่ง order จริง และจะไม่แสดง success ปลอม");
      return;
    }
    if (pricingQuery.isLoading) {
      setNotice("กำลังตรวจสอบราคาและ availability จาก server กรุณารอสักครู่");
      return;
    }
    if (pricingQuery.isError || !pricingQuery.data) {
      setNotice("ยังตรวจสอบราคาไม่สำเร็จ กรุณาลองใหม่ก่อนส่ง order");
      void pricingQuery.refetch();
      return;
    }
    setPhase("submitting");
    setNotice("");
    try {
      const result = await createPublicOrder(storeCode, {
        channel: "QR",
        fulfillmentType,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, ...(item.variantId ? { variantId: item.variantId } : {}), ...(item.modifierIds && item.modifierIds.length > 0 ? { modifierIds: item.modifierIds } : {}) }))
      }, idempotencyKey.current);
      const token = result.trackingToken ?? result.order.publicTrackingToken;
      if (!token) throw new Error("Order response did not include a tracking token");
      setTrackingToken(token);
      await localRepository.saveOrder({ storeCode, storeName, trackingToken: token, orderNumber: result.order.orderNumber, status: result.order.status, createdAt: Date.now() });
      clear();
      try {
        const payment = await createPublicPaymentSession(storeCode, token);
        if (payment.payment?.url) {
          window.location.assign(payment.payment.url);
          return;
        }
        setNotice("Order นี้ชำระเงินแล้วหรือไม่ต้องชำระเพิ่ม สามารถติดตามสถานะจาก server ได้");
      } catch (paymentError) {
        if (paymentError instanceof ApiClientError && paymentError.code === "PAYMENT_PROVIDER_UNAVAILABLE") {
          setNotice("สร้าง order แล้ว แต่ hosted payment provider ยังไม่ได้ตั้งค่า จึงยังไม่ถือว่าชำระเงินสำเร็จ");
        } else {
          setNotice("สร้าง order แล้ว แต่ยังเปิด payment handoff ไม่สำเร็จ คุณสามารถกลับมาตรวจสอบ order เดิมได้โดยไม่สร้างซ้ำ");
        }
      }
      setPhase("success");
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 400 && error.status < 500 && error.status !== 409) {
        setPhase("review");
        setNotice(error.message);
      } else {
        setPhase("unknown");
        setNotice("ยังไม่ทราบผลลัพธ์ของ order การตรวจสอบอีกครั้งจะใช้ idempotency key เดิมเพื่อป้องกันการสร้างซ้ำ");
      }
    }
  };
  if (items.length === 0 && phase !== "success") return <div className="page-frame"><PageHeading eyebrow="CHECKOUT / SECURE HANDOFF" title="ยืนยันรายการ" description="Cart draft ว่างหรือหมดอายุแล้ว" /><EmptyState icon={ShoppingBag} title="ยังไม่มีรายการให้ checkout" description="กลับไปเลือกเมนู แล้วตรวจสอบยอดจริงจาก server ก่อนส่ง order" action={<Link className="button button--dark" to="/">กลับไปสำรวจ</Link>} /></div>;
  return <div className="page-frame"><PageHeading eyebrow="CHECKOUT / SECURE HANDOFF" title="ยืนยันรายการ" description="ก่อนส่ง order ระบบจะตรวจราคา availability ภาษี coupon และ policy จาก server อีกครั้ง" /><div className="checkout-steps"><div className="checkout-step is-active"><span>01</span><strong>Review</strong><small>ตรวจรายการ</small></div><div className="checkout-step"><span>02</span><strong>Payment handoff</strong><small>provider ภายนอก</small></div><div className="checkout-step"><span>03</span><strong>Track</strong><small>สถานะจาก server</small></div></div>{phase === "success" ? <section className="empty-state" aria-live="polite"><span className="icon-badge" aria-hidden="true"><Check size={22} /></span><h2>Order submitted</h2><p className="body-copy">Order ถูกสร้างโดย Customer Gateway แล้ว ไม่เก็บ card data ใน Aevo Go</p>{notice && <p className="inline-notice" role="status">{notice}</p>}<Link className="button button--dark" to={`/activity/orders/${trackingToken}`}>ติดตาม order</Link></section> : <section className="flow-card" aria-busy={phase === "submitting"}><div className="section-heading"><h2>{storeName}</h2><span className="muted-label">{items.length} รายการ</span></div><div className="cart-list">{items.map((item) => <div className="cart-line" key={item.lineId ?? item.productId}><div><strong>{item.name}</strong><small>{item.quantity} × {formatMinorAmount(item.unitPriceMinor, item.currency)}{item.modifierIds?.length ? ` · ${item.modifierIds.length} ตัวเลือก` : ""}</small></div><strong>{formatMinorAmount(item.unitPriceMinor * item.quantity, item.currency)}</strong></div>)}</div><div className="cart-total"><span>ยอดจาก server</span><strong>{formatMinorAmount(totalMinor, pricingQuery.data?.currency ?? items[0]?.currency ?? "THB")}</strong></div>{customerDataMode === "live" && pricingQuery.isLoading && <p className="muted-label">กำลังตรวจสอบราคาและ availability จาก Customer Gateway…</p>}{customerDataMode === "live" && pricingQuery.isError && <div className="guardrail-note"><CircleHelp size={16} aria-hidden="true" /><span>ยังตรวจสอบราคาไม่สำเร็จ</span><button className="text-link text-link--button" type="button" onClick={() => void pricingQuery.refetch()}>ลองใหม่</button></div>}{pricingQuery.data && <p className="muted-label">pricing version: {pricingQuery.data.pricingVersion} · server time: {new Date(pricingQuery.data.serverTime).toLocaleTimeString("th-TH")}</p>}<fieldset className="field-group"><legend>รูปแบบการรับบริการ</legend><GlidingGroup items={fulfillmentTabs} activeId={fulfillmentType} ariaLabel="รูปแบบการรับบริการ" onChange={(id) => { if (id === "TAKEAWAY" || id === "DINE_IN") setFulfillmentType(id); }} /></fieldset><div className="booking-form-grid"><div className="field-group"><label htmlFor="checkout-name">ชื่อ (ถ้ามี)</label><input id="checkout-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" /></div><div className="field-group"><label htmlFor="checkout-phone">โทรศัพท์ (ถ้ามี)</label><input id="checkout-phone" type="tel" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} autoComplete="tel" /></div><div className="field-group field-group--full"><label htmlFor="checkout-notes">หมายเหตุ</label><textarea id="checkout-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} /></div></div><div className="guardrail-note"><WalletCards size={16} aria-hidden="true" /><span>ถ้ามี provider ระบบจะส่งไปยัง hosted checkout เท่านั้น; Aevo Go ไม่รับข้อมูลบัตรโดยตรง</span></div>{notice && <p className="inline-notice" role={phase === "unknown" ? "alert" : "status"}>{notice}</p>}<div className="flow-card__footer"><Link className="button button--ghost" to="/cart">กลับ cart</Link><button className="button button--dark" type="button" onClick={() => void submit()} disabled={phase === "submitting" || customerDataMode !== "live" || pricingQuery.isLoading || pricingQuery.isError}>{phase === "submitting" ? "กำลังส่ง order…" : phase === "unknown" ? "ตรวจสอบ order เดิม" : customerDataMode === "live" ? "ส่ง order" : "เชื่อมต่อ Gateway ก่อนส่ง"}</button></div></section>}</div>;
}

export function ProfileSectionPage() {
  const { section = "preferences" } = useParams();
  const config = section === "quests" ? { title: "Quests", icon: Gift, text: "Quest definition และ progress จะโหลดจาก versioned server configuration" } : section === "coupons" ? { title: "Coupons", icon: Ticket, text: "Coupon grant และ redemption จะอยู่ใน transaction เดียวกับ Customer API" } : section === "level" ? { title: "Level & badges", icon: Sparkles, text: "EXP จะมาจาก append-only ledger ไม่ใช่ค่าที่ client เขียนเอง" } : { title: "Preferences", icon: Sparkles, text: "การตั้งค่าธีมและการตกแต่งสำหรับบัญชีของคุณ" };
  return (
    <div className="page-frame">
      <SubpageNavigation
        breadcrumbs={[
          { label: "โปรไฟล์", to: "/profile", icon: <User size={13} aria-hidden="true" /> },
          { label: config.title },
        ]}
      />
      <PageHeading eyebrow="PROFILE / PROGRESSION" title={config.title} description="หน้านี้เป็น route skeleton ตาม contract ใหม่และจะเติม read model เมื่อ API พร้อม" />
      <EmptyState icon={config.icon} title="กำลังเตรียมข้อมูลของคุณ" description={config.text} action={<Link className="button button--dark" to="/profile">กลับ profile</Link>} />
    </div>
  );
}

export function CreatePage() {
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get("type");
  const type = rawType === "review" || rawType === "trace" ? rawType : "post";
  const copy = type === "trace"
    ? { label: "TRACE", title: "สร้าง Trace ของคุณ", description: "เรียง Place ที่อยากแนะนำให้กลายเป็นเส้นทางที่คนอื่นทำตามได้" }
    : type === "review"
      ? { label: "REVIEW", title: "แบ่งปันประสบการณ์", description: "เขียนจากสิ่งที่คุณไปจริง และแนบ Place ที่เกี่ยวข้อง" }
      : { label: "POST", title: "เล่าเรื่องที่เพิ่งค้นพบ", description: "แบ่งปันเรื่องสั้น ๆ ให้คนที่ติดตามคุณได้เห็น" };
  return (
    <div className="page-frame create-page">
      <SubpageNavigation
        breadcrumbs={[
          { label: "โปรไฟล์", to: "/profile", icon: <User size={13} aria-hidden="true" /> },
          { label: "เขียนเล่าเรื่องใหม่ (Drafts)" },
        ]}
      />
      <PageHeading eyebrow={`CREATE / ${copy.label}`} title={copy.title} description={copy.description} />
      <section className="create-workspace">
        <div className="create-workspace__header">
          <div><p className="eyebrow">{copy.label}</p><h2>เริ่มจากสิ่งที่อยากบอก</h2></div>
          <span className="muted-label">Draft จะยังไม่เผยแพร่</span>
        </div>
        <label className="create-field"><span>ข้อความ</span><textarea placeholder={type === "trace" ? "เล่าเส้นทางนี้เหมาะกับใคร…" : "เขียนสิ่งที่อยากแบ่งปัน…"} maxLength={2000} /></label>
        <div className="create-field-row">
          <label className="create-field"><span>แนบ Place หรือ Trace</span><select defaultValue=""><option value="">เลือกภายหลัง</option><option value="north-star-coffee">North Star Coffee</option><option value="ari-design-morning">Ari เช้าเบา ๆ กับกาแฟและงานออกแบบ</option></select></label>
          <label className="create-field"><span>รูปภาพ</span><input type="file" accept="image/*" /></label>
        </div>
        <div className="guardrail-note"><CircleHelp size={16} aria-hidden="true" /><span>การเผยแพร่จริงจะตรวจ session สิทธิ์ moderation และผลลัพธ์จากระบบก่อนแสดงต่อสาธารณะ</span></div>
        <div className="flow-card__footer"><Link className="button button--ghost" to="/">ยกเลิก</Link><button className="button button--dark" type="button" disabled>บันทึก draft เมื่อระบบพร้อม</button></div>
      </section>
    </div>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"checking" | "signed-in" | "guest" | "error">("checking");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  useEffect(() => {
    let active = true;
    const complete = async (): Promise<void> => {
      if (code || state) {
        const flow = readGoSsoFlow();
        if (!code || !state || !flow || flow.state !== state) throw new Error("Invalid sign-in handoff");
        await completeCustomerSignIn({ code, state, codeVerifier: flow.verifier });
        clearGoSsoFlow();
      }
      const session = await getCustomerSession();
      if (!active) return;
      if (session) {
        setStatus("signed-in");
        navigate(returnTo, { replace: true });
      } else {
        setStatus("guest");
      }
    };
    void complete().catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [code, navigate, returnTo, state]);
  const copy = status === "checking" ? "กำลังตรวจสอบ session ผ่าน Customer Gateway…" : status === "signed-in" ? "เข้าสู่ระบบสำเร็จ กำลังกลับไปหน้าที่ขอไว้…" : status === "guest" ? "ยังไม่มี session ที่ใช้งานได้ กรุณาเริ่ม sign-in ผ่าน gateway" : "ตรวจสอบ session ไม่สำเร็จ กรุณาลองใหม่";
  return <main className="standalone-page"><section className="callback-card"><span className="icon-badge" aria-hidden="true"><CircleHelp size={21} /></span><p className="eyebrow">AUTH / CALLBACK</p><h1>Session handoff</h1><p className="body-copy" role="status" aria-live="polite">{copy}</p>{status !== "checking" && status !== "signed-in" && <Link className="button button--dark" to={returnTo}>กลับไปต่อ</Link>}</section></main>;
}
