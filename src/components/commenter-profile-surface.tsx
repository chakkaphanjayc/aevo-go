import { useEffect, useState } from "react";
import { ArrowRight, Check, UserPlus, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { DiscoveryComment, DiscoveryCommentProfile } from "@/features/discovery/types";

export interface CommenterProfileSurfaceProps {
  profile: DiscoveryCommentProfile;
  onClose: () => void;
  onFollow?: (profile: DiscoveryCommentProfile) => Promise<void>;
}

export function commentProfileFromComment(comment: DiscoveryComment): DiscoveryCommentProfile {
  if (comment.authorProfile) return comment.authorProfile;
  return {
    id: comment.authorId ?? `commenter-${comment.id}`,
    name: comment.authorName,
    initials: comment.authorInitials,
    bio: "โปรไฟล์ public จะปรากฏเมื่อ Customer Gateway ส่งข้อมูลผู้ใช้มาให้",
    area: "—",
    expertise: [],
  };
}

export function CommenterIdentity({
  comment,
  onFollow,
}: {
  comment: DiscoveryComment;
  onFollow?: (profile: DiscoveryCommentProfile) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const profile = commentProfileFromComment(comment);

  return (
    <>
      <button
        className="commenter-identity"
        type="button"
        aria-label={`เปิดโปรไฟล์ ${profile.name}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="discovery-avatar" aria-hidden="true">{profile.initials}</span>
        <span className="commenter-identity__copy">
          <strong>{profile.name}</strong>
          {(profile.area || profile.expertise?.length) && (
            <small>{[profile.area, ...(profile.expertise ?? []).slice(0, 2)].filter(Boolean).join(" · ")}</small>
          )}
        </span>
      </button>
      {open && (
        <CommenterProfileSurface
          profile={profile}
          onClose={() => setOpen(false)}
          onFollow={onFollow}
        />
      )}
    </>
  );
}

export function CommenterProfileSurface({ profile, onClose, onFollow }: CommenterProfileSurfaceProps) {
  const [following, setFollowing] = useState(profile.following === true);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const toggleFollow = async () => {
    if (!onFollow) {
      setNotice("การติดตามจะพร้อมเมื่อ Customer Gateway รองรับ relation ของผู้แสดงความคิดเห็น");
      return;
    }
    const nextFollowing = !following;
    setPending(true);
    setNotice("");
    try {
      await onFollow({ ...profile, following: nextFollowing });
      setFollowing(nextFollowing);
    } catch {
      setNotice("ยังเปลี่ยนสถานะการติดตามไม่ได้ ลองใหม่ได้");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="commenter-profile-layer" role="presentation">
      <button className="commenter-profile-layer__scrim" type="button" aria-label="ปิดโปรไฟล์ผู้แสดงความคิดเห็น" onClick={onClose} />
      <section className="commenter-profile-surface" role="dialog" aria-modal="true" aria-labelledby={`commenter-profile-${profile.id}`}>
        <header className="commenter-profile-surface__header">
          <span className="eyebrow">COMMENTER PROFILE</span>
          <button className="icon-button icon-button--subtle" type="button" aria-label="ปิดโปรไฟล์" onClick={onClose}><X size={17} aria-hidden="true" /></button>
        </header>
        <div className="commenter-profile-surface__identity">
          <span className="commenter-profile-surface__avatar" aria-hidden="true">{profile.initials}</span>
          <div>
            <h2 id={`commenter-profile-${profile.id}`}>{profile.name}</h2>
            <p>{[profile.area, ...(profile.expertise ?? []).slice(0, 3)].filter(Boolean).join(" · ") || "Public commenter"}</p>
          </div>
        </div>
        <p className="commenter-profile-surface__bio">{profile.bio ?? "ยังไม่มี Bio จาก public profile"}</p>
        <div className="commenter-profile-surface__match">
          <span className="eyebrow">TASTE MATCH</span>
          <strong>{profile.tasteMatchLabel ?? "—"}</strong>
          <p>{profile.tasteMatchLabel ? "ความชอบบางส่วนของคุณอาจตรงกับผู้แสดงความคิดเห็นคนนี้" : "ยังไม่มีคะแนนจับคู่จาก public profile"}</p>
        </div>
        <div className="commenter-profile-surface__actions">
          <button className="button button--dark" type="button" disabled={pending} aria-busy={pending || undefined} onClick={() => void toggleFollow()}>
            {following ? <Check size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
            {following ? "ติดตามแล้ว" : "ติดตาม"}
          </button>
          <Link className="button button--ghost" to={`/creators/${encodeURIComponent(profile.id)}`} onClick={onClose}>
            ดู Profile <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {notice && <p className="commenter-profile-surface__notice" role="status">{notice}</p>}
      </section>
    </div>
  );
}
