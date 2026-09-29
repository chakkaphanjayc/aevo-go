import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  CalendarClock,
  Check,
  ChevronRight,
  Coffee,
  Compass,
  Laptop,
  Leaf,
  Map,
  MapPin,
  Palette,
  Route,
  Stamp,
  Ticket,
  UserPlus,
  UsersRound,
  Wine,
} from "lucide-react";
import type {
  DiscoveryActionState,
  DiscoveryPlace,
  DiscoveryTrace,
  DiscoveryTracer,
  DiscoveryTracerSummary,
} from "./types";

const areaOptions = [
  {
    value: null,
    label: "ทุกย่าน",
    description: "Bangkok",
    icon: Compass,
  },
  {
    value: "Ari",
    label: "อารีย์",
    description: "Ari",
    icon: Coffee,
  },
  {
    value: "Old Town",
    label: "เจริญกรุง – ตลาดน้อย",
    description: "Old Town",
    icon: Route,
  },
  {
    value: "Thonglor",
    label: "ทองหล่อ – เอกมัย",
    description: "Thonglor",
    icon: MapPin,
  },
  {
    value: "Sathorn",
    label: "สาทร / พระนคร",
    description: "Sathorn",
    icon: Map,
  },
] as const;

const vibeOptions = [
  { value: "slow-bar", label: "Slow Bar", icon: Coffee },
  { value: "quiet", label: "Quiet Space", icon: Leaf },
  { value: "art", label: "Art & Gallery", icon: Palette },
  { value: "work", label: "Work-friendly", icon: Laptop },
  { value: "speakeasy", label: "Speakeasy", icon: Wine },
] as const;

export interface ExploreContextSidebarProps {
  activeArea: string;
  activeVibe: string;
  demoMode: boolean;
  onAreaChange: (value: string | null) => void;
  onVibeChange: (value: string | null) => void;
}

export interface ExploreInsightsSidebarProps {
  demoMode: boolean;
  selectedTrace: DiscoveryTrace | null;
  fallbackTrace: DiscoveryTrace | null;
  partnerPlaces: readonly DiscoveryPlace[];
  trendingTracers: readonly DiscoveryTracer[];
  creatorFollowing: (profile: DiscoveryTracerSummary) => boolean;
  creatorFollowState?: (
    profile: DiscoveryTracerSummary,
  ) => DiscoveryActionState | undefined;
  onCreatorFollow?: (profile: DiscoveryTracerSummary) => void;
}

function SidebarCardHeading({
  eyebrow,
  title,
  icon,
}: {
  eyebrow: string;
  title: string;
  icon: typeof Compass;
}) {
  const Icon = icon;
  return (
    <div className="explore-sidebar-card__heading">
      <div>
        <p className="explore-sidebar__eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <Icon size={17} aria-hidden="true" />
    </div>
  );
}

