import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Coins,
  Compass,
  Edit3,
  ExternalLink,
  Footprints,
  Gift,
  Heart,
  HelpCircle,
  MapPin,
  QrCode,
  Route,
  ShoppingBag,
  Sparkles,
  Ticket,
  User,
  X,
  Zap,
} from "lucide-react";
import { GlidingGroup } from "@/components/gliding-group";
import { SubpageNavigation, type BreadcrumbStep } from "@/components/subpage-navigation";
import { AvatarDecoration } from "@/features/profile/avatar-decoration";
import { ProfileEffectLayer } from "@/features/profile/profile-effect-layer";
import {
  calculateLevelInfo,
  type AchievementItem,
  type QuestItem,
  type RedeemedCoupon,
  type ShopCategory,
  type ShopItem,
} from "./types";
import {
  INITIAL_ACHIEVEMENTS_CATALOG,
  INITIAL_QUESTS_CATALOG,
  SHOP_ITEMS_CATALOG,
} from "./catalog";
import {
  claimQuestReward,
  defaultGamificationState,
  getGamificationState,
  redeemShopItem,
  useCoupon,
} from "./storage";

export type GamificationTab = "level" | "quests" | "shop" | "coupons";

const VALID_TABS: readonly GamificationTab[] = ["level", "quests", "shop", "coupons"];

interface GamificationHubPageProps {
  initialTab?: GamificationTab;
}

