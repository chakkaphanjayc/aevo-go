import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Award,
  BadgePercent,
  CalendarDays,
  ChevronDown,
  Clock,
  Coffee,
  Compass,
  Footprints,
  MapPin,
  Navigation,
  Palette,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  Ticket,
  Users,
  Utensils,
  Wine,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { GlidingGroup, type GlidingGroupItem } from "@/components/gliding-group";
import type { DiscoveryPlace } from "./types";
import {
  getCurrentTimeSlot,
  searchSmartTrace,
  swapTraceWaypoint,
  reorderTraceWaypoints,
} from "@/lib/search-trace-service";
import type { SearchTraceResponse, TraceWaypoint } from "@/contracts/search";

export const portalCategories = [
  { id: "all", label: "ทั้งหมด", icon: Compass },
  { id: "cafe", label: "คาเฟ่ & Slow Bar", icon: Coffee },
  { id: "dining", label: "ร้านอาหาร", icon: Utensils },
  { id: "trace", label: "Trace เส้นทาง", icon: Route },
  { id: "bar", label: "บาร์", icon: Wine },
  { id: "activities", label: "เวิร์กช็อป", icon: Palette },
  { id: "play", label: "จองด่วน Aevo Play", icon: Zap },
] as const;

export type ExplorePortalCategory = (typeof portalCategories)[number]["id"];

const portalCategoryIds = new Set<ExplorePortalCategory>(
  portalCategories.map((category) => category.id),
);

export function parseExplorePortalCategory(value: string | null): ExplorePortalCategory {
  return value && portalCategoryIds.has(value as ExplorePortalCategory)
    ? (value as ExplorePortalCategory)
    : "all";
}

const areaOptions = [
  "Bangkok",
  "Ari",
  "Thonglor",
  "Sathorn",
  "Charoenkrung",
  "Talat Noi",
  "Siam",
  "Yaowarat",
  "Old Town",
] as const;

const partyOptions = ["1", "2", "3", "4", "5", "6+"] as const;

const vouchers = [
  {
    id: "new-user",
    eyebrow: "WELCOME",
    title: "ผู้ใช้ใหม่รับส่วนลด 15%",
    description: "เมื่อจองร้านอาหารผ่าน Aevo Play ครั้งแรก",
    action: "เข้าสู่ระบบเพื่อรับสิทธิ์",
  },
  {
    id: "welcome-drink",
    eyebrow: "TRACE PERK",
    title: "ฟรี Welcome Drink",
    description: "ที่ร้านกาแฟพาร์ทเนอร์ใน Trace เจริญกรุง",
    action: "กดรับสิทธิ์",
  },
  {
    id: "fast-pass",
    eyebrow: "FAST PASS",
    title: "จองโต๊ะล่วงหน้า",
    description: "ลดเวลารอคิวสำหรับร้านยอดนิยมที่ร่วมรายการ",
    action: "ดูรายละเอียดสิทธิ์",
  },
] as const;

export interface ExploreBookingPortalProps {
  activeCategory: ExplorePortalCategory;
  area: string;
  date: string;
  demoMode: boolean;
  heroImageUrl: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  partnerPlaces: readonly DiscoveryPlace[];
  partySize: string;
  query: string;
  promoOpen: boolean;
  onAreaChange: (value: string) => void;
  onBookingSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCategoryChange: (category: ExplorePortalCategory) => void;
  onDateChange: (value: string) => void;
  onDismissPromo: () => void;
  onNotify: (message: string) => void;
  onPartySizeChange: (value: string) => void;
  onQueryChange: (value: string) => void;
}

