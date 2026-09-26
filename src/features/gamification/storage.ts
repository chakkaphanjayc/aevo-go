import { localRepository } from "@/lib/local-repository";
import type { RedeemedCoupon, UserGamificationState } from "./types";
import { INITIAL_ACHIEVEMENTS_CATALOG, INITIAL_QUESTS_CATALOG, SHOP_ITEMS_CATALOG } from "./catalog";
import { getStoredProfileCustomization, saveStoredProfileCustomization } from "@/features/profile/profile-storage";

const CURRENT_SCHEMA_VERSION = 1;

export function defaultGamificationState(userId = "current-user"): UserGamificationState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    userId,
    totalExp: 750, // Starts at Level 3: Taste Connoisseur for a welcoming active feel
    points: 480,   // Starting points to explore and test shop redemptions
    unlockedDecorations: ["none", "lightstruck-halo"],
    unlockedEffects: ["none", "prismatic-sheen"],
    unlockedBanners: ["obsidian-carbon", "lightstruck-iridescent"],
    completedQuestIds: ["quest-daily-checkin", "quest-daily-save", "quest-explore-booking"],
    claimedQuestIds: ["quest-daily-checkin"], // quest-daily-save and quest-explore-booking are ready to be claimed!
    unlockedAchievementIds: ["ach-founding-tastemaker", "ach-coffee-explorer", "ach-patron"],
    redeemedCoupons: [
      {
        id: "coupon-starter-1",
        shopItemId: "shop-coup-north-star",
        code: "AEVO-NORTH-DRIP-902",
        title: "North Star Coffee: รับฟรี Specialty Drip Bag",
        partnerStoreName: "North Star Coffee",
        discountLabel: "Free Drip Bag",
        redeemedAt: Date.now() - 86400000 * 2,
        validUntil: Date.now() + 86400000 * 28,
        status: "active",
      },
    ],
    updatedAt: Date.now(),
  };
}

function getStorageKey(userId?: string): string {
  const normalizedId = userId?.trim() || "current-user";
  return `user_gamification_v1_${normalizedId}`;
}

export async function getGamificationState(userId?: string): Promise<UserGamificationState> {
  const key = getStorageKey(userId);
  try {
    const raw = await localRepository.getPreference<Partial<UserGamificationState>>(key);
    if (!raw) {
      return defaultGamificationState(userId);
    }

    return {
      version: CURRENT_SCHEMA_VERSION,
      userId: raw.userId ?? userId ?? "current-user",
      totalExp: typeof raw.totalExp === "number" ? raw.totalExp : 750,
      points: typeof raw.points === "number" ? raw.points : 480,
      unlockedDecorations: Array.isArray(raw.unlockedDecorations)
        ? raw.unlockedDecorations
        : ["none", "lightstruck-halo"],
      unlockedEffects: Array.isArray(raw.unlockedEffects)
        ? raw.unlockedEffects
        : ["none", "prismatic-sheen"],
      unlockedBanners: Array.isArray(raw.unlockedBanners)
        ? raw.unlockedBanners
        : ["obsidian-carbon", "lightstruck-iridescent"],
      completedQuestIds: Array.isArray(raw.completedQuestIds)
        ? raw.completedQuestIds
        : ["quest-daily-checkin", "quest-daily-save"],
      claimedQuestIds: Array.isArray(raw.claimedQuestIds) ? raw.claimedQuestIds : ["quest-daily-checkin"],
      unlockedAchievementIds: Array.isArray(raw.unlockedAchievementIds)
        ? raw.unlockedAchievementIds
        : ["ach-founding-tastemaker"],
      redeemedCoupons: Array.isArray(raw.redeemedCoupons) ? raw.redeemedCoupons : [],
      updatedAt: raw.updatedAt ?? Date.now(),
    };
  } catch {
    return defaultGamificationState(userId);
  }
}