export function GamificationHubPage({ initialTab }: GamificationHubPageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab: pathTab } = useParams<{ tab?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const queryTab = searchParams.get("tab") as GamificationTab | null;
  const pathSegment = location.pathname.split("/").filter(Boolean).pop();
  const inferredPathTab = pathSegment && VALID_TABS.includes(pathSegment as GamificationTab) ? (pathSegment as GamificationTab) : undefined;
  const resolvedPathTab = pathTab && VALID_TABS.includes(pathTab as GamificationTab) ? (pathTab as GamificationTab) : undefined;
  const activeTab: GamificationTab =
    (queryTab && VALID_TABS.includes(queryTab) ? queryTab : undefined) ||
    initialTab ||
    resolvedPathTab ||
    inferredPathTab ||
    "level";

  const [notice, setNotice] = useState<string>("");
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>("all");
  const [confirmRedeemItem, setConfirmRedeemItem] = useState<ShopItem | null>(null);
  const [activeCouponModal, setActiveCouponModal] = useState<RedeemedCoupon | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const gamificationQuery = useQuery({
    queryKey: ["user-gamification-state"],
    queryFn: () => getGamificationState(),
    staleTime: 30_000,
  });

  const state = gamificationQuery.data ?? defaultGamificationState();
  const levelInfo = calculateLevelInfo(state.totalExp);

  const setTab = (tab: GamificationTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const handleClaimQuest = async (quest: QuestItem) => {
    setIsActionPending(true);
    try {
      const res = await claimQuestReward(quest.id);
      queryClient.setQueryData(["user-gamification-state"], res.state);
      setNotice(`ยินดีด้วย! คุณได้รับ +${res.earnedPoints} แต้ม และ +${res.earnedExp} EXP`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรับรางวัล");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRedeem = async (item: ShopItem) => {
    setIsActionPending(true);
    try {
      const res = await redeemShopItem(item.id);
      if (!res.success) {
        setNotice(res.error ?? "ไม่สามารถแลกของรางวัลได้");
        return;
      }
      queryClient.setQueryData(["user-gamification-state"], res.state);
      setConfirmRedeemItem(null);
      if (item.category === "coupon" && res.coupon) {
        setNotice(`แลกสำเร็จ! คูปอง "${item.name}" ถูกเพิ่มลงในกระเป๋าของคุณแล้ว`);
        setActiveCouponModal(res.coupon);
      } else {
        setNotice(`แลกสำเร็จ! "${item.name}" ถูกปลดล็อกและสวมใส่บนโปรไฟล์ของคุณแล้ว`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการแลกรางวัล");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleUseCoupon = async (coupon: RedeemedCoupon) => {
    setIsActionPending(true);
    try {
      const updated = await useCoupon(coupon.id);
      queryClient.setQueryData(["user-gamification-state"], updated);
      setActiveCouponModal(null);
      setNotice(`ใช้สิทธิ์คูปอง "${coupon.title}" เรียบร้อยแล้ว`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการใช้คูปอง");
    } finally {
      setIsActionPending(false);
    }
  };

  const getQuestIcon = (iconKey: QuestItem["iconKey"]) => {
    switch (iconKey) {
      case "coffee":
        return <Coffee size={18} aria-hidden="true" />;
      case "bookmark":
        return <Bookmark size={18} aria-hidden="true" />;
      case "edit-3":
        return <Edit3 size={18} aria-hidden="true" />;
      case "route":
        return <Route size={18} aria-hidden="true" />;
      case "zap":
        return <Zap size={18} aria-hidden="true" />;
      default:
        return <MapPin size={18} aria-hidden="true" />;
    }
  };

  const getAchievementIcon = (iconKey: AchievementItem["iconKey"]) => {
    switch (iconKey) {
      case "sparkles":
        return <Sparkles size={20} aria-hidden="true" />;
      case "coffee":
        return <Coffee size={20} aria-hidden="true" />;
      case "footprints":
        return <Footprints size={20} aria-hidden="true" />;
      case "route":
        return <Route size={20} aria-hidden="true" />;
      default:
        return <BadgeCheck size={20} aria-hidden="true" />;
    }
  };

  const navTabs = [
    {
      id: "level",
      label: (
        <span className="gamification-tab-label">
          <Sparkles size={15} aria-hidden="true" />
          <span>ระดับ & เหรียญตรา</span>
        </span>
      ),
    },
    {
      id: "quests",
      label: (
        <span className="gamification-tab-label">
          <Gift size={15} aria-hidden="true" />
          <span>ภารกิจ & กิจกรรม</span>
        </span>
      ),
    },
    {
      id: "shop",
      label: (
        <span className="gamification-tab-label">
          <ShoppingBag size={15} aria-hidden="true" />
          <span>ร้านค้าแลกรางวัล</span>
        </span>
      ),
    },
    {
      id: "coupons",
      label: (
        <span className="gamification-tab-label">
          <Ticket size={15} aria-hidden="true" />
          <span>กระเป๋าคูปอง ({state.redeemedCoupons.filter((c) => c.status === "active").length})</span>
        </span>
      ),
    },
  ] as const;

  const isItemOwned = (item: ShopItem): boolean => {
    if (item.category === "avatar_decoration" && item.decorationId) {
      return state.unlockedDecorations.includes(item.decorationId);
    }
    if (item.category === "profile_effect" && item.effectId) {
      return state.unlockedEffects.includes(item.effectId);
    }
    if (item.category === "banner" && item.bannerId) {
      return state.unlockedBanners.includes(item.bannerId);
    }
    return false;
  };

  const filteredShopItems = SHOP_ITEMS_CATALOG.filter((item) => {
    if (selectedShopFilter === "cosmetic") {
      return item.category !== "coupon";
    }
    if (selectedShopFilter === "coupons") {
      return item.category === "coupon";
    }
    return true;
  });

  const getBreadcrumbs = (tab: GamificationTab): BreadcrumbStep[] => {
    const profileStep: BreadcrumbStep = {
      label: "โปรไฟล์",
      to: "/profile",
      icon: <User size={13} aria-hidden="true" />,
    };

    switch (tab) {
      case "coupons":
        return [
          profileStep,
          {
            label: "ร้านค้า & รางวัล",
            to: "/shop",
            icon: <ShoppingBag size={13} aria-hidden="true" />,
          },
          {
            label: "คูปองของฉัน",
            icon: <Ticket size={13} aria-hidden="true" />,
          },
        ];
      case "shop":
        return [
          profileStep,
          {
            label: "ร้านค้า & รางวัล",
            icon: <ShoppingBag size={13} aria-hidden="true" />,
          },
        ];
      case "quests":
        return [
          profileStep,
          {
            label: "ภารกิจ & กิจกรรม",
            icon: <Sparkles size={13} aria-hidden="true" />,
          },
        ];
      case "level":
      default:
        return [
          profileStep,
          {
            label: "ระดับ & เหรียญตรา",
            icon: <Award size={13} aria-hidden="true" />,
          },
        ];
    }
  };

  return (
    <div className="gamification-hub-page page-frame">
      {/* Topline & Hierarchical Subpage Navigation */}
      <div className="gamification-hub-header">
        <SubpageNavigation breadcrumbs={getBreadcrumbs(activeTab)} />
        <div className="gamification-user-badges">
          <span className="gamification-level-pill" style={{ borderColor: levelInfo.tierBadgeColor }}>
            <span className="gamification-level-pill__dot" style={{ background: levelInfo.tierBadgeColor }} />
            <strong>Lv.{levelInfo.level}</strong>
            <small>{levelInfo.title}</small>
          </span>
          <span className="gamification-points-pill" title="Aevo Points สะสม">
            <Coins size={14} className="icon-gold" aria-hidden="true" />
            <strong>{state.points}</strong>
            <small>Pts</small>
          </span>
        </div>
      </div>

      {/* Hero Headline */}
      <div className="gamification-hero-banner">
        <div className="gamification-hero-banner__text">
          <span className="eyebrow">GAMIFICATION & REWARDS</span>
          <h1>เส้นทางความสำเร็จและของรางวัล</h1>
          <p>
            สะสม EXP จากการสำรวจย่าน เช็คอิน รีวิว และจองผ่าน Aevo Play
            เพื่อรับแต้มแลกกรอบอวาตาร์ เอฟเฟกต์ และคูปองร้านค้าพาร์ทเนอร์
          </p>
        </div>
      </div>

      {notice && (
        <div className="gamification-notice" role="status">
          <Check size={16} aria-hidden="true" />
          <span>{notice}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="ปิดแจ้งเตือน"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="gamification-nav-container">
        <GlidingGroup
          items={navTabs}
          activeId={activeTab}
          onChange={(id) => setTab(id as GamificationTab)}
          ariaLabel="Gamification Hub Navigation"
          role="tablist"
        />
      </div>

      {/* TAB 1: LEVEL & BADGES */}
      {activeTab === "level" && (
        <div className="gamification-tab-content">
          {/* Level Progress Bento Card */}
          <section className="gamification-level-card" aria-label="ระดับและ EXP ปัจจุบัน">
            <div className="gamification-level-card__top">
              <div className="gamification-level-badge-large" style={{ borderColor: levelInfo.tierBadgeColor }}>
                <span className="gamification-level-num">Lv.{levelInfo.level}</span>
                <span className="gamification-level-star">★</span>
              </div>
              <div className="gamification-level-card__info">
                <span className="eyebrow" style={{ color: levelInfo.tierBadgeColor }}>
                  {levelInfo.subtitle}
                </span>
                <h2>{levelInfo.title}</h2>
                <p>
                  อีก {Math.max(0, levelInfo.nextLevelExp - levelInfo.currentExp)} EXP
                  เพื่อเลื่อนสู่ระดับถัดไปและปลดล็อกสิทธิพิเศษเพิ่มเติม
                </p>
              </div>
            </div>

            {/* EXP Progress Bar */}
            <div className="gamification-exp-progress-wrapper">
              <div className="gamification-exp-labels">
                <span>ความคืบหน้า EXP</span>
                <strong>
                  {levelInfo.currentExp} / {levelInfo.nextLevelExp} EXP ({levelInfo.progressPercent}%)
                </strong>
              </div>
              <div className="gamification-exp-track">
                <div
                  className="gamification-exp-fill"
                  style={{
                    width: `${levelInfo.progressPercent}%`,
                    background: `linear-gradient(90deg, #38bdf8 0%, ${levelInfo.tierBadgeColor} 100%)`,
                  }}
                />
              </div>
            </div>

            {/* Level Perks Unlocked */}
            <div className="gamification-perks-row">
              <div className="gamification-perk-item">
                <BadgeCheck size={16} aria-hidden="true" />
                <span>ปลดล็อกกรอบอวาตาร์ระดับ Tastemaker</span>
              </div>
              <div className="gamification-perk-item">
                <Zap size={16} aria-hidden="true" />
                <span>รับแต้มคูณ 1.2x เมื่อจองผ่าน Aevo Play</span>
              </div>
              <div className="gamification-perk-item">
                <Ticket size={16} aria-hidden="true" />
                <span>สิทธิ์แลกคูปองลับประจำสัปดาห์</span>
              </div>
            </div>
          </section>

          {/* Achievements & Milestones Section */}
          <section className="gamification-section" aria-labelledby="achievements-heading">
            <div className="section-heading">
              <div>
                <h3 id="achievements-heading">เหรียญตราและความสำเร็จ (Achievements)</h3>
                <span className="muted-label">
                  ปลดล็อกแล้ว {INITIAL_ACHIEVEMENTS_CATALOG.filter((a) => a.unlocked).length} จาก{" "}
                  {INITIAL_ACHIEVEMENTS_CATALOG.length} รายการ
                </span>
              </div>
            </div>

            <div className="gamification-achievements-grid">
              {INITIAL_ACHIEVEMENTS_CATALOG.map((ach) => (
                <div
                  key={ach.id}
                  className={`gamification-achievement-card${ach.unlocked ? " is-unlocked" : " is-locked"}`}
                >
                  <div className="gamification-achievement-card__icon">
                    {getAchievementIcon(ach.iconKey)}
                  </div>
                  <div className="gamification-achievement-card__body">
                    <div className="gamification-achievement-card__header">
                      <h4>{ach.title}</h4>
                      {ach.unlocked && <span className="achievement-unlocked-tag">ปลดล็อกแล้ว</span>}
                    </div>
                    <p>{ach.description}</p>
                    <div className="gamification-achievement-card__footer">
                      <span className="achievement-reward">
                        +{ach.rewardExp} EXP · +{ach.rewardPoints} Pts
                      </span>
                      <span className="achievement-progress-text">
                        {ach.currentProgress} / {ach.maxProgress}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: QUESTS & MISSIONS */}
      {activeTab === "quests" && (
        <div className="gamification-tab-content">
          <div className="gamification-quests-banner">
            <div>
              <h3>ภารกิจสะสมแต้มประจำวันและเมือง</h3>
              <p>ทำกิจกรรม สำรวจสถานที่ หรือเขียนรีวิวเพื่อรับแต้มนำไปแลกของรางวัลใน Shop</p>
            </div>
            <Link className="button button--ghost" to="/profile/shop">
              <ShoppingBag size={15} aria-hidden="true" />
              ไปหน้าร้านค้าแลกรางวัล
            </Link>
          </div>

          <div className="gamification-quests-list" aria-label="รายการภารกิจ">
            {INITIAL_QUESTS_CATALOG.map((quest) => {
              const isCompleted = quest.currentProgress >= quest.maxProgress;
              const isClaimed = state.claimedQuestIds.includes(quest.id);

              return (
                <article
                  key={quest.id}
                  className={`gamification-quest-card${isClaimed ? " is-claimed" : isCompleted ? " is-ready" : ""}`}
                >
                  <div className="gamification-quest-card__icon">
                    {getQuestIcon(quest.iconKey)}
                  </div>

                  <div className="gamification-quest-card__content">
                    <div className="gamification-quest-card__topline">
                      <span className="quest-category-badge">{quest.category.toUpperCase()}</span>
                      <span className="quest-reward-badge">
                        +{quest.rewardPoints} Pts · +{quest.rewardExp} EXP
                      </span>
                    </div>
                    <h4>{quest.title}</h4>
                    <p>{quest.description}</p>

                    <div className="gamification-quest-progress-bar">
                      <div className="gamification-quest-progress-info">
                        <small>ความคืบหน้า</small>
                        <small>
                          {quest.currentProgress} / {quest.maxProgress}
                        </small>
                      </div>
                      <div className="quest-track">
                        <div
                          className="quest-fill"
                          style={{
                            width: `${Math.min(100, Math.round((quest.currentProgress / quest.maxProgress) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="gamification-quest-card__action">
                    {isClaimed ? (
                      <span className="quest-claimed-badge">
                        <Check size={14} aria-hidden="true" />
                        รับรางวัลแล้ว
                      </span>
                    ) : isCompleted ? (
                      <button
                        type="button"
                        className="button button--dark button-claim-quest"
                        disabled={isActionPending}
                        onClick={() => void handleClaimQuest(quest)}
                      >
                        <Sparkles size={14} aria-hidden="true" />
                        รับรางวัล
                      </button>
                    ) : (
                      <Link className="button button--ghost" to={quest.actionLink}>
                        {quest.actionLabel}
                        <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: REWARDS SHOP */}
      {activeTab === "shop" && (
        <div className="gamification-tab-content">
          <div className="gamification-shop-bar">
            <div className="gamification-shop-bar__points">
              <span className="eyebrow">YOUR WALLET</span>
              <div className="shop-balance">
                <Coins size={22} className="icon-gold" aria-hidden="true" />
                <strong>{state.points}</strong>
                <span>Points พร้อมแลก</span>
              </div>
            </div>

            <div className="gamification-shop-filters">
              <GlidingGroup
                items={[
                  { id: "all", label: "ทั้งหมด" },
                  { id: "cosmetic", label: "ของตกแต่งโปรไฟล์" },
                  { id: "coupons", label: "คูปองร้านค้า" },
                ]}
                activeId={selectedShopFilter}
                onChange={(id) => setSelectedShopFilter(id as "all" | "cosmetic" | "coupons")}
                ariaLabel="ตัวกรองร้านค้า"
                size="small"
              />
            </div>
          </div>

          <div className="gamification-shop-grid">
            {filteredShopItems.map((item) => {
              const owned = isItemOwned(item);
              const canAfford = state.points >= item.costPoints;

              return (
                <div key={item.id} className="gamification-shop-card">
                  {/* Cosmetic Preview Box */}
                  <div className="gamification-shop-card__preview">
                    {item.category === "avatar_decoration" && item.decorationId && (
                      <div className="shop-avatar-preview">
                        <div className="shop-avatar-circle">AG</div>
                        <AvatarDecoration decorationId={item.decorationId} size={56} />
                      </div>
                    )}
                    {item.category === "profile_effect" && item.effectId && (
                      <div className="shop-effect-preview">
                        <ProfileEffectLayer effectId={item.effectId} />
                        <span className="shop-effect-indicator" style={{ color: item.accentColor }}>
                          {item.name}
                        </span>
                      </div>
                    )}
                    {item.category === "banner" && (
                      <div className="shop-banner-preview" style={{ background: item.accentColor }}>
                        <span>{item.name}</span>
                      </div>
                    )}
                    {item.category === "coupon" && (
                      <div className="shop-coupon-preview">
                        <Ticket size={28} style={{ color: item.accentColor }} aria-hidden="true" />
                        <strong>{item.discountLabel}</strong>
                        <small>{item.partnerStoreName}</small>
                      </div>
                    )}
                    <span className="shop-item-tag" style={{ color: item.accentColor }}>
                      {item.tag}
                    </span>
                  </div>

                  <div className="gamification-shop-card__body">
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                  </div>

                  <div className="gamification-shop-card__footer">
                    <span className="shop-cost">
                      <Coins size={15} className="icon-gold" aria-hidden="true" />
                      <strong>{item.costPoints}</strong>
                      <small>Points</small>
                    </span>

                    {owned ? (
                      <span className="shop-owned-badge">
                        <Check size={14} aria-hidden="true" /> ครอบครองแล้ว
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`button ${canAfford ? "button--dark" : "button--ghost"}`}
                        disabled={!canAfford || isActionPending}
                        onClick={() => setConfirmRedeemItem(item)}
                      >
                        {canAfford ? "แลกรางวัล" : "แต้มไม่พอ"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: MY COUPONS */}
      {activeTab === "coupons" && (
        <div className="gamification-tab-content">
          <div className="gamification-coupons-header">
            <div>
              <h3>กระเป๋าคูปองและสิทธิพิเศษของคุณ</h3>
              <p>แสดงรหัสหรือบาร์โค้ดคูปองแก่พนักงานร้านค้าพาร์ทเนอร์เพื่อรับสิทธิ์</p>
            </div>
            <Link className="button button--ghost" to="/profile/shop">
              <ShoppingBag size={15} aria-hidden="true" />
              แลกคูปองเพิ่ม
            </Link>
          </div>

          {state.redeemedCoupons.length > 0 ? (
            <div className="gamification-coupons-grid">
              {state.redeemedCoupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className={`gamification-coupon-ticket${coupon.status === "used" ? " is-used" : ""}`}
                >
                  <div className="gamification-coupon-ticket__left">
                    <span className="coupon-partner-label">{coupon.partnerStoreName}</span>
                    <h4>{coupon.discountLabel}</h4>
                    <p>{coupon.title}</p>
                    <div className="coupon-expiry">
                      <Clock3 size={13} aria-hidden="true" />
                      <span>ใช้ได้ถึง {new Date(coupon.validUntil).toLocaleDateString("th-TH")}</span>
                    </div>
                  </div>

                  <div className="gamification-coupon-ticket__stub">
                    <span className="coupon-code-badge">{coupon.code}</span>
                    {coupon.status === "used" ? (
                      <span className="coupon-used-stamp">ใช้สิทธิ์แล้ว</span>
                    ) : (
                      <button
                        type="button"
                        className="button button--dark button-show-coupon"
                        onClick={() => setActiveCouponModal(coupon)}
                      >
                        <QrCode size={14} aria-hidden="true" />
                        ใช้สิทธิ์
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-card" role="status">
              <div className="profile-empty-card__icon">
                <Ticket size={28} aria-hidden="true" />
              </div>
              <h3>ยังไม่มีคูปองในกระเป๋า</h3>
              <p>สะสมแต้มจากการทำเควสแล้วนำมาแลกสิทธิพิเศษจากร้านค้าพาร์ทเนอร์ได้ที่นี่</p>
              <button
                type="button"
                className="profile-empty-card__cta"
                onClick={() => setTab("shop")}
              >
                <ShoppingBag size={15} aria-hidden="true" />
                <span>ไปร้านค้าแลกคูปอง</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Confirm Redeem Shop Item */}
      {confirmRedeemItem && (
        <div className="profile-customizer-backdrop" role="dialog" aria-modal="true">
          <div className="gamification-confirm-modal">
            <div className="gamification-confirm-modal__header">
              <h3>ยืนยันการแลกของรางวัล</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setConfirmRedeemItem(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="gamification-confirm-modal__body">
              <h4>{confirmRedeemItem.name}</h4>
              <p>{confirmRedeemItem.description}</p>
              <div className="confirm-points-summary">
                <div>
                  <span>แต้มปัจจุบัน:</span>
                  <strong>{state.points} Pts</strong>
                </div>
                <div>
                  <span>ใช้แต้มแลก:</span>
                  <strong className="text-danger">-{confirmRedeemItem.costPoints} Pts</strong>
                </div>
                <div className="confirm-balance-row">
                  <span>แต้มคงเหลือหลังแลก:</span>
                  <strong>{state.points - confirmRedeemItem.costPoints} Pts</strong>
                </div>
              </div>
            </div>
            <div className="gamification-confirm-modal__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setConfirmRedeemItem(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="button button--dark"
                disabled={isActionPending}
                onClick={() => void handleRedeem(confirmRedeemItem)}
              >
                <Check size={15} aria-hidden="true" />
                ยืนยันการแลก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Active Coupon & Barcode for Store Redemption */}
      {activeCouponModal && (
        <div className="profile-customizer-backdrop" role="dialog" aria-modal="true">
          <div className="gamification-barcode-modal">
            <div className="gamification-confirm-modal__header">
              <h3>สิทธิพิเศษของคุณ</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setActiveCouponModal(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="gamification-barcode-modal__body">
              <span className="eyebrow">{activeCouponModal.partnerStoreName}</span>
              <h4>{activeCouponModal.title}</h4>
              <p className="discount-highlight">{activeCouponModal.discountLabel}</p>

              {/* Simulated Barcode */}
              <div className="coupon-barcode-display" aria-label="บาร์โค้ดคูปอง">
                <div className="barcode-lines" />
                <span className="barcode-code-text">{activeCouponModal.code}</span>
              </div>
              <small className="barcode-instruction">
                แสดงหน้าจอนี้แก่พนักงานร้านเพื่อสแกนหรือบันทึกส่วนลด
              </small>
            </div>
            <div className="gamification-confirm-modal__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setActiveCouponModal(null)}
              >
                ปิดหน้าต่าง
              </button>
              {activeCouponModal.status === "active" && (
                <button
                  type="button"
                  className="button button--dark"
                  disabled={isActionPending}
                  onClick={() => void handleUseCoupon(activeCouponModal)}
                >
                  <Check size={15} aria-hidden="true" />
                  ใช้สิทธิ์เรียบร้อยแล้ว
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GamificationHubPage;
