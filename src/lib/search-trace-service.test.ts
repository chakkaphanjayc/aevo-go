import { describe, it, expect } from "vitest";
import {
  parseSearchIntent,
  calculateHopMetrics,
  swapTraceWaypoint,
  reorderTraceWaypoints,
  searchSmartTrace,
  getCurrentTimeSlot,
} from "./search-trace-service";

describe("search-trace-service", () => {
  it("parses 4-axis multi-dimensional intent correctly", () => {
    const intent = parseSearchIntent(
      "หาร้านกาแฟเงียบๆ ไว้นั่งทำงาน แล้วต่อด้วยมื้อเที่ยงแถวอารีย์ ไม่เกิน 800 ม."
    );

    expect(intent.mood_atmosphere).toContain("quiet");
    expect(intent.mood_atmosphere).toContain("work-friendly");
    expect(intent.spatio_temporal).toContain("800 ม.");
    expect(intent.spatio_temporal).toContain("อารีย์");
    expect(intent.sequence_flow).toEqual(["Specialty Coffee", "Artisan Lunch"]);
    expect(intent.privileges.length).toBeGreaterThan(0);
    expect(intent.semantic_confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("calculates hop metrics and avoids loop traversal", () => {
    const waypoints = [
      {
        step: 1,
        place_id: "p1",
        name: "North Star Coffee",
        category: "cafe",
        vibe_matches: ["quiet"],
        walk_to_next: { distance_meters: 450, mins: 6 },
        aevo_perk: null,
      },
      {
        step: 2,
        place_id: "p2",
        name: "Sora Table",
        category: "lunch_dining",
        vibe_matches: ["fast-casual"],
        walk_to_next: null,
        aevo_perk: null,
      },
    ];

    const { totalDist, totalMins, updatedWaypoints } = calculateHopMetrics(waypoints);
    expect(totalDist).toBe(450);
    expect(totalMins).toBe(6);
    expect(updatedWaypoints[1].walk_to_next).toBeNull();
  });

  it("swaps a waypoint with a compatible alternative node", async () => {
    const trace = await searchSmartTrace({
      query: "กาแฟและมื้อเที่ยงอารีย์",
      user_location: { lat: 13.7797, lng: 100.5447 },
    });

    const originalPlaceId = trace.waypoints[0].place_id;
    const swapped = swapTraceWaypoint(trace, 0);

    expect(swapped.waypoints[0].place_id).not.toBe(originalPlaceId);
    expect(swapped.waypoints).toHaveLength(trace.waypoints.length);
    expect(swapped.total_distance_meters).toBeGreaterThan(0);
  });

  it("reorders waypoints and maintains pathway sequence", async () => {
    const trace = await searchSmartTrace({
      query: "กาแฟและมื้อเที่ยงอารีย์",
      user_location: { lat: 13.7797, lng: 100.5447 },
    });

    const firstBefore = trace.waypoints[0].name;
    const secondBefore = trace.waypoints[1].name;

    const reordered = reorderTraceWaypoints(trace, 0, 1);
    expect(reordered.waypoints[0].name).toBe(secondBefore);
    expect(reordered.waypoints[1].name).toBe(firstBefore);
    expect(reordered.waypoints[0].step).toBe(1);
    expect(reordered.waypoints[1].step).toBe(2);
  });

  it("returns contextual time slot based on current time", () => {
    const morningDate = new Date("2026-09-26T08:30:00");
    const morningSlot = getCurrentTimeSlot(morningDate);
    expect(morningSlot.slot_id).toBe("morning_rush");

    const lunchDate = new Date("2026-09-26T12:30:00");
    const lunchSlot = getCurrentTimeSlot(lunchDate);
    expect(lunchSlot.slot_id).toBe("lunch_dining");

    const eveningDate = new Date("2026-09-26T19:00:00");
    const eveningSlot = getCurrentTimeSlot(eveningDate);
    expect(eveningSlot.slot_id).toBe("nightlife_hop");
  });
});
