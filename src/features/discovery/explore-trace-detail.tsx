import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
  ExternalLink,
  Heart,
  MessageCircle,
  MapPin,
  Navigation,
  Plus,
  Route,
  Share2,
  ShieldCheck,
  Star,
  UserPlus,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CommentStream } from "@/components/comment-stream";
import { InlineCommentSection } from "@/components/inline-comment-section";
import {
  PhotoLightbox,
  type PhotoLightboxItem,
} from "@/components/photo-lightbox";
import {
  discoveryReasonCopy,
  type DiscoveryComment,
  type DiscoveryCommentProfile,
  type DiscoveryTrace,
} from "./types";
import type { DiscoveryActionHandlers } from "./discovery-cards";

export interface ExploreDetailStop {
  id: string;
  slug: string;
  name: string;
  category: string;
  timeLabel: string;
  durationLabel: string;
  note: string;
  area: string;
  pick: boolean;
  imageUrl?: string | null;
  imageUrls?: readonly string[];
  likeCount?: number;
  liked?: boolean;
  comments?: readonly DiscoveryComment[];
  commentCount?: number;
  isAevoPlayPartner?: boolean;
  bookingSlug?: string;
  /** True only when the stop has an explicit, verified public booking target. */
  bookingAvailable?: boolean;
}

interface ExploreTraceDetailProps {
  trace: DiscoveryTrace;
  demoMode: boolean;
  creatorFollowing: boolean;
  creatorFollowPending: boolean;
  handlers: DiscoveryActionHandlers;
  onClose: () => void;
  onFollowCreator?: () => void;
  onStartJourney: () => void;
  onSaveStop?: (stop: ExploreDetailStop) => void;
  commentFocusRequestKey?: number;
  onCommentSubmit?: (body: string) => Promise<void>;
  onCommentEdit?: (commentId: string, body: string) => Promise<void>;
  onCommentDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  onOpenMedia?: (index: number) => void;
  onBookingUnavailable?: (stop: ExploreDetailStop) => void;
}

const demoStopsBySlug: Record<string, readonly Omit<ExploreDetailStop, "id" | "slug" | "area">[]> = {
  "ari-design-morning": [
    { name: "North Star Coffee", category: "Specialty coffee", timeLabel: "09:00", durationLabel: "45 นาที", note: "เริ่มต้นด้วยกาแฟที่รสชัด แล้วเผื่อเวลานั่งดูแสงหน้าร้าน", pick: true },
    { name: "Clay & Form Studio", category: "Ceramic studio", timeLabel: "10:00", durationLabel: "35 นาที", note: "แวะดูชิ้นงานเล็ก ๆ และคุยกับเจ้าของสตูดิโอ", pick: false },
    { name: "Ari Garden Window", category: "Quiet pause", timeLabel: "11:00", durationLabel: "25 นาที", note: "จุดพักที่เดินต่อได้โดยไม่ต้องเรียกรถ", pick: true },
    { name: "Paper Plane Gallery", category: "Design space", timeLabel: "11:40", durationLabel: "35 นาที", note: "เลือกดูงานที่สนใจสักหนึ่งห้อง แล้วปล่อยเวลาให้ช้าลง", pick: false },
    { name: "Slow Loop Bakery", category: "Bakery", timeLabel: "12:30", durationLabel: "30 นาที", note: "ปิดท้ายด้วยของว่างก่อนแยกย้ายจากย่าน Ari", pick: true },
  ],
  "old-town-light-walk": [
    { name: "Talat Noi Coffee", category: "Coffee stop", timeLabel: "15:30", durationLabel: "40 นาที", note: "เริ่มก่อนสี่โมงเพื่อเก็บแสงต่อเนื่องไปจนจบเส้นทาง", pick: true },
    { name: "Warehouse 30", category: "Creative district", timeLabel: "16:20", durationLabel: "35 นาที", note: "เดินดูงานและร้านเล็ก ๆ ในอาคารเก่า", pick: false },
    { name: "River City Bangkok", category: "Art space", timeLabel: "17:10", durationLabel: "50 นาที", note: "เลือกนิทรรศการที่สนใจหนึ่งจุด ไม่ต้องรีบเก็บครบทุกห้อง", pick: true },
    { name: "Charoen Krung Gallery", category: "Gallery", timeLabel: "18:15", durationLabel: "35 นาที", note: "พักขาก่อนต่อไปยังช่วงเย็นของเส้นทาง", pick: false },
    { name: "Old Town Bookhouse", category: "Bookstore", timeLabel: "19:00", durationLabel: "25 นาที", note: "มองหาหนังสือภาพหรือโปสการ์ดเป็นของที่ระลึก", pick: false },
    { name: "Twilight Bridge", category: "Photo walk", timeLabel: "19:35", durationLabel: "30 นาที", note: "จบด้วยวิวริมแม่น้ำก่อนเลือกมื้อค่ำตามสะดวก", pick: true },
  ],
  "sathorn-slow-reset": [
    { name: "Calm House Studio", category: "Wellness", timeLabel: "18:00", durationLabel: "45 นาที", note: "เริ่มด้วยคลาสเบา ๆ ที่ไม่ต้องเตรียมตัวมาก", pick: true },
    { name: "Sathorn Market", category: "Local market", timeLabel: "19:00", durationLabel: "35 นาที", note: "เดินเลือกของกินแบบไม่ต้องวางแผนล่วงหน้า", pick: false },
    { name: "Green Room Kitchen", category: "Dinner", timeLabel: "19:50", durationLabel: "55 นาที", note: "เลือกมื้อเย็นที่แบ่งกันได้และใช้เวลานั่งคุย", pick: true },
    { name: "Moonlight Walk", category: "Slow walk", timeLabel: "21:00", durationLabel: "25 นาที", note: "เดินย่อยก่อนกลับ โดยไม่เพิ่มจุดหมายใหม่", pick: false },
  ],
};

