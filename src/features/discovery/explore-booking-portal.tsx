import type { FormEvent, ReactNode, RefObject } from "react";
import {
  ArrowRight,
  BadgePercent,
  CalendarDays,
  ChevronDown,
  Coffee,
  Compass,
  MapPin,
  Palette,
  Route,
  Search,
  Sparkles,
  Store,
  Ticket,
  Users,
  Utensils,
  Wine,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { GlidingGroup, type GlidingGroupItem } from "@/components/gliding-group";
import type { DiscoveryPlace } from "./types";

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
    <article className="explore-portal__partner-card">
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
        <Link className="button button--emerald explore-portal__partner-cta" to={bookingHref}>
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
  const categoryItems: readonly GlidingGroupItem[] = portalCategories.map(
    ({ id, label, icon: Icon }) => ({
      id,
      label: <CategoryLabel icon={Icon} label={label} />,
    }),
  );

  return (
    <div className="explore-portal">
      <section className="explore-portal__booking-card" aria-labelledby="booking-card-title">
        <div className="explore-portal__booking-heading">
          <div>
            <p className="eyebrow">PLAN YOUR NEXT STOP</p>
            <h1 id="booking-card-title">ค้นหาแล้วจองได้ในที่เดียว</h1>
          </div>
          <span className="explore-portal__booking-hint">
            <Sparkles size={14} aria-hidden="true" />
            {demoMode ? "ตัวอย่างข้อมูลสำหรับทดสอบ" : "Availability จากระบบจริง"}
          </span>
        </div>

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
          <button className="button button--emerald explore-portal__search-button" type="submit">
            <Search size={17} aria-hidden="true" />
            <span>ค้นหา &amp; จอง</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
        <p className="explore-portal__booking-note">
          <span className="explore-portal__booking-note-dot" aria-hidden="true" />
          ข้อมูลราคา เวลาเปิด และที่ว่างจะยืนยันอีกครั้งจาก server ก่อนทำรายการ
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
                    : "รายละเอียดจะแสดงเมื่อ campaign projection ของบัญชีและร้านที่ร่วมรายการพร้อมใช้งาน"}
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
          <div className="explore-portal__partner-grid">
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
