import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { calculateLevelInfo } from "./types";
import {
  addGamificationPoints,
  claimQuestReward,
  getGamificationState,
  redeemShopItem,
  saveGamificationState,
  useCoupon,
} from "./storage";
import { localRepository } from "@/lib/local-repository";
import { GamificationHubPage } from "./gamification-hub-page";

describe("Gamification System - Calculations & Contracts", () => {
  it("calculates level info accurately across progression tiers", () => {
    // Level 1: 0 - 199 EXP
    const lvl1 = calculateLevelInfo(50);
    expect(lvl1.level).toBe(1);
    expect(lvl1.title).toBe("Urban Novice");
    expect(lvl1.nextLevelExp).toBe(200);
    expect(lvl1.progressPercent).toBe(25); // 50 / 200 = 25%

    // Level 3: 500 - 999 EXP (range size = 500)
    const lvl3 = calculateLevelInfo(750);
    expect(lvl3.level).toBe(3);
    expect(lvl3.title).toBe("Taste Connoisseur");
    expect(lvl3.nextLevelExp).toBe(1000);
    expect(lvl3.progressPercent).toBe(50); // (750 - 500) / 500 = 50%

    // Max Level 6: 3000+ EXP
    const maxLvl = calculateLevelInfo(4500);
    expect(maxLvl.level).toBe(6);
    expect(maxLvl.title).toBe("Urban Legend");
    expect(maxLvl.progressPercent).toBe(100);
  });
});

describe("Gamification Storage & Operations Engine", () => {
  const testUserId = "test-gamer-42";

  beforeEach(async () => {
    try {
      await localRepository.setPreference(`user_gamification_v1_${testUserId}`, null);
      await localRepository.setPreference(`profile_customization_v1_${testUserId}`, null);
    } catch {
      // ignore
    }
  });

  it("returns initialized state when no state is previously stored", async () => {
    const state = await getGamificationState(testUserId);
    expect(state.userId).toBe(testUserId);
    expect(state.points).toBe(480);
    expect(state.totalExp).toBe(750);
    expect(state.unlockedDecorations).toContain("lightstruck-halo");
  });

  it("claims quest reward successfully and updates points and EXP", async () => {
    // Initial state has quest-daily-save ready (completed, but not yet claimed)
    const initial = await getGamificationState(testUserId);
    expect(initial.claimedQuestIds).not.toContain("quest-daily-save");

    const result = await claimQuestReward("quest-daily-save", testUserId);
    expect(result.success).toBe(true);
    expect(result.earnedPoints).toBe(30);
    expect(result.earnedExp).toBe(60);
    expect(result.state.points).toBe(initial.points + 30);
    expect(result.state.totalExp).toBe(initial.totalExp + 60);
    expect(result.state.claimedQuestIds).toContain("quest-daily-save");

    // Second claim should throw
    await expect(claimQuestReward("quest-daily-save", testUserId)).rejects.toThrow(
      "รับรางวัลภารกิจนี้ไปแล้ว"
    );
  });

  it("validates insufficient points during shop item redemption", async () => {
    // Set points to 10
    const state = await getGamificationState(testUserId);
    await saveGamificationState({ ...state, points: 10 });

    const result = await redeemShopItem("shop-dec-sakura", testUserId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("แต้มสะสมไม่เพียงพอ");
  });

  it("redeems cosmetic item, deducts points, unlocks item, and equips it", async () => {
    // Set enough points
    const state = await getGamificationState(testUserId);
    await saveGamificationState({ ...state, points: 600 });

    const result = await redeemShopItem("shop-dec-sakura", testUserId);
    expect(result.success).toBe(true);
    expect(result.state.unlockedDecorations).toContain("sakura-orbit");
    expect(result.state.points).toBe(600 - 120); // 120 points cost

    // Verify stored state has unlocked sakura-orbit
    const updated = await getGamificationState(testUserId);
    expect(updated.unlockedDecorations).toContain("sakura-orbit");
  });

  it("redeems merchant partner coupon and allows using it", async () => {
    const state = await getGamificationState(testUserId);
    await saveGamificationState({ ...state, points: 600 });

    const result = await redeemShopItem("shop-coup-talat-noi", testUserId);
    expect(result.success).toBe(true);
    expect(result.coupon).toBeDefined();
    expect(result.coupon?.partnerStoreName).toBe("Talat Noi Roastery");
    expect(result.coupon?.status).toBe("active");
    expect(result.coupon?.code).toMatch(/^AEVO-/);

    const couponId = result.coupon!.id;

    // Use coupon
    const stateAfterUse = await useCoupon(couponId, testUserId);
    const usedCoupon = stateAfterUse.redeemedCoupons.find((c) => c.id === couponId);
    expect(usedCoupon?.status).toBe("used");
  });

  it("supports manual points & exp accrual via addGamificationPoints", async () => {
    const updated = await addGamificationPoints(100, 150, testUserId);
    expect(updated.points).toBe(480 + 100);
    expect(updated.totalExp).toBe(750 + 150);
  });
});

describe("GamificationHubPage UI Component", () => {
  const createTestQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

  it("renders level tab by default with level badge, EXP bar, and achievements", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile/level"]}>
          <Routes>
            <Route path="/profile/:tab?" element={<GamificationHubPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "เส้นทางความสำเร็จและของรางวัล" })).toBeInTheDocument();
    expect(screen.getAllByText("Taste Connoisseur").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("เหรียญตราและความสำเร็จ (Achievements)")).toBeInTheDocument();
    expect(screen.getByText("Founding Tastemaker")).toBeInTheDocument();
  });

  it("switches to quests tab and shows daily and exploration missions", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile/quests"]}>
          <Routes>
            <Route path="/profile/:tab?" element={<GamificationHubPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("ภารกิจสะสมแต้มประจำวันและเมือง")).toBeInTheDocument();
    expect(screen.getByText("บันทึกสถานที่โปรดลงใน Saved")).toBeInTheDocument();
    expect(screen.getByText("เดินตามรอย Trace ย่าน Ari ถึงตลาดน้อย")).toBeInTheDocument();
  });

  it("switches to shop tab and displays points wallet and item cards", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile/shop"]}>
          <Routes>
            <Route path="/profile/:tab?" element={<GamificationHubPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("YOUR WALLET")).toBeInTheDocument();
    expect(screen.getByText("Points พร้อมแลก")).toBeInTheDocument();
    expect(screen.getByText("Sakura Orbit")).toBeInTheDocument();
    expect(screen.getByText("North Star Coffee: รับฟรี Specialty Drip Bag")).toBeInTheDocument();
  });

  it("switches to coupons tab and displays active coupons with barcode modal trigger", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile/coupons"]}>
          <Routes>
            <Route path="/profile/:tab?" element={<GamificationHubPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("กระเป๋าคูปองและสิทธิพิเศษของคุณ")).toBeInTheDocument();
    expect(screen.getByText("North Star Coffee")).toBeInTheDocument();

    // Click on "ใช้สิทธิ์" button
    const openBarcodeBtn = screen.getByRole("button", { name: /ใช้สิทธิ์/ });
    fireEvent.click(openBarcodeBtn);

    // Modal opens showing simulated barcode
    expect(screen.getByRole("heading", { name: "สิทธิพิเศษของคุณ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ใช้สิทธิ์เรียบร้อยแล้ว" })).toBeInTheDocument();
  });
});
