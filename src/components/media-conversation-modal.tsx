import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type TouchEvent,
  type WheelEvent,
  type CSSProperties,
} from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  MapPin,
  Navigation,
  Route,
  Send,
  Share2,
  UserPlus,
  X,
} from "lucide-react";
import { CommentStream } from "@/components/comment-stream";
import type {
  DiscoveryComment,
  DiscoveryCommentProfile,
  DiscoveryPost,
  DiscoveryTrace,
} from "@/features/discovery/types";

export interface MediaConversationModalProps {
  trace?: DiscoveryTrace | null;
  post?: DiscoveryPost | null;
  demoMode?: boolean;
  initialImageIndex?: number;
  autoFocusComposer?: boolean;
  creatorFollowing?: boolean;
  creatorFollowPending?: boolean;
  onFollowCreator?: () => void;
  saved?: boolean;
  savePending?: boolean;
  onSave?: () => void;
  liked?: boolean;
  likePending?: boolean;
  likeCount?: number;
  onLike?: () => void;
  onShare?: () => void;
  onStartJourney?: () => void;
  onCommentSubmit?: (body: string, parentId?: string) => Promise<void>;
  onCommentEdit?: (commentId: string, body: string) => Promise<void>;
  onCommentDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  onClose: () => void;
}

interface MediaItem {
  id: string;
  src?: string;
  alt: string;
  fallback: string;
  title: string;
  location: string;
  note: string;
  comments: readonly DiscoveryComment[];
}