function buildDemoStops(trace: DiscoveryTrace): ExploreDetailStop[] {
  const routeStops = trace.routeStops;
  if (routeStops?.length) {
    const timeSlots = ["09:00", "10:00", "11:15", "12:30", "14:00", "15:30", "17:00", "18:30"];
    return routeStops.map((stop, index) => ({
      id: `${trace.id}-stop-${index + 1}`,
      slug: `${trace.slug}-${stop.id}`,
      name: stop.name,
      category: stop.category,
      timeLabel: timeSlots[index] ?? "ตามสะดวก",
      durationLabel: stop.category === "Dining" ? "60 นาที" : stop.category === "Activities" ? "90 นาที" : "45 นาที",
      note: `${stop.subtitle} · เลือกจังหวะที่พอดีกับเส้นทางของคุณ`,
      area: stop.area,
      pick: index === 0 || index === routeStops.length - 1,
      imageUrl: stop.imageUrl,
      imageUrls: stop.imageUrl ? [stop.imageUrl] : [],
      likeCount: [24, 11, 8, 14, 19][index] ?? 7,
      liked: false,
      comments: index === 0 ? trace.comments : [],
      commentCount: index === 0 ? trace.comments.length : 0,
      isAevoPlayPartner: stop.isAevoPlayPartner ?? false,
      bookingSlug: stop.id,
      bookingAvailable: false,
    }));
  }
  const seeds = demoStopsBySlug[trace.slug] ?? [];
  const images = trace.coverImages ?? [];
  return seeds.slice(0, trace.stopCount).map((stop, index) => ({
    ...stop,
    id: `${trace.id}-stop-${index + 1}`,
    slug: `${trace.slug}-stop-${index + 1}`,
    area: trace.area,
    imageUrl: images[index % Math.max(images.length, 1)] ?? null,
    imageUrls: images.length > 1
      ? [images[index % images.length], images[(index + 1) % images.length]]
      : images.length === 1
        ? [images[0]]
        : [],
    likeCount: [24, 11, 8, 14, 19][index] ?? 7,
    liked: false,
    comments: index === 0 ? trace.comments : [],
    commentCount: index === 0 ? trace.comments.length : 0,
    isAevoPlayPartner: ["North Star Coffee", "Calm House Studio"].includes(stop.name),
    bookingSlug: stop.name.toLowerCase().replaceAll(" ", "-"),
    bookingAvailable: false,
  }));
}

