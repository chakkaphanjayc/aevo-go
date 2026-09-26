import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CircleHelp, MapPinned, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { canonicalPlaceIdSchema, type PlaceDetail } from "@/contracts/place";
import { getPlaceDetail } from "@/lib/place-api";

function safeRelativePath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/stores/") || value.startsWith("//")) return null;
  return value;
}

function placeAddress(place: PlaceDetail): string {
  return place.address?.formattedAddress ?? place.area ?? "ยังไม่มีที่อยู่สาธารณะ";
}

function DetailState({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <main className="page-content">
      <div className="page-frame">
        <div className="map-result-state" role={alert ? "alert" : "status"}>
          {alert && <CircleHelp size={17} aria-hidden="true" />}
          {children}
        </div>
      </div>
    </main>
  );
}

function CapabilityBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span className={`map-canvas-legend__dot${enabled ? " map-canvas-legend__dot--partner" : ""}`}>
      {label}: {enabled ? "เปิด" : "ไม่เปิด"}
    </span>
  );
}

export function CanonicalPlaceDetailPage() {
  const { placeId } = useParams<{ placeId: string }>();
  const parsedPlaceId = canonicalPlaceIdSchema.safeParse(placeId);
  const placeQuery = useQuery({
    queryKey: ["canonical-place-detail", placeId],
    queryFn: () => {
      if (!parsedPlaceId.success) throw new Error("Invalid canonical Place ID");
      return getPlaceDetail(parsedPlaceId.data);
    },
    enabled: parsedPlaceId.success,
    staleTime: 30_000,
  });

  if (!parsedPlaceId.success) {
    return <DetailState alert>ลิงก์ Place ไม่ถูกต้อง</DetailState>;
  }
  if (placeQuery.isLoading) {
    return <DetailState>กำลังโหลดรายละเอียด Place…</DetailState>;
  }
  if (placeQuery.isError || !placeQuery.data) {
    return (
      <DetailState alert>
        โหลดรายละเอียด Place ไม่ได้ · ลองกลับไปค้นหาจาก Map อีกครั้ง
      </DetailState>
    );
  }

  const place = placeQuery.data;
  const bookingPath = safeRelativePath(place.capabilities.publicBookingRoute);
  const freshness =
    place.capabilities.freshness.state === "stale"
      ? "ข้อมูล capability อาจล้าสมัย"
      : place.capabilities.freshness.state === "fresh"
        ? "ข้อมูล capability ล่าสุด"
        : "ยังไม่ทราบ freshness ของ capability";

  return (
    <main className="page-content">
      <div className="page-frame">
        <Link className="back-link" to="/map">
          <ArrowLeft size={16} aria-hidden="true" />
          กลับไป Map
        </Link>
        <header className="page-heading">
          <p className="eyebrow">CANONICAL PLACE</p>
          <h1>{place.name}</h1>
          <p className="body-copy">
            {place.category.label} · {placeAddress(place)}
          </p>
        </header>

        <section className="flow-card" aria-label="Place summary">
          <div className="booking-review">
            <span className="eyebrow">PUBLIC PROJECTION</span>
            <h2>{place.area ?? "พื้นที่ยังไม่ระบุ"}</h2>
            <p>
              <MapPinned size={15} aria-hidden="true" />
              {placeAddress(place)}
            </p>
            <p className="muted-label">
              <ShieldCheck size={15} aria-hidden="true" />
              สถานะ: {place.verification.label ?? place.verification.status}
            </p>
          </div>
          <div className="map-canvas-legend" aria-label="ความสามารถของ Place">
            <CapabilityBadge label="Booking" enabled={place.capabilities.bookable} />
            <CapabilityBadge label="Queue" enabled={place.capabilities.queueSupported} />
            <CapabilityBadge label="Aevo Play" enabled={place.capabilities.aevoPlayPartner} />
          </div>
          <p className="guardrail-note">
            <CalendarDays size={15} aria-hidden="true" />
            {freshness}
          </p>
          {bookingPath && place.capabilities.bookable && (
            <div className="button-row">
              <Link className="button button--dark" to={bookingPath}>
                ตรวจสอบ availability
              </Link>
            </div>
          )}
        </section>

        {place.attribution.length > 0 && (
          <section className="flow-card" aria-label="ข้อมูลแหล่งที่มา">
            <span className="eyebrow">ATTRIBUTION</span>
            <div className="button-row">
              {place.attribution.map((source) =>
                source.url ? (
                  <a
                    className="button button--ghost"
                    href={source.url}
                    key={`${source.sourceKind}-${source.label}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.requiredText ?? source.label}
                  </a>
                ) : (
                  <span className="muted-label" key={`${source.sourceKind}-${source.label}`}>
                    {source.requiredText ?? source.label}
                  </span>
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
