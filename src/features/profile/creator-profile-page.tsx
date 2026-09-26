import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Check,
  Clock3,
  Coffee,
  Compass,
  Edit3,
  Footprints,
  Gift,
  Heart,
  Leaf,
  Map,
  MapPin,
  MessageCircle,
  Palette,
  Plus,
  Route,
  Settings,
  Share2,
  Award,
  ShoppingBag,
  Sparkles,
  Ticket,
  User,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GlidingGroup } from "@/components/gliding-group";
import { SubpageNavigation } from "@/components/subpage-navigation";
import { MediaConversationModal } from "@/components/media-conversation-modal";
import { ExploreTraceDetail } from "@/features/discovery/explore-trace-detail";
import { PostInlineDetail } from "@/features/discovery/post-inline-detail";
import type { StoreMapSummary, TraceMapSummary } from "@/features/map/contracts";
import { MapLibreMap, type MapProviderStatus } from "@/features/map/maplibre-map";
import { demoPosts, demoTraces } from "@/features/discovery/demo-discovery";
import type {
  DiscoveryAction,
  DiscoveryActionState,
  DiscoveryCommentProfile,
  DiscoveryItem,
  DiscoveryPost,
  DiscoveryTrace,
  DiscoveryTracerSummary,
} from "@/features/discovery/types";
import type { DiscoveryActionHandlers } from "@/features/discovery/discovery-cards";
import { customerDataMode, mapStyleUrl } from "@/lib/env";
import { createIdempotencyKey } from "@/lib/idempotency";
import { listCustomerFavorites } from "@/lib/public-api";
import { localRepository } from "@/lib/local-repository";
import { getCustomerSession } from "@/lib/session";
import { setTraceDeeTracerFollow } from "@/lib/customer-api";
import { calculateLevelInfo } from "@/features/gamification/types";
import { getGamificationState } from "@/features/gamification/storage";
import { AvatarDecoration } from "./avatar-decoration";
import { ProfileEffectLayer } from "./profile-effect-layer";
import { ProfileCustomizerModal } from "./profile-customizer-modal";
import {
  BANNER_PRESETS,
  PROFILE_BADGES_CATALOG,
  THEME_ACCENTS,
  type UserProfileCustomization,
} from "./profile-customization-types";
import {
  defaultProfileCustomization,
  getStoredProfileCustomization,
  saveStoredProfileCustomization,
} from "./profile-storage";

type ProfileTab = "traces" | "posts" | "map";

interface ProfileCreator extends DiscoveryTracerSummary {
  bio: string;
  verified: boolean;
  expertiseLabel: string;
  socialLabel: string;
}

const profileCreator: ProfileCreator = {
  ...(demoTraces[0]?.creator ?? {
    id: "tracer-ari",
    name: "Mina P.",
    initials: "MP",
    expertise: ["กาแฟ", "งานออกแบบ"],
    area: "Ari",
    following: false,
  }),
  bio: "ชอบเก็บรายละเอียดเล็ก ๆ ของเมืองผ่านกาแฟ งานออกแบบ และการเดินที่ไม่ต้องเร่งรีบ",
  verified: true,
  expertiseLabel: "Specialty Coffee & Design",
  socialLabel: "Ari · Bangkok",
};

const profileTraces: readonly DiscoveryTrace[] = [
  ...(demoTraces[0] ? [{ ...demoTraces[0], creator: profileCreator }] : []),
  ...(demoTraces[1]
    ? [{
        ...demoTraces[1],
        id: "trace-ari-old-town-edit",
        slug: "ari-old-town-edit",
        creator: profileCreator,
        title: "จาก Ari ถึงตลาดน้อยในวันที่อยากเดินให้ไกลขึ้น",
        description: "ฉบับต่อยอดจากกาแฟแก้วแรกไปสู่สตูดิโอเล็กและแสงเย็นของเมืองเก่า",
        area: "Ari · Charoenkrung",
        stopCount: 6,
        durationMinutes: 240,
        distanceKm: 4.2,
        budgetLabel: "฿฿",
        followerCount: 64,
        remixCount: 12,
        completionCount: 27,
        rating: 4.9,
        reason: { code: "SIMILAR_TASTE" as const, matchedTopics: ["กาแฟ", "ย่านเก่า"] },
      }]
    : []),
];

const profilePosts: readonly DiscoveryPost[] = [
  ...(demoPosts[0] ? [{ ...demoPosts[0], author: profileCreator }] : []),
  ...(demoPosts[1] && profileTraces[1]
    ? [{
        ...demoPosts[1],
        id: "post-ari-evening-note",
        author: profileCreator,
        body: "ถ้าอยากต่อวันให้ยาวขึ้น ลองออกจาก Ari ไปทางตลาดน้อยช่วงเย็น แสงจะเปลี่ยนบรรยากาศของ Trace ไปอีกแบบ",
        attachedObject: {
          itemType: "TRACE" as const,
          id: profileTraces[1].id,
          title: profileTraces[1].title,
          subtitle: `${profileTraces[1].stopCount} stops · ${profileTraces[1].area}`,
          href: `/traces/${profileTraces[1].slug}`,
        },
      }]
    : []),
];

