import type { AvatarDecorationId, BannerPresetId, ProfileEffectId } from "@/features/profile/profile-customization-types";

export interface UserGamificationState {
  version: 1;
  userId: string;
  totalExp: number;
  points: number;
  unlockedDecorations: AvatarDecorationId[];
  unlockedEffects: ProfileEffectId[];
  unlockedBanners: BannerPresetId[];
  completedQuestIds: string[];
  claimedQuestIds: string[];
  unlockedAchievementIds: string[];
  redeemedCoupons: RedeemedCoupon[];
  updatedAt: number;
}

export type QuestCategory = "daily" | "explore" | "community" | "spend";

export interface QuestItem {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  rewardPoints: number;
  rewardExp: number;
  currentProgress: number;
  maxProgress: number;
  actionLabel: string;
  actionLink: string;
  iconKey: "map-pin" | "coffee" | "bookmark" | "heart" | "edit-3" | "route" | "zap";
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  category: "explorer" | "taste" | "social" | "mastery";
  iconKey: "badge-check" | "sparkles" | "compass" | "coffee" | "footprints" | "route" | "award";
  rewardExp: number;
  rewardPoints: number;
  unlocked: boolean;
  unlockedAt?: number;
  currentProgress: number;
  maxProgress: number;
}

export type ShopCategory = "avatar_decoration" | "profile_effect" | "banner" | "coupon";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  costPoints: number;
  tag: string;
  accentColor: string;
  // If cosmetic
  decorationId?: AvatarDecorationId;
  effectId?: ProfileEffectId;
  bannerId?: BannerPresetId;
  // If merchant coupon
  partnerStoreSlug?: string;
  partnerStoreName?: string;
  discountLabel?: string;
  validDays?: number;
}

export interface RedeemedCoupon {
  id: string;
  shopItemId: string;
  code: string;
  title: string;
  partnerStoreName: string;
  discountLabel: string;
  redeemedAt: number;
  validUntil: number;
  status: "active" | "used" | "expired";
}

export interface LevelInfo {
  level: number;
  title: string;
  subtitle: string;
  currentExp: number;
  nextLevelExp: number;
  progressPercent: number;
  tierBadgeColor: string;
}

export const LEVEL_TIERS: readonly { minExp: number; level: number; title: string; subtitle: string; color: string }[] = [
  { minExp: 0, level: 1, title: "Urban Novice", subtitle: "นักสำรวจเมืองมือใหม่", color: "#94a3b8" },
  { minExp: 200, level: 2, title: "Neighborhood Scout", subtitle: "นักสังเกตการณ์ย่าน", color: "#38bdf8" },
  { minExp: 500, level: 3, title: "Taste Connoisseur", subtitle: "ผู้ชำนาญการคัดสรรรสนิยม", color: "#34d399" },
  { minExp: 1000, level: 4, title: "City Curator", subtitle: "ภัณฑารักษ์แห่งเมือง", color: "#fbbf24" },
  { minExp: 1800, level: 5, title: "Master Tastemaker", subtitle: "ผู้สร้างสรรค์วิถีเมือง", color: "#c084fc" },
  { minExp: 3000, level: 6, title: "Urban Legend", subtitle: "ตำนานนักเดินทาง Aevocado", color: "#f43f5e" },
];

export function calculateLevelInfo(totalExp: number): LevelInfo {
  let activeTier = LEVEL_TIERS[0]!;
  let nextTier = LEVEL_TIERS[1];

  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    const tier = LEVEL_TIERS[i]!;
    if (totalExp >= tier.minExp) {
      activeTier = tier;
      nextTier = LEVEL_TIERS[i + 1];
      break;
    }
  }

  if (!nextTier) {
    return {
      level: activeTier.level,
      title: activeTier.title,
      subtitle: activeTier.subtitle,
      currentExp: totalExp,
      nextLevelExp: totalExp,
      progressPercent: 100,
      tierBadgeColor: activeTier.color,
    };
  }

  const expInCurrentTier = totalExp - activeTier.minExp;
  const expRequiredForNext = nextTier.minExp - activeTier.minExp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((expInCurrentTier / expRequiredForNext) * 100)));

  return {
    level: activeTier.level,
    title: activeTier.title,
    subtitle: activeTier.subtitle,
    currentExp: totalExp,
    nextLevelExp: nextTier.minExp,
    progressPercent,
    tierBadgeColor: activeTier.color,
  };
}