interface TouchStart {
  x: number;
  y: number;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} ชม.` : `${hours} ชม. ${remainder} นาที`;
}

function createMediaItems(
  trace: DiscoveryTrace | null,
  post: DiscoveryPost | null,
): readonly MediaItem[] {
  const comments = post?.comments ?? trace?.comments ?? [];
  const note = post?.body ?? trace?.description ?? "ยังไม่มีคำบรรยายจากผู้สร้าง";
  const location = post?.attachedObject?.subtitle ?? post?.author.area ?? trace?.area ?? "—";

  if (post) {
    const imageSources = post.mediaImages ?? [];
    const labels = post.mediaLabels.length > 0 ? post.mediaLabels : ["POST"];
    const count = Math.max(imageSources.length, labels.length, 1);
    return Array.from({ length: count }, (_, index) => ({
      id: `${post.id}-media-${index}`,
      src: imageSources[index],
      alt: `${post.author.name} รูปที่ ${index + 1}`,
      fallback: labels[index] ?? `ภาพประสบการณ์ ${index + 1}`,
      title: post.attachedObject?.title ?? `${post.author.name} field note`,
      location,
      note,
      comments,
    }));
  }

  if (trace) {
    const imageSources = trace.coverImages ?? [];
    const labels = trace.coverTiles.length > 0 ? trace.coverTiles : [trace.area];
    const count = Math.max(imageSources.length, labels.length, 1);
    return Array.from({ length: count }, (_, index) => ({
      id: `${trace.id}-media-${index}`,
      src: imageSources[index],
      alt: `${trace.title} ภาพที่ ${index + 1}`,
      fallback: labels[index] ?? `Stop ${String(index + 1).padStart(2, "0")}`,
      title: trace.title,
      location: trace.area,
      note,
      comments,
    }));
  }

  return [{
    id: "media-empty",
    alt: "ไม่มีสื่อ",
    fallback: "ไม่มีสื่อ",
    title: "ไม่มีรายการที่เลือก",
    location: "—",
    note: "ยังไม่มีข้อมูล media สำหรับรายการนี้",
    comments: [],
  }];
}

interface CardTransform {
  offsetY: number;
  offsetX: number;
  rotateDeg: number;
  scale: number;
  zIndex: number;
  opacity: number;
  brightness: number;
  pointerEvents: CSSProperties["pointerEvents"];
}

// Deterministic playful tilt angles and horizontal drift for an organic card deck feel
const STACK_TILTS = [
  { rotate: 2.2, offsetX: 10 },
  { rotate: -2.8, offsetX: -12 },
  { rotate: 3.4, offsetX: 14 },
  { rotate: -3.8, offsetX: -16 },
  { rotate: 4.2, offsetX: 18 },
];

function getCardTransform(index: number, activeIndex: number): CardTransform {
  if (index === activeIndex) {
    return {
      offsetY: 0,
      offsetX: 0,
      rotateDeg: 0,
      scale: 1,
      zIndex: 30,
      opacity: 1,
      brightness: 1,
      pointerEvents: "auto",
    };
  }

  // Upcoming cards: stacked behind the active card with playful organic tilt and horizontal drift
  if (index > activeIndex) {
    const depth = index - activeIndex;
    const tiltIndex = (depth - 1) % STACK_TILTS.length;
    const tilt = STACK_TILTS[tiltIndex] ?? { rotate: 2, offsetX: 8 };
    const offsetY = -depth * 20;
    const offsetX = tilt.offsetX;
    const rotateDeg = tilt.rotate;
    const scale = Math.max(0.86, 1 - depth * 0.035);
    const zIndex = Math.max(1, 30 - depth * 4);
    const opacity = Math.max(0.38, 1 - depth * 0.15);
    const brightness = Math.max(0.5, 1 - depth * 0.18);
    return {
      offsetY,
      offsetX,
      rotateDeg,
      scale,
      zIndex,
      opacity,
      brightness,
      pointerEvents: "auto",
    };
  }

  // Past cards: transitioned upward off-screen, subtly tilted and faded out
  const pastDepth = activeIndex - index;
  const pastTiltIndex = (pastDepth - 1) % STACK_TILTS.length;
  const pastTilt = STACK_TILTS[pastTiltIndex] ?? { rotate: -2, offsetX: -8 };
  const offsetY = -70 - pastDepth * 20;
  const offsetX = -pastTilt.offsetX * 0.6;
  const rotateDeg = -pastTilt.rotate * 0.8;
  const scale = 0.94;
  const zIndex = Math.max(1, 10 - pastDepth);
  return {
    offsetY,
    offsetX,
    rotateDeg,
    scale,
    zIndex,
    opacity: 0,
    brightness: 0.4,
    pointerEvents: "none",
  };
}

export function MediaConversationModal({
  trace = null,
  post = null,
  demoMode = false,
  initialImageIndex = 0,
  autoFocusComposer = false,
  creatorFollowing = false,
  creatorFollowPending = false,
  onFollowCreator,
  saved,
  savePending = false,
  onSave,
  liked,
  likePending = false,
  likeCount,
  onLike,
  onShare,
  onStartJourney,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onFollowCommenter,
  onClose,
}: MediaConversationModalProps) {
  const mediaItems = useMemo(() => createMediaItems(trace, post), [post, trace]);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(initialImageIndex, 0), Math.max(mediaItems.length - 1, 0)),
  );
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());
  const [isChanging, setIsChanging] = useState(false);
  const [composerBody, setComposerBody] = useState("");
  const [replyTo, setReplyTo] = useState<DiscoveryComment | null>(null);
  const [pendingComment, setPendingComment] = useState(false);
  const [conversationNotice, setConversationNotice] = useState("");
  const [localComments, setLocalComments] = useState<Record<string, DiscoveryComment[]>>({});
  const [localLiked, setLocalLiked] = useState(liked ?? false);
  const [localSaved, setLocalSaved] = useState(saved ?? false);
  const [localNotice, setLocalNotice] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const wheelLockTimerRef = useRef<number | null>(null);
  const isWheelLockedRef = useRef(false);
  const touchLockTimerRef = useRef<number | null>(null);
  const isTouchLockedRef = useRef(false);
  const touchStartRef = useRef<TouchStart | null>(null);
  const closeRef = useRef(onClose);
  const activeItem = mediaItems[activeIndex] ?? mediaItems[0];

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousScrollY = window.scrollY;
    const previousDocumentScrollTop = document.scrollingElement?.scrollTop ?? previousScrollY;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(mediaItems.length - 1, current + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      if (wheelLockTimerRef.current !== null) {
        window.clearTimeout(wheelLockTimerRef.current);
      }
      if (touchLockTimerRef.current !== null) {
        window.clearTimeout(touchLockTimerRef.current);
      }
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.documentElement.scrollTop = previousScrollY;
      document.body.scrollTop = previousScrollY;
      if (document.scrollingElement) document.scrollingElement.scrollTop = previousDocumentScrollTop;
    };
  }, [mediaItems.length]);

  useEffect(() => {
    if (activeIndex >= mediaItems.length) setActiveIndex(Math.max(mediaItems.length - 1, 0));
    setFailedImages((current) => {
      const next = new Set(current);
      next.delete(activeIndex);
      return next;
    });
    setIsChanging(true);
    const timer = window.setTimeout(() => setIsChanging(false), 150);
    setReplyTo(null);
    setConversationNotice("");
    return () => window.clearTimeout(timer);
  }, [activeIndex, mediaItems.length]);

  useEffect(() => {
    setLocalLiked(liked ?? false);
  }, [liked, post?.id, trace?.id]);

  useEffect(() => {
    setLocalSaved(saved ?? false);
  }, [saved, post?.id, trace?.id]);

  useEffect(() => {
    if (!autoFocusComposer || !onCommentSubmit) return;
    const frame = window.requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, autoFocusComposer, onCommentSubmit]);

  if (!activeItem) return null;

  const comments = localComments[activeItem.id] ?? [...activeItem.comments];
  const creator = post?.author ?? trace?.creator;
  const title = post?.attachedObject?.title ?? post?.body ?? trace?.title ?? activeItem.title;
  const count = likeCount ?? 0;
  const effectiveLiked = localLiked;
  const effectiveSaved = localSaved;
  const displayedLikeCount = count + (effectiveLiked && !liked ? 1 : 0);
  const commentEnabled = Boolean(onCommentSubmit);

  const stepCard = (offset: number) => {
    if (mediaItems.length < 2) return;
    setActiveIndex((current) => Math.min(mediaItems.length - 1, Math.max(0, current + offset)));
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (mediaItems.length < 2) return;
    if (isWheelLockedRef.current) return;

    const delta = event.deltaY;
    if (Math.abs(delta) < 18) return;

    // Single Intent Wheel Handler: Lock immediately for 450ms
    isWheelLockedRef.current = true;
    const direction = delta > 0 ? 1 : -1;
    setActiveIndex((current) => Math.min(mediaItems.length - 1, Math.max(0, current + direction)));

    if (wheelLockTimerRef.current !== null) {
      window.clearTimeout(wheelLockTimerRef.current);
    }
    wheelLockTimerRef.current = window.setTimeout(() => {
      isWheelLockedRef.current = false;
      wheelLockTimerRef.current = null;
    }, 450);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || isTouchLockedRef.current || mediaItems.length < 2) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) < 40 || Math.abs(deltaY) <= Math.abs(deltaX)) return;

    isTouchLockedRef.current = true;
    const direction = deltaY < 0 ? 1 : -1;
    setActiveIndex((current) => Math.min(mediaItems.length - 1, Math.max(0, current + direction)));

    if (touchLockTimerRef.current !== null) {
      window.clearTimeout(touchLockTimerRef.current);
    }
    touchLockTimerRef.current = window.setTimeout(() => {
      isTouchLockedRef.current = false;
      touchLockTimerRef.current = null;
    }, 450);
  };

  const handleLike = () => {
    if (onLike) {
      if (demoMode) setLocalLiked((current) => !current);
      onLike();
      return;
    }
    if (demoMode) {
      setLocalLiked((current) => !current);
      return;
    }
    setLocalNotice("การกดถูกใจจะพร้อมเมื่อเชื่อมต่อ Customer Gateway");
  };

  const handleSave = () => {
    if (onSave) {
      if (demoMode) setLocalSaved((current) => !current);
      onSave();
      return;
    }
    if (demoMode) {
      setLocalSaved((current) => !current);
      return;
    }
    setLocalNotice("การบันทึกจะพร้อมเมื่อเชื่อมต่อ Customer Gateway");
  };

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        setLocalNotice("เปิด share sheet แล้ว");
      } catch {
        // A cancelled native share is not an error.
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href)
        .then(() => setLocalNotice("คัดลอกลิงก์แล้ว"))
        .catch(() => setLocalNotice("ยังไม่สามารถคัดลอกลิงก์ได้"));
      return;
    }
    setLocalNotice("อุปกรณ์นี้ยังไม่รองรับการแชร์");
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = composerBody.trim();
    if (!body || pendingComment || !onCommentSubmit) return;
    const optimistic: DiscoveryComment = {
      id: `local-media-comment-${Date.now()}`,
      authorName: "คุณ",
      authorInitials: "คุณ",
      body,
      createdAt: "เมื่อสักครู่",
      ...(replyTo ? { parentId: replyTo.id } : {}),
    };
    setPendingComment(true);
    setConversationNotice("");
    setLocalComments((current) => ({
      ...current,
      [activeItem.id]: [...(current[activeItem.id] ?? activeItem.comments), optimistic],
    }));
    setComposerBody("");
    try {
      await onCommentSubmit(body, replyTo?.id);
      setReplyTo(null);
      setConversationNotice("ส่งความคิดเห็นแล้ว");
    } catch {
      setLocalComments((current) => ({
        ...current,
        [activeItem.id]: (current[activeItem.id] ?? activeItem.comments).filter((comment) => comment.id !== optimistic.id),
      }));
      setComposerBody(body);
      setConversationNotice("ส่งความคิดเห็นไม่สำเร็จ ลองใหม่ได้");
    } finally {
      setPendingComment(false);
    }
  };

  return (
    <div
      className="media-conversation-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Media Viewer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <section
        className="media-conversation-modal__canvas"
        aria-label="Media viewer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div className="media-conversation-modal__canvas-topline">
          <div className="media-conversation-modal__nav-indicators">
            <div className="media-conversation-modal__counter-pill">
              <span
                className="media-conversation-modal__count"
                aria-label={`${activeIndex + 1} of ${mediaItems.length}`}
              >
                {activeIndex + 1} / {mediaItems.length}
              </span>
              {mediaItems.length > 1 && (
                <span className="media-conversation-modal__status-text">
                  {activeIndex === mediaItems.length - 1
                    ? "รูปสุดท้าย"
                    : `เหลืออีก ${mediaItems.length - 1 - activeIndex} รูป`}
                </span>
              )}
            </div>
            {mediaItems.length > 1 && (
              <div className="media-conversation-modal__step-controls">
                <button
                  type="button"
                  className="media-conversation-modal__step-btn"
                  onClick={() => stepCard(-1)}
                  disabled={activeIndex === 0}
                  aria-label="ภาพก่อนหน้า"
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="media-conversation-modal__step-btn"
                  onClick={() => stepCard(1)}
                  disabled={activeIndex === mediaItems.length - 1}
                  aria-label="ภาพถัดไป"
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* Interactive Story Segments Progress */}
          {mediaItems.length > 1 && (
            <div
              className="media-conversation-modal__progress-segments"
              role="tablist"
              aria-label="ลำดับรูปภาพ"
            >
              {mediaItems.map((_, idx) => {
                const isCurrent = idx === activeIndex;
                const isPast = idx < activeIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    aria-label={`ไปยังรูปที่ ${idx + 1} จาก ${mediaItems.length}`}
                    className={`media-conversation-modal__segment${isCurrent ? " is-active" : ""}${isPast ? " is-past" : ""}`}
                    onClick={() => setActiveIndex(idx)}
                  />
                );
              })}
            </div>
          )}

          <span className="eyebrow">MEDIA / {post ? "POST" : "TRACE"}</span>
        </div>

        {/* Floating Side Quick Navigation Chevrons */}
        {mediaItems.length > 1 && (
          <>
            <button
              type="button"
              className="media-conversation-modal__nav-side-btn is-prev"
              onClick={() => stepCard(-1)}
              disabled={activeIndex === 0}
              aria-label="เลื่อนไปรูปก่อนหน้า"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="media-conversation-modal__nav-side-btn is-next"
              onClick={() => stepCard(1)}
              disabled={activeIndex === mediaItems.length - 1}
              aria-label="เลื่อนไปรูปถัดไป"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        )}

        {/* Layered Scroll Stack Stage */}
        <div
          className="media-conversation-modal__stack-stage"
          tabIndex={0}
          aria-label="Scroll Stack media"
        >
          {mediaItems.map((item, index) => {
            const transform = getCardTransform(index, activeIndex);
            const isActive = index === activeIndex;
            const isStacked = index > activeIndex;

            return (
              <div
                key={item.id}
                className={`media-conversation-modal__stack-card${isActive ? " is-active" : isStacked ? " is-stacked" : " is-past"}`}
                style={{
                  transform: `translate3d(${transform.offsetX}px, ${transform.offsetY}px, 0) scale(${transform.scale}) rotate(${transform.rotateDeg}deg)`,
                  transformOrigin: "center 88%",
                  zIndex: transform.zIndex,
                  opacity: transform.opacity,
                  filter: `brightness(${transform.brightness})`,
                  pointerEvents: transform.pointerEvents,
                }}
                onClick={() => {
                  if (!isActive && isStacked) {
                    setActiveIndex(index);
                  }
                }}
                data-stack-index={index}
                data-stack-slot={index - activeIndex}
              >
                {/* Stack Header Spine */}
                <div className="media-conversation-modal__card-header-spine">
                  <div className="media-conversation-modal__card-spine-left">
                    <span className="media-conversation-modal__card-spine-badge">
                      {item.fallback}
                    </span>
                    <span className="media-conversation-modal__card-spine-title">
                      {item.title}
                    </span>
                  </div>
                  <span className="media-conversation-modal__card-spine-tag">
                    {item.location}
                  </span>
                </div>

                {/* Card Main Stage */}
                <div className="media-conversation-modal__image-stage">
                  {item.src && !failedImages.has(index) ? (
                    <>
                      <div
                        className="media-conversation-modal__image-blur-bg"
                        style={{ backgroundImage: `url(${item.src})` }}
                        aria-hidden="true"
                      />
                      <img
                        className="media-conversation-modal__image"
                        src={item.src}
                        alt={item.alt}
                        onError={() => setFailedImages((current) => new Set(current).add(index))}
                        draggable={false}
                      />
                    </>
                  ) : (
                    <span className="media-conversation-modal__fallback">{item.fallback}</span>
                  )}
                </div>

                {/* Card Caption Overlay */}
                <div className="media-conversation-modal__caption">
                  <span className="eyebrow">{item.location}</span>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="media-conversation-modal__panel">
        <span className="media-conversation-modal__handle" aria-hidden="true" />
        <header className="media-conversation-modal__header">
          <div className="media-conversation-modal__creator">
            <span className="creator-profile-avatar creator-profile-avatar--small" aria-hidden="true">{creator?.initials ?? "AG"}</span>
            <div>
              <strong>{creator?.name ?? "Aevocado Go"}</strong>
              <span>{creator?.area ?? activeItem.location}{trace?.creator.tasteMatchLabel ? ` · ${trace.creator.tasteMatchLabel}` : ""}</span>
            </div>
          </div>
          <div className="media-conversation-modal__header-actions">
            {onFollowCreator && <button className={`media-conversation-modal__follow${creatorFollowing ? " is-following" : ""}`} type="button" onClick={onFollowCreator} disabled={creatorFollowPending} aria-pressed={creatorFollowing} aria-busy={creatorFollowPending}>
              {creatorFollowing ? <Check size={14} aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
              {creatorFollowing ? "ติดตามแล้ว" : "ติดตาม"}
            </button>}
            <button ref={closeButtonRef} className="media-conversation-modal__close" type="button" onClick={() => closeRef.current()} aria-label="ปิด Media Viewer"><X size={20} aria-hidden="true" /></button>
          </div>
        </header>

        <div className={`media-conversation-modal__discussion${isChanging ? " is-changing" : ""}`}>
          <div className="media-conversation-modal__story" key={activeItem.id}>
            <span className="eyebrow">{post ? "FIELD NOTE" : "TRACE STORY"}</span>
            <h2 id="media-conversation-modal-title">{activeItem.title}</h2>
            <div className="media-conversation-modal__place"><MapPin size={14} aria-hidden="true" /><span>{activeItem.location}</span></div>
            <p>{activeItem.note}</p>
            {trace && <div className="media-conversation-modal__trace-summary"><Route size={15} aria-hidden="true" /><span>{trace.stopCount} stops · {formatDuration(trace.durationMinutes)} · {trace.distanceKm === null ? "—" : `${trace.distanceKm} km`}</span>{onStartJourney && <button type="button" onClick={onStartJourney}><Navigation size={14} aria-hidden="true" />เริ่มเดินทาง</button>}</div>}
          </div>

          <div className="media-conversation-modal__interactions" aria-label="การกระทำกับคอนเทนต์">
            <button className={effectiveLiked ? "is-selected" : ""} type="button" onClick={handleLike} disabled={likePending} aria-pressed={effectiveLiked}>
              <Heart size={17} fill={effectiveLiked ? "currentColor" : "none"} aria-hidden="true" />{displayedLikeCount > 0 ? displayedLikeCount : "ถูกใจ"}
            </button>
            <button className={effectiveSaved ? "is-selected" : ""} type="button" onClick={handleSave} disabled={savePending} aria-pressed={effectiveSaved}>
              {effectiveSaved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />} {effectiveSaved ? "บันทึกแล้ว" : "บันทึก"}
            </button>
            <button type="button" onClick={() => void handleShare()}><Share2 size={17} aria-hidden="true" />แชร์</button>
          </div>

          <section className="media-conversation-modal__comments" aria-labelledby="media-conversation-comments-title">
            <div className="media-conversation-modal__comments-heading"><div><span className="eyebrow">DISCUSSION</span><h3 id="media-conversation-comments-title">บทสนทนา</h3></div><span>{comments.length} ความคิดเห็น</span></div>
            <CommentStream
              comments={comments}
              onSubmit={onCommentSubmit}
              onReply={(comment) => { setReplyTo(comment); composerRef.current?.focus({ preventScroll: true }); }}
              onEdit={onCommentEdit ?? (demoMode ? async (commentId, body) => {
                setLocalComments((current) => ({ ...current, [activeItem.id]: (current[activeItem.id] ?? activeItem.comments).map((comment) => comment.id === commentId ? { ...comment, body, isEdited: true } : comment) }));
              } : undefined)}
              onDelete={onCommentDelete ?? (demoMode ? async (commentId) => {
                setLocalComments((current) => ({ ...current, [activeItem.id]: (current[activeItem.id] ?? activeItem.comments).filter((comment) => comment.id !== commentId && comment.parentId !== commentId) }));
              } : undefined)}
              onFollowCommenter={onFollowCommenter}
            />
          </section>
        </div>

        <form className="media-conversation-modal__composer" onSubmit={(event) => void submitComment(event)}>
          <div className="media-conversation-modal__composer-label"><span>{replyTo ? `กำลังตอบ ${replyTo.authorName}` : "เขียนความคิดเห็น"}</span>{replyTo && <button type="button" onClick={() => setReplyTo(null)}>ยกเลิก</button>}</div>
          <div className="media-conversation-modal__composer-row">
            <textarea ref={composerRef} value={composerBody} onChange={(event) => setComposerBody(event.target.value)} placeholder={commentEnabled ? "แบ่งปันสิ่งที่คุณพบระหว่างทาง…" : "ความคิดเห็นจะพร้อมเมื่อเชื่อมต่อ Customer Gateway"} aria-label="เขียนความคิดเห็น" maxLength={1000} disabled={!commentEnabled || pendingComment} rows={1} />
            <button className="media-conversation-modal__send" type="submit" disabled={!commentEnabled || pendingComment || !composerBody.trim()} aria-busy={pendingComment} aria-label="ส่งความคิดเห็น"><Send size={17} aria-hidden="true" /></button>
          </div>
          {(conversationNotice || localNotice) && <p className="media-conversation-modal__notice" role="status">{conversationNotice || localNotice}</p>}
        </form>
      </aside>
    </div>
  );
}
