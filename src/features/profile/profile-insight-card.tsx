import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ArrowLeftRight, CalendarDays, Heart, PackageCheck, ShieldCheck } from "lucide-react";

type InsightValue = number | null;

interface ProfileInsightCardProps {
  name: string;
  email?: string | null;
  initials: string;
  accountLabel: string;
  accountDescription: string;
  isAuthenticated: boolean;
  savedPlaces: InsightValue;
  reservations: InsightValue;
  orders: InsightValue;
  localDataReady: boolean;
  action: ReactNode;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
}

interface TiltState {
  x: number;
  y: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

function metricValue(value: InsightValue): string {
  return value === null ? "—" : String(value);
}

function InsightMetric({
  icon: Icon,
  label,
  value,
  note
}: {
  icon: typeof Heart;
  label: string;
  value: InsightValue;
  note: string;
}) {
  return (
    <div className="profile-insight-card__metric">
      <span className="profile-insight-card__metric-icon" aria-hidden="true"><Icon size={16} /></span>
      <span className="profile-insight-card__metric-label">{label}</span>
      <strong className="profile-insight-card__metric-value">{metricValue(value)}</strong>
      <small>{note}</small>
    </div>
  );
}

export function ProfileInsightCard({
  name,
  email,
  initials,
  accountLabel,
  accountDescription,
  isAuthenticated,
  savedPlaces,
  reservations,
  orders,
  localDataReady,
  action
}: ProfileInsightCardProps) {
  const [face, setFace] = useState<"front" | "back">("front");
  const [tilt, setTilt] = useState<TiltState>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const toggleFace = () => setFace((current) => current === "front" ? "back" : "front");

  const isInteractiveTarget = (target: EventTarget | null): boolean =>
    target instanceof Element && Boolean(target.closest("button, a, input, textarea, select"));

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target) || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || reducedMotion) return;
    setTilt({
      x: clamp(-(event.clientY - drag.startY) / 5, -16, 16),
      y: clamp((event.clientX - drag.startX) / 5, -16, 16)
    });
  };

  const settlePointer = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    dragRef.current = null;
    setDragging(false);
    setTilt({ x: 0, y: 0 });
    if (commit && !reducedMotion && distance >= 56) toggleFace();
  };

  const baseRotation = face === "back" ? 180 : 0;
  const transform = reducedMotion
    ? `rotateY(${baseRotation}deg)`
    : `rotateX(${tilt.x}deg) rotateY(${baseRotation + tilt.y}deg)`;

  return (
    <article className="profile-insight-card" aria-label="Profile insight card">
      <div
        className={`profile-insight-card__stage${dragging ? " is-dragging" : ""}${reducedMotion ? " is-reduced-motion" : ""}`}
        style={{ transform }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => settlePointer(event, true)}
        onPointerCancel={(event) => settlePointer(event, false)}
      >
        <section className="profile-insight-card__face profile-insight-card__face--front" aria-hidden={face !== "front"}>
          <div className="profile-insight-card__header">
            <div>
              <p className="eyebrow">PROFILE / IDENTITY</p>
              <span className="profile-insight-card__product-mark">AEVO GO</span>
            </div>
            {face === "front" && <button className="profile-insight-card__flip" type="button" onClick={toggleFace} aria-label="ดู profile insights">
              <ArrowLeftRight size={16} aria-hidden="true" />
              <span>ดู insight</span>
            </button>}
          </div>

          <div className="profile-insight-card__identity">
            <span className="profile-insight-card__avatar" aria-hidden="true">{initials}</span>
            <div>
              <p className="eyebrow">{accountLabel}</p>
              <h2>{name}</h2>
              <p className="body-copy">{email || accountDescription}</p>
            </div>
          </div>

          <div className="profile-insight-card__state-grid">
            <div className="profile-insight-card__state">
              <span className="eyebrow">ACCOUNT SIGNAL</span>
              <strong>{isAuthenticated ? "Connected" : "Guest mode"}</strong>
            </div>
            <div className="profile-insight-card__state">
              <span className="eyebrow">NEXT SURFACE</span>
              <strong>Explore to Profile</strong>
            </div>
          </div>

          <div className="profile-insight-card__footer">
            {face === "front" && <div className="profile-insight-card__action">{action}</div>}
            <p className="profile-insight-card__hint">ลากเพื่อพลิกดูข้อมูล · ใช้ปุ่มด้านบนด้วยแป้นพิมพ์</p>
          </div>
        </section>

        <section className="profile-insight-card__face profile-insight-card__face--back" aria-hidden={face !== "back"}>
          <div className="profile-insight-card__header">
            <div>
              <p className="eyebrow">PROFILE / INSIGHTS</p>
              <span className="profile-insight-card__product-mark">READ MODEL</span>
            </div>
            {face === "back" && <button className="profile-insight-card__flip" type="button" onClick={toggleFace} aria-label="กลับไปดู profile">
              <ArrowLeftRight size={16} aria-hidden="true" />
              <span>กลับด้านหน้า</span>
            </button>}
          </div>

          <div className="profile-insight-card__back-intro">
            <span className="profile-insight-card__back-icon" aria-hidden="true"><ShieldCheck size={20} /></span>
            <div>
              <h2>สัญญาณการใช้งานของคุณ</h2>
              <p className="body-copy">ตัวเลขจากข้อมูลที่อ่านได้จริง ไม่ใช่คะแนนที่สร้างขึ้นเพื่อการตกแต่ง</p>
            </div>
          </div>

          <div className="profile-insight-card__metrics" aria-label="Profile usage insights">
            <InsightMetric icon={Heart} label="Saved places" value={savedPlaces} note={savedPlaces === null ? "กำลังอ่านข้อมูล" : "รายการที่เก็บไว้"} />
            <InsightMetric icon={CalendarDays} label="Reservations" value={reservations} note={reservations === null ? "กำลังอ่านข้อมูล" : "local recovery records"} />
            <InsightMetric icon={PackageCheck} label="Orders" value={orders} note={orders === null ? "กำลังอ่านข้อมูล" : "local recovery records"} />
          </div>

          <div className="profile-insight-card__boundary">
            <div>
              <span className="eyebrow">DATA BOUNDARY</span>
              <strong>{isAuthenticated ? "Customer session + local recovery" : "Local recovery only"}</strong>
            </div>
            <small>{localDataReady ? "อ่านจากเครื่องนี้แล้ว" : "กำลังอ่านข้อมูลจากเครื่องนี้"}</small>
          </div>
        </section>
      </div>
      <p className="sr-only" aria-live="polite">{face === "front" ? "กำลังแสดงข้อมูล profile" : "กำลังแสดง profile insights"}</p>
    </article>
  );
}
