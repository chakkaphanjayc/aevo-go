import { useState, useRef } from "react";
import {
  BadgeCheck,
  Check,
  Coffee,
  Compass,
  Footprints,
  Image as ImageIcon,
  Palette,
  Route,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  AVATAR_DECORATIONS,
  AVATAR_PRESETS,
  BANNER_PRESETS,
  PROFILE_BADGES_CATALOG,
  PROFILE_EFFECTS,
  THEME_ACCENTS,
  type AvatarDecorationId,
  type BannerPresetId,
  type ProfileEffectId,
  type ThemeAccentId,
  type UserProfileCustomization,
} from "./profile-customization-types";
import { AvatarDecoration } from "./avatar-decoration";
import { ProfileEffectLayer } from "./profile-effect-layer";
import { processProfileImageUpload } from "./profile-storage";

interface ProfileCustomizerModalProps {
  initialData: UserProfileCustomization;
  onSave: (updated: UserProfileCustomization) => void;
  onClose: () => void;
}

type CustomizerTab = "identity" | "decorations" | "effects" | "theme";

export function ProfileCustomizerModal({
  initialData,
  onSave,
  onClose,
}: ProfileCustomizerModalProps) {
  const [activeTab, setActiveTab] = useState<CustomizerTab>("identity");
  const [draft, setDraft] = useState<UserProfileCustomization>({ ...initialData });
  const [imageError, setImageError] = useState<string>("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const activeTheme = THEME_ACCENTS.find((t) => t.id === draft.themeAccentId) ?? THEME_ACCENTS[0]!;
  const activeBanner = BANNER_PRESETS.find((b) => b.id === draft.bannerPresetId) ?? BANNER_PRESETS[0]!;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");
    setIsProcessingImage(true);
    try {
      const processed = await processProfileImageUpload(file, 512, 3 * 1024 * 1024);
      setDraft((prev) => ({ ...prev, avatarUrl: processed.dataUrl }));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดรูป");
    } finally {
      setIsProcessingImage(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
    }
  };

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");
    setIsProcessingImage(true);
    try {
      const processed = await processProfileImageUpload(file, 1440, 4 * 1024 * 1024);
      setDraft((prev) => ({
        ...prev,
        bannerUrl: processed.dataUrl,
        bannerPresetId: "custom",
      }));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดรูป");
    } finally {
      setIsProcessingImage(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    }
  };

  const toggleBadge = (badgeId: string) => {
    setDraft((prev) => {
      const exists = prev.activeBadges.includes(badgeId);
      if (exists) {
        return { ...prev, activeBadges: prev.activeBadges.filter((b) => b !== badgeId) };
      }
      return { ...prev, activeBadges: [...prev.activeBadges, badgeId] };
    });
  };

  const getBadgeIcon = (iconKey: string) => {
    switch (iconKey) {
      case "badge-check":
        return <BadgeCheck size={14} aria-hidden="true" />;
      case "coffee":
        return <Coffee size={14} aria-hidden="true" />;
      case "footprints":
        return <Footprints size={14} aria-hidden="true" />;
      case "compass":
        return <Compass size={14} aria-hidden="true" />;
      case "route":
        return <Route size={14} aria-hidden="true" />;
      default:
        return <Sparkles size={14} aria-hidden="true" />;
    }
  };

  const initials = draft.displayName
    ? draft.displayName
        .split(/\s+/u)
        .filter(Boolean)
        .map((part) => part[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AG";

  return (
    <div
      className="profile-customizer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-modal-title"
    >
      <div className="profile-customizer-modal">
        {/* Header */}
        <header className="profile-customizer-modal__header">
          <div className="profile-customizer-modal__title-row">
            <Sparkles size={20} className="icon-sparkle-prismatic" aria-hidden="true" />
            <div>
              <h2 id="customizer-modal-title">ตกแต่งโปรไฟล์ของคุณ</h2>
              <p>ปรับแต่งอวาตาร์ กรอบตกแต่ง และเอฟเฟกต์ตามสไตล์ของคุณ</p>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างตกแต่งโปรไฟล์"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Content Body: Split Studio Layout */}
        <div className="profile-customizer-modal__body">
          {/* Left Column: Real-time Live Preview Card */}
          <aside className="profile-customizer-preview-col" aria-label="ตัวอย่างการแสดงผลโปรไฟล์">
            <span className="profile-customizer-preview-col__label">LIVE PREVIEW</span>
            <div
              className="profile-preview-card-frame"
              style={{
                background: activeTheme.bgGradient,
                boxShadow: `0 16px 40px -12px rgba(0, 0, 0, 0.75), 0 0 24px -6px ${activeTheme.glow}`,
              }}
            >
              {/* Profile Effect Over Preview */}
              <ProfileEffectLayer effectId={draft.profileEffectId} />

              {/* Preview Banner */}
              <div
                className="profile-preview-card__banner"
                style={{
                  background:
                    draft.bannerPresetId === "custom" && draft.bannerUrl
                      ? `url(${draft.bannerUrl}) center/cover no-repeat`
                      : activeBanner.gradient,
                  borderColor: activeBanner.borderTint,
                }}
              />

              {/* Preview Identity Top */}
              <div className="profile-preview-card__content">
                <div className="profile-preview-avatar-wrapper">
                  <div className="profile-preview-avatar">
                    {draft.avatarUrl ? (
                      <img src={draft.avatarUrl} alt="" className="profile-preview-avatar__img" />
                    ) : (
                      <span className="profile-preview-avatar__initials">{initials}</span>
                    )}
                  </div>
                  {/* Real-time Discord-style Avatar Decoration */}
                  <AvatarDecoration decorationId={draft.avatarDecorationId} size={72} />
                </div>

                <div className="profile-preview-meta">
                  <div className="profile-preview-name-row">
                    <strong>{draft.displayName || "ชื่อของคุณ"}</strong>
                    {draft.pronouns && <span className="profile-preview-pronouns">{draft.pronouns}</span>}
                  </div>
                  <span className="profile-preview-handle">@{draft.handle || "yourname"}</span>
                  <p className="profile-preview-bio">
                    {draft.bio || "บอกเล่าสไตล์การเดินทางของคุณที่นี่..."}
                  </p>
                </div>

                {/* Badges showcase */}
                {draft.activeBadges.length > 0 && (
                  <div className="profile-preview-badges" aria-label="เหรียญรางวัลที่เลือก">
                    {draft.activeBadges.map((badgeId) => {
                      const badge = PROFILE_BADGES_CATALOG.find((b) => b.id === badgeId);
                      if (!badge) return null;
                      return (
                        <span key={badgeId} className="profile-preview-badge" title={badge.name}>
                          {getBadgeIcon(badge.iconKey)}
                          <span>{badge.name}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Right Column: Customization Controls & Tabs */}
          <main className="profile-customizer-controls-col">
            <nav className="profile-customizer-tabs" aria-label="หมวดหมู่การตั้งค่า">
              <button
                type="button"
                className={`profile-customizer-tab${activeTab === "identity" ? " is-active" : ""}`}
                onClick={() => setActiveTab("identity")}
              >
                <User size={15} aria-hidden="true" />
                ข้อมูลทั่วไป
              </button>
              <button
                type="button"
                className={`profile-customizer-tab${activeTab === "decorations" ? " is-active" : ""}`}
                onClick={() => setActiveTab("decorations")}
              >
                <Sparkles size={15} aria-hidden="true" />
                กรอบอวาตาร์
              </button>
              <button
                type="button"
                className={`profile-customizer-tab${activeTab === "effects" ? " is-active" : ""}`}
                onClick={() => setActiveTab("effects")}
              >
                <ImageIcon size={15} aria-hidden="true" />
                เอฟเฟกต์ & แบนเนอร์
              </button>
              <button
                type="button"
                className={`profile-customizer-tab${activeTab === "theme" ? " is-active" : ""}`}
                onClick={() => setActiveTab("theme")}
              >
                <Palette size={15} aria-hidden="true" />
                ธีม & เหรียญรางวัล
              </button>
            </nav>

            {imageError && (
              <div className="profile-customizer-error" role="alert">
                <span>{imageError}</span>
              </div>
            )}

            <div className="profile-customizer-panel">
              {/* TAB 1: Identity & Avatar Upload */}
              {activeTab === "identity" && (
                <div className="customizer-panel-section">
                  <div className="field-group">
                    <label htmlFor="customizer-display-name">ชื่อที่แสดง (Display Name)</label>
                    <input
                      id="customizer-display-name"
                      type="text"
                      value={draft.displayName}
                      onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                      placeholder="เช่น Mina P."
                      maxLength={40}
                      required
                    />
                  </div>

                  <div className="field-row-split">
                    <div className="field-group">
                      <label htmlFor="customizer-handle">ชื่อผู้ใช้ (@handle)</label>
                      <input
                        id="customizer-handle"
                        type="text"
                        value={draft.handle}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                          })
                        }
                        placeholder="yourname"
                        maxLength={24}
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="customizer-pronouns">สรรพนาม (Pronouns)</label>
                      <input
                        id="customizer-pronouns"
                        type="text"
                        value={draft.pronouns ?? ""}
                        onChange={(e) => setDraft({ ...draft, pronouns: e.target.value })}
                        placeholder="เช่น she/her, they/them"
                        maxLength={16}
                      />
                    </div>
                  </div>

                  <div className="field-group">
                    <label htmlFor="customizer-bio">
                      คำอธิบายตัวตน (Bio)
                      <span className="field-char-count">{draft.bio.length}/160</span>
                    </label>
                    <textarea
                      id="customizer-bio"
                      value={draft.bio}
                      onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                      placeholder="บอกเล่าความชอบหรือสไตล์การเดินเมืองของคุณ..."
                      rows={3}
                      maxLength={160}
                    />
                  </div>

                  {/* Avatar Picker & Upload Section */}
                  <div className="customizer-avatar-section">
                    <span className="customizer-section-title">รูปโปรไฟล์ (Avatar)</span>
                    <div className="customizer-avatar-actions">
                      <input
                        type="file"
                        ref={avatarFileInputRef}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        onChange={handleAvatarFile}
                      />
                      <button
                        type="button"
                        className="button button--ghost"
                        disabled={isProcessingImage}
                        onClick={() => avatarFileInputRef.current?.click()}
                      >
                        <Upload size={14} aria-hidden="true" />
                        {isProcessingImage ? "กำลังประมวลผล..." : "อัปโหลดรูปภาพ"}
                      </button>
                      {draft.avatarUrl && (
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => setDraft({ ...draft, avatarUrl: null })}
                        >
                          รีเซ็ตเป็นตัวอักษรย่อ
                        </button>
                      )}
                    </div>

                    <div className="customizer-avatar-presets">
                      <span className="muted-label">หรือเลือกรูปแนะนำ:</span>
                      <div className="customizer-preset-grid">
                        {AVATAR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            className={`customizer-preset-btn${
                              draft.avatarUrl === preset.url ? " is-active" : ""
                            }`}
                            onClick={() => setDraft({ ...draft, avatarUrl: preset.url })}
                            aria-label={`เลือกรูป ${preset.name}`}
                          >
                            <img src={preset.url} alt="" />
                            {draft.avatarUrl === preset.url && (
                              <span className="customizer-preset-check">
                                <Check size={12} />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Discord-style Avatar Decorations */}
              {activeTab === "decorations" && (
                <div className="customizer-panel-section">
                  <div className="customizer-section-desc">
                    <p>
                      กรอบตกแต่งอวาตาร์แบบอนิเมชัน (Avatar Decorations) ที่จะแสดงรอบรูปโปรไฟล์ของคุณ
                      ช่วยเพิ่มเอกลักษณ์และความสะดุดตาในทุกหน้า
                    </p>
                  </div>

                  <div className="customizer-decoration-grid">
                    {AVATAR_DECORATIONS.map((dec) => {
                      const isSelected = draft.avatarDecorationId === dec.id;
                      return (
                        <button
                          key={dec.id}
                          type="button"
                          className={`customizer-card-choice${isSelected ? " is-selected" : ""}`}
                          onClick={() => setDraft({ ...draft, avatarDecorationId: dec.id })}
                        >
                          <div className="customizer-card-choice__preview">
                            <div className="customizer-mini-avatar">
                              {initials}
                              <AvatarDecoration decorationId={dec.id} size={48} />
                            </div>
                          </div>
                          <div className="customizer-card-choice__info">
                            <div className="customizer-card-choice__header">
                              <strong>{dec.name}</strong>
                              <span
                                className="customizer-card-choice__tag"
                                style={{ color: dec.accentColor }}
                              >
                                {dec.tag}
                              </span>
                            </div>
                            <p>{dec.description}</p>
                          </div>
                          {isSelected && (
                            <span className="customizer-card-choice__check">
                              <Check size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: Discord-style Profile Effects & Banner */}
              {activeTab === "effects" && (
                <div className="customizer-panel-section">
                  {/* Profile Effect Section */}
                  <div className="customizer-subgroup">
                    <span className="customizer-section-title">
                      เอฟเฟกต์ตกแต่งหน้าโปรไฟล์ (Profile Effects)
                    </span>
                    <p className="customizer-subgroup__desc">
                      เอฟเฟกต์เรืองแสงและละอองแสงอนิเมชันที่จะพาดผ่านการ์ดโปรไฟล์ของคุณแบบเรียลไทม์
                    </p>

                    <div className="customizer-effects-grid">
                      {PROFILE_EFFECTS.map((eff) => {
                        const isSelected = draft.profileEffectId === eff.id;
                        return (
                          <button
                            key={eff.id}
                            type="button"
                            className={`customizer-effect-choice${isSelected ? " is-selected" : ""}`}
                            onClick={() => setDraft({ ...draft, profileEffectId: eff.id })}
                          >
                            <div className="customizer-effect-choice__head">
                              <span
                                className="customizer-effect-dot"
                                style={{ background: eff.accentColor }}
                              />
                              <strong>{eff.name}</strong>
                              <span className="customizer-card-choice__tag">{eff.tag}</span>
                            </div>
                            <p>{eff.description}</p>
                            {isSelected && (
                              <span className="customizer-card-choice__check">
                                <Check size={14} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Banner Presets & Upload Section */}
                  <div className="customizer-subgroup">
                    <div className="customizer-banner-header">
                      <span className="customizer-section-title">ภาพหน้าปก (Cover Banner)</span>
                      <input
                        type="file"
                        ref={bannerFileInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        onChange={handleBannerFile}
                      />
                      <button
                        type="button"
                        className="button button--ghost"
                        disabled={isProcessingImage}
                        onClick={() => bannerFileInputRef.current?.click()}
                      >
                        <Upload size={14} aria-hidden="true" />
                        อัปโหลดแบนเนอร์เอง
                      </button>
                    </div>

                    <div className="customizer-banner-grid">
                      {BANNER_PRESETS.filter((b) => b.id !== "custom").map((banner) => {
                        const isSelected = draft.bannerPresetId === banner.id;
                        return (
                          <button
                            key={banner.id}
                            type="button"
                            className={`customizer-banner-choice${isSelected ? " is-selected" : ""}`}
                            style={{ background: banner.gradient }}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                bannerPresetId: banner.id,
                                bannerUrl: null,
                              })
                            }
                          >
                            <span>{banner.name}</span>
                            {isSelected && (
                              <span className="customizer-banner-check">
                                <Check size={14} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Theme Accents & Badges */}
              {activeTab === "theme" && (
                <div className="customizer-panel-section">
                  <div className="customizer-subgroup">
                    <span className="customizer-section-title">
                      โทนสีและกระจกการ์ด (Profile Theme Glass)
                    </span>
                    <div className="customizer-theme-grid">
                      {THEME_ACCENTS.map((theme) => {
                        const isSelected = draft.themeAccentId === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            className={`customizer-theme-choice${isSelected ? " is-selected" : ""}`}
                            onClick={() => setDraft({ ...draft, themeAccentId: theme.id })}
                          >
                            <span
                              className="customizer-theme-swatch"
                              style={{ background: theme.primary }}
                            />
                            <span>{theme.name}</span>
                            {isSelected && (
                              <span className="customizer-card-choice__check">
                                <Check size={14} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="customizer-subgroup">
                    <span className="customizer-section-title">
                      เหรียญตราและความสำเร็จ (Showcase Badges)
                    </span>
                    <p className="customizer-subgroup__desc">
                      เลือกเหรียญรางวัลที่คุณต้องการแสดงบนหน้าโปรไฟล์
                    </p>

                    <div className="customizer-badges-list">
                      {PROFILE_BADGES_CATALOG.map((badge) => {
                        const isChecked = draft.activeBadges.includes(badge.id);
                        return (
                          <button
                            key={badge.id}
                            type="button"
                            className={`customizer-badge-item${isChecked ? " is-checked" : ""}`}
                            onClick={() => toggleBadge(badge.id)}
                            aria-pressed={isChecked}
                          >
                            <span className="customizer-badge-item__icon">
                              {getBadgeIcon(badge.iconKey)}
                            </span>
                            <div className="customizer-badge-item__text">
                              <strong>{badge.name}</strong>
                              <small>{badge.description}</small>
                            </div>
                            <span className="customizer-badge-item__box">
                              {isChecked && <Check size={13} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Modal Footer */}
        <footer className="profile-customizer-modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="button button--dark button-save-customizer"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            <Check size={16} aria-hidden="true" />
            บันทึกการเปลี่ยนแปลง
          </button>
        </footer>
      </div>
    </div>
  );
}
