import {
  useEffect,
  useState,
  type ReactNode,
  useRef,
} from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Plus,
  Repeat2,
  Route,
  Share2,
  Star,
  UserPlus,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CommentStream } from "@/components/comment-stream";
import type { PhotoLightboxItem } from "@/components/photo-lightbox";
import {
  discoveryReasonCopy,
  type DiscoveryAction,
  type DiscoveryActionState,
  type DiscoveryCommentProfile,
  type DiscoveryItem,
  type DiscoveryPlace,
  type DiscoveryPost,
  type DiscoveryReason,
  type DiscoveryTrace,
  type DiscoveryTracer,
  type DiscoveryTracerSummary,
} from "./types";

export interface DiscoveryActionHandlers {
  onAction?: (item: DiscoveryItem, action: DiscoveryAction) => void;
  onComment?: (item: DiscoveryItem) => void;
  onOpenPostDetail?: (item: DiscoveryPost) => void;
  onInlineCommentSubmit?: (
    item: DiscoveryItem,
    body: string,
    parentId?: string,
  ) => Promise<void>;
  onCommentEdit?: (
    item: DiscoveryItem,
    commentId: string,
    body: string,
  ) => Promise<void>;
  onCommentDelete?: (item: DiscoveryItem, commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  onSelectTrace?: (item: DiscoveryTrace) => void;
  selectedTraceId?: string | null;
  activeSpyItemId?: string | null;
  onCreatorFollow?: (profile: DiscoveryTracerSummary) => void;
  creatorFollowing?: (profile: DiscoveryTracerSummary) => boolean;
  creatorFollowState?: (
    profile: DiscoveryTracerSummary,
  ) => DiscoveryActionState | undefined;
  onOpen?: (item: DiscoveryItem) => void;
  onHide?: (item: DiscoveryItem) => void;
  onImpression?: (item: DiscoveryItem, position: number) => void;
  actionState?: (
    item: DiscoveryItem,
    action: DiscoveryAction,
  ) => DiscoveryActionState | undefined;
}

function ActionButton({
  action,
  label,
  icon,
  item,
  handlers,
  selected = false,
  variant = "ghost",
}: {
  action: DiscoveryAction;
  label: string;
  icon: ReactNode;
  item: DiscoveryItem;
  handlers: DiscoveryActionHandlers;
  selected?: boolean;
  variant?: "ghost" | "primary";
}) {
  const state = handlers.actionState?.(item, action);
  const disabled = !handlers.onAction || state?.pending === true;
  return (
    <button
      className={`discovery-action discovery-action--${variant}${selected ? " is-selected" : ""}`}
      type="button"
      aria-pressed={selected}
      aria-busy={state?.pending || undefined}
      disabled={disabled}
      onClick={() => handlers.onAction?.(item, action)}
    >
      {state?.pending ? (
        <span className="button-spinner" aria-hidden="true" />
      ) : (
        icon
      )}
      <span>{state?.pending ? "กำลังบันทึก…" : label}</span>
    </button>
  );
}

function IconActionButton({
  action,
  label,
  item,
  handlers,
  icon,
  selected,
}: {
  action: DiscoveryAction;
  label: string;
  item: DiscoveryItem;
  handlers: DiscoveryActionHandlers;
  icon: ReactNode;
  selected?: boolean;
}) {
  const state = handlers.actionState?.(item, action);
  return (
    <button
      className={`discovery-icon-action${selected ? " is-selected" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={selected === undefined ? undefined : selected}
      aria-busy={state?.pending || undefined}
      disabled={!handlers.onAction || state?.pending === true}
      onClick={() => handlers.onAction?.(item, action)}
    >
      {state?.pending ? (
        <span className="button-spinner" aria-hidden="true" />
      ) : (
        icon
      )}
    </button>
  );
}

function TasteReason({ item }: { item: DiscoveryItem }) {
  return (
    <p className="taste-reason">
      <span className="taste-reason__mark" aria-hidden="true" />
      <span>{discoveryReasonCopy(item.reason)}</span>
    </p>
  );
}

function PresentationDetails({ item }: { item: DiscoveryItem }) {
  const presentation = item.presentation;
  if (!presentation) return null;
  return (
    <div className={`discovery-card__decorations discovery-card__decorations--${presentation.style}`} aria-label="รูปแบบการตกแต่งคอนเทนต์">
      <span><Palette size={12} aria-hidden="true" />{presentation.style}</span>
      {presentation.feeling && <span>{presentation.feeling}</span>}
      {presentation.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
    </div>
  );
}

function PhotoGridTile({
  item,
  index,
  total,
  onOpen,
}: {
  item: PhotoLightboxItem;
  index: number;
  total: number;
  onOpen: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  return (
    <button
      className={`discovery-photo-grid__tile discovery-photo-grid__tile--${index + 1}`}
      type="button"
      aria-label={`เปิดรูปที่ ${index + 1} ของ ${total}`}
      onClick={onOpen}
    >
      {item.src && !imageError ? (
        <img
          src={item.src}
          alt={item.alt}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="discovery-photo-grid__fallback">{item.fallback}</span>
      )}
      {index === 3 && total > 4 && (
        <span className="discovery-photo-grid__remaining" aria-hidden="true">
          +{total - 3}
        </span>
      )}
    </button>
  );
}

function PhotoGrid({
  labels,
  images,
  title,
  onOpenDetail,
}: {
  labels: readonly string[];
  images?: readonly string[];
  title: string;
  onOpenDetail?: () => void;
}) {
  const total = images && images.length > 0 ? images.length : Math.max(labels.length, 1);
  const items: PhotoLightboxItem[] = Array.from({ length: total }, (_, index) => ({
    src: images?.[index],
    alt: `${title} รูปที่ ${index + 1}`,
    fallback: labels[index] ?? "ไม่มีสื่อที่แนบ",
  }));
  const visibleItems = items.slice(0, 4);
  const variant = total === 1 ? "single" : total === 2 ? "two" : total === 3 ? "three" : "many";

  return (
    <div
      className={`discovery-photo-grid discovery-photo-grid--${variant}`}
      aria-label={`รูปภาพ ${title}`}
    >
      {visibleItems.map((item, index) => (
        <PhotoGridTile
          key={`${item.src ?? item.fallback}-${index}`}
          item={item}
          index={index}
          total={total}
          onOpen={() => onOpenDetail?.()}
        />
      ))}
    </div>
  );
}

function PlaceVisual({ item }: { item: DiscoveryPlace }) {
  return (
    <div className="discovery-place-visual" aria-hidden="true">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <span>
          {item.name
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
      )}
      <span className="discovery-place-visual__tag">{item.category}</span>
    </div>
  );
}

function CreatorProfilePopover({
  profile,
  reason,
  stats,
  handlers,
  onClose,
}: {
  profile: DiscoveryTracerSummary;
  reason: DiscoveryReason;
  stats: readonly { value: string | number; label: string }[];
  handlers: DiscoveryActionHandlers;
  onClose: () => void;
}) {
  const following = handlers.creatorFollowing?.(profile) ?? profile.following;
  const followState = handlers.creatorFollowState?.(profile);
  return (
    <div className="creator-profile-layer" role="presentation">
      <button
        className="creator-profile-layer__scrim"
        type="button"
        aria-label="ปิดโปรไฟล์ Creator"
        onClick={onClose}
      />
      <section
        className="creator-profile-popover"
        role="dialog"
        aria-modal="true"
            aria-labelledby={`creator-profile-${profile.id}`}
      >
        <header className="creator-profile-popover__header">
          <div>
            <p className="eyebrow"><UserRound size={13} aria-hidden="true" /> CREATOR PROFILE</p>
            <span className="muted-label">โปรไฟล์ผู้สร้าง Trace</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="ปิดโปรไฟล์ Creator"
            onClick={onClose}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="creator-profile-popover__identity">
          <span className="discovery-avatar discovery-avatar--large" aria-hidden="true">
            {profile.initials}
          </span>
          <div>
            <h2 id={`creator-profile-${profile.id}`}>{profile.name}</h2>
            <p>{profile.area} · {profile.expertise.join(" · ")}</p>
            <p className="creator-profile-popover__bio">
              {profile.bio ?? "ยังไม่มี Bio จาก public profile"}
            </p>
          </div>
        </div>
        <div className="creator-profile-popover__taste">
          <span className="eyebrow">TASTE MATCH</span>
          <strong>{profile.tasteMatchLabel ?? "จากเหตุผลของรายการนี้"}</strong>
          <p>{discoveryReasonCopy(reason)}</p>
        </div>
        <div className="creator-profile-popover__stats" aria-label="สถิติครีเอเตอร์">
          {stats.map((stat) => (
            <span key={stat.label}><strong>{stat.value}</strong><small>{stat.label}</small></span>
          ))}
        </div>
        {profile.profileAvailable !== false && (
          <Link
            className="creator-profile-popover__view"
            to={`/creators/${encodeURIComponent(profile.id)}`}
            onClick={onClose}
          >
            เปิด Creator profile <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
        {handlers.onCreatorFollow && (
          <button
            className="button button--dark creator-profile-popover__follow"
            type="button"
            aria-pressed={following}
            aria-busy={followState?.pending || undefined}
            disabled={followState?.pending === true}
            onClick={() => handlers.onCreatorFollow?.(profile)}
          >
            {followState?.pending ? (
              <span className="button-spinner" aria-hidden="true" />
            ) : following ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <UserPlus size={15} aria-hidden="true" />
            )}
            {followState?.pending ? "กำลังบันทึก…" : following ? "ติดตามแล้ว" : "ติดตาม Creator"}
          </button>
        )}
      </section>
    </div>
  );
}

function CardError({
  item,
  handlers,
}: {
  item: DiscoveryItem;
  handlers: DiscoveryActionHandlers;
}) {
  const errorAction = (
    ["trace", "follow", "remix", "like", "share", "hide"] as const
  ).find((action) => handlers.actionState?.(item, action)?.error);
  const error = errorAction
    ? handlers.actionState?.(item, errorAction)?.error
    : null;
  if (!error) return null;
  return (
    <p className="discovery-card__error" role="alert">
      {error}
      <button
        type="button"
        onClick={() => errorAction && handlers.onAction?.(item, errorAction)}
      >
        ลองใหม่
      </button>
    </p>
  );
}

export function TraceCard({
  item,
  handlers,
}: {
  item: DiscoveryTrace;
  handlers: DiscoveryActionHandlers;
}) {
  const [creatorProfileOpen, setCreatorProfileOpen] = useState(false);
  const selected = Boolean(
    (handlers.onSelectTrace && handlers.selectedTraceId === item.id) ||
    handlers.activeSpyItemId === item.id
  );
  useEffect(() => {
    if (!creatorProfileOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreatorProfileOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [creatorProfileOpen]);
  return (
    <article
      className={`discovery-card discovery-card--trace${selected ? " is-selected is-active-spy" : ""}${item.presentation ? ` discovery-card--style-${item.presentation.style}` : ""}`}
      data-discovery-item-id={item.id}
      aria-current={selected ? "true" : undefined}
    >
      <div className="discovery-card__header">
        <button
          className="discovery-post__creator"
          type="button"
          aria-expanded={creatorProfileOpen}
          onClick={() => setCreatorProfileOpen(true)}
        >
          <span className="discovery-avatar" aria-hidden="true">
            {item.creator.initials}
          </span>
          <span>
            <strong>{item.creator.name}</strong>
            <small>
              {item.creator.expertise.slice(0, 2).join(" · ")} · {item.area}
            </small>
          </span>
        </button>
        <div className="discovery-card__header-right">
          <TasteReason item={item} />
          {handlers.onHide && (
            <IconActionButton
              action="hide"
              label="ไม่สนใจ Trace นี้"
              item={item}
              handlers={handlers}
              icon={<MoreHorizontal size={17} aria-hidden="true" />}
            />
          )}
        </div>
      </div>
      <div className="discovery-card__body">
        <div className="discovery-card__title-row">
          <h2>
            <button
              className="discovery-card__title-button"
              type="button"
              onClick={() => {
                handlers.onOpen?.(item);
                handlers.onSelectTrace?.(item);
              }}
            >
              {item.title}
            </button>
          </h2>
          {item.rating !== null && (
            <span className="discovery-rating">
              <Star size={13} fill="currentColor" aria-hidden="true" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="discovery-card__description">{item.description}</p>
        <PresentationDetails item={item} />
        <PhotoGrid
          labels={item.coverTiles}
          images={item.coverImages}
          title={item.title}
          onOpenDetail={handlers.onSelectTrace ? () => handlers.onSelectTrace?.(item) : undefined}
        />
        <div className="discovery-card__metrics" aria-label="รายละเอียด Trace">
          <span>
            <Route size={14} aria-hidden="true" />
            {item.stopCount} stops
          </span>
          <span>
            <Clock3 size={14} aria-hidden="true" />
            {item.durationMinutes
              ? `${item.durationMinutes / 60} ชม.`
              : "ไม่ระบุเวลา"}
          </span>
          <span>
            {item.distanceKm ? `${item.distanceKm} km` : "ไม่ระบุระยะทาง"}
          </span>
          <span>{item.budgetLabel ?? "ไม่ระบุงบ"}</span>
        </div>
        <div className="discovery-card__social">
          <span>{item.followerCount} คนตามรอย</span>
          <span>{item.remixCount} Remix</span>
          {item.completionCount > 0 && (
            <span>{item.completionCount} คนไปจริง</span>
          )}
        </div>
        <CommentStream
          comments={item.comments}
          compact
          showComposer={Boolean(handlers.onInlineCommentSubmit)}
          onSubmit={handlers.onInlineCommentSubmit ? (body, parentId) => handlers.onInlineCommentSubmit?.(item, body, parentId) ?? Promise.resolve() : undefined}
          onEdit={handlers.onCommentEdit ? (commentId, body) => handlers.onCommentEdit?.(item, commentId, body) ?? Promise.resolve() : undefined}
          onDelete={handlers.onCommentDelete ? (commentId) => handlers.onCommentDelete?.(item, commentId) ?? Promise.resolve() : undefined}
          onFollowCommenter={handlers.onFollowCommenter}
          onViewAll={() => handlers.onComment?.(item)}
        />
        <div className="discovery-card__action-bar" role="toolbar" aria-label="การดำเนินการ Trace">
          <div className="discovery-action-group">
            <IconActionButton
              action="comment"
              label="แสดงความคิดเห็น"
              item={item}
              handlers={handlers}
              icon={<MessageCircle size={18} aria-hidden="true" />}
            />
            {item.comments.length > 0 && (
              <span className="discovery-count-label">{item.comments.length}</span>
            )}
          </div>
          <div className="discovery-action-group">
            <IconActionButton
              action="remix"
              label="ดัดแปลงเส้นทาง"
              item={item}
              handlers={handlers}
              icon={<Repeat2 size={18} aria-hidden="true" />}
            />
            {item.remixCount > 0 && (
              <span className="discovery-count-label">{item.remixCount}</span>
            )}
          </div>
          <div className="discovery-action-group">
            <IconActionButton
              action="trace"
              label={item.saved ? "นำออกจาก Saved" : "บันทึก Trace"}
              item={item}
              handlers={handlers}
              selected={item.saved}
              icon={item.saved ? <Check size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
            />
            {item.followerCount > 0 && (
              <span className="discovery-count-label">{item.followerCount}</span>
            )}
          </div>
          <Link
            className="discovery-icon-action"
            to={`/map?mode=traces&trace=${encodeURIComponent(item.slug)}`}
            aria-label="ดู Trace บนแผนที่"
          >
            <MapPin size={18} aria-hidden="true" />
          </Link>
          <div className="discovery-action-group">
            <IconActionButton
              action="share"
              label="แชร์ Trace"
              item={item}
              handlers={handlers}
              icon={<Share2 size={18} aria-hidden="true" />}
            />
          </div>
          {handlers.onSelectTrace && (
            <button
              className="discovery-action-detail-pill"
              type="button"
              aria-pressed={selected}
              onClick={() => handlers.onSelectTrace?.(item)}
              aria-label="ดูรายละเอียด Trace"
            >
              <span>รายละเอียด</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <CardError item={item} handlers={handlers} />
      </div>
      {creatorProfileOpen && (
        <CreatorProfilePopover
          profile={item.creator}
          reason={item.reason}
          stats={[
            { value: item.stopCount, label: "Stops" },
            { value: item.followerCount, label: "คนตามรอย" },
            { value: item.remixCount, label: "Remix" },
          ]}
          handlers={handlers}
          onClose={() => setCreatorProfileOpen(false)}
        />
      )}
    </article>
  );
}

export function PlaceCard({
  item,
  handlers,
}: {
  item: DiscoveryPlace;
  handlers: DiscoveryActionHandlers;
}) {
  const selected = handlers.activeSpyItemId === item.id;
  return (
    <article
      className={`discovery-card discovery-card--place${selected ? " is-selected is-active-spy" : ""}`}
      data-discovery-item-id={item.id}
    >
      <PlaceVisual item={item} />
      <div className="discovery-card__body">
        <div className="discovery-card__eyebrow">
          <span>PLACE</span>
          <TasteReason item={item} />
        </div>
        <div className="discovery-card__title-row">
          <div>
            <h2>
              <Link
                to={`/stores/${item.slug}`}
                onClick={() => handlers.onOpen?.(item)}
              >
                {item.name}
              </Link>
            </h2>
            <p className="discovery-card__creator">
              {item.category} · {item.area} · {item.priceLabel}
            </p>
          </div>
          <span
            className={`discovery-open-state${item.openNow === true ? " is-open" : ""}`}
          >
            {item.openNow === true
              ? "เปิดอยู่"
              : item.openNow === false
                ? "ปิดอยู่"
                : "ดูเวลา"}
          </span>
        </div>
        <p className="discovery-card__description">{item.description}</p>
        <p className="discovery-place-graph">
          อยู่ใน {item.traceCount} Traces ที่คุณน่าจะชอบ
        </p>
        {item.isAevoPlayPartner && (
          <p className="discovery-place-partner">
            <Zap size={13} aria-hidden="true" />
            จองโต๊ะทันทีผ่าน Aevo Play
          </p>
        )}
        <div className="discovery-card__actions">
          <ActionButton
            action="trace"
            label={item.saved ? "บันทึกแล้ว" : "Trace It"}
            icon={
              item.saved ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Bookmark size={15} aria-hidden="true" />
              )
            }
            item={item}
            handlers={handlers}
            selected={item.saved}
            variant="primary"
          />
          <Link
            className="discovery-action discovery-action--ghost"
            to={`/map?mode=places&selected=${encodeURIComponent(item.slug)}`}
          >
            <MapPin size={15} aria-hidden="true" />
            ดูบนแผนที่
          </Link>
          <Link className="discovery-action discovery-action--ghost" to={`/create?type=trace&place=${encodeURIComponent(item.slug)}`}>
            <Plus size={15} aria-hidden="true" />เพิ่มใน Trace
          </Link>
          {item.isAevoPlayPartner && (
            <Link
              className="discovery-action discovery-action--partner"
              to={`/stores/${item.venueSlug ?? item.slug}/booking`}
            >
              <Zap size={15} aria-hidden="true" />จองสิทธิ์
            </Link>
          )}
          <IconActionButton
            action="comment"
            label="ดูความคิดเห็น"
            item={item}
            handlers={handlers}
            icon={<MessageCircle size={17} aria-hidden="true" />}
          />
        </div>
        <CardError item={item} handlers={handlers} />
      </div>
    </article>
  );
}

export function PostCard({
  item,
  handlers,
}: {
  item: DiscoveryPost;
  handlers: DiscoveryActionHandlers;
}) {
  const [creatorProfileOpen, setCreatorProfileOpen] = useState(false);
  useEffect(() => {
    if (!creatorProfileOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreatorProfileOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [creatorProfileOpen]);
  const selected = handlers.activeSpyItemId === item.id;
  return (
    <article
      className={`discovery-card discovery-card--post${selected ? " is-selected is-active-spy" : ""}${item.presentation ? ` discovery-card--style-${item.presentation.style}` : ""}`}
      data-discovery-item-id={item.id}
    >
      <div className="discovery-card__header">
        <button
          className="discovery-post__creator"
          type="button"
          aria-expanded={creatorProfileOpen}
          onClick={() => setCreatorProfileOpen(true)}
        >
          <span className="discovery-avatar" aria-hidden="true">
            {item.author.initials}
          </span>
          <span>
            <strong>{item.author.name}</strong>
            <small>
              {item.author.expertise.slice(0, 2).join(" · ")} · {item.publishedLabel}
            </small>
          </span>
        </button>
        <div className="discovery-card__header-right">
          <TasteReason item={item} />
          {handlers.onHide && (
            <IconActionButton
              action="hide"
              label="เมนูเพิ่มเติม"
              item={item}
              handlers={handlers}
              icon={<MoreHorizontal size={17} aria-hidden="true" />}
            />
          )}
        </div>
      </div>
      <div className="discovery-card__body">
        <p className="discovery-post__body">{item.body}</p>
        <PresentationDetails item={item} />
        <PhotoGrid
          labels={item.mediaLabels}
          images={item.mediaImages}
          title={`โพสต์ของ ${item.author.name}`}
          onOpenDetail={() => {
            if (handlers.onOpenPostDetail) {
              handlers.onOpenPostDetail(item);
            } else if (handlers.onComment) {
              handlers.onComment(item);
            }
          }}
        />
        {item.attachedObject && (
          <button
            className="discovery-attached-object"
            type="button"
            onClick={() => {
              handlers.onOpen?.(item);
              if (handlers.onOpenPostDetail) handlers.onOpenPostDetail(item);
              else handlers.onComment?.(item);
            }}
          >
            <span className="discovery-attached-object__type">
              {item.attachedObject.itemType === "TRACE" ? "TRACE" : "PLACE"}
            </span>
            <span>
              <strong>{item.attachedObject.title}</strong>
              <small>{item.attachedObject.subtitle}</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <CommentStream
          comments={item.comments}
          compact
          showComposer={Boolean(handlers.onInlineCommentSubmit)}
          onSubmit={handlers.onInlineCommentSubmit ? (body, parentId) => handlers.onInlineCommentSubmit?.(item, body, parentId) ?? Promise.resolve() : undefined}
          onEdit={handlers.onCommentEdit ? (commentId, body) => handlers.onCommentEdit?.(item, commentId, body) ?? Promise.resolve() : undefined}
          onDelete={handlers.onCommentDelete ? (commentId) => handlers.onCommentDelete?.(item, commentId) ?? Promise.resolve() : undefined}
          onFollowCommenter={handlers.onFollowCommenter}
          onViewAll={() => handlers.onComment?.(item)}
        />
        <div className="discovery-card__action-bar" role="toolbar" aria-label="การดำเนินการโพสต์">
          <div className="discovery-action-group">
            <IconActionButton
              action="comment"
              label="แสดงความคิดเห็น"
              item={item}
              handlers={handlers}
              icon={<MessageCircle size={18} aria-hidden="true" />}
            />
            {item.comments.length > 0 && (
              <span className="discovery-count-label">{item.comments.length}</span>
            )}
          </div>
          <div className="discovery-action-group">
            <IconActionButton
              action="like"
              label={item.liked ? "ยกเลิกถูกใจ" : "ถูกใจ"}
              item={item}
              handlers={handlers}
              selected={item.liked}
              icon={
                <Heart
                  size={18}
                  fill={item.liked ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              }
            />
            {item.likeCount > 0 && (
              <span className="discovery-count-label">{item.likeCount}</span>
            )}
          </div>
          <div className="discovery-action-group">
            <IconActionButton
              action="share"
              label="แชร์โพสต์"
              item={item}
              handlers={handlers}
              icon={<Share2 size={18} aria-hidden="true" />}
            />
          </div>
        </div>
        <CardError item={item} handlers={handlers} />
      </div>
      {creatorProfileOpen && (
        <CreatorProfilePopover
          profile={item.author}
          reason={item.reason}
          stats={[
            { value: item.likeCount, label: "ถูกใจ" },
            { value: item.comments.length, label: "ความเห็น" },
            { value: item.author.expertise.length, label: "ความถนัด" },
          ]}
          handlers={handlers}
          onClose={() => setCreatorProfileOpen(false)}
        />
      )}
    </article>
  );
}

export function TracerCard({
  item,
  handlers,
}: {
  item: DiscoveryTracer;
  handlers: DiscoveryActionHandlers;
}) {
  const selected = handlers.activeSpyItemId === item.id;
  return (
    <article
      className={`discovery-card discovery-card--tracer${selected ? " is-selected is-active-spy" : ""}`}
      data-discovery-item-id={item.id}
    >
      <div className="discovery-post__header">
        <div className="discovery-avatar" aria-hidden="true">
          {item.tracer.initials}
        </div>
        <div>
          <p className="eyebrow">TRACER RECOMMENDATION</p>
          <h2>{item.tracer.name}</h2>
          <p>
            {item.tracer.area} · {item.tracer.expertise.slice(0, 2).join(" · ")}
          </p>
        </div>
        <TasteReason item={item} />
      </div>
      <div className="discovery-card__body">
        <p className="discovery-tracer-match">{item.tasteMatchLabel}</p>
        <Link
          className="discovery-attached-object"
          to={`/traces/${item.featuredTrace.slug}`}
        >
          <span className="discovery-attached-object__type">TRACE</span>
          <span>
            <strong>{item.featuredTrace.title}</strong>
            <small>
              {item.featuredTrace.stopCount} stops · {item.featuredTrace.area}
            </small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <div className="discovery-card__actions">
          <ActionButton
            action="follow"
            label={item.tracer.following ? "ติดตามแล้ว" : "Follow"}
            icon={
              item.tracer.following ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <UserPlus size={15} aria-hidden="true" />
              )
            }
            item={item}
            handlers={handlers}
            selected={item.tracer.following}
            variant="primary"
          />
          <span className="discovery-count-label">
            {item.followerCount} followers
          </span>
        </div>
        <CardError item={item} handlers={handlers} />
      </div>
    </article>
  );
}

export function DiscoveryCard({
  item,
  handlers,
}: {
  item: DiscoveryItem;
  handlers: DiscoveryActionHandlers;
}) {
  const card =
    item.itemType === "TRACE" ? (
      <TraceCard item={item} handlers={handlers} />
    ) : item.itemType === "PLACE" ? (
      <PlaceCard item={item} handlers={handlers} />
    ) : item.itemType === "POST" ? (
      <PostCard item={item} handlers={handlers} />
    ) : (
      <TracerCard item={item} handlers={handlers} />
    );
  return (
    <DiscoveryImpression item={item} onImpression={handlers.onImpression}>
      {card}
    </DiscoveryImpression>
  );
}

function DiscoveryImpression({
  item,
  onImpression,
  children,
}: {
  item: DiscoveryItem;
  onImpression?: (item: DiscoveryItem, position: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (
      !node ||
      reported.current ||
      !onImpression ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) {
          if (dwellTimer.current !== null) {
            clearTimeout(dwellTimer.current);
            dwellTimer.current = null;
          }
          return;
        }
        if (reported.current) return;
        if (dwellTimer.current !== null) return;
        dwellTimer.current = setTimeout(() => {
          dwellTimer.current = null;
          if (reported.current) return;
          reported.current = true;
          const position = [...(node.parentElement?.children ?? [])].indexOf(
            node,
          );
          onImpression(item, position < 0 ? 0 : position);
          observer.disconnect();
        }, 1_000);
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (dwellTimer.current !== null) {
        clearTimeout(dwellTimer.current);
        dwellTimer.current = null;
      }
    };
  }, [item, onImpression]);
  return (
    <div ref={ref} className="discovery-card-observer">
      {children}
    </div>
  );
}
