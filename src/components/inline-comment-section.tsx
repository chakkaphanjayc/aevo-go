import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { CommenterIdentity } from "@/components/commenter-profile-surface";
import { CommentThread } from "@/components/comment-thread";
import type { PhotoLightboxItem } from "@/components/photo-lightbox";
import type { DiscoveryComment, DiscoveryCommentProfile } from "@/features/discovery/types";

export interface InlineCommentSectionProps {
  title?: string;
  comments: readonly DiscoveryComment[];
  media?: readonly PhotoLightboxItem[];
  focusRequestKey?: number;
  onSubmit?: (body: string) => Promise<void>;
  onEdit?: (commentId: string, body: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
}

export function InlineCommentSection({
  title = "Trace",
  comments,
  media = [],
  focusRequestKey = 0,
  onSubmit,
  onEdit,
  onDelete,
  onFollowCommenter,
}: InlineCommentSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<DiscoveryComment[]>([...comments]);
  const [isThreadOpen, setIsThreadOpen] = useState(false);

  useEffect(() => {
    setItems([...comments]);
  }, [comments]);

  useEffect(() => {
    if (focusRequestKey <= 0) return;
    setIsThreadOpen(true);
    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequestKey]);

  const submit = onSubmit
    ? async (body: string, parentId?: string) => {
        await onSubmit(body);
        setItems((current) => [
          {
            id: `inline-comment-${Date.now()}`,
            authorName: "คุณ",
            authorInitials: "คุณ",
            body,
            createdAt: "เมื่อสักครู่",
            ...(parentId ? { parentId } : {}),
          },
          ...current,
        ]);
      }
    : undefined;
  const featured = items[0];

  return (
    <section
      ref={sectionRef}
      id="comments-section"
      className="explore-detail-section explore-inline-comments"
      aria-labelledby="explore-comments-title"
      tabIndex={-1}
    >
      <div className="explore-detail-section__heading">
        <div>
          <span className="eyebrow">DISCUSSION</span>
          <h3 id="explore-comments-title">ความคิดเห็น</h3>
        </div>
        <span className="muted-label">{items.length} ความเห็น</span>
      </div>

      {featured ? (
        <article className="explore-inline-comment explore-inline-comment--featured">
          <div className="explore-inline-comment__header">
            <CommenterIdentity comment={featured} onFollow={onFollowCommenter} />
            <span className="muted-label">{featured.createdAt}</span>
          </div>
          <p>{featured.body}</p>
        </article>
      ) : (
        <div className="explore-detail-unavailable explore-inline-comments__empty" role="status">
          <MessageCircle size={18} aria-hidden="true" />
          <div>
            <strong>ยังไม่มีความคิดเห็น</strong>
            <p>เริ่มบทสนทนาเกี่ยวกับจุดแวะและจังหวะของเส้นทางนี้ได้เลย</p>
          </div>
        </div>
      )}

      <button
        className="explore-inline-comments__view-all"
        type="button"
        onClick={() => setIsThreadOpen(true)}
      >
        {items.length > 0 ? `ดูความคิดเห็นทั้งหมด (${items.length} รายการ)` : "เริ่มบทสนทนา"}
        <span aria-hidden="true">→</span>
      </button>

      {isThreadOpen && (
        <CommentThread
          title={title}
          comments={items}
          media={media}
          onClose={() => setIsThreadOpen(false)}
          onSubmit={submit}
          onEdit={onEdit}
          onDelete={onDelete}
          onFollowCommenter={onFollowCommenter}
          autoFocus={focusRequestKey > 0}
        />
      )}
    </section>
  );
}