function CategoryLabel({
  icon: Icon,
  label,
}: {
  icon: (typeof portalCategories)[number]["icon"];
  label: string;
}) {
  return (
    <span className="explore-portal__category-label">
      <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function PortalField({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <label className="explore-portal__field">
      <span className="explore-portal__field-label">
        {icon}
        <span>{label}</span>
      </span>
      {children}
    </label>
  );
}

function PartnerPlaceCard({
  date,
  partySize,
  place,
}: {
  date: string;
  partySize: string;
  place: DiscoveryPlace;
}) {
  const bookingQuery = new URLSearchParams();
  if (date) bookingQuery.set("date", date);
  if (partySize) bookingQuery.set("party", partySize);
  const bookingHref = `/stores/${place.slug}/booking${bookingQuery.toString() ? `?${bookingQuery.toString()}` : ""}`;
  const initials = place.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3);

  return (
    <article className="explore-portal__partner-card" role="listitem">
      <div className="explore-portal__partner-visual">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
        <span className="explore-portal__partner-tag">
          <Zap size={12} aria-hidden="true" />
          Aevo Play
        </span>
      </div>
      <div className="explore-portal__partner-body">
        <div className="explore-portal__partner-heading">
          <div>
            <h3>{place.name}</h3>
            <p>
              {place.category} · {place.area} · {place.priceLabel}
            </p>
          </div>
          <span className="explore-portal__partner-open">
            {place.openNow === true ? "เปิดอยู่" : "ดูเวลา"}
          </span>
        </div>
        <p className="explore-portal__partner-copy">{place.description}</p>
        <Link className="button button--white-prismatic explore-portal__partner-cta" to={bookingHref}>
          <Zap size={15} aria-hidden="true" />
          จองสิทธิ์
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function ExploreBookingPortal({
  activeCategory,
  area,
  date,
  demoMode,
  heroImageUrl,
  inputRef,
  partnerPlaces,
  partySize,
  query,
  promoOpen,
  onAreaChange,
  onBookingSubmit,
  onCategoryChange,
  onDateChange,
  onDismissPromo,
  onNotify,
  onPartySizeChange,
  onQueryChange,
}: ExploreBookingPortalProps) {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState<"smart_trace" | "custom_booking">("smart_trace");
  const [activeTrace, setActiveTrace] = useState<SearchTraceResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);

  const currentSlot = useMemo(() => getCurrentTimeSlot(), []);

  const defaultLocation = useMemo(
    () => ({ lat: 13.7797, lng: 100.5447, accuracy_meters: 10 }),
    []
  );

  // Debounced search trace synthesis when query updates
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setActiveTrace(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchSmartTrace({
          query: trimmed,
          user_location: defaultLocation,
        });
        setActiveTrace(result);
      } catch (err) {
        console.error("Explore trace search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, defaultLocation]);

  const handleSelectPrompt = (promptText: string) => {
    onQueryChange(promptText);
    inputRef.current?.focus();
  };

  const handleAroundMe = () => {
    const prompt = "รอบตัวฉันตอนนี้ ในระยะ 500ม. คาเฟ่และร้านอาหารจานด่วน";
    onQueryChange(prompt);
  };

  const handleSwapNode = (index: number) => {
    if (!activeTrace) return;
    const currentWaypoint = activeTrace.waypoints[index];
    const updated = swapTraceWaypoint(activeTrace, index);
    setActiveTrace(updated);
    setSwapFeedback(
      `สลับเป็น ${updated.waypoints[index].name} (แทน ${currentWaypoint.name})`
    );
    window.setTimeout(() => setSwapFeedback(null), 3000);
  };

  const handleReorder = () => {
    if (!activeTrace || activeTrace.waypoints.length < 2) return;
    const updated = reorderTraceWaypoints(activeTrace, 0, 1);
    setActiveTrace(updated);
    setSwapFeedback("สลับลำดับการเดินทางแล้ว");
    window.setTimeout(() => setSwapFeedback(null), 2500);
  };

  const handleStartWalk = (trace: SearchTraceResponse) => {
    navigate(
      `/map?mode=traces&trace_id=${encodeURIComponent(trace.trace_id)}&title=${encodeURIComponent(trace.title)}`
    );
  };

  const categoryItems: readonly GlidingGroupItem[] = portalCategories.map(
    ({ id, label, icon: Icon }) => ({
      id,
      label: <CategoryLabel icon={Icon} label={label} />,
    }),
  );

  return (
    <div className="explore-portal">
      {/* =========================================================================
          HERO SECTION: SMART SPATIAL SEARCH & TRACE DISCOVERY ENGINE
         ========================================================================= */}
      <section className="explore-portal__booking-card explore-portal__booking-card--smart" aria-labelledby="booking-card-title">
        <div className="explore-portal__booking-heading">
          <div>
            <div className="explore-portal__eyebrow-row">
              <span className="eyebrow">AEVO GO SPATIAL DISCOVERY</span>
              <span className="explore-portal__live-pill">
                <span className="explore-portal__live-dot" aria-hidden="true" />
                Zero-Friction Trace Engine
              </span>
            </div>
            <h1 id="booking-card-title">ค้นพบเส้นทางและร้านค้าแบบต่อเนื่อง</h1>
          </div>

          {/* Mode Switcher: Smart Trace Discovery vs Custom Booking Parameters */}
          <div className="explore-portal__mode-toggle" role="group" aria-label="โหมดการค้นหา">
            <button
              type="button"
              className={`explore-portal__mode-btn${searchMode === "smart_trace" ? " is-active" : ""}`}
              onClick={() => setSearchMode("smart_trace")}
            >
              <Compass size={14} aria-hidden="true" />
              <span>Smart Trace Routing</span>
            </button>
            <button
              type="button"
              className={`explore-portal__mode-btn${searchMode === "custom_booking" ? " is-active" : ""}`}
              onClick={() => setSearchMode("custom_booking")}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Custom Parameters</span>
            </button>
          </div>
        </div>

        {/* Category Filter Glider */}
        <div className="explore-portal__category-scroll">
          <GlidingGroup
            items={categoryItems}
            activeId={activeCategory}
            ariaLabel="ประเภทการค้นหาและจอง"
            role="tablist"
            size="small"
            className="explore-portal__categories"
            onChange={(id) => onCategoryChange(parseExplorePortalCategory(id))}
          />
        </div>

        {/* =========================================================================
            PRIMARY SMART SEARCH OMNI-BAR
           ========================================================================= */}
        <div className="explore-portal__smart-bar-wrapper">
          <div className="explore-portal__smart-input-box">
            <div className="explore-portal__smart-icon">
              {isSearching ? (
                <RefreshCw size={19} className="smart-omni-spinner" aria-hidden="true" />
              ) : (
                <Search size={19} aria-hidden="true" />
              )}
            </div>
            <input
              ref={inputRef}
              type="search"
              className="explore-portal__smart-input"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="ค้นหาเส้นทาง เช่น 'หาร้านกาแฟเงียบๆ ไว้นั่งทำงาน แล้วต่อด้วยมื้อเที่ยงแถวอารีย์'..."
              aria-label="ค้นหาเส้นทางและร้านค้าแบบชาญฉลาด"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                className="explore-portal__smart-clear"
                aria-label="ล้างคำค้นหา"
                onClick={() => {
                  onQueryChange("");
                  inputRef.current?.focus();
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="explore-portal__smart-cta"
              onClick={() => {
                if (activeTrace) {
                  handleStartWalk(activeTrace);
                } else if (query.trim()) {
                  navigate(`/map?mode=traces&q=${encodeURIComponent(query.trim())}`);
                } else {
                  handleAroundMe();
                }
              }}
            >
              <Navigation size={15} aria-hidden="true" />
              <span>เปิด Trace Map</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Quick Feedback Toast for Node Swapping */}
          {swapFeedback && (
            <div className="explore-portal__toast" role="status">
              <Sparkles size={14} className="text-sky-200" aria-hidden="true" />
              <span>{swapFeedback}</span>
            </div>
          )}
        </div>

        {/* =========================================================================
            SMART TRACE MODE CONTENT: ZERO-STATE & ACTIVE-STATE PROJECTION
           ========================================================================= */}
        {searchMode === "smart_trace" && (
          <div className="explore-portal__trace-container">
            {/* ZERO-STATE: Shown when query is empty */}
            {!query.trim() && (
              <div className="explore-portal__zero-state">
                {/* Around Me Right Now Quick Button */}
                <div className="explore-portal__around-me-wrapper">
                  <button
                    type="button"
                    className="explore-portal__around-me-card"
                    onClick={handleAroundMe}
                  >
                    <div className="explore-portal__around-me-content">
                      <div className="explore-portal__around-me-icon">
                        <Compass size={18} aria-hidden="true" />
                      </div>
                      <div>
                        <strong>รอบตัวฉันตอนนี้</strong>
                        <p>ค้นหาและร้อยเรียงเส้นทางจากพิกัด GPS อัตโนมัติ</p>
                      </div>
                    </div>
                    <span className="explore-portal__badge-walk">
                      <Footprints size={13} aria-hidden="true" />
                      รัศมี 500 ม. · เดิน 5-7 นาที
                    </span>
                  </button>
                </div>

                {/* Time-of-Day Contextual Slot Nudge */}
                <div className="explore-portal__slot-section">
                  <div className="explore-portal__slot-header">
                    <span className="explore-portal__slot-badge">
                      {currentSlot.slot_id === "morning_rush" && <Coffee size={14} />}
                      {currentSlot.slot_id === "lunch_dining" && <Utensils size={14} />}
                      {currentSlot.slot_id === "afternoon_focus" && <Sparkles size={14} />}
                      {currentSlot.slot_id === "nightlife_hop" && <Wine size={14} />}
                      <span>{currentSlot.label} ({currentSlot.time_range})</span>
                    </span>
                    <span className="explore-portal__slot-hint">ซิงก์จาก Local Admin Control</span>
                  </div>

                  <div className="explore-portal__prompt-grid">
                    {currentSlot.recommended_prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="explore-portal__prompt-chip"
                        onClick={() => handleSelectPrompt(prompt)}
                      >
                        <Sparkles size={14} className="text-amber-200 shrink-0" aria-hidden="true" />
                        <span>{prompt}</span>
                        <ArrowRight size={13} className="text-zinc-500 ml-auto" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Curated Traces Fast Shortcuts */}
                <div className="explore-portal__curated-section">
                  <span className="explore-portal__curated-heading">เส้นทางแนะนำพิเศษพร้อมสิทธิประโยชน์ Aevo Play:</span>
                  <div className="explore-portal__curated-row">
                    <button
                      type="button"
                      className="explore-portal__curated-chip"
                      onClick={() => handleSelectPrompt("กาแฟ Slow bar เงียบสงบ อารีย์ ต่อมื้อเที่ยง")}
                    >
                      <Coffee size={13} aria-hidden="true" />
                      Ari Slow Work Trace
                    </button>
                    <button
                      type="button"
                      className="explore-portal__curated-chip"
                      onClick={() => handleSelectPrompt("คราฟต์เบียร์บาร์ และไวน์บาร์ไฟสลัว ทองหล่อ")}
                    >
                      <Wine size={13} aria-hidden="true" />
                      Thonglor Evening Hop
                    </button>
                    <button
                      type="button"
                      className="explore-portal__curated-chip"
                      onClick={() => handleSelectPrompt("กาแฟคั่ว เจริญกรุง ตลาดน้อย เดินชมอาร์ต")}
                    >
                      <Compass size={13} aria-hidden="true" />
                      Talat Noi Art Walk
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVE-STATE: Synthesized Trace Route Card + Fluid Timeline Pathway */}
            {query.trim() && activeTrace && (
              <div className="explore-portal__active-trace">
                <div className="explore-portal__trace-card">
                  <div className="explore-portal__trace-header">
                    <div>
                      <span className="smart-omni-trace-type-badge">
                        <Navigation size={12} aria-hidden="true" />
                        SYNTHESIZED TRACE ROUTE BUNDLE
                      </span>
                      <h2 className="explore-portal__trace-title">{activeTrace.title}</h2>
                      <p className="explore-portal__trace-summary">{activeTrace.summary}</p>
                    </div>
                  </div>

                  {/* Trace Metrics */}
                  <div className="smart-omni-trace-metrics">
                    <div className="smart-omni-metric-item">
                      <MapPin size={14} className="text-sky-200" aria-hidden="true" />
                      <span>{activeTrace.waypoints.length} จุดแวะต่อเนื่อง</span>
                    </div>
                    <div className="smart-omni-metric-dot" />
                    <div className="smart-omni-metric-item">
                      <Footprints size={14} className="text-blue-400" aria-hidden="true" />
                      <span>{activeTrace.total_distance_meters} ม.</span>
                    </div>
                    <div className="smart-omni-metric-dot" />
                    <div className="smart-omni-metric-item">
                      <Clock size={14} className="text-amber-400" aria-hidden="true" />
                      <span>เดินรวม ~{activeTrace.estimated_walking_mins} นาที</span>
                    </div>
                  </div>

                  {/* 4-Axis Parsed Intent Breakdown */}
                  {activeTrace.parsed_intent && (
                    <div className="smart-omni-intent-pills">
                      <span className="smart-omni-intent-label">Parsed Vector:</span>
                      {activeTrace.parsed_intent.mood_atmosphere.map((tag) => (
                        <span key={tag} className="smart-omni-vibe-pill">
                          #{tag}
                        </span>
                      ))}
                      <span className="smart-omni-spatio-pill">
                        {activeTrace.parsed_intent.spatio_temporal}
                      </span>
                    </div>
                  )}

                  {/* Fluid Timeline Pathway */}
                  <div className="smart-omni-timeline">
                    {/* Start Node */}
                    <div className="smart-omni-timeline-node smart-omni-timeline-start">
                      <div className="smart-omni-node-marker smart-omni-node-start">
                        <MapPin size={13} aria-hidden="true" />
                      </div>
                      <div className="smart-omni-node-body">
                        <strong>จุดเริ่มต้น: พิกัดรอบตัวคุณ (BTS อารีย์)</strong>
                        <small>เริ่มก้าวเดินจากจุดปัจจุบัน ไม่เดินวนกลับทางเดิม</small>
                      </div>
                    </div>

                    {/* Waypoint Nodes */}
                    {activeTrace.waypoints.map((wp: TraceWaypoint, idx: number) => (
                      <div key={wp.place_id || idx} className="smart-omni-node-group">
                        <div className="smart-omni-hop-connector">
                          <div className="smart-omni-hop-line" />
                          <span className="smart-omni-hop-badge">
                            <Footprints size={11} aria-hidden="true" />
                            เดิน {idx === 0 ? "350 ม. · 4 นาที" : `${wp.walk_to_next ? wp.walk_to_next.distance_meters : 450} ม. · ${wp.walk_to_next ? wp.walk_to_next.mins : 6} นาที`}
                          </span>
                          <div className="smart-omni-hop-line" />
                        </div>

                        <div className="smart-omni-timeline-node">
                          <div className="smart-omni-node-marker">
                            <span>{wp.step}</span>
                          </div>
                          <div className="smart-omni-waypoint-card">
                            <div className="smart-omni-waypoint-main">
                              <div className="smart-omni-waypoint-info">
                                <div className="smart-omni-waypoint-title-row">
                                  <h4 className="smart-omni-waypoint-name">{wp.name}</h4>
                                  <span className="smart-omni-category-tag">{wp.category}</span>
                                </div>
                                <div className="smart-omni-vibe-matches">
                                  {wp.vibe_matches.map((vibe) => (
                                    <span key={vibe} className="smart-omni-vibe-match">
                                      ✓ {vibe}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <button
                                type="button"
                                className="smart-omni-action-btn"
                                title="สุ่มเปลี่ยนจุดนี้เป็นร้านอื่นที่เข้ากัน"
                                aria-label={`สุ่มเปลี่ยนจุดที่ ${wp.step}: ${wp.name}`}
                                onClick={() => handleSwapNode(idx)}
                              >
                                <RefreshCw size={13} aria-hidden="true" />
                                <span>สลับร้านนี้</span>
                              </button>
                            </div>

                            {wp.aevo_perk && (
                              <div className="smart-omni-perk-row">
                                <span className={`smart-omni-perk-badge smart-omni-perk--${wp.aevo_perk.type}`}>
                                  {wp.aevo_perk.type === "fast_pass" ? (
                                    <Zap size={12} aria-hidden="true" />
                                  ) : (
                                    <Award size={12} aria-hidden="true" />
                                  )}
                                  {wp.aevo_perk.label}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions Bar */}
                  <div className="smart-omni-controls-bar">
                    <button
                      type="button"
                      className="smart-omni-btn-secondary"
                      onClick={handleReorder}
                    >
                      <ArrowUpDown size={14} aria-hidden="true" />
                      <span>สลับลำดับการเดิน</span>
                    </button>

                    <button
                      type="button"
                      className="smart-omni-btn-primary"
                      onClick={() => handleStartWalk(activeTrace)}
                    >
                      <Navigation size={15} aria-hidden="true" />
                      <span>เริ่มเดินจริงบน Trace Map</span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            CUSTOM BOOKING PARAMETERS (DATE / PARTY SIZE / AREA FORM)
           ========================================================================= */}
        {searchMode === "custom_booking" && (
          <form className="explore-portal__booking-form" onSubmit={onBookingSubmit}>
            <PortalField icon={<MapPin size={16} aria-hidden="true" />} label="ไปย่านไหนดี?">
              <span className="explore-portal__select-wrap">
                <select
                  value={area || "Bangkok"}
                  onChange={(event) => onAreaChange(event.target.value)}
                  aria-label="เลือกพื้นที่"
                >
                  {areaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </PortalField>
            <PortalField icon={<CalendarDays size={16} aria-hidden="true" />} label="วันและเวลา">
              <input
                type="date"
                value={date}
                onChange={(event) => onDateChange(event.target.value)}
                aria-label="เลือกวันที่เดินทาง"
              />
            </PortalField>
            <PortalField icon={<Users size={16} aria-hidden="true" />} label="จำนวนคน">
              <span className="explore-portal__select-wrap">
                <select
                  value={partySize || "2"}
                  onChange={(event) => onPartySizeChange(event.target.value)}
                  aria-label="เลือกจำนวนคน"
                >
                  {partyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "6+" ? "6 คนขึ้นไป" : `${option} คน`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </PortalField>
            <PortalField icon={<Search size={16} aria-hidden="true" />} label="ค้นหาสิ่งที่อยากทำ">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="ร้าน, Trace หรือย่าน"
                aria-label="ค้นหาร้าน Trace หรือย่าน"
              />
            </PortalField>
            <button className="button button--white-prismatic explore-portal__search-button" type="submit">
              <Search size={17} aria-hidden="true" />
              <span>ค้นหา &amp; จอง</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        )}

        <p className="explore-portal__booking-note">
          <span className="explore-portal__booking-note-dot" aria-hidden="true" />
          {searchMode === "smart_trace"
            ? "Trace Route คำนวณแบบ Real-time ตามระยะก้าวเดินจริงและหลีกเลี่ยงการเดินวนกลับทางเดิม"
            : "ข้อมูลราคา เวลาเปิด และที่ว่างจะยืนยันอีกครั้งจาก server ก่อนทำรายการ"}
        </p>
      </section>

      {/* <section className="explore-portal__hero" aria-label="ภาพบรรยากาศกรุงเทพฯ">
        <div className="explore-portal__hero-media">
          {heroImageUrl ? (
            <img
              className="explore-portal__hero-image"
              src={heroImageUrl}
              alt=""
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="explore-portal__hero-fallback" aria-hidden="true">
              <Compass size={118} strokeWidth={0.8} />
            </div>
          )}
          <div className="explore-portal__hero-scrim" aria-hidden="true" />
          {promoOpen && (
            <aside className="explore-portal__promo" aria-label="โปรโมชัน Aevo Play">
              <div className="explore-portal__promo-icon" aria-hidden="true">
                <BadgePercent size={18} />
              </div>
              <div>
                <strong>ล็อกอินเพื่อรับสิทธิ์จาก Aevo Play</strong>
                <p>ตรวจสอบแคมเปญที่ใช้ได้กับบัญชีของคุณก่อนจอง</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="ปิดโปรโมชัน"
                onClick={onDismissPromo}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </aside>
          )}
        </div>
      </section> */}

      <section className="explore-portal__section" aria-labelledby="privileges-title">
        <div className="explore-portal__section-heading">
          <div>
            <p className="eyebrow">AEVO PLAY PRIVILEGES</p>
            <h2 id="privileges-title">สิทธิพิเศษและสิทธิ์การจองสำหรับคุณ</h2>
          </div>
          <span className="muted-label">
            <Ticket size={15} aria-hidden="true" />
            {demoMode ? "ตัวอย่างแคมเปญ" : "สิทธิ์ขึ้นกับบัญชีและร้านที่ร่วมรายการ"}
          </span>
        </div>
        <div className="explore-portal__voucher-grid">
          {vouchers.map((voucher) => (
            <article className="explore-portal__voucher" key={voucher.id}>
              <span className="explore-portal__voucher-notch explore-portal__voucher-notch--left" aria-hidden="true" />
              <span className="explore-portal__voucher-notch explore-portal__voucher-notch--right" aria-hidden="true" />
              <div className="explore-portal__voucher-main">
                <p className="eyebrow">{voucher.eyebrow}</p>
                <h3>{demoMode ? voucher.title : "สิทธิ์จากแคมเปญ Aevo Play"}</h3>
                <p>
                  {demoMode
                    ? voucher.description
                    : "รายละเอียดจะแสดงเมื่อสิทธิ์ของบัญชีและร้านที่ร่วมรายการพร้อมใช้งาน"}
                </p>
              </div>
              <div className="explore-portal__voucher-action">
                <BadgePercent size={17} aria-hidden="true" />
                <button type="button" onClick={() => onNotify(`${voucher.action} — ระบบจะตรวจสิทธิ์จากบัญชีและแคมเปญก่อนยืนยัน`) }>
                  {voucher.action}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="explore-portal__section" aria-labelledby="partner-title">
        <div className="explore-portal__section-heading">
          <div>
            <p className="eyebrow">BOOK WITH AEVO PLAY</p>
            <h2 id="partner-title">ร้านที่พร้อมให้คุณจองสิทธิ์</h2>
          </div>
          <Link className="text-link" to="/search?category=Dining">
            ดูร้านทั้งหมด <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {partnerPlaces.length > 0 ? (
          <div className="explore-portal__partner-grid explore-portal__partner-grid--scroll" role="list" aria-label="ร้านที่พร้อมให้จองผ่าน Aevo Play">
            {partnerPlaces.slice(0, 3).map((place) => (
              <PartnerPlaceCard
                key={place.id}
                date={date}
                partySize={partySize}
                place={place}
              />
            ))}
          </div>
        ) : (
          <div className="explore-portal__partner-empty" role="status">
            <Store size={20} aria-hidden="true" />
            <div>
              <strong>ยังไม่มีร้าน partner ในผลลัพธ์ชุดนี้</strong>
              <p>ลองล้างตัวกรองหรือค้นหาพื้นที่อื่น เพื่อดูร้านที่ส่งต่อไป Aevo Play ได้</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