function DetailMediaViewer({ trace, onOpenMedia }: { trace: DiscoveryTrace; onOpenMedia?: (index: number) => void }) {
  const mediaItems: PhotoLightboxItem[] = (trace.coverImages?.length ? trace.coverImages : [undefined]).map(
    (src, index) => ({
      src,
      alt: `${trace.title} รูปที่ ${index + 1}`,
      fallback: trace.coverTiles[index] ?? "TRACE",
    }),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const activeItem = mediaItems[activeIndex] ?? mediaItems[0];
  const hasMultipleItems = mediaItems.length > 1;

  useEffect(() => {
    setActiveIndex(0);
    setIsZoomed(false);
    setImageError(false);
    setImageLoaded(false);
  }, [trace.id]);

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [activeIndex, activeItem.src]);

  const move = (direction: -1 | 1) => {
    if (!hasMultipleItems) return;
    setIsZoomed(false);
    setActiveIndex((current) => (current + direction + mediaItems.length) % mediaItems.length);
  };

  const toggleZoom = () => setIsZoomed((prev) => !prev);

  return (
    <div
      className={`explore-detail-media-stage${isZoomed ? " is-zoomed" : ""}${imageLoaded ? " is-image-ready" : ""}`}
      aria-label={`ภาพประกอบ ${trace.title}`}
    >
      <div className="explore-detail-media-stage__backdrop" aria-hidden="true">
        {activeItem.src && !imageError && <img src={activeItem.src} alt="" decoding="async" />}
      </div>
      <button
        className="explore-detail-media-stage__canvas"
        type="button"
        aria-label={isZoomed ? "ย่อภาพกลับขนาดปกติ" : `ขยายภาพ ${activeIndex + 1} ของ ${mediaItems.length}`}
        onClick={() => {
          if (onOpenMedia) onOpenMedia(activeIndex);
          else toggleZoom();
        }}
      >
        {activeItem.src && !imageError ? (
          <img
            className="explore-detail-media-stage__image"
            src={activeItem.src}
            alt={activeItem.alt}
            loading="eager"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="explore-detail-media-stage__fallback">{activeItem.fallback}</span>
        )}
      </button>
      {activeItem.src && !imageError && (
        <button
          className="explore-detail-media-stage__zoom-toggle"
          type="button"
          aria-label={isZoomed ? "ย่อขนาดภาพ" : "ซูมดูภาพ"}
          onClick={toggleZoom}
        >
          {isZoomed ? <ZoomOut size={13} aria-hidden="true" /> : <ZoomIn size={13} aria-hidden="true" />}
          <span>{isZoomed ? "ย่อภาพ" : "ซูม"}</span>
        </button>
      )}
      {hasMultipleItems && (
        <>
          <button className="explore-detail-media-stage__nav explore-detail-media-stage__nav--previous" type="button" aria-label="ภาพก่อนหน้า" onClick={() => move(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button className="explore-detail-media-stage__nav explore-detail-media-stage__nav--next" type="button" aria-label="ภาพถัดไป" onClick={() => move(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <span className="explore-detail-media-stage__count" aria-live="polite">{activeIndex + 1} / {mediaItems.length}</span>
        </>
      )}
    </div>
  );
}

function DetailOverview({ trace }: { trace: DiscoveryTrace }) {
  const duration = trace.durationMinutes === null
    ? "—"
    : trace.durationMinutes >= 60
      ? `${Math.floor(trace.durationMinutes / 60)} ชม.${trace.durationMinutes % 60 ? ` ${trace.durationMinutes % 60} นาที` : ""}`
      : `${trace.durationMinutes} นาที`;
  const tags = Array.from(
    new Set([
      ...trace.topicTags,
      ...(trace.presentation?.tags ?? []),
    ].filter(Boolean)),
  ).slice(0, 6);
  const metrics = [
    { icon: Route, value: String(trace.stopCount), label: "จุดแวะ" },
    { icon: Clock3, value: duration, label: "เวลาโดยประมาณ" },
    { icon: MapPin, value: trace.distanceKm === null ? "—" : `${trace.distanceKm} กม.`, label: "ระยะทาง" },
    { icon: Star, value: trace.rating === null ? "—" : trace.rating.toFixed(1), label: "คะแนนจากชุมชน" },
  ] as const;

  return (
    <section className="explore-detail-overview" aria-labelledby="explore-overview-title">
      <div className="explore-detail-overview__heading">
        <div>
          <span className="eyebrow">AT A GLANCE</span>
          <h3 id="explore-overview-title">ข้อมูลสำคัญของเส้นทาง</h3>
        </div>
        <span className="muted-label">
          {trace.presentation?.visibility === "followers" ? "เฉพาะผู้ติดตาม" : "เปิดให้ติดตาม"}
        </span>
      </div>
      <div className="explore-detail-overview__metrics">
        {metrics.map(({ icon: Icon, value, label }) => (
          <div className="explore-detail-overview__metric" key={label}>
            <span aria-hidden="true"><Icon size={15} /></span>
            <strong>{value}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      {(tags.length > 0 || trace.presentation?.feeling) && (
        <div className="explore-detail-overview__tags" aria-label="ลักษณะของ Trace">
          {trace.presentation?.feeling && <span>{trace.presentation.feeling}</span>}
          {tags.map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      )}
    </section>
  );
}

function StopTimeline({
  stops,
  demoMode,
  onSaveStop,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onFollowCommenter,
  onOpenMedia,
  onClose,
  onBookingUnavailable,
}: {
  stops: readonly ExploreDetailStop[];
  demoMode: boolean;
  onSaveStop?: (stop: ExploreDetailStop) => void;
  onCommentSubmit?: (body: string) => Promise<void>;
  onCommentEdit?: (commentId: string, body: string) => Promise<void>;
  onCommentDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  onOpenMedia?: (index: number) => void;
  onClose?: () => void;
  onBookingUnavailable?: (stop: ExploreDetailStop) => void;
}) {
  if (!demoMode) {
    return (
      <div className="explore-detail-unavailable" role="status">
        <Route size={18} aria-hidden="true" />
        <div>
          <strong>รายละเอียดจุดแวะยังไม่พร้อม</strong>
          <p>ข้อมูลกำลังอยู่ระหว่างการอัปเดต จึงยังไม่เปิดรายละเอียดจุดแวะจากข้อมูลที่ไม่ยืนยัน</p>
          {onClose && <button className="text-link text-link--button" type="button" onClick={onClose}>ย้อนกลับ</button>}
        </div>
      </div>
    );
  }

  return (
    <ol className="explore-stop-timeline">
      {stops.map((stop, index) => (
        <StopStory
          key={stop.id}
          index={index}
          stop={stop}
          onSaveStop={onSaveStop}
          onCommentSubmit={onCommentSubmit}
          onCommentEdit={onCommentEdit}
          onCommentDelete={onCommentDelete}
          onFollowCommenter={onFollowCommenter}
          onOpenMedia={onOpenMedia}
          onBookingUnavailable={onBookingUnavailable}
        />
      ))}
    </ol>
  );
}

function stopPhotoItems(stop: ExploreDetailStop): PhotoLightboxItem[] {
  const sources = stop.imageUrls?.length
    ? stop.imageUrls
    : stop.imageUrl
      ? [stop.imageUrl]
      : [];
  return sources.length > 0
    ? sources.map((src, index) => ({
        src,
        alt: `${stop.name} รูปที่ ${index + 1}`,
        fallback: stop.name,
      }))
    : [{ alt: `${stop.name} ภาพตัวอย่าง`, fallback: stop.name }];
}

function StopMediaCarousel({ stop, onOpenMedia }: { stop: ExploreDetailStop; onOpenMedia?: (index: number) => void }) {
  const items = stopPhotoItems(stop);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const [isOpen, setIsOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const activeItem = items[activeIndex] ?? items[0];
  const hasMultipleItems = items.length > 1;

  useEffect(() => {
    setActiveIndex(0);
    setFailedImages(new Set());
    setIsOpen(false);
  }, [stop.id]);

  const move = (direction: -1 | 1) => {
    if (!hasMultipleItems) return;
    setActiveIndex((current) => (current + direction + items.length) % items.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    didSwipeRef.current = false;
    touchStartRef.current = touch
      ? { x: touch.clientX, y: touch.clientY }
      : null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || !hasMultipleItems) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    didSwipeRef.current = true;
    move(deltaX < 0 ? 1 : -1);
  };

  return (
    <div className="explore-stop-media-carousel">
      <div
        className="explore-stop-media"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="explore-stop-media__button"
          type="button"
          aria-label={`เปิดภาพ ${stop.name} รูปที่ ${activeIndex + 1}`}
          onClick={() => {
            if (didSwipeRef.current) {
              didSwipeRef.current = false;
              return;
            }
            if (onOpenMedia) onOpenMedia(activeIndex);
            else setIsOpen(true);
          }}
        >
          {activeItem.src && !failedImages.has(activeIndex) ? (
            <img
              src={activeItem.src}
              alt={activeItem.alt}
              loading="lazy"
              decoding="async"
              onError={() => setFailedImages((current) => new Set(current).add(activeIndex))}
            />
          ) : (
            <span className="explore-stop-media__fallback">{activeItem.fallback}</span>
          )}
        </button>
        <span className="explore-stop-media__count" aria-live="polite">{activeIndex + 1} / {items.length}</span>
        <span className="explore-stop-media__zoom">
          <ZoomIn size={13} aria-hidden="true" />
          แตะเพื่อดูเต็มจอ
        </span>
        {hasMultipleItems && (
          <>
            <button className="explore-stop-media__nav explore-stop-media__nav--previous" type="button" aria-label="ภาพก่อนหน้า" onClick={() => move(-1)}>
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <button className="explore-stop-media__nav explore-stop-media__nav--next" type="button" aria-label="ภาพถัดไป" onClick={() => move(1)}>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {hasMultipleItems && (
        <div className="explore-stop-media__thumbs" role="tablist" aria-label={`รูปภาพของ ${stop.name}`}>
          {items.map((item, index) => (
            <button
              className={`explore-stop-media__thumb${index === activeIndex ? " is-active" : ""}`}
              key={`${stop.id}-photo-${index}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`ดูรูปที่ ${index + 1} ของ ${items.length}`}
              onClick={() => {
                setActiveIndex(index);
                if (onOpenMedia) onOpenMedia(index);
                else setIsOpen(true);
              }}
            >
              {item.src && !failedImages.has(index) ? (
                <img
                  src={item.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedImages((current) => new Set(current).add(index))}
                />
              ) : (
                <span>{index + 1}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {isOpen && (
        <PhotoLightbox
          items={items}
          initialIndex={activeIndex}
          title={stop.name}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function StopStory({
  stop,
  index,
  onSaveStop,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onFollowCommenter,
  onOpenMedia,
  onBookingUnavailable,
}: {
  stop: ExploreDetailStop;
  index: number;
  onSaveStop?: (stop: ExploreDetailStop) => void;
  onCommentSubmit?: (body: string) => Promise<void>;
  onCommentEdit?: (commentId: string, body: string) => Promise<void>;
  onCommentDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  onOpenMedia?: (index: number) => void;
  onBookingUnavailable?: (stop: ExploreDetailStop) => void;
}) {
  const [liked, setLiked] = useState(stop.liked === true);
  const [likeCount, setLikeCount] = useState(stop.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(stop.commentCount ?? stop.comments?.length ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [bookingFallbackOpen, setBookingFallbackOpen] = useState(false);
  const comments = stop.comments ?? [];

  useEffect(() => {
    setLiked(stop.liked === true);
    setLikeCount(stop.likeCount ?? 0);
    setCommentCount(stop.commentCount ?? stop.comments?.length ?? 0);
  }, [stop.id, stop.likeCount, stop.liked, stop.commentCount, stop.comments]);

  useEffect(() => {
    setBookingFallbackOpen(false);
  }, [stop.id]);

  const submitComment = onCommentSubmit
    ? async (body: string) => {
        await onCommentSubmit(body);
        setCommentCount((current) => current + 1);
      }
    : undefined;

  return (
    <li className="explore-stop">
      <div className="explore-stop__rail" aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="explore-stop__body">
        <div className="explore-stop__heading">
          <div>
            <span className="explore-stop__time"><Clock3 size={13} aria-hidden="true" />{stop.timeLabel} · {stop.durationLabel}</span>
            <h4>{stop.name}</h4>
            <p>{stop.category} · {stop.area}</p>
          </div>
          {stop.pick && <span className="explore-stop__pick"><Star size={12} fill="currentColor" aria-hidden="true" />Dee Pick</span>}
        </div>
        <StopMediaCarousel stop={stop} onOpenMedia={onOpenMedia} />
        <div className="explore-stop-interaction-bar" aria-label={`การกระทำสำหรับ ${stop.name}`}>
          <button
            className={`explore-stop-interaction${liked ? " is-liked" : ""}`}
            type="button"
            aria-pressed={liked}
            onClick={() => {
              setLiked((current) => {
                setLikeCount((count) => count + (current ? -1 : 1));
                return !current;
              });
            }}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
            <span className="explore-stop-interaction__label">ถูกใจ</span><strong>{likeCount}</strong>
          </button>
          <button className="explore-stop-interaction" type="button" aria-label={`เปิดความคิดเห็นของ ${stop.name}`} onClick={() => setCommentsOpen((current) => !current)}>
            <MessageCircle size={15} aria-hidden="true" />
            <span className="explore-stop-interaction__label">ความคิดเห็น</span><strong>{commentCount}</strong>
          </button>
          <Link className="explore-stop-interaction" to={`/map?mode=places&q=${encodeURIComponent(stop.name)}`} aria-label={`ดู ${stop.name} บน Map`}>
            <MapPin size={15} aria-hidden="true" /><span className="explore-stop-interaction__label">ดูบน Map</span>
          </Link>
          {stop.isAevoPlayPartner && (
            stop.bookingAvailable && stop.bookingSlug ? (
              <Link className="explore-stop-interaction explore-stop-interaction--booking" to={`/stores/${encodeURIComponent(stop.bookingSlug)}/booking`} aria-label={`จอง ${stop.name} ผ่าน Aevo Play`}>
                <Zap size={15} aria-hidden="true" /><span className="explore-stop-interaction__label">จองผ่าน Aevo Play</span>
              </Link>
            ) : (
              <button
                className="explore-stop-interaction explore-stop-interaction--booking"
                type="button"
                aria-expanded={bookingFallbackOpen}
                aria-label={`จอง ${stop.name} ผ่าน Aevo Play`}
                onClick={() => {
                  setBookingFallbackOpen(true);
                  onBookingUnavailable?.(stop);
                }}
              >
                <Zap size={15} aria-hidden="true" /><span className="explore-stop-interaction__label">จองผ่าน Aevo Play</span>
              </button>
            )
          )}
        </div>
        <p className="explore-stop__note">{stop.note}</p>
        {bookingFallbackOpen && (
          <div className="explore-stop-fallback" role="status">
            <div>
              <strong>ข้อมูลการจองยังไม่พร้อม</strong>
              <p>ข้อมูลกำลังอยู่ระหว่างการอัปเดต และยังไม่เปิดลิงก์จองที่ยืนยันไม่ได้</p>
            </div>
            <button className="text-link text-link--button" type="button" onClick={() => setBookingFallbackOpen(false)}>ย้อนกลับ</button>
          </div>
        )}
        {onSaveStop ? (
          <button className="explore-stop__save" type="button" aria-label={`เซฟ ${stop.name} ไว้ในรายการ`} onClick={() => onSaveStop(stop)}>
            <Bookmark size={14} aria-hidden="true" /><span className="explore-stop__save-label">เซฟจุดนี้ไว้ในรายการ</span>
          </button>
        ) : (
          <span className="explore-stop__save is-disabled" aria-label="การเซฟจุดแวะยังไม่พร้อม"><Bookmark size={14} aria-hidden="true" /><span className="explore-stop__save-label">เซฟจุดนี้จะพร้อมเมื่อมีข้อมูลสถานที่</span></span>
        )}
        {commentsOpen && (
          <section className="explore-stop__comments" aria-label={`ความคิดเห็นของ ${stop.name}`}>
            <CommentStream
              comments={comments}
              showComposer={Boolean(submitComment)}
              onSubmit={submitComment}
              onEdit={onCommentEdit}
              onDelete={onCommentDelete}
              onFollowCommenter={onFollowCommenter}
              onViewAll={() => undefined}
            />
          </section>
        )}
      </div>
    </li>
  );
}

function RemixVariations({ trace, demoMode }: { trace: DiscoveryTrace; demoMode: boolean }) {
  if (!demoMode) {
    return (
      <div className="explore-detail-unavailable" role="status">
        <RepeatIcon />
        <div>
          <strong>เวอร์ชัน Remix จะพร้อมเมื่อข้อมูลเส้นทางครบ</strong>
          <p>จำนวน Remix ที่มีอยู่ตอนนี้: {trace.remixCount}</p>
        </div>
      </div>
    );
  }

  const variations = [
    { id: `${trace.id}-remix-short`, title: `${trace.title} · เวอร์ชันสั้น`, subtitle: `${Math.max(2, trace.stopCount - 2)} stops · สำหรับเวลาน้อย` },
    { id: `${trace.id}-remix-slow`, title: `${trace.title} · เดินช้าลง`, subtitle: `${trace.stopCount} stops · เพิ่มเวลาพัก` },
  ];
  return (
    <div className="explore-remix-list">
      {variations.map((variation) => (
        <Link className="explore-remix-card" key={variation.id} to={`/traces/${trace.slug}?remix=${encodeURIComponent(variation.id)}`}>
          <span className="explore-remix-card__icon" aria-hidden="true"><RepeatIcon /></span>
          <span><strong>{variation.title}</strong><small>{variation.subtitle}</small></span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

function RepeatIcon() {
  return <Plus size={17} aria-hidden="true" />;
}

export function ExploreTraceDetail({
  trace,
  demoMode,
  creatorFollowing,
  creatorFollowPending,
  handlers,
  onClose,
  onFollowCreator,
  onStartJourney,
  onSaveStop,
  commentFocusRequestKey = 0,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onFollowCommenter,
  onOpenMedia,
  onBookingUnavailable,
}: ExploreTraceDetailProps) {
  const stops = useMemo(
    () => (demoMode ? buildDemoStops(trace) : []),
    [demoMode, trace],
  );
  const reason = discoveryReasonCopy(trace.reason);
  const saveState = handlers.actionState?.(trace, "trace");
  const shareState = handlers.actionState?.(trace, "share");
  const tasteMatch = demoMode
    ? trace.reason.code === "SIMILAR_TASTE"
      ? "94%"
      : trace.reason.code === "FOLLOWING_TRACER"
        ? "88%"
        : "81%"
    : null;

  return (
    <aside className="explore-detail-panel" aria-label={`รายละเอียด Trace ${trace.title}`}>
      <header className="explore-detail-panel__header explore-detail-story-header">
        <div className="explore-detail-story-header__copy">
          <p className="eyebrow">TRACE / {trace.topicTags[0] ?? "DISCOVERY"}</p>
          <h2>{trace.title}</h2>
          <div className="explore-detail-story-meta" aria-label="ข้อมูลสรุป Trace">
            <span className="discovery-avatar" aria-hidden="true">{trace.creator.initials}</span>
            <strong>{trace.creator.name}</strong>
            <span aria-hidden="true">·</span>
            <span>{trace.stopCount} Stops</span>
            <span aria-hidden="true">·</span>
            <span>{trace.durationMinutes === null ? "—" : `${trace.durationMinutes / 60} ชม.`}</span>
            <span aria-hidden="true">·</span>
            <span>{trace.distanceKm === null ? "—" : `${trace.distanceKm} กม.`}</span>
            <span aria-hidden="true">·</span>
            <span>{trace.budgetLabel ?? "—"}</span>
          </div>
          <div className="explore-detail-story-badge-row">
            <span className="explore-detail-taste-badge">
              <ShieldCheck size={13} aria-hidden="true" />
              Taste match · {tasteMatch ?? "—"}
            </span>
            <span className="explore-detail-story-area"><MapPin size={13} aria-hidden="true" />{trace.area}</span>
          </div>
        </div>
        <div className="explore-detail-panel__header-actions">
          {onFollowCreator && (
            <button
              className="explore-detail-follow-control"
              type="button"
              disabled={creatorFollowPending}
              aria-busy={creatorFollowPending || undefined}
              aria-pressed={creatorFollowing}
              onClick={onFollowCreator}
            >
              {creatorFollowPending ? <span className="button-spinner" aria-hidden="true" /> : creatorFollowing ? <Check size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
              <span>{creatorFollowing ? "ติดตามแล้ว" : "ติดตาม"}</span>
            </button>
          )}
          <button className="explore-detail-panel__back" type="button" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden="true" />ย้อนกลับ
          </button>
          <button
            className="icon-button icon-button--subtle"
            type="button"
            aria-label="แชร์ Trace"
            aria-busy={shareState?.pending || undefined}
            onClick={() => handlers.onAction?.(trace, "share")}
          >
            <Share2 size={17} aria-hidden="true" />
          </button>
          <button className="icon-button icon-button--subtle" type="button" aria-label="ปิดรายละเอียด" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="explore-detail-panel__body explore-detail-panel__body--animated" key={trace.id}>
        <DetailMediaViewer trace={trace} onOpenMedia={onOpenMedia} />

        <section className="explore-detail-story-lead" aria-labelledby="explore-story-title">
          <span className="eyebrow">THE STORY OF THIS TRACE</span>
          <h3 id="explore-story-title">เดินตามจังหวะที่ {trace.creator.name} ตั้งใจไว้</h3>
          <p>{trace.description}</p>
        </section>

        <DetailOverview trace={trace} />

        <section className="explore-detail-reason explore-detail-reason--story" aria-labelledby="explore-reason-title">
          <div className="explore-detail-reason__icon" aria-hidden="true"><ShieldCheck size={18} /></div>
          <div><span className="eyebrow">WHY THIS TRACE</span><h3 id="explore-reason-title">เหตุผลที่แนะนำให้คุณ</h3><p>{reason}</p></div>
        </section>

        <section className="explore-detail-section" aria-labelledby="explore-stops-title">
          <div className="explore-detail-section__heading"><div><span className="eyebrow">JOURNEY PLAN</span><h3 id="explore-stops-title">เรื่องราวระหว่างทาง</h3></div><span className="muted-label">{demoMode ? `${stops.length} จุดแวะ` : "ข้อมูลเส้นทาง"}</span></div>
          <StopTimeline
            stops={stops}
            demoMode={demoMode}
            onSaveStop={onSaveStop}
            onCommentSubmit={onCommentSubmit}
            onCommentEdit={onCommentEdit}
            onCommentDelete={onCommentDelete}
            onFollowCommenter={onFollowCommenter}
            onOpenMedia={onOpenMedia}
            onClose={onClose}
            onBookingUnavailable={onBookingUnavailable}
          />
        </section>

        <section className="explore-detail-section" aria-labelledby="explore-remix-title">
          <div className="explore-detail-section__heading"><div><span className="eyebrow">MORE WAYS TO WALK</span><h3 id="explore-remix-title">Remixed variations</h3></div><span className="muted-label">{trace.remixCount} Remix</span></div>
          <RemixVariations trace={trace} demoMode={demoMode} />
        </section>

        <section className="explore-detail-community" aria-labelledby="explore-proof-title">
          <div className="explore-detail-section__heading">
            <div><span className="eyebrow">COMMUNITY PROOF</span><h3 id="explore-proof-title">คนที่ไปจริง</h3></div>
            <Star size={18} aria-hidden="true" />
          </div>
          {trace.rating === null ? (
            <div className="explore-detail-unavailable" role="status"><ShieldCheck size={18} aria-hidden="true" /><div><strong>ยังไม่มีคะแนนที่ยืนยันได้</strong><p>ระบบจะแสดงคะแนนเมื่อมีข้อมูลจากคนที่ไปจริงเพียงพอ</p></div></div>
          ) : (
            <div className="explore-proof-summary">
              <strong><Star size={16} fill="currentColor" aria-hidden="true" />{trace.rating.toFixed(1)}</strong>
              <span>{trace.completionCount} คนไปจริง</span>
              <span>{trace.followerCount} คนตามรอย</span>
              <span>{trace.remixCount} Remix</span>
            </div>
          )}
        </section>

        <InlineCommentSection
          title={trace.title}
          comments={trace.comments}
          focusRequestKey={commentFocusRequestKey}
          onSubmit={onCommentSubmit}
          onEdit={onCommentEdit}
          onDelete={onCommentDelete}
          onFollowCommenter={onFollowCommenter}
        />
      </div>

      <footer className="explore-detail-panel__footer">
        <button className="icon-button icon-button--subtle explore-detail-panel__save" type="button" disabled={saveState?.pending} aria-busy={saveState?.pending || undefined} aria-label={trace.saved ? "นำ Trace ออกจากรายการบันทึก" : "บันทึก Trace"} onClick={() => handlers.onAction?.(trace, "trace")}>
          {saveState?.pending ? <span className="button-spinner" aria-hidden="true" /> : trace.saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
        </button>
        <button className="button button--white-prismatic explore-detail-panel__start" type="button" onClick={onStartJourney}>
          <Navigation size={16} aria-hidden="true" />เริ่มเดินตาม Trace
        </button>
      </footer>
      <p className="sr-only" role="status">{shareState?.error || ""}</p>
    </aside>
  );
}

export function ExploreDetailEmpty({ onClose }: { onClose?: () => void } = {}) {
  return (
    <div className="explore-detail-empty">
      <span className="explore-detail-empty__icon" aria-hidden="true"><ArrowLeft size={20} /></span>
      <span className="eyebrow">TRACE DETAIL</span>
      <h2>ข้อมูลกำลังอยู่ระหว่างการอัปเดต</h2>
      <p>รายละเอียดเส้นทางนี้ยังจัดส่งไม่ครบ จึงคงคุณไว้ในหน้าเดิมแทนการพาไปหน้า error</p>
      {onClose ? (
        <button className="text-link text-link--button" type="button" onClick={onClose}>ย้อนกลับ</button>
      ) : (
        <span className="muted-label"><ExternalLink size={14} aria-hidden="true" />เริ่มจากการ์ดฝั่งซ้าย</span>
      )}
    </div>
  );
}
