import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  UserPlus,
  X,
} from "lucide-react";
import { CommentStream } from "@/components/comment-stream";
import type { DiscoveryCommentProfile, DiscoveryPost } from "./types";

export interface PostInlineDetailProps {
  post: DiscoveryPost;
  demoMode: boolean;
  liked: boolean;
  likeCount: number;
  onClose: () => void;
  onOpenMedia: (index: number) => void;
  onLike?: () => void;
  onShare?: () => void;
  commentFocusRequestKey?: number;
  onCommentSubmit?: (body: string, parentId?: string) => Promise<void>;
  onCommentEdit?: (commentId: string, body: string) => Promise<void>;
  onCommentDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
}

export function PostInlineDetail({
  post,
  demoMode,
  liked,
  likeCount,
  onClose,
  onOpenMedia,
  onLike,
  onShare,
  commentFocusRequestKey = 0,
  onCommentSubmit,
  onCommentEdit,
  onCommentDelete,
  onFollowCommenter,
}: PostInlineDetailProps) {
  const images = useMemo(() => post.mediaImages ?? [], [post.mediaImages]);
  const [saved, setSaved] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const commentsRef = useRef<HTMLElement>(null);
  const activeSrc = images[activeImage];

  useEffect(() => {
    setImageLoaded(false);
  }, [activeImage, activeSrc]);

  const focusComments = () => {
    const section = commentsRef.current;
    if (!section) return;
    const scrollContainer = section.closest<HTMLElement>(".explore-detail-panel__body");
    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 1) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      scrollContainer.scrollTo({
        top: Math.max(0, scrollContainer.scrollTop + sectionRect.top - containerRect.top - 16),
        behavior: "smooth",
      });
    }
    section.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (commentFocusRequestKey <= 0) return;
    if (typeof window.requestAnimationFrame !== "function") {
      const timeoutId = window.setTimeout(focusComments, 0);
      return () => window.clearTimeout(timeoutId);
    }
    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      focusComments();
      secondFrame = window.requestAnimationFrame(focusComments);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
    };
  }, [commentFocusRequestKey]);

  return (
    <aside className="explore-detail-panel post-inline-detail" aria-label={`รายละเอียดโพสต์ของ ${post.author.name}`}>
      <header className="explore-detail-panel__header explore-detail-story-header">
        <div className="explore-detail-story-header__copy">
          <p className="eyebrow">FIELD NOTE / {post.author.area}</p>
          <h2>บันทึกจาก {post.author.name}</h2>
          <div className="explore-detail-story-meta">
            <span className="discovery-avatar" aria-hidden="true">{post.author.initials}</span>
            <strong>{post.author.name}</strong><span aria-hidden="true">·</span><span>{post.publishedLabel}</span>
          </div>
        </div>
        <div className="explore-detail-panel__header-actions">
          <button className="explore-detail-panel__back" type="button" onClick={onClose}><ArrowLeft size={16} aria-hidden="true" />ย้อนกลับ</button>
          <button className="icon-button icon-button--subtle" type="button" aria-label="แชร์โพสต์" onClick={onShare}><Share2 size={17} aria-hidden="true" /></button>
          <button className="icon-button icon-button--subtle" type="button" aria-label="ปิดรายละเอียด" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
      </header>
      <div className="explore-detail-panel__body explore-detail-panel__body--animated">
        <section className="post-inline-detail__media" aria-label={`ภาพโพสต์ของ ${post.author.name}`}>
          <button className={`post-inline-detail__media-button${imageLoaded ? " is-image-ready" : ""}`} type="button" onClick={() => onOpenMedia(activeImage)} aria-label={`เปิดภาพ ${activeImage + 1} ของ ${Math.max(images.length, post.mediaLabels.length, 1)}`}>
            {activeSrc && !imageError ? <img src={activeSrc} alt={`${post.author.name} รูปที่ ${activeImage + 1}`} onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} /> : <span>{post.mediaLabels[activeImage] ?? "POST"}</span>}
            <span className="post-inline-detail__media-count">{activeImage + 1} / {Math.max(images.length, post.mediaLabels.length, 1)}</span>
          </button>
          {Math.max(images.length, post.mediaLabels.length, 1) > 1 && <div className="post-inline-detail__thumbs" role="tablist" aria-label="รูปภาพโพสต์">
            {Array.from({ length: Math.max(images.length, post.mediaLabels.length, 1) }, (_, index) => <button key={index} type="button" role="tab" aria-selected={index === activeImage} aria-label={`ดูรูปที่ ${index + 1}`} className={index === activeImage ? "is-active" : ""} onClick={() => { setActiveImage(index); setImageError(false); }}><span>{index + 1}</span></button>)}
          </div>}
        </section>
        <section className="explore-detail-story-lead">
          <span className="eyebrow">THE STORY</span>
          <h3>{post.attachedObject?.title ?? "บันทึกระหว่างทาง"}</h3>
          <p>{post.body}</p>
        </section>
        {post.attachedObject && <button className="discovery-attached-object post-inline-detail__attached" type="button" onClick={() => onOpenMedia(0)}><span className="discovery-attached-object__type">{post.attachedObject.itemType}</span><span><strong>{post.attachedObject.title}</strong><small>{post.attachedObject.subtitle}</small></span><MapPin size={16} aria-hidden="true" /></button>}
        <div className="media-conversation-modal__interactions post-inline-detail__interactions" aria-label="การกระทำกับโพสต์">
          <button className={liked ? "is-selected" : ""} type="button" onClick={onLike} aria-label={liked ? "ยกเลิกถูกใจ" : "ถูกใจ"} aria-pressed={liked}><Heart size={17} fill={liked ? "currentColor" : "none"} aria-hidden="true" /><span className="post-inline-detail__interaction-label">ถูกใจ</span>{likeCount}</button>
          <button className={saved ? "is-selected" : ""} type="button" onClick={() => setSaved((current) => !current)} aria-label={saved ? "นำโพสต์ออกจากรายการบันทึก" : "บันทึกโพสต์"} aria-pressed={saved}>{saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}<span className="post-inline-detail__interaction-label">{saved ? "บันทึกแล้ว" : "บันทึก"}</span></button>
          <button type="button" aria-label="ไปที่ความคิดเห็น" onClick={focusComments}><MessageCircle size={17} aria-hidden="true" /><span className="post-inline-detail__interaction-label">ความคิดเห็น</span>{post.comments.length}</button>
        </div>
        <section ref={commentsRef} className="post-inline-detail__comments" id="post-inline-comments" aria-labelledby="post-inline-comments-title" tabIndex={-1}>
          <div className="explore-detail-section__heading"><div><span className="eyebrow">DISCUSSION</span><h3 id="post-inline-comments-title">ความคิดเห็น</h3></div><UserPlus size={16} aria-hidden="true" /></div>
          <CommentStream comments={post.comments} showComposer={Boolean(onCommentSubmit)} onSubmit={onCommentSubmit} onEdit={onCommentEdit} onDelete={onCommentDelete} onFollowCommenter={onFollowCommenter} />
          {!demoMode && <p className="muted-label">ความคิดเห็นจากผู้คนจะปรากฏเมื่อข้อมูลการสนทนาพร้อมใช้งาน</p>}
        </section>
      </div>
      <footer className="explore-detail-panel__footer post-inline-detail__footer"><button className="icon-button icon-button--subtle explore-detail-panel__save" type="button" onClick={() => setSaved((current) => !current)} aria-pressed={saved} aria-label={saved ? "นำโพสต์ออกจากรายการบันทึก" : "บันทึกโพสต์"}>{saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}</button><button className="button button--white-prismatic explore-detail-panel__start" type="button" onClick={onShare}><Share2 size={16} aria-hidden="true" />แชร์บันทึกนี้</button></footer>
    </aside>
  );
}