const profileMapPlaces: readonly StoreMapSummary[] = [
  {
    id: "north-star-coffee",
    slug: "north-star-coffee",
    name: "North Star Coffee",
    point: { latitude: 13.7797, longitude: 100.5448 },
    category: "Cafe",
    categoryIconKey: "cafe",
    rating: 4.8,
    reviewCount: 214,
    priceLevel: 2,
    priceRange: "฿฿",
    availableToday: true,
    availabilityLabel: "จองผ่าน Aevo Play ได้วันนี้",
    area: "Ari",
    imageUrl: null,
    source: "customer",
    isAevoPlayPartner: true,
    venueSlug: "north-star-coffee",
  },
  {
    id: "ari-ceramic-house",
    slug: "ari-ceramic-house",
    name: "Ari Ceramic House",
    point: { latitude: 13.7793, longitude: 100.5441 },
    category: "Activities",
    categoryIconKey: "activities",
    rating: 4.7,
    reviewCount: 73,
    priceLevel: 2,
    priceRange: "฿฿",
    availableToday: true,
    availabilityLabel: "จองผ่าน Aevo Play ได้ 14:00",
    area: "Ari",
    imageUrl: null,
    source: "customer",
    isAevoPlayPartner: true,
    venueSlug: "ari-ceramic-house",
  },
  {
    id: "talat-noi-roastery",
    slug: "talat-noi-roastery",
    name: "Talat Noi Roastery",
    point: { latitude: 13.7337, longitude: 100.5102 },
    category: "Cafe",
    categoryIconKey: "cafe",
    rating: 4.8,
    reviewCount: 128,
    priceLevel: 2,
    priceRange: "฿฿",
    availableToday: true,
    availabilityLabel: "จองผ่าน Aevo Play ได้ 10:30",
    area: "Charoenkrung",
    imageUrl: null,
    source: "customer",
    isAevoPlayPartner: true,
    venueSlug: "talat-noi-roastery",
  },
];

const profileMapTrace: TraceMapSummary = {
  id: "trace-ari-old-town-edit",
  slug: "ari-old-town-edit",
  title: "จาก Ari ถึงตลาดน้อยในวันที่อยากเดินให้ไกลขึ้น",
  area: "Ari · Charoenkrung",
  stopCount: 6,
  durationMinutes: 240,
  distanceKm: 4.2,
  matchLabel: "94% taste match",
  followerCount: 64,
  remixCount: 12,
  route: [
    { latitude: 13.7797, longitude: 100.5448 },
    { latitude: 13.7793, longitude: 100.5441 },
    { latitude: 13.7337, longitude: 100.5102 },
  ],
};

function profileTabFromSearch(value: string | null): ProfileTab {
  return value === "posts" || value === "map" ? value : "traces";
}

function initialsFromName(value: string): string {
  const initials = value
    .split(/\s+/u)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "AG";
}

function formatHours(minutes: number | null): string {
  if (minutes === null) return "0 ชม.";
  return `${minutes / 60} ชม.`;
}

function ProfileDemoNotice() {
  return (
    <div className="creator-profile-demo-notice" role="status">
      <Sparkles size={15} aria-hidden="true" />
      <span>โหมดทดลอง · บัญชีตัวอย่างสำหรับการสำรวจและบันทึกรอยเท้าใน Aevocado GO</span>
    </div>
  );
}

function TraceMosaic({ trace, onOpen }: { trace: DiscoveryTrace; onOpen: () => void }) {
  const images = trace.coverImages ?? [];
  return (
    <button className="creator-trace-card__mosaic" type="button" onClick={onOpen} aria-label={`เปิด ${trace.title}`}>
      {images.length > 0 ? images.slice(0, 3).map((src, index) => (
        <img key={`${src}-${index}`} src={src} alt="" loading="lazy" decoding="async" />
      )) : trace.coverTiles.map((tile) => <span key={tile}>{tile}</span>)}
      <span className="creator-trace-card__mosaic-count">{trace.stopCount} stops</span>
    </button>
  );
}

function TraceCard({ trace, onOpen, saved, onSave }: { trace: DiscoveryTrace; onOpen: () => void; saved: boolean; onSave: () => void }) {
  return (
    <article className="creator-trace-card">
      <TraceMosaic trace={trace} onOpen={onOpen} />
      <div className="creator-trace-card__body">
        <div className="creator-trace-card__eyebrow">
          <span>{trace.area}</span>
          <span><BadgeCheck size={13} aria-hidden="true" />Public Trace</span>
        </div>
        <button className="creator-trace-card__title" type="button" onClick={onOpen}>{trace.title}</button>
        <p>{trace.description}</p>
        <div className="creator-trace-card__meta" aria-label="ข้อมูล Trace">
          <span><Route size={14} aria-hidden="true" />{trace.stopCount} stops</span>
          <span><Clock3 size={14} aria-hidden="true" />{formatHours(trace.durationMinutes)}</span>
          <span>{trace.distanceKm === null ? "0 km" : `${trace.distanceKm} km`}</span>
        </div>
        <footer className="creator-trace-card__footer">
          <span>{trace.followerCount} คนตามรอย · {trace.remixCount} Remix</span>
          <div>
            <button className={`icon-button icon-button--subtle${saved ? " is-selected" : ""}`} type="button" aria-label={saved ? "ยกเลิกบันทึก Trace" : "บันทึก Trace"} aria-pressed={saved} onClick={(event) => { event.stopPropagation(); onSave(); }}>
              {saved ? <Check size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
            </button>
            <button className="creator-trace-card__open" type="button" onClick={onOpen}>เปิด Trace <ArrowRight size={14} aria-hidden="true" /></button>
          </div>
        </footer>
      </div>
    </article>
  );
}

function PostCard({ post, onOpen, liked, onLike }: { post: DiscoveryPost; onOpen: () => void; liked: boolean; onLike: () => void }) {
  const image = post.mediaImages?.[0];
  return (
    <article className="creator-post-card">
      <button className="creator-post-card__media" type="button" onClick={onOpen} aria-label={`เปิดโพสต์ของ ${post.author.name}`}>
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span>{post.mediaLabels[0] ?? "POST"}</span>}
        <span className="creator-post-card__media-count">{post.mediaImages?.length ?? post.mediaLabels.length} รูป</span>
      </button>
      <div className="creator-post-card__body">
        <div className="creator-post-card__author">
          <span className="creator-profile-avatar--small" aria-hidden="true">{post.author.initials}</span>
          <span><strong>{post.author.name}</strong><small>{post.publishedLabel}</small></span>
        </div>
        <p>{post.body}</p>
        <footer className="creator-post-card__footer">
          <button className={`creator-content-action${liked ? " is-selected" : ""}`} type="button" aria-pressed={liked} onClick={onLike}>
            <Heart size={15} fill={liked ? "currentColor" : "none"} aria-hidden="true" />{post.likeCount + (liked && !post.liked ? 1 : 0)}
          </button>
          <button className="creator-content-action" type="button" onClick={onOpen}>
            <MessageCircle size={15} aria-hidden="true" />{post.comments.length}
          </button>
          <button className="creator-post-card__open" type="button" onClick={onOpen}>
            ดูโพสต์ <ArrowRight size={14} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </article>
  );
}

function CreatorMapPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<MapProviderStatus>("loading");
  const selectedPlace = profileMapPlaces.find((place) => place.slug === selectedSlug) ?? null;
  return (
    <section className="creator-map-panel" aria-labelledby="creator-map-title">
      <header className="creator-map-panel__header">
        <div>
          <span className="eyebrow">FOOTPRINT MAP</span>
          <h2 id="creator-map-title">แผนที่รอยเท้า</h2>
          <p>สถานที่และจุดแวะที่เคยไปหรือแนะนำไว้</p>
        </div>
        <Link className="button button--ghost" to="/map?mode=places&area=Ari">
          <Map size={15} aria-hidden="true" />ขยายแผนที่เต็มจอ
        </Link>
      </header>
      <div className="creator-map-panel__canvas">
        <MapLibreMap
          stores={profileMapPlaces}
          traces={[profileMapTrace]}
          styleUrl={mapStyleUrl}
          selectedSlug={selectedSlug}
          initialViewState={{ longitude: 100.532, latitude: 13.756, zoom: 10.8 }}
          onSelect={(slug) => setSelectedSlug(slug)}
          onSelectTrace={(slug) => { setSelectedSlug(slug); onNotice("เลือกเส้นทางแล้ว"); }}
          onViewportChange={() => undefined}
          onStatus={setStatus}
        />
        {status === "error" && <div className="creator-map-panel__fallback" role="status">Map provider ใช้งานไม่ได้ · เลือกสถานที่จากรายการด้านล่างได้</div>}
      </div>
      <div className="creator-map-panel__places">
        {profileMapPlaces.map((place) => (
          <button className={`creator-map-place${selectedSlug === place.slug ? " is-selected" : ""}`} type="button" key={place.slug} aria-pressed={selectedSlug === place.slug} onClick={() => setSelectedSlug(place.slug)}>
            <span className="creator-map-place__pin" aria-hidden="true"><MapPin size={14} /></span>
            <span><strong>{place.name}</strong><small>{place.area} · {place.category}</small></span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      {selectedPlace && (
        <div className="creator-map-panel__selected">
          <span><strong>{selectedPlace.name}</strong><small>{selectedPlace.availabilityLabel ?? "Public place"}</small></span>
          {selectedPlace.isAevoPlayPartner && (
            <Link className="creator-map-panel__book" to={`/stores/${selectedPlace.slug}/booking`}>
              <Zap size={14} aria-hidden="true" />จองสิทธิ์
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function CreatorProfileEmpty({ tab, isOwnProfile }: { tab: ProfileTab; isOwnProfile: boolean }) {
  if (tab === "traces") {
    return (
      <div className="profile-empty-card" role="status">
        <div className="profile-empty-card__icon">
          <Route size={28} aria-hidden="true" />
        </div>
        <h3>{isOwnProfile ? "ยังไม่มีเส้นทางที่คุณสร้างไว้" : "ยังไม่มีเส้นทางสาธารณะ"}</h3>
        <p>
          {isOwnProfile
            ? "ยังไม่มีเส้นทางที่คุณสร้างไว้ แบ่งปันย่านโปรดของคุณให้เพื่อนๆ ได้ตามรอย"
            : "เมื่อมีการสร้างและเผยแพร่เส้นทาง จะแสดงให้คุณได้ตามรอยที่นี่"}
        </p>
        {isOwnProfile && (
          <Link className="button button--white-prismatic profile-empty-card__cta" to="/create?type=trace">
            <Plus size={15} aria-hidden="true" />
            <span>+ สร้าง Trace แรก</span>
          </Link>
        )}
      </div>
    );
  }
  if (tab === "posts") {
    return (
      <div className="profile-empty-card" role="status">
        <div className="profile-empty-card__icon">
          <Sparkles size={28} aria-hidden="true" />
        </div>
        <h3>{isOwnProfile ? "ยังไม่มีโพสต์และเรื่องราว" : "ยังไม่มีเรื่องราวที่แชร์"}</h3>
        <p>
          {isOwnProfile
            ? "บันทึกโมเมนต์ประทับใจ ภาพถ่าย และเรื่องราวระหว่างการเดินทางในแบบของคุณ"
            : "เรื่องราวและภาพบรรยากาศใหม่ๆ จะปรากฏให้เห็นที่นี่"}
        </p>
        {isOwnProfile && (
          <Link className="button button--white-prismatic profile-empty-card__cta" to="/create?type=post">
            <Plus size={15} aria-hidden="true" />
            <span>เขียนเรื่องราวแรก</span>
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="profile-empty-card" role="status">
      <div className="profile-empty-card__icon">
        <MapPin size={28} aria-hidden="true" />
      </div>
      <h3>{isOwnProfile ? "ยังไม่มีแผนที่รอยเท้า" : "ยังไม่มีหมุดสถานที่"}</h3>
      <p>
        {isOwnProfile
          ? "ออกไปเช็คอินหรือสร้าง Trace เพื่อเริ่มสะสมหมุดบนแผนที่ส่วนตัวของคุณ"
          : "หมุดสถานที่โปรดจะปรากฏบนแผนที่เมื่อเริ่มออกเดินทาง"}
      </p>
      {isOwnProfile && (
        <Link className="button button--white-prismatic profile-empty-card__cta" to="/map">
          <Compass size={15} aria-hidden="true" />
          <span>สำรวจย่านรอบตัว</span>
        </Link>
      )}
    </div>
  );
}

function PersonalShortcutsGrid({ savedPlacesCount }: { savedPlacesCount: number | null }) {
  const shortcuts = [
    {
      to: "/shop",
      icon: ShoppingBag,
      title: "ร้านค้า & คูปอง",
      subtitle: "Aevo Rewards & Shop",
      badge: "Aevo Perks & Coupons",
    },
    {
      to: "/profile/quests",
      icon: Award,
      title: "เลเวล & ภารกิจ",
      subtitle: "Level & Quests",
      badge: "Level & badges",
    },
    {
      to: "/saved",
      icon: Bookmark,
      title: "รายการที่บันทึกไว้",
      subtitle: "Saved Places",
      badge: savedPlacesCount !== null && savedPlacesCount > 0 ? String(savedPlacesCount) : undefined,
    },
    {
      to: "/create?mode=drafts",
      icon: Edit3,
      title: "ดราฟต์ของฉัน",
      subtitle: "Draft Traces",
    },
  ];

  return (
    <div className="profile-bento-shortcuts" aria-label="Personal shortcuts">
      {shortcuts.map(({ to, icon: Icon, title, subtitle, badge }) => (
        <Link key={to} to={to} className="profile-bento-shortcut-card">
          <div className="profile-bento-shortcut-card__icon">
            <Icon size={18} aria-hidden="true" />
          </div>
          <div className="profile-bento-shortcut-card__text">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
          {badge && <span className="profile-bento-shortcut-card__badge">{badge}</span>}
          <ArrowRight size={14} className="profile-bento-shortcut-card__arrow" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export function CreatorProfilePage() {
  const { creatorId } = useParams<{ creatorId?: string }>();
  const isOwnProfile = !creatorId;
  const demoMode = customerDataMode === "demo";
  const demoCreatorMatch = !creatorId || creatorId === profileCreator.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notice, setNotice] = useState("");
  const [following, setFollowing] = useState(!isOwnProfile && demoMode && demoCreatorMatch && profileCreator.following);
  const [followPending, setFollowPending] = useState(false);
  const [savedTraceIds, setSavedTraceIds] = useState<Set<string>>(new Set());
  const [unsavedTraceIds, setUnsavedTraceIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalIndex, setMediaModalIndex] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["auth", "customer-session", "creator-profile"],
    queryFn: getCustomerSession,
    enabled: isOwnProfile && !demoMode,
    retry: false,
    staleTime: 60_000,
  });

  const localProfileQuery = useQuery({
    queryKey: ["profile", "creator-profile-local-insights"],
    queryFn: async () => {
      const [favorites, reservations, orders] = await Promise.all([
        localRepository.listFavorites(),
        localRepository.listReservations(),
        localRepository.listOrders(),
      ]);
      return { favoriteCount: favorites.length, reservationCount: reservations.length, orderCount: orders.length };
    },
    enabled: isOwnProfile,
    staleTime: 30_000,
  });

  const serverFavoritesQuery = useQuery({
    queryKey: ["customer-favorites", "creator-profile"],
    queryFn: listCustomerFavorites,
    enabled: isOwnProfile && !demoMode && Boolean(sessionQuery.data),
    retry: false,
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();
  const profileKey = isOwnProfile ? (sessionQuery.data?.user.id ?? "self") : (creatorId ?? "guest");

  const customizationQuery = useQuery({
    queryKey: ["user-profile-customization", profileKey],
    queryFn: async () => {
      const stored = await getStoredProfileCustomization(profileKey);
      if (!isOwnProfile && demoCreatorMatch) {
        return {
          ...stored,
          displayName: profileCreator.name,
          handle: "minap_ari",
          bio: profileCreator.bio,
          avatarDecorationId: "lightstruck-halo" as const,
          bannerPresetId: "lightstruck-iridescent" as const,
          profileEffectId: "prismatic-sheen" as const,
          themeAccentId: "obsidian-titanium" as const,
          activeBadges: ["badge-founding-tastemaker", "badge-verified-curator", "badge-coffee-specialist"],
        };
      }
      return stored;
    },
    staleTime: 60_000,
  });

  const fallbackName = sessionQuery.data?.user.displayName || sessionQuery.data?.user.email?.split("@")[0] || "Your Name";
  const profileCustomization = customizationQuery.data ?? defaultProfileCustomization(profileKey, {
    displayName: isOwnProfile ? fallbackName : (demoCreatorMatch ? profileCreator.name : "Creator"),
    bio: isOwnProfile ? "Coffee & Urban Architecture Lover · Bangkok" : (demoCreatorMatch ? profileCreator.bio : ""),
    handle: isOwnProfile
      ? ((sessionQuery.data?.user.email?.split("@")[0] || "yourname").toLowerCase().replace(/[^a-z0-9_]/g, ""))
      : (demoCreatorMatch ? "minap_ari" : (creatorId || "creator").toLowerCase().replace(/[^a-z0-9_]/g, "")),
  });

  const activeTheme = THEME_ACCENTS.find((t) => t.id === profileCustomization.themeAccentId) ?? THEME_ACCENTS[0]!;
  const activeBanner = BANNER_PRESETS.find((b) => b.id === profileCustomization.bannerPresetId) ?? BANNER_PRESETS[0]!;

  const gamificationQuery = useQuery({
    queryKey: ["user-gamification-state", profileKey],
    queryFn: () => getGamificationState(isOwnProfile ? undefined : (creatorId ?? undefined)),
    staleTime: 30_000,
  });
  const gamificationLevelInfo = calculateLevelInfo(gamificationQuery.data?.totalExp ?? 750);

  const handleSaveCustomization = async (updated: UserProfileCustomization) => {
    await saveStoredProfileCustomization(updated);
    setNotice("บันทึกการตกแต่งโปรไฟล์สำเร็จแล้ว");
    queryClient.setQueryData(["user-profile-customization", profileKey], updated);
  };

  const getBadgeIcon = (iconKey: string) => {
    switch (iconKey) {
      case "badge-check":
        return <BadgeCheck size={14} aria-hidden="true" />;
      case "coffee":
        return <Coffee size={14} aria-hidden="true" />;
      case "footprints":
        return <Footprints size={14} aria-hidden="true" />;
      case "compass":
        return <Compass size={14} aria-hidden="true" />;
      case "route":
        return <Route size={14} aria-hidden="true" />;
      default:
        return <Sparkles size={14} aria-hidden="true" />;
    }
  };

  const currentDisplayName = isOwnProfile ? profileCustomization.displayName : creatorId ? (customizationQuery.data?.displayName ?? (demoCreatorMatch ? profileCreator.name : "Creator")) : profileCreator.name;
  const currentBio = isOwnProfile ? profileCustomization.bio : (demoCreatorMatch ? profileCreator.bio : (customizationQuery.data?.bio ?? ""));

  const liveCreator: ProfileCreator = {
    id: sessionQuery.data?.user.id ?? "current-user",
    name: currentDisplayName,
    initials: initialsFromName(currentDisplayName),
    expertise: ["กาแฟ", "งานออกแบบ"],
    area: "Bangkok",
    following: false,
    bio: currentBio,
    verified: false,
    expertiseLabel: "Specialty Coffee & Design",
    socialLabel: "Bangkok",
  };

  const creator = demoMode && demoCreatorMatch ? profileCreator : liveCreator;
  const traces = demoMode && demoCreatorMatch ? profileTraces : [];
  const posts = demoMode && demoCreatorMatch ? profilePosts : [];
  const activeTab = profileTabFromSearch(searchParams.get("tab"));
  const selectedId = searchParams.get("item");
  const selectedTrace = traces.find((trace) => trace.id === selectedId || trace.slug === selectedId) ?? null;
  const selectedPost = posts.find((post) => post.id === selectedId) ?? null;
  const selectedPostTrace = selectedPost?.attachedObject?.itemType === "TRACE"
    ? traces.find((trace) => trace.id === selectedPost.attachedObject?.id) ?? null
    : null;
  const modalTrace = selectedTrace ?? selectedPostTrace;
  const detailTrace = modalTrace;
  const detailOpen = Boolean(detailTrace || selectedPost);

  // Human stats guaranteed numeric - 0 instead of unavailable strings
  const tracesCount = traces.length;
  const followersCount = demoMode && demoCreatorMatch ? 184 : 0;
  const remixesCount = traces.reduce((sum, trace) => sum + trace.remixCount, 0);
  const checkinsCount = traces.reduce((sum, trace) => sum + trace.completionCount, 0);

  const localFavoriteCount = localProfileQuery.isLoading ? null : localProfileQuery.data?.favoriteCount ?? 0;
  const savedPlacesCount = serverFavoritesQuery.data ? new Set([...(serverFavoritesQuery.data ?? [])]).size : localFavoriteCount;

  const userHandle = isOwnProfile
    ? (sessionQuery.data?.user.email?.split("@")[0] || "yourname").toLowerCase().replace(/[^a-z0-9_]/g, "")
    : (creator.id || creator.name).toLowerCase().replace(/[^a-z0-9_]/g, "");

  const updateUrl = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  const [isClosingDetail, setIsClosingDetail] = useState(false);
  const [closingDetailTrace, setClosingDetailTrace] = useState<DiscoveryTrace | null>(null);
  const [closingSelectedPost, setClosingSelectedPost] = useState<DiscoveryPost | null>(null);
  const closingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
        closingTimeoutRef.current = null;
      }
    };
  }, []);

  const isDetailActive = Boolean(detailOpen && !isClosingDetail);
  const activeDetailTrace = detailTrace || closingDetailTrace;
  const activeSelectedPost = selectedPost || closingSelectedPost;

  const openTrace = (trace: DiscoveryTrace) => {
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    updateUrl({ tab: "traces", item: trace.id });
  };
  const openPost = (post: DiscoveryPost) => {
    if (closingTimeoutRef.current !== null) {
      window.clearTimeout(closingTimeoutRef.current);
      closingTimeoutRef.current = null;
    }
    setIsClosingDetail(false);
    setClosingDetailTrace(null);
    setClosingSelectedPost(null);
    updateUrl({ tab: "posts", item: post.id });
  };
  const closeDetail = () => {
    setMediaModalOpen(false);
    if (detailTrace || selectedPost) {
      setClosingDetailTrace(detailTrace);
      setClosingSelectedPost(selectedPost);
      setIsClosingDetail(true);
      if (closingTimeoutRef.current !== null) {
        window.clearTimeout(closingTimeoutRef.current);
      }
      closingTimeoutRef.current = window.setTimeout(() => {
        setIsClosingDetail(false);
        setClosingDetailTrace(null);
        setClosingSelectedPost(null);
        closingTimeoutRef.current = null;
        updateUrl({ item: null });
      }, 200);
    } else {
      updateUrl({ item: null });
    }
  };
  const openMedia = (index: number) => {
    setMediaModalIndex(Math.max(0, index));
    setMediaModalOpen(true);
  };
  const closeMedia = () => setMediaModalOpen(false);
  const isTraceSaved = (trace: DiscoveryTrace): boolean =>
    !unsavedTraceIds.has(trace.id) && (trace.saved || savedTraceIds.has(trace.id));

  const toggleFollow = async () => {
    if (isOwnProfile) return;
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    if (demoMode) {
      setNotice(nextFollowing ? "ติดตามแล้ว" : "ยกเลิกการติดตามแล้ว");
      return;
    }
    setFollowPending(true);
    try {
      await setTraceDeeTracerFollow(creator.id, nextFollowing, createIdempotencyKey("creator-profile-follow"));
      setNotice(nextFollowing ? "ติดตามแล้ว" : "ยกเลิกการติดตามแล้ว");
    } catch {
      setFollowing(!nextFollowing);
      setNotice("ยังไม่สามารถอัปเดตการติดตามได้");
    } finally {
      setFollowPending(false);
    }
  };

  const saveProfileTrace = (trace: DiscoveryTrace) => {
    const wasSaved = isTraceSaved(trace);
    if (wasSaved) {
      setUnsavedTraceIds((current) => new Set(current).add(trace.id));
      setSavedTraceIds((current) => { const next = new Set(current); next.delete(trace.id); return next; });
    } else {
      setSavedTraceIds((current) => new Set(current).add(trace.id));
      setUnsavedTraceIds((current) => { const next = new Set(current); next.delete(trace.id); return next; });
    }
    setNotice(wasSaved ? "นำ Trace ออกจาก Saved แล้ว" : "บันทึก Trace แล้ว");
  };

  const toggleProfilePostLike = (post: DiscoveryPost) => {
    setLikedPostIds((current) => {
      const next = new Set(current);
      if (next.has(post.id) || post.liked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    setNotice(post.liked || likedPostIds.has(post.id) ? "ยกเลิกถูกใจแล้ว" : "ถูกใจแล้ว");
  };

  const handleShareProfile = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
    }
    setNotice("คัดลอกลิงก์โปรไฟล์แล้ว");
  };

  const profileActionState = (_item: DiscoveryItem, _action: DiscoveryAction): DiscoveryActionState | undefined => undefined;
  const profileHandlers: DiscoveryActionHandlers = {
    onAction: (item, action) => {
      if (action === "trace" && item.itemType === "TRACE") saveProfileTrace(item);
      if (action === "share") setNotice("คัดลอกบริบทของ Trace สำหรับแชร์แล้ว");
    },
    actionState: profileActionState,
  };

  const profileCommenterFollow = demoMode
    ? async (profile: DiscoveryCommentProfile): Promise<void> => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 160));
        setNotice(`ติดตาม ${profile.name} แล้ว`);
      }
    : undefined;

  const profileTabs = [
    {
      id: "traces",
      label: (
        <span className="profile-tab-label">
          <Route size={15} aria-hidden="true" />
          <span>{isOwnProfile ? "Traces ของฉัน" : `Traces ของ ${creator.name}`}</span>
        </span>
      ),
    },
    {
      id: "posts",
      label: (
        <span className="profile-tab-label">
          <Sparkles size={15} aria-hidden="true" />
          <span>โพสต์และเรื่องราว</span>
          <span className="sr-only"> Posts</span>
        </span>
      ),
    },
    {
      id: "map",
      label: (
        <span className="profile-tab-label">
          <MapPin size={15} aria-hidden="true" />
          <span>แผนที่รอยเท้า</span>
          <span className="sr-only"> Footprint Map</span>
        </span>
      ),
    },
  ] as const;

  return (
    <div className="creator-profile-page">
      {!isOwnProfile && (
        <div className="creator-profile-page__topline">
          <SubpageNavigation
            breadcrumbs={[
              { label: "โปรไฟล์", to: "/profile", icon: <User size={13} /> },
              { label: `นักสร้างสรรค์: ${creator.name}` },
            ]}
          />
        </div>
      )}

      {demoMode && <ProfileDemoNotice />}

      {/* Hero Profile Bento Section - Customizable Prismatic Identity Card */}
      <header
        className="creator-profile-hero prismatic-passport-card"
        style={{
          background: activeTheme.bgGradient,
          borderColor: activeBanner.borderTint,
          boxShadow: `0 20px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 35px ${activeTheme.primary}22`,
        }}
      >
        {/* Discord-style Ambient Profile Effect Layer */}
        <ProfileEffectLayer effectId={profileCustomization.profileEffectId} />

        {/* Top Level & Title Badge Row */}
        <div className="profile-card-top-row">
          <div className="profile-card-level-badge">
            <span className="profile-card-level-badge__dot" />
            <Sparkles size={12} aria-hidden="true" />
            <span>{`Lv.${gamificationLevelInfo.level} ${gamificationLevelInfo.title}`}</span>
          </div>
          {isOwnProfile && (
            <Link
              className="profile-btn-icon"
              to="/profile/preferences"
              aria-label="ตั้งค่าโปรไฟล์"
            >
              <Settings size={16} aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* Hero Cover Banner */}
        <div
          className="profile-hero-banner"
          style={{
            background:
              profileCustomization.bannerPresetId === "custom" && profileCustomization.bannerUrl
                ? `url(${profileCustomization.bannerUrl}) center/cover no-repeat`
                : activeBanner.gradient,
            borderColor: activeBanner.borderTint,
          }}
        >
          <div className="profile-hero-banner__sheen" />
        </div>

        <div className="profile-bento-hero-top">
          {/* 96px Circular Avatar with Laura Mercier Light Struck Aura & Discord Avatar Decoration */}
          <div className="profile-avatar-aura-wrapper">
            <div className="profile-avatar-aura" aria-hidden="true">
              {profileCustomization.avatarUrl ? (
                <img src={profileCustomization.avatarUrl} alt="" className="profile-avatar-aura__img" />
              ) : (
                creator.initials
              )}
            </div>
            <AvatarDecoration decorationId={profileCustomization.avatarDecorationId} size={96} />
          </div>

          <div className="profile-identity-info">
            <div className="profile-identity-name-row">
              <h1>{creator.name}</h1>
              {creator.verified && (
                <span className="profile-verified-badge" title="Verified Tastemaker">
                  <BadgeCheck size={20} aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="profile-identity-sub-row">
              <span className="profile-handle">@{userHandle}</span>
              {profileCustomization.pronouns && (
                <span className="profile-pronouns-tag">{profileCustomization.pronouns}</span>
              )}
            </div>
            <p className="profile-bio">{creator.bio}</p>

            {/* Discord-style Badges Showcase */}
            {profileCustomization.activeBadges.length > 0 && (
              <div className="profile-badges-showcase" aria-label="เหรียญรางวัลของคุณ">
                {profileCustomization.activeBadges.map((badgeId) => {
                  const badge = PROFILE_BADGES_CATALOG.find((b) => b.id === badgeId);
                  if (!badge) return null;
                  return (
                    <span key={badgeId} className="profile-badge-pill" title={badge.description}>
                      {getBadgeIcon(badge.iconKey)}
                      <span>{badge.name}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="profile-action-row">
            {isOwnProfile ? (
              <>
                <button
                  className="profile-btn-primary"
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Edit3 size={15} aria-hidden="true" />
                  <span>ปรับแต่งบัตร / แต่งตัว</span>
                  <span className="sr-only"> (แก้ไขโปรไฟล์)</span>
                </button>
                <button
                  className="profile-btn-secondary"
                  type="button"
                  onClick={handleShareProfile}
                >
                  <Share2 size={15} aria-hidden="true" />
                  <span>แชร์การ์ด</span>
                  <span className="sr-only"> (แชร์โปรไฟล์)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className="profile-btn-primary"
                  type="button"
                  disabled={followPending}
                  aria-busy={followPending || undefined}
                  aria-pressed={following}
                  onClick={() => void toggleFollow()}
                >
                  {following ? <Check size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
                  {following ? "กำลังติดตาม" : "ติดตาม"}
                </button>
                <button
                  className="profile-btn-secondary"
                  type="button"
                  onClick={handleShareProfile}
                >
                  <Share2 size={15} aria-hidden="true" />
                  แชร์โปรไฟล์
                </button>
              </>
            )}
          </div>
        </div>

        {/* Taste Identity Section */}
        <section className="profile-taste-identity" aria-label="Taste Identity">
          {!isOwnProfile && (
            <div className="profile-taste-match-badge">
              <span className="eyebrow">TASTE MATCH MATRIX</span>
              <strong>94%</strong>
              <small>taste match</small>
            </div>
          )}
          <div className="profile-taste-chips">
            <span className="profile-taste-chip">
              <Coffee size={13} aria-hidden="true" />
              Specialty Coffee
            </span>
            <span className="profile-taste-chip">
              <Leaf size={13} aria-hidden="true" />
              Quiet Space
            </span>
            <span className="profile-taste-chip">
              <Palette size={13} aria-hidden="true" />
              Art & Gallery
            </span>
            <span className="profile-taste-chip">
              <Footprints size={13} aria-hidden="true" />
              Walkable City
            </span>
          </div>
          {isOwnProfile && (
            <Link className="profile-taste-link" to="/profile/preferences">
              <span>ปรับแต่ง Taste</span>
              <Edit3 size={12} aria-hidden="true" />
            </Link>
          )}
        </section>
      </header>

      {/* Human Stats Bar (4 metrics in 1 row - numbers only, no unavailable) */}
      <div className="profile-stats-bar" aria-label="สถิติของคุณ">
        <div className="profile-stat-item">
          <span className="profile-stat-item__value">{tracesCount}</span>
          <span className="profile-stat-item__label">Traces</span>
          <small className="profile-stat-item__sub">เส้นทาง</small>
        </div>
        <div className="profile-stat-item">
          <span className="profile-stat-item__value">{followersCount}</span>
          <span className="profile-stat-item__label">Followers</span>
          <small className="profile-stat-item__sub">ผู้ติดตาม</small>
        </div>
        <div className="profile-stat-item">
          <span className="profile-stat-item__value">{remixesCount}</span>
          <span className="profile-stat-item__label">Remixes</span>
          <small className="profile-stat-item__sub">ครั้งที่ถูกรีมิกซ์</small>
        </div>
        <div className="profile-stat-item">
          <span className="profile-stat-item__value">{checkinsCount}</span>
          <span className="profile-stat-item__label">Check-ins</span>
          <small className="profile-stat-item__sub">สถานที่ที่เคยไป</small>
        </div>
      </div>

      {/* Personal Shortcuts Bento Row (for own profile) */}
      {isOwnProfile && (
        <PersonalShortcutsGrid savedPlacesCount={savedPlacesCount} />
      )}

      {notice && (
        <div className="creator-profile-notice" role="status">
          <Check size={15} aria-hidden="true" />
          {notice}
          <button className="icon-button" type="button" aria-label="ปิดข้อความแจ้งเตือน" onClick={() => setNotice("")}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Centered Content Tabs & Feed */}
      <div className={`creator-profile-layout${isDetailActive ? " has-detail" : ""}`}>
        <main className="creator-profile-content" id="creator-content">
          <div className="profile-tabs-centered">
            <GlidingGroup
              items={profileTabs}
              activeId={activeTab}
              onChange={(id) => updateUrl({ tab: id, item: null })}
              ariaLabel="Profile content tabs"
              role="tablist"
            />
          </div>

          {activeTab === "traces" && (
            traces.length > 0 ? (
              <div className="creator-trace-grid">
                {traces.map((trace) => (
                  <TraceCard
                    key={trace.id}
                    trace={trace}
                    saved={isTraceSaved(trace)}
                    onSave={() => saveProfileTrace(trace)}
                    onOpen={() => openTrace(trace)}
                  />
                ))}
              </div>
            ) : (
              <CreatorProfileEmpty tab="traces" isOwnProfile={isOwnProfile} />
            )
          )}

          {activeTab === "posts" && (
            posts.length > 0 ? (
              <div className="creator-post-grid">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    liked={post.liked || likedPostIds.has(post.id)}
                    onLike={() => toggleProfilePostLike(post)}
                    onOpen={() => openPost(post)}
                  />
                ))}
              </div>
            ) : (
              <CreatorProfileEmpty tab="posts" isOwnProfile={isOwnProfile} />
            )
          )}

          {activeTab === "map" && (
            demoMode ? (
              <CreatorMapPanel onNotice={setNotice} />
            ) : (
              <CreatorProfileEmpty tab="map" isOwnProfile={isOwnProfile} />
            )
          )}
        </main>

        {/* Master-Detail Split Pane when active item is selected */}
        {(detailOpen || isClosingDetail) && (activeDetailTrace || activeSelectedPost) && (
          <div className={`creator-profile-inline-detail${isClosingDetail ? " is-closing" : ""}`}>
            {activeDetailTrace ? (
              <ExploreTraceDetail
                trace={activeDetailTrace}
                demoMode={demoMode}
                creatorFollowing={following}
                creatorFollowPending={followPending}
                handlers={profileHandlers}
                onClose={closeDetail}
                onFollowCreator={() => void toggleFollow()}
                onStartJourney={() => navigate(`/map?mode=traces&selected=${encodeURIComponent(activeDetailTrace.slug)}`)}
                onSaveStop={demoMode ? () => setNotice("เซฟจุดแวะไว้แล้ว") : undefined}
                onCommentSubmit={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 220)); } : undefined}
                onCommentEdit={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); } : undefined}
                onCommentDelete={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); } : undefined}
                onFollowCommenter={profileCommenterFollow}
                onOpenMedia={openMedia}
              />
            ) : activeSelectedPost ? (
              <PostInlineDetail
                post={activeSelectedPost}
                demoMode={demoMode}
                liked={activeSelectedPost.liked || likedPostIds.has(activeSelectedPost.id)}
                likeCount={activeSelectedPost.likeCount}
                onClose={closeDetail}
                onOpenMedia={openMedia}
                onLike={() => toggleProfilePostLike(activeSelectedPost)}
                onShare={() => setNotice("คัดลอกบริบทของโพสต์สำหรับแชร์แล้ว")}
                onCommentSubmit={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 220)); } : undefined}
                onCommentEdit={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); } : undefined}
                onCommentDelete={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); } : undefined}
                onFollowCommenter={profileCommenterFollow}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Full-screen Theater Modal */}
      {mediaModalOpen && (modalTrace || selectedPost) && (
        <MediaConversationModal
          trace={modalTrace}
          post={modalTrace ? null : selectedPost}
          demoMode={demoMode}
          creatorFollowing={following}
          creatorFollowPending={followPending}
          onFollowCreator={!isOwnProfile ? () => void toggleFollow() : undefined}
          saved={modalTrace ? isTraceSaved(modalTrace) : undefined}
          onSave={modalTrace ? () => saveProfileTrace(modalTrace) : undefined}
          liked={selectedPost ? selectedPost.liked || likedPostIds.has(selectedPost.id) : undefined}
          likeCount={selectedPost?.likeCount}
          onLike={selectedPost ? () => toggleProfilePostLike(selectedPost) : undefined}
          onStartJourney={modalTrace ? () => navigate(`/map?mode=traces&selected=${encodeURIComponent(modalTrace.slug)}`) : undefined}
          onCommentSubmit={demoMode ? async () => { setNotice("ความคิดเห็นถูกบันทึกใน demo thread แล้ว"); } : undefined}
          onCommentEdit={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); } : undefined}
          onCommentDelete={demoMode ? async () => { await new Promise<void>((resolve) => window.setTimeout(resolve, 160)); } : undefined}
          onFollowCommenter={profileCommenterFollow}
          initialImageIndex={mediaModalIndex}
          onClose={closeMedia}
        />
      )}

      {/* Interactive Discord-style Profile Customizer Modal */}
      {editModalOpen && (
        <ProfileCustomizerModal
          initialData={profileCustomization}
          onSave={(updated) => void handleSaveCustomization(updated)}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}

export default CreatorProfilePage;
