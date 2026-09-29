import { describe, it, expect } from "vitest";
import {
  searchTraceRequestSchema,
  searchTraceResponseSchema,
  adminSearchConfigSchema,
} from "./search";

describe("search contracts", () => {
  it("validates client-facing POST /api/v1/search/trace request correctly", () => {
    const validRequest = {
      query: "หาร้านกาแฟเงียบๆ ไว้นั่งทำงาน แล้วต่อด้วยมื้อเที่ยงแถวอารีย์",
      user_location: {
        lat: 13.7797,
        lng: 100.5447,
        accuracy_meters: 12,
      },
      constraints: {
        max_walking_dist_meters: 1500,
        max_nodes: 3,
        prefer_aevo_partners: true,
      },
    };

    const parsed = searchTraceRequestSchema.safeParse(validRequest);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.query).toContain("หาร้านกาแฟ");
      expect(parsed.data.user_location.lat).toBe(13.7797);
      expect(parsed.data.constraints?.prefer_aevo_partners).toBe(true);
    }
  });

  it("validates synthesized search trace response matching Phase 4.1 specification", () => {
    const validResponse = {
      trace_id: "tr_ari_coffee_lunch_01",
      title: "Quiet Workspace & Artisan Lunch Trace",
      summary: "เริ่มต้นกาแฟ Slow bar เงียบสงบ แล้วเดินต่อไปร้านอาหารจานด่วนพรีเมียม",
      total_distance_meters: 1150,
      estimated_walking_mins: 16,
      waypoints: [
        {
          step: 1,
          place_id: "p_north_star",
          name: "North Star Coffee",
          category: "cafe",
          vibe_matches: ["quiet", "plugs", "slow-bar"],
          walk_to_next: { distance_meters: 450, mins: 6 },
          aevo_perk: { type: "discount", label: "ส่วนลด 15% Aevo Play" },
        },
        {
          step: 2,
          place_id: "p_sora_table",
          name: "Sora Table",
          category: "lunch_dining",
          vibe_matches: ["fast-casual", "comfort-food"],
          walk_to_next: null,
          aevo_perk: { type: "fast_pass", label: "Fast Pass ลัดคิวทันที" },
        },
      ],
    };

    const parsed = searchTraceResponseSchema.safeParse(validResponse);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.waypoints).toHaveLength(2);
      expect(parsed.data.waypoints[0].aevo_perk?.type).toBe("discount");
      expect(parsed.data.waypoints[1].walk_to_next).toBeNull();
    }
  });

  it("validates admin configuration matching Phase 4.2 specification", () => {
    const validConfig = {
      weights: {
        semantic: 0.35,
        distance: 0.3,
        partner: 0.2,
        rating: 0.15,
        time: 0.1,
      },
      max_search_radius_meters: 2500,
      dynamic_rerank_enabled: true,
      time_slots: [
        {
          slot_id: "morning_rush",
          label: "Morning Rush",
          time_range: "07:00-11:00",
          preset_trace_tags: ["cafe", "takeaway", "breakfast"],
          recommended_prompts: ["Slow Bar เช้า", "Takeaway ด่วน"],
        },
      ],
    };

    const parsed = adminSearchConfigSchema.safeParse(validConfig);
    expect(parsed.success).toBe(true);
  });
});
