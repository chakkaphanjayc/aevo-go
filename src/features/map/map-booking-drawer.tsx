import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicAvailabilitySlot } from "@/contracts/public";
import { getPublicVenueAvailability } from "@/lib/public-api";
import { customerDataMode } from "@/lib/env";
import type { StoreMapSummary } from "./contracts";

type BookingPlace = Pick<
  StoreMapSummary,
  | "slug"
  | "name"
  | "area"
  | "venueSlug"
  | "publicBookingRoute"
  | "isAevoPlayPartner"
>;

type BookingStep = "select" | "review";

const demoSlots = ["10:30", "12:00", "14:00", "17:30", "19:30"];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatSlot(slot: PublicAvailabilitySlot): string {
  return slot.localStartTime;
}

function venueSlugFromBookingPath(path: string | null | undefined): string | null {
  if (!path?.startsWith("/stores/") || path.startsWith("//")) return null;
  const match = path.match(/^\/stores\/([^/]+)(?:\/booking)?(?:\?|$)/u);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
export function MapBookingDrawer({
  place,
  onClose,
}: {
  place: BookingPlace;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [date, setDate] = useState(todayDate);
  const [partySize, setPartySize] = useState(2);
  const [selectedTime, setSelectedTime] = useState("");
  const [step, setStep] = useState<BookingStep>("select");

  const venueSlug = place.venueSlug ?? venueSlugFromBookingPath(place.publicBookingRoute);
  const availabilityQuery = useQuery({
    queryKey: ["map-booking-availability", venueSlug, date, partySize],
    queryFn: () => getPublicVenueAvailability(venueSlug!, date, partySize),
    enabled: customerDataMode === "live" && Boolean(place.isAevoPlayPartner && venueSlug),
    staleTime: 15_000,
  });

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const liveSlots = useMemo(
    () =>
      availabilityQuery.data?.slots.filter((slot) => slot.available) ?? [],
    [availabilityQuery.data],
  );
  const displayedSlots = customerDataMode === "demo" ? demoSlots : liveSlots;
  const selectedLiveSlot = liveSlots.find(
    (slot) => formatSlot(slot) === selectedTime,
  );
  const bookingUrl = useMemo(() => {
    const params = new URLSearchParams({ date, party: String(partySize) });
    if (selectedTime) params.set("time", selectedTime);
    const basePath = place.publicBookingRoute?.startsWith("/stores/")
      ? place.publicBookingRoute
      : `/stores/${encodeURIComponent(place.slug)}/booking`;
    return `${basePath}${basePath.includes("?") ? "&" : "?"}${params.toString()}`;
  }, [date, partySize, place.publicBookingRoute, place.slug, selectedTime]);

  return (
    <div className="map-booking-layer" role="presentation">
      <button
        className="map-booking-layer__scrim"
        type="button"
        aria-label="ปิดหน้าจอง"
        onClick={onClose}
      />
      <aside
        className="map-booking-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-booking-title"
      >
        <header className="map-booking-drawer__header">
          <div>
            <p className="eyebrow">AEVO PLAY BOOKING</p>
            <h2 id="map-booking-title">จองเวลาที่ {place.name}</h2>
            <span className="muted-label">
              <Ticket size={13} aria-hidden="true" />
              {place.area} · partner ของ Aevo Play
            </span>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าจอง"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {step === "select" ? (
          <div className="map-booking-drawer__body">
            <div className="map-booking-drawer__fields">
              <label className="map-booking-field">
                <span>
                  <CalendarDays size={14} aria-hidden="true" />วันที่
                </span>
                <input
                  type="date"
                  value={date}
                  min={todayDate()}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSelectedTime("");
                  }}
                />
              </label>
              <label className="map-booking-field">
                <span>
                  <Users size={14} aria-hidden="true" />จำนวนคน
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={partySize}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setPartySize(Math.max(1, Math.min(20, next || 1)));
                    setSelectedTime("");
                  }}
                />
              </label>
            </div>

            <div className="map-booking-drawer__section">
              <div className="map-booking-drawer__section-heading">
                <strong>เลือกช่วงเวลา</strong>
                <span>{customerDataMode === "demo" ? "ตัวอย่าง" : "จาก server"}</span>
              </div>
              {customerDataMode === "live" && availabilityQuery.isLoading && (
                <p className="map-booking-drawer__status" role="status">
                  <Clock3 size={15} aria-hidden="true" />กำลังอ่าน availability…
                </p>
              )}
              {customerDataMode === "live" && availabilityQuery.isError && (
                <p className="map-booking-drawer__status map-booking-drawer__status--error" role="alert">
                  <CircleHelp size={15} aria-hidden="true" />ยังอ่าน slot จาก Aevo Play ไม่ได้
                  <button className="text-link text-link--button" type="button" onClick={() => void availabilityQuery.refetch()}>
                    ลองใหม่
                  </button>
                </p>
              )}
              {customerDataMode === "live" && !availabilityQuery.isLoading && !availabilityQuery.isError && displayedSlots.length === 0 && (
                <p className="map-booking-drawer__status" role="status">
                  <Clock3 size={15} aria-hidden="true" />วันที่นี้ยังไม่มี slot ที่ว่าง
                </p>
              )}
              {displayedSlots.length > 0 && (
                <div className="map-booking-slots" role="group" aria-label="ช่วงเวลาที่เลือกได้">
                  {displayedSlots.map((slot) => {
                    const label = typeof slot === "string" ? slot : formatSlot(slot);
                    const available = typeof slot === "string" || slot.available;
                    return (
                      <button
                        key={label}
                        className={`map-booking-slot${selectedTime === label ? " is-selected" : ""}`}
                        type="button"
                        aria-pressed={selectedTime === label}
                        disabled={!available}
                        onClick={() => setSelectedTime(label)}
                      >
                        {selectedTime === label && <Check size={14} aria-hidden="true" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="guardrail-note">
              <Clock3 size={15} aria-hidden="true" />
              <span>เวลาจริงและจำนวนที่นั่งจะถูกตรวจซ้ำใน Aevo Play ก่อนสร้าง hold</span>
            </div>
            <button
              className="button button--dark map-booking-drawer__next"
              type="button"
              disabled={!selectedTime || (customerDataMode === "live" && availabilityQuery.isError)}
              onClick={() => setStep("review")}
            >
              ตรวจสอบรายละเอียด <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="map-booking-drawer__body">
            <div className="map-booking-review">
              <span className="eyebrow">BOOKING SUMMARY</span>
              <h3>{place.name}</h3>
              <p><CalendarDays size={15} aria-hidden="true" />{date}</p>
              <p><Clock3 size={15} aria-hidden="true" />{selectedTime} · {partySize} คน</p>
              {selectedLiveSlot && (
                <p className="muted-label">
                  <Check size={14} aria-hidden="true" />
                  server ยืนยันว่า slot นี้ยังว่างอยู่
                </p>
              )}
            </div>
            <div className="guardrail-note">
              <Ticket size={16} aria-hidden="true" />
              <span>
                Aevo Go จะส่งต่อไปยัง Aevo Play เพื่อกรอกข้อมูลผู้จอง สร้าง slot hold
                และยืนยันด้วย server authority
              </span>
            </div>
            {customerDataMode === "demo" && (
              <p className="inline-notice" role="status">
                Demo mode: เป็นตัวอย่าง flow และยังไม่สร้าง reservation จริง
              </p>
            )}
            <div className="map-booking-drawer__actions">
              <button className="button button--ghost" type="button" onClick={() => setStep("select")}>
                ย้อนกลับ
              </button>
              <Link className="button button--dark" to={bookingUrl} onClick={onClose}>
                ไปต่อที่ Aevo Play <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