export async function saveGamificationState(state: UserGamificationState): Promise<void> {
  const key = getStorageKey(state.userId);
  const updated: UserGamificationState = {
    ...state,
    version: CURRENT_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
  await localRepository.setPreference(key, updated);
}

export async function claimQuestReward(
  questId: string,
  userId?: string
): Promise<{ success: boolean; state: UserGamificationState; earnedPoints: number; earnedExp: number }> {
  const state = await getGamificationState(userId);
  const quest = INITIAL_QUESTS_CATALOG.find((q) => q.id === questId);

  if (!quest) {
    throw new Error("ไม่พบภารกิจนี้");
  }

  if (state.claimedQuestIds.includes(questId)) {
    throw new Error("รับรางวัลภารกิจนี้ไปแล้ว");
  }

  const updatedState: UserGamificationState = {
    ...state,
    points: state.points + quest.rewardPoints,
    totalExp: state.totalExp + quest.rewardExp,
    claimedQuestIds: [...state.claimedQuestIds, questId],
    completedQuestIds: Array.from(new Set([...state.completedQuestIds, questId])),
    updatedAt: Date.now(),
  };

  await saveGamificationState(updatedState);
  return {
    success: true,
    state: updatedState,
    earnedPoints: quest.rewardPoints,
    earnedExp: quest.rewardExp,
  };
}

export async function redeemShopItem(
  shopItemId: string,
  userId?: string
): Promise<{ success: boolean; error?: string; state: UserGamificationState; coupon?: RedeemedCoupon }> {
  const state = await getGamificationState(userId);
  const item = SHOP_ITEMS_CATALOG.find((i) => i.id === shopItemId);

  if (!item) {
    return { success: false, error: "ไม่พบสินค้าในร้านค้า", state };
  }

  if (state.points < item.costPoints) {
    return {
      success: false,
      error: `แต้มสะสมไม่เพียงพอ (ต้องการ ${item.costPoints} แต้ม แต่คุณมี ${state.points} แต้ม)`,
      state,
    };
  }

  let newCoupon: RedeemedCoupon | undefined;
  const updatedState: UserGamificationState = {
    ...state,
    points: state.points - item.costPoints,
    updatedAt: Date.now(),
  };

  // 1. If avatar decoration
  if (item.category === "avatar_decoration" && item.decorationId) {
    if (!updatedState.unlockedDecorations.includes(item.decorationId)) {
      updatedState.unlockedDecorations = [...updatedState.unlockedDecorations, item.decorationId];
    }
  }

  // 2. If profile effect
  if (item.category === "profile_effect" && item.effectId) {
    if (!updatedState.unlockedEffects.includes(item.effectId)) {
      updatedState.unlockedEffects = [...updatedState.unlockedEffects, item.effectId];
    }
  }

  // 3. If cover banner
  if (item.category === "banner" && item.bannerId) {
    if (!updatedState.unlockedBanners.includes(item.bannerId)) {
      updatedState.unlockedBanners = [...updatedState.unlockedBanners, item.bannerId];
    }
  }

  // 4. If merchant coupon
  if (item.category === "coupon") {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    newCoupon = {
      id: `coupon-${Date.now()}-${randomSuffix}`,
      shopItemId: item.id,
      code: `AEVO-${item.tag.replace(/[^A-Z0-9]/g, "") || "PERK"}-${randomSuffix}`,
      title: item.name,
      partnerStoreName: item.partnerStoreName ?? "Aevo Partner",
      discountLabel: item.discountLabel ?? item.tag,
      redeemedAt: Date.now(),
      validUntil: Date.now() + (item.validDays ?? 30) * 86400000,
      status: "active",
    };
    updatedState.redeemedCoupons = [newCoupon, ...updatedState.redeemedCoupons];
  }

  await saveGamificationState(updatedState);

  // Sync with profile customization if cosmetic
  if (item.decorationId || item.effectId || item.bannerId) {
    try {
      const profile = await getStoredProfileCustomization(userId);
      await saveStoredProfileCustomization({
        ...profile,
        avatarDecorationId: item.decorationId ?? profile.avatarDecorationId,
        profileEffectId: item.effectId ?? profile.profileEffectId,
        bannerPresetId: item.bannerId ?? profile.bannerPresetId,
      });
    } catch {
      // Non-blocking profile sync
    }
  }

  return { success: true, state: updatedState, coupon: newCoupon };
}

export async function useCoupon(couponId: string, userId?: string): Promise<UserGamificationState> {
  const state = await getGamificationState(userId);
  const updatedCoupons = state.redeemedCoupons.map((c) =>
    c.id === couponId ? { ...c, status: "used" as const } : c
  );

  const updatedState: UserGamificationState = {
    ...state,
    redeemedCoupons: updatedCoupons,
    updatedAt: Date.now(),
  };

  await saveGamificationState(updatedState);
  return updatedState;
}

export async function addGamificationPoints(
  points: number,
  exp: number,
  userId?: string
): Promise<UserGamificationState> {
  const state = await getGamificationState(userId);
  const updatedState: UserGamificationState = {
    ...state,
    points: state.points + points,
    totalExp: state.totalExp + exp,
    updatedAt: Date.now(),
  };
  await saveGamificationState(updatedState);
  return updatedState;
}
