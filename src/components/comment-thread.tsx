import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Send,
  X,
} from "lucide-react";
import { CommentStream } from "@/components/comment-stream";
import { PhotoLightbox, type PhotoLightboxItem } from "@/components/photo-lightbox";
import type { DiscoveryComment, DiscoveryCommentProfile } from "@/features/discovery/types";

export interface CommentThreadPreview {
  authorName: string;
  authorInitials: string;
  publishedLabel: string;
  body: string;
  media: readonly PhotoLightboxItem[];
}

export interface CommentThreadProps {
  title: string;
  comments: readonly DiscoveryComment[];
  onClose: () => void;
  onSubmit?: (body: string, parentId?: string, image?: File) => Promise<void>;
  onEdit?: (commentId: string, body: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  autoFocus?: boolean;
  preview?: CommentThreadPreview;
  media?: readonly PhotoLightboxItem[];
}

function commentTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CommentThread({
  title,
  comments,
  onClose,
  onSubmit,
  onEdit,
  onDelete,
  onFollowCommenter,
  autoFocus = true,
  preview,
  media = [],
}: CommentThreadProps) {
  const [items, setItems] = useState<DiscoveryComment[]>([...comments]);
  const [sort, setSort] = useState<"relevant" | "newest">("relevant");
  const [replyTo, setReplyTo] = useState<DiscoveryComment | null>(null);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | undefined>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const hasMedia = media.length > 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (autoFocus) composerRef.current?.focus({ preventScroll: true });
      else closeRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [autoFocus, onClose]);

  const ordered = useMemo(() => {
    const next = [...items];
    if (sort === "newest")
      next.sort(
        (left, right) =>
          commentTimestamp(right.createdAt) - commentTimestamp(left.createdAt),
      );
    return next;
  }, [items, sort]);