export function ExploreContextSidebar({
  activeArea,
  activeVibe,
  demoMode,
  onAreaChange,
  onVibeChange,
}: ExploreContextSidebarProps) {
  return (
    <aside
      className="explore-context-sidebar"
      aria-label="บริบทและทางลัดการค้นหา"
    >
      <div className="explore-sidebar__stack">
        <section className="explore-sidebar-card">
          <SidebarCardHeading
            eyebrow="DISCOVERY CONTEXT"
            title="สำรวจตามจังหวะของคุณ"
            icon={Compass}
          />
          <div className="explore-sidebar__options" role="group" aria-label="เลือกย่าน">
            {areaOptions.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === null
                ? activeArea.length === 0
                : activeArea === option.value;
              return (
                <button
                  key={option.description}
                  className={`explore-sidebar-option${isActive ? " is-active" : ""}`}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onAreaChange(option.value)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="explore-sidebar-option__copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  {isActive && <Check size={15} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="explore-sidebar-card">
          <SidebarCardHeading
            eyebrow="VIBE & MOOD"
            title="อยากได้บรรยากาศแบบไหน"
            icon={Leaf}
          />
          <div className="explore-sidebar-chips" role="group" aria-label="เลือก vibe">
            {vibeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeVibe === option.value;
              return (
                <button
                  key={option.value}
                  className={`explore-sidebar-chip${isActive ? " is-active" : ""}`}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onVibeChange(isActive ? null : option.value)}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          {activeVibe === "match" && (
            <button
              className="text-link text-link--button explore-sidebar__clear"
              type="button"
              onClick={() => onVibeChange(null)}
            >
              ล้าง Taste match
            </button>
          )}
          <p className="explore-sidebar-note">
            {demoMode
              ? "ตัวอย่างข้อมูลในเครื่องสำหรับทดสอบตัวกรอง"
              : "ตัวกรองจะทำงานตาม facet ที่ Gateway ส่งกลับมา"}
          </p>
        </section>

        <section className="explore-sidebar-card">
          <SidebarCardHeading
            eyebrow="MY SHORTCUTS"
            title="กลับไปต่อจากที่ค้างไว้"
            icon={Bookmark}
          />
          <nav className="explore-sidebar-shortcuts" aria-label="ทางลัดส่วนตัว">
            <Link className="explore-sidebar-shortcut" to="/saved?tab=traces">
              <Bookmark size={16} aria-hidden="true" />
              <span>เส้นทางที่ Trace It ไว้ล่าสุด</span>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
            <Link className="explore-sidebar-shortcut" to="/traces?mode=drafts">
              <CalendarClock size={16} aria-hidden="true" />
              <span>Draft Trace ของฉัน</span>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
            <Link className="explore-sidebar-shortcut" to="/activity?filter=checkins">
              <Stamp size={16} aria-hidden="true" />
              <span>ประวัติการเช็คอินและแสตมป์</span>
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </section>
      </div>
    </aside>
  );
}

const mapPinPositions = [
  { left: "17%", top: "68%" },
  { left: "36%", top: "48%" },
  { left: "54%", top: "61%" },
  { left: "72%", top: "35%" },
  { left: "84%", top: "22%" },
] as const;

function MiniMapPreview({
  demoMode,
  trace,
}: {
  demoMode: boolean;
  trace: DiscoveryTrace | null;
}) {
  const stopCount = trace
    ? Math.min(Math.max(trace.stopCount, 1), mapPinPositions.length)
    : 0;

  return (
    <section className="explore-sidebar-card explore-sidebar-card--map">
      <SidebarCardHeading
        eyebrow="SPATIAL CONTEXT"
        title="Trace ที่กำลังถูกดู"
        icon={Map}
      />
      {trace && demoMode ? (
        <div
          className="explore-sidebar-map"
          aria-label={`แผนที่ตัวอย่าง ${trace.title}`}
        >
          <span className="explore-sidebar-map__label">DEMO ROUTE PREVIEW</span>
          <span className="explore-sidebar-map__area">{trace.area}</span>
          <span className="explore-sidebar-map__line explore-sidebar-map__line--one" />
          <span className="explore-sidebar-map__line explore-sidebar-map__line--two" />
          <span className="explore-sidebar-map__line explore-sidebar-map__line--three" />
          {mapPinPositions.slice(0, stopCount).map((position, index) => (
            <span
              key={`${trace.id}-pin-${index + 1}`}
              className="explore-sidebar-map__pin"
              style={position}
              aria-hidden="true"
            >
              {index + 1}
            </span>
          ))}
          <div className="explore-sidebar-map__footer">
            <span>{trace.stopCount} จุดแวะ</span>
            <span>{trace.distanceKm ? `${trace.distanceKm} km` : "ระยะทางยังไม่พร้อม"}</span>
          </div>
        </div>
      ) : (
        <div className="explore-sidebar-map explore-sidebar-map--empty">
          <MapPin size={20} aria-hidden="true" />
          <span>
            {trace
              ? "พิกัดเส้นทางจะแสดงเมื่อมี route projection"
              : "เลือก Trace เพื่อดูจุดแวะบนแผนที่"}
          </span>
        </div>
      )}
      <div className="explore-sidebar-card__footer">
        <span className="muted-label">
          {trace ? `${trace.title} · ${trace.area}` : "ยังไม่มี Trace ที่เลือก"}
        </span>
        <Link
          className="button button--ghost explore-sidebar__wide-button"
          to={trace ? `/map?mode=traces&trace=${encodeURIComponent(trace.slug)}` : "/map"}
        >
          <Map size={15} aria-hidden="true" />
          <span>ขยายดูบน Trace Map</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function BookablePanel({
  places,
}: {
  places: readonly DiscoveryPlace[];
}) {
  return (
    <section className="explore-sidebar-card">
      <SidebarCardHeading
        eyebrow="AEVO PLAY"
        title="ร้านที่เปิดรับจอง"
        icon={Ticket}
      />
      {places.length > 0 ? (
        <div className="explore-sidebar-place-list explore-sidebar-place-list--scroll" role="list" aria-label="ร้านที่เปิดรับจองผ่าน Aevo Play">
          {places.slice(0, 2).map((place) => (
            <article className="explore-sidebar-place" key={place.id} role="listitem">
              <div className="explore-sidebar-place__row">
                {place.imageUrl ? (
                  <img
                    className="explore-sidebar-place__image"
                    src={place.imageUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="explore-sidebar-place__image explore-sidebar-place__image--fallback" aria-hidden="true">
                    <MapPin size={17} />
                  </span>
                )}
                <div className="explore-sidebar-place__copy">
                  <strong>{place.name}</strong>
                  <span>{place.category} · {place.area}</span>
                  <small>{place.priceLabel}</small>
                </div>
              </div>
              <div className="explore-sidebar-place__meta">
                <span className={place.openNow === true ? "is-open" : ""}>
                  {place.openNow === true
                    ? "เปิดอยู่"
                    : place.openNow === false
                      ? "ปิดอยู่"
                      : "ตรวจเวลาใน Aevo Play"}
                </span>
                <Link
                  className="explore-sidebar-place__cta"
                  to={`/stores/${encodeURIComponent(place.slug)}/booking`}
                >
                  <span>จองสิทธิ์</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="explore-sidebar-empty">
          <Ticket size={18} aria-hidden="true" />
          <span>ยังไม่มีสถานที่ที่ส่งสถานะการจองมาในบริบทนี้</span>
        </div>
      )}
    </section>
  );
}

function TrendingTracersPanel({
  tracers,
  creatorFollowing,
  creatorFollowState,
  onCreatorFollow,
}: {
  tracers: readonly DiscoveryTracer[];
  creatorFollowing: (profile: DiscoveryTracerSummary) => boolean;
  creatorFollowState?: (
    profile: DiscoveryTracerSummary,
  ) => DiscoveryActionState | undefined;
  onCreatorFollow?: (profile: DiscoveryTracerSummary) => void;
}) {
  return (
    <section className="explore-sidebar-card">
      <SidebarCardHeading
        eyebrow="TRENDING TRACERS"
        title="ผู้สร้างที่น่าติดตาม"
        icon={UsersRound}
      />
      {tracers.length > 0 ? (
        <div className="explore-sidebar-tracer-list">
          {tracers.slice(0, 3).map((item) => {
            const following = creatorFollowing(item.tracer);
            const followState = creatorFollowState?.(item.tracer);
            return (
              <article className="explore-sidebar-tracer" key={item.id}>
                <span className="explore-sidebar-avatar" aria-hidden="true">
                  {item.tracer.initials}
                </span>
                <div className="explore-sidebar-tracer__copy">
                  <strong>{item.tracer.name}</strong>
                  <span>{item.tracer.area} · {item.tracer.expertise.slice(0, 2).join(" · ")}</span>
                  <small>Taste match · {item.tasteMatchLabel}</small>
                  <Link to={`/?selected=${encodeURIComponent(item.featuredTrace.slug)}`}>
                    ดู Trace เด่น
                  </Link>
                </div>
                <button
                  className={`icon-button icon-button--small explore-sidebar-tracer__follow${following ? " is-following" : ""}`}
                  type="button"
                  aria-label={following ? `เลิกติดตาม ${item.tracer.name}` : `ติดตาม ${item.tracer.name}`}
                  aria-pressed={following}
                  aria-busy={followState?.pending === true}
                  disabled={!onCreatorFollow || followState?.pending === true}
                  onClick={() => onCreatorFollow?.(item.tracer)}
                >
                  {following ? <Check size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="explore-sidebar-empty">
          <UsersRound size={18} aria-hidden="true" />
          <span>ยังไม่มีคำแนะนำผู้สร้างจาก Gateway</span>
        </div>
      )}
    </section>
  );
}

function CommunityPulse({
  demoMode,
  trace,
}: {
  demoMode: boolean;
  trace: DiscoveryTrace | null;
}) {
  const pulseItems = trace
    ? [
        {
          icon: Route,
          text: `${trace.completionCount} คนทำ Trace นี้จบครบทุกจุด`,
        },
        {
          icon: UsersRound,
          text: `${trace.remixCount} Remix จากชุมชนกำลังถูกดูต่อ`,
        },
        {
          icon: Bookmark,
          text: `${trace.followerCount} คนบันทึกเส้นทางนี้ไว้`,
        },
      ]
    : [];

  return (
    <section className="explore-sidebar-card">
      <SidebarCardHeading
        eyebrow="COMMUNITY PULSE"
        title="จังหวะจากชุมชน"
        icon={UsersRound}
      />
      {demoMode && pulseItems.length > 0 ? (
        <div className="explore-sidebar-pulse-list">
          {pulseItems.map((pulse, index) => {
            const Icon = pulse.icon;
            return (
              <div className="explore-sidebar-pulse" key={`${trace?.id ?? "trace"}-pulse-${index}`}>
                <Icon size={16} aria-hidden="true" />
                <span>{pulse.text}</span>
              </div>
            );
          })}
          <p className="explore-sidebar-note">ตัวอย่าง activity จากข้อมูลในเครื่อง</p>
        </div>
      ) : (
        <div className="explore-sidebar-empty">
          <UsersRound size={18} aria-hidden="true" />
          <span>Community activity จะแสดงเมื่อมี event จาก Gateway</span>
        </div>
      )}
    </section>
  );
}

export function ExploreInsightsSidebar({
  demoMode,
  selectedTrace,
  fallbackTrace,
  partnerPlaces,
  trendingTracers,
  creatorFollowing,
  creatorFollowState,
  onCreatorFollow,
}: ExploreInsightsSidebarProps) {
  const mapTrace = selectedTrace ?? fallbackTrace;
  return (
    <aside
      className="explore-insights-sidebar"
      aria-label="ข้อมูลเชิงพื้นที่และกิจกรรมชุมชน"
    >
      <div className="explore-sidebar__stack">
        <MiniMapPreview demoMode={demoMode} trace={mapTrace} />
        <BookablePanel places={partnerPlaces} />
        {demoMode && (
          <TrendingTracersPanel
            tracers={trendingTracers}
            creatorFollowing={creatorFollowing}
            creatorFollowState={creatorFollowState}
            onCreatorFollow={onCreatorFollow}
          />
        )}
        <CommunityPulse demoMode={demoMode} trace={mapTrace} />
      </div>
    </aside>
  );
}
