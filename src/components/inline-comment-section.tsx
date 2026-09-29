import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CommentStream } from "@/components/comment-stream";
import type { DiscoveryComment, DiscoveryCommentProfile } from "@/features/discovery/types";

export interface InlineCommentSectionProps {
  title?: string;
  comments: readonly DiscoveryComment[];
  focusRequestKey?: number;
  onSubmit?: (body: string, parentId?: string) => Promise<void>;
  onEdit?: (commentId: string, body: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
}

export function InlineCommentSection({
  title = "Trace",
  comments,
  focusRequestKey = 0,
  onSubmit,
  onEdit,
  onDelete,
  onFollowCommenter,
}: InlineCommentSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<DiscoveryComment[]>([...comments]);

  useEffect(() => {
    setItems([...comments]);
  }, [comments]);

  const focusSection = () => {
    const section = sectionRef.current;
    if (!section) return;

    // Keep the scroll target inside the detail body. scrollIntoView() may
    // choose the page or the feed column when the desktop split view has more
    // than one scroll owner.
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
    if (focusRequestKey <= 0) return;
    if (typeof window.requestAnimationFrame !== "function") {
      const timeoutId = window.setTimeout(focusSection, 0);
      return () => window.clearTimeout(timeoutId);
    }
    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      focusSection();
      secondFrame = window.requestAnimationFrame(focusSection);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
    };
  }, [focusRequestKey]);

  const submit = onSubmit
    ? async (body: string, parentId?: string) => {
        await onSubmit(body, parentId);
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
  return (
    <section
      ref={sectionRef}
      id="comments-section"
      className="explore-detail-section explore-inline-comments"
      aria-labelledby="explore-comments-title"
      aria-label={title ? `ความคิดเห็นเกี่ยวกับ ${title}` : undefined}
      tabIndex={-1}
    >
      <div className="explore-detail-section__heading">
        <div>
          <span className="eyebrow">DISCUSSION</span>
          <h3 id="explore-comments-title">ความคิดเห็น</h3>
        </div>
        <span className="muted-label">{items.length} ความเห็น</span>
      </div>

      <CommentStream
        comments={items}
        showComposer={Boolean(submit)}
        showReplyActions={Boolean(submit)}
        onSubmit={submit}
        onEdit={onEdit}
        onDelete={onDelete}
        onFollowCommenter={onFollowCommenter}
      />
    </section>
  );
}