  const submit = async (): Promise<void> => {
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    const optimistic: DiscoveryComment = {
      id: `local-comment-${Date.now()}`,
      authorName: "คุณ",
      authorInitials: "คุณ",
      body: trimmed,
      createdAt: "เมื่อสักครู่",
      ...(replyTo ? { parentId: replyTo.id } : {}),
    };
    setPending(true);
    setNotice("");
    setItems((current) => [...current, optimistic]);
    setBody("");
    try {
      if (!onSubmit) throw new Error("comment-thread-submit-unavailable");
      await onSubmit(trimmed, replyTo?.id, image);
      setReplyTo(null);
      setImage(undefined);
      setNotice("ส่งความคิดเห็นแล้ว");
    } catch {
      setItems((current) =>
        current.filter((item) => item.id !== optimistic.id),
      );
      setBody(trimmed);
      setNotice("ส่งความคิดเห็นไม่สำเร็จ ลองใหม่ได้");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={`comment-drawer__backdrop${hasMedia ? " comment-drawer__backdrop--media" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        id="comment-thread-dialog"
        className={`comment-drawer${hasMedia ? " comment-drawer--media" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-thread-title"
      >
        <header className="comment-drawer__header">
          <div>
            <p className="eyebrow">DISCUSSION</p>
            <h2 id="comment-thread-title">ความคิดเห็นเกี่ยวกับ {title}</h2>
            <span className="muted-label">
              {items.length} ความคิดเห็น · ตอบกลับได้ 1 ชั้น
            </span>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="ปิดความคิดเห็น"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="comment-drawer__toolbar">
          <button
            className={`comment-sort${sort === "relevant" ? " is-active" : ""}`}
            type="button"
            onClick={() => setSort("relevant")}
          >
            <ArrowUp size={14} aria-hidden="true" />
            เกี่ยวข้อง
          </button>
          <button
            className={`comment-sort${sort === "newest" ? " is-active" : ""}`}
            type="button"
            onClick={() => setSort("newest")}
          >
            <ArrowDown size={14} aria-hidden="true" />
            ใหม่ล่าสุด
          </button>
        </div>
        <div className={`comment-drawer__body${hasMedia ? " comment-drawer__body--media" : ""}`}>
          {hasMedia && (
            <aside className="comment-media-modal__media" aria-label={`ภาพของ ${title}`}>
              <button
                className="comment-media-modal__image"
                type="button"
                onClick={() => setPreviewIndex(0)}
                aria-label={`เปิดภาพของ ${title} แบบเต็มจอ`}
              >
                {media[0]?.src ? (
                  <img src={media[0].src} alt={media[0].alt} loading="lazy" decoding="async" />
                ) : (
                  <span>{media[0]?.fallback ?? title}</span>
                )}
                {media.length > 1 && <span className="comment-media-modal__count">1 / {media.length}</span>}
              </button>
              <div className="comment-media-modal__caption">
                <span className="eyebrow">MEDIA CONTEXT</span>
                <strong>{title}</strong>
                <span className="muted-label">แตะภาพเพื่อดูเต็มจอ · ปัดซ้ายขวาเพื่อเปลี่ยนรูป</span>
              </div>
            </aside>
          )}
          <div className={hasMedia ? "comment-drawer__discussion" : undefined}>
            {preview && (
            <article className="comment-post-preview">
              <div className="comment-post-preview__header">
                <span className="discovery-avatar" aria-hidden="true">{preview.authorInitials}</span>
                <div>
                  <strong>{preview.authorName}</strong>
                  <span className="muted-label">{preview.publishedLabel}</span>
                </div>
              </div>
              <p>{preview.body}</p>
              {preview.media.length > 0 && (
                <button
                  className="comment-post-preview__media"
                  type="button"
                  onClick={() => setPreviewIndex(0)}
                  aria-label="เปิดดูภาพของโพสต์"
                >
                  {preview.media[0]?.src ? (
                    <img src={preview.media[0].src} alt={preview.media[0].alt} loading="lazy" decoding="async" />
                  ) : (
                    <span>{preview.media[0]?.fallback ?? "ไม่มีสื่อที่แนบ"}</span>
                  )}
                  {preview.media.length > 1 && <span className="comment-post-preview__count">1 / {preview.media.length}</span>}
                </button>
              )}
            </article>
            )}
            <CommentStream
              comments={items}
              showReplyActions
              onReply={(comment) => setReplyTo(comment)}
              onEdit={onEdit}
              onDelete={onDelete}
              onFollowCommenter={onFollowCommenter}
            />
          </div>
        </div>
        <form
          className="comment-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="comment-composer__reply">
            {replyTo ? (
              <span>
                กำลังตอบ {replyTo.authorName}
                <button type="button" onClick={() => setReplyTo(null)}>
                  ยกเลิก
                </button>
              </span>
            ) : (
              <span>เขียนความคิดเห็นของคุณ</span>
            )}
          </div>
          <textarea
            ref={composerRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="เขียนความคิดเห็น หรือใช้ @mention"
            aria-label="เขียนความคิดเห็น"
            maxLength={1000}
            disabled={pending}
          />
          <div className="comment-composer__footer">
            <label className="comment-file-button">
              <ImagePlus size={16} aria-hidden="true" />
              เพิ่มรูป
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setImage(event.target.files?.[0])}
                disabled={pending}
              />
            </label>
            {image && <span className="muted-label">{image.name}</span>}
            <button
              className="button button--dark"
              type="submit"
              disabled={pending || !body.trim()}
              aria-busy={pending}
            >
              {pending ? "กำลังส่ง…" : "ส่งความคิดเห็น"}
              <Send size={15} aria-hidden="true" />
            </button>
          </div>
          {notice && (
            <p
              className="inline-notice"
              role={notice.includes("ไม่สำเร็จ") ? "alert" : "status"}
            >
              {notice}
            </p>
          )}
        </form>
      </aside>
      {previewIndex !== null && (hasMedia || preview) && (
        <PhotoLightbox
          items={hasMedia ? media : preview?.media ?? []}
          initialIndex={previewIndex}
          title={hasMedia ? title : `โพสต์ของ ${preview?.authorName ?? title}`}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
