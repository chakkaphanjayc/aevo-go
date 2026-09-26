import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Check,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { CommenterIdentity } from "@/components/commenter-profile-surface";
import type { DiscoveryComment, DiscoveryCommentProfile } from "@/features/discovery/types";

type CommentStatus = "idle" | "pending" | "sent" | "error";
type CommentRetryMode = "submit" | "edit" | "delete";

export interface CommentStreamProps {
  comments: readonly DiscoveryComment[];
  compact?: boolean;
  maxVisible?: number;
  currentUserId?: string;
  showComposer?: boolean;
  showReplyActions?: boolean;
  composerPlaceholder?: string;
  onSubmit?: (body: string, parentId?: string) => Promise<void>;
  onEdit?: (commentId: string, body: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onReply?: (comment: DiscoveryComment) => void;
  onFollowCommenter?: (profile: DiscoveryCommentProfile) => Promise<void>;
  onViewAll?: () => void;
}

function isCurrentUser(comment: DiscoveryComment, currentUserId: string): boolean {
  return comment.authorId === currentUserId || comment.authorName === "คุณ";
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status: CommentStatus): string {
  if (status === "pending") return "กำลังส่ง";
  if (status === "sent") return "ส่งแล้ว";
  if (status === "error") return "ส่งไม่สำเร็จ";
  return "";
}

export function CommentStream({
  comments,
  compact = false,
  maxVisible = compact ? 2 : undefined,
  currentUserId = "current-user",
  showComposer = false,
  showReplyActions = false,
  composerPlaceholder = "เขียนความคิดเห็น…",
  onSubmit,
  onEdit,
  onDelete,
  onReply,
  onFollowCommenter,
  onViewAll,
}: CommentStreamProps) {
  const [items, setItems] = useState<DiscoveryComment[]>([...comments]);
  const [statuses, setStatuses] = useState<Record<string, CommentStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [retryModes, setRetryModes] = useState<Record<string, CommentRetryMode>>({});
  const [retryBodies, setRetryBodies] = useState<Record<string, string>>({});
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<DiscoveryComment | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  useEffect(() => {
    setItems([...comments]);
  }, [comments]);

  const roots = useMemo(
    () => items.filter((comment) => !comment.parentId).sort((left, right) => timestampValue(left.createdAt) - timestampValue(right.createdAt)),
    [items],
  );
  const replies = useMemo(() => {
    const next = new Map<string, DiscoveryComment[]>();
    for (const comment of items) {
      if (!comment.parentId) continue;
      const current = next.get(comment.parentId) ?? [];
      current.push(comment);
      next.set(comment.parentId, current);
    }
    return next;
  }, [items]);
  const visibleRoots = maxVisible ? roots.slice(0, maxVisible) : roots;
  const hiddenCount = Math.max(roots.length - visibleRoots.length, 0);

  const setStatus = (id: string, status: CommentStatus, message?: string) => {
    setStatuses((current) => ({ ...current, [id]: status }));
    setErrors((current) => {
      const next = { ...current };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !onSubmit) return;
    const optimistic: DiscoveryComment = {
      id: `local-comment-${Date.now()}`,
      authorId: currentUserId,
      authorName: "คุณ",
      authorInitials: "คุณ",
      body: trimmed,
      createdAt: "เมื่อสักครู่",
      ...(replyTo ? { parentId: replyTo.id } : {}),
    };
    setItems((current) => [...current, optimistic]);
    setStatus(optimistic.id, "pending");
    setBody("");
    try {
      await onSubmit(trimmed, replyTo?.id);
      setStatus(optimistic.id, "sent");
      setRetryModes((current) => { const next = { ...current }; delete next[optimistic.id]; return next; });
      setReplyTo(null);
    } catch {
      setBody(trimmed);
      setRetryModes((current) => ({ ...current, [optimistic.id]: "submit" }));
      setStatus(optimistic.id, "error", "ส่งความคิดเห็นไม่สำเร็จ");
    }
  };

  const retry = async (comment: DiscoveryComment) => {
    if (statuses[comment.id] === "pending") return;
    const mode = retryModes[comment.id] ?? "submit";
    if (mode === "submit" && !onSubmit) return;
    if (mode === "edit" && !onEdit) return;
    if (mode === "delete" && !onDelete) return;
    setStatus(comment.id, "pending");
    try {
      if (mode === "edit") {
        const nextBody = retryBodies[comment.id] ?? comment.body;
        setItems((current) => current.map((item) => item.id === comment.id ? { ...item, body: nextBody, isEdited: true } : item));
        await onEdit?.(comment.id, nextBody);
      } else if (mode === "delete") {
        setRemovingIds((current) => new Set(current).add(comment.id));
        await onDelete?.(comment.id);
        window.setTimeout(() => {
          setItems((current) => current.filter((item) => item.id !== comment.id && item.parentId !== comment.id));
          setRemovingIds((current) => { const next = new Set(current); next.delete(comment.id); return next; });
        }, 160);
      } else {
        await onSubmit?.(comment.body, comment.parentId);
      }
      setStatus(comment.id, "sent");
      setRetryModes((current) => { const next = { ...current }; delete next[comment.id]; return next; });
    } catch {
      setStatus(comment.id, "error", mode === "delete" ? "ลบความคิดเห็นไม่สำเร็จ" : mode === "edit" ? "แก้ไขความคิดเห็นไม่สำเร็จ" : "ส่งความคิดเห็นไม่สำเร็จ");
    }
  };

  const saveEdit = async (comment: DiscoveryComment) => {
    const trimmed = editingBody.trim();
    if (!trimmed || !onEdit) return;
    const previousBody = comment.body;
    const previousIsEdited = comment.isEdited;
    setItems((current) => current.map((item) => item.id === comment.id ? { ...item, body: trimmed, isEdited: true } : item));
    setEditingId(null);
    setMenuId(null);
    setRetryBodies((current) => ({ ...current, [comment.id]: trimmed }));
    setRetryModes((current) => ({ ...current, [comment.id]: "edit" }));
    setStatus(comment.id, "pending");
    try {
      await onEdit(comment.id, trimmed);
      setStatus(comment.id, "sent");
      setRetryModes((current) => { const next = { ...current }; delete next[comment.id]; return next; });
    } catch {
      setItems((current) => current.map((item) => item.id === comment.id ? { ...item, body: previousBody, isEdited: previousIsEdited } : item));
      setStatus(comment.id, "error", "แก้ไขความคิดเห็นไม่สำเร็จ");
    }
  };

  const remove = async (comment: DiscoveryComment) => {
    if (!onDelete) return;
    setRemovingIds((current) => new Set(current).add(comment.id));
    setDeleteId(null);
    setMenuId(null);
    setRetryModes((current) => ({ ...current, [comment.id]: "delete" }));
    setStatus(comment.id, "pending");
    try {
      await onDelete(comment.id);
      setStatus(comment.id, "sent");
      setRetryModes((current) => { const next = { ...current }; delete next[comment.id]; return next; });
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== comment.id && item.parentId !== comment.id));
        setRemovingIds((current) => { const next = new Set(current); next.delete(comment.id); return next; });
      }, 160);
    } catch {
      setRemovingIds((current) => { const next = new Set(current); next.delete(comment.id); return next; });
      setStatus(comment.id, "error", "ลบความคิดเห็นไม่สำเร็จ");
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className={`comment-stream${compact ? " comment-stream--compact" : ""}`}>
      {visibleRoots.length === 0 ? (
        !compact && <p className="comment-stream__empty">ยังไม่มีความคิดเห็น เริ่มบทสนทนาได้เลย</p>
      ) : (
        <div className="comment-stream__list">
          {visibleRoots.map((comment) => {
            const status = statuses[comment.id] ?? "idle";
            const managed = isCurrentUser(comment, currentUserId);
            const commentReplies = replies.get(comment.id) ?? [];
            return (
              <article className={`comment-stream__item${status === "error" ? " has-error" : ""}${removingIds.has(comment.id) ? " is-removing" : ""}`} key={comment.id}>
                <div className="comment-stream__meta">
                  <CommenterIdentity comment={comment} onFollow={onFollowCommenter} />
                  <span className="comment-stream__timestamp">{comment.createdAt}</span>
                  {status === "pending" && <LoaderCircle className="comment-stream__status-icon is-spinning" size={13} aria-label="กำลังส่ง" />}
                  {status === "sent" && <Check className="comment-stream__status-icon" size={13} aria-label="ส่งสำเร็จ" />}
                  {managed && (onEdit || onDelete) && (
                    <button className="comment-stream__menu-button" type="button" aria-label={`เมนูความคิดเห็นของ ${comment.authorName}`} aria-expanded={menuId === comment.id} onClick={() => setMenuId((current) => current === comment.id ? null : comment.id)}>
                      <MoreHorizontal size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="comment-stream__edit-row">
                    <textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} aria-label="แก้ไขความคิดเห็น" rows={2} autoFocus />
                    <div>
                      <button className="button button--dark" type="button" disabled={!editingBody.trim() || status === "pending"} onClick={() => void saveEdit(comment)}>บันทึก</button>
                      <button className="button button--ghost" type="button" onClick={() => setEditingId(null)}>ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <p>{comment.body} {comment.isEdited && <small className="comment-stream__edited">(แก้ไขแล้ว)</small>}</p>
                )}
                {menuId === comment.id && (
                  <div className="comment-stream__menu" role="menu">
                    {onEdit && <button type="button" role="menuitem" onClick={() => { setEditingId(comment.id); setEditingBody(comment.body); setMenuId(null); }}><Pencil size={13} aria-hidden="true" />แก้ไข</button>}
                    {onDelete && <button type="button" role="menuitem" onClick={() => { setDeleteId(comment.id); setMenuId(null); }}><Trash2 size={13} aria-hidden="true" />ลบ</button>}
                  </div>
                )}
                {deleteId === comment.id && (
                  <div className="comment-stream__confirm" role="alertdialog" aria-label="ยืนยันการลบความคิดเห็น">
                    <span>ลบความคิดเห็นนี้หรือไม่?</span>
                    <button className="button button--dark" type="button" onClick={() => void remove(comment)}>ลบ</button>
                    <button className="icon-button icon-button--subtle" type="button" aria-label="ยกเลิกการลบ" onClick={() => setDeleteId(null)}><X size={14} aria-hidden="true" /></button>
                  </div>
                )}
                <div className="comment-stream__actions">
                  {(onSubmit || showReplyActions) && <button type="button" onClick={() => { setReplyTo(comment); onReply?.(comment); }}><Reply size={13} aria-hidden="true" />ตอบกลับ</button>}
                  {status === "error" && (onSubmit || onEdit || onDelete) && <button type="button" onClick={() => void retry(comment)}><RotateCcw size={13} aria-hidden="true" />ลองใหม่</button>}
                  {errors[comment.id] && <span role="alert">{errors[comment.id]}</span>}
                </div>
                {commentReplies.map((reply) => (
                  <div className="comment-stream__reply" key={reply.id}>
                    <div className="comment-stream__meta"><CommenterIdentity comment={reply} onFollow={onFollowCommenter} /><span className="comment-stream__timestamp">{reply.createdAt}</span></div>
                    <p>{reply.body} {reply.isEdited && <small className="comment-stream__edited">(แก้ไขแล้ว)</small>}</p>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      )}
      {(hiddenCount > 0 || onViewAll) && (
        <button className="comment-stream__view-all" type="button" onClick={onViewAll}>{hiddenCount > 0 ? `ดูความคิดเห็นอีก ${hiddenCount} รายการ` : "ดูความคิดเห็นทั้งหมด"}</button>
      )}
      {showComposer && onSubmit && (
        <form className="comment-stream__composer" onSubmit={(event) => void submit(event)}>
          <div className="comment-stream__composer-label">{replyTo ? <span>กำลังตอบ {replyTo.authorName}<button type="button" onClick={() => setReplyTo(null)}>ยกเลิก</button></span> : <span>เขียนความคิดเห็น</span>}</div>
          <div className="comment-stream__composer-row">
            <textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={composerPlaceholder} aria-label="เขียนความคิดเห็น" maxLength={1000} rows={1} />
            <button className="comment-stream__send" type="submit" disabled={!body.trim()} aria-label="ส่งความคิดเห็น"><Send size={16} aria-hidden="true" /></button>
          </div>
        </form>
      )}
    </div>
  );
}
