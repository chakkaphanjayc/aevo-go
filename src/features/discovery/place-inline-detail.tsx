import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ExternalLink,
  MapPin,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { InlineCommentSection } from "@/components/inline-comment-section";
import { placeApiMode } from "@/lib/env";
import type { DiscoveryCommentProfile, DiscoveryPlace } from "./types";

export interface PlaceInlineDetailProps {
  place: DiscoveryPlace;
  demoMode: boolean;
  onClose: () => void;
  saved?: boolean;
  onSave?: () => void;
  commentFocusRequestKey?: number;
  onCommentSubmit?: (body: string, parentId?: string) => Promise<void>;
  onCommentEdit?: (commentId: string, body: string) => Promise<void>;
  onCommentDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
}

function placeMapHref(place: DiscoveryPlace): string {
  const selection = placeApiMode === "canonical"
    ? place.canonicalPlaceId ?? place.slug
    : place.slug;
  return `/map?mode=places&selected=${encodeURIComponent(selection)}`;
}

function placeDetailHref(place: DiscoveryPlace): string {
  if (placeApiMode === "canonical" && place.canonicalPlaceId) {
    return `/places/${encodeURIComponent(place.canonicalPlaceId)}`;
  }
  return placeApiMode === "canonical"
    ? `/map?mode=places&q=${encodeURIComponent(place.name)}`
    : `/stores/${encodeURIComponent(place.slug)}`;
}

export function PlaceInlineDetail({
  place,
  demoMode,
  onClose,
  saved = place.saved,
  onSave,
  commentFocusRequestKey = 0,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onFollowCommenter,
}: PlaceInlineDetailProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const canBook = place.isAevoPlayPartner === true &&
    (placeApiMode !== "canonical" || Boolean(place.venueSlug));

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [place.id, place.imageUrl]);

  return (
    <aside className="explore-detail-panel place-inline-detail" aria-label={`รายละเอียดสถานที่ ${place.name}`}>
      <header className="explore-detail-panel__header explore-detail-story-header">
        <div className="explore-detail-story-header__copy">
          <p className="eyebrow">PLACE / {place.area}</p>
          <h2>{place.name}</h2>
          <div className="explore-detail-story-meta">
            <span className="discovery-avatar" aria-hidden="true"><MapPin size={15} /></span>
            <strong>{place.category}</strong>
            <span aria-hidden="true">·</span>
            <span>{place.priceLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{place.openNow === true ? "เปิดอยู่" : place.openNow === false ? "ปิดอยู่" : "เช็กเวลา"}</span>
          </div>
        </div>
        <div className="explore-detail-panel__header-actions">
          <button className="explore-detail-panel__back" type="button" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden="true" />ย้อนกลับ
          </button>
          <button className="icon-button icon-button--subtle" type="button" aria-label="ปิดรายละเอียด" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="explore-detail-panel__body explore-detail-panel__body--animated">
        <section className={`place-inline-detail__media${imageLoaded ? " is-image-ready" : ""}`} aria-label={`ภาพสถานที่ ${place.name}`}>
          {place.imageUrl && !imageError ? (
            <img src={place.imageUrl} alt={place.name} onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} />
          ) : (
            <div className="place-inline-detail__media-fallback" aria-hidden="true">
              <MapPin size={28} />
              <strong>{place.name}</strong>
            </div>
          )}
        </section>

        <section className="explore-detail-story-lead place-inline-detail__lead">
          <span className="eyebrow">PLACE CONTEXT</span>
          <h3>{place.name} ในจังหวะที่พอดีกับคุณ</h3>
          <p>{place.description}</p>
          <div className="place-inline-detail__facts" aria-label="ข้อมูลสถานที่">
            <span><MapPin size={15} aria-hidden="true" />{place.area}</span>
            <span>{place.traceCount} Traces ที่เกี่ยวข้อง</span>
            <span>{place.comments.length} ความคิดเห็น</span>
          </div>
        </section>

        <div className="place-inline-detail__actions" aria-label="การกระทำกับสถานที่">
          <Link className="button button--ghost" to={placeMapHref(place)}>
            <MapPin size={16} aria-hidden="true" />ดูบนแผนที่
          </Link>
          <Link className="button button--ghost" to={placeDetailHref(place)}>
            <ExternalLink size={16} aria-hidden="true" />เปิดหน้า Place
          </Link>
          {canBook && (
            <Link className="button button--white-prismatic" to={`/stores/${place.venueSlug ?? place.slug}/booking`}>
              <Zap size={16} aria-hidden="true" />จองผ่าน Aevo Play
            </Link>
          )}
        </div>

        <InlineCommentSection
          title={place.name}
          comments={place.comments}
          focusRequestKey={commentFocusRequestKey}
          onSubmit={onCommentSubmit}
          onEdit={onCommentEdit}
          onDelete={onCommentDelete}
          onFollowCommenter={onFollowCommenter}
        />

        {!demoMode && (
          <p className="muted-label place-inline-detail__gateway-note">
            ความคิดเห็นจะพร้อมใช้งานเมื่อ Customer Gateway จัดส่งข้อมูลการสนทนาของสถานที่นี้
          </p>
        )}
      </div>

      <footer className="explore-detail-panel__footer place-inline-detail__footer">
        <button className="icon-button icon-button--subtle explore-detail-panel__save" type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? "นำสถานที่ออกจากรายการบันทึก" : "บันทึกสถานที่"}>
          {saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
        </button>
        <Link className="button button--white-prismatic explore-detail-panel__start" to={placeMapHref(place)}>
          <MapPin size={16} aria-hidden="true" />ดูเส้นทางไปสถานที่
        </Link>
      </footer>
    </aside>
  );
}
