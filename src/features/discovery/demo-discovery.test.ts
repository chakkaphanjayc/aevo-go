import { describe, expect, it } from "vitest";
import {
  demoDiscoveryItems,
  filterDemoDiscoveryItems,
} from "@/features/discovery/demo-discovery";

describe("demo discovery feed", () => {
  it("keeps mixed content in the default feed", () => {
    const items = filterDemoDiscoveryItems(
      demoDiscoveryItems,
      "for_you",
      "",
      "",
    );
    expect(new Set(items.map((item) => item.itemType))).toEqual(
      new Set(["TRACE", "PLACE", "POST", "TRACER"]),
    );
  });

  it("filters Following and Nearby without changing the source fixture", () => {
    const following = filterDemoDiscoveryItems(
      demoDiscoveryItems,
      "following",
      "",
      "",
    );
    const nearby = filterDemoDiscoveryItems(
      demoDiscoveryItems,
      "nearby",
      "",
      "",
    );
    expect(
      following.every(
        (item) =>
          item.itemType === "POST" ||
          item.itemType === "TRACE" ||
          item.itemType === "TRACER",
      ),
    ).toBe(true);
    expect(
      nearby.every((item) => {
        const area =
          item.itemType === "TRACE" || item.itemType === "PLACE"
            ? item.area
            : item.itemType === "POST"
              ? item.author.area
              : item.tracer.area;
        return area === "Ari" || area === "ใกล้ฉัน";
      }),
    ).toBe(true);
    expect(demoDiscoveryItems.length).toBeGreaterThan(nearby.length);
  });

  it("searches across the content-specific fields", () => {
    const results = filterDemoDiscoveryItems(
      demoDiscoveryItems,
      "for_you",
      "งานออกแบบ",
      "",
    );
    expect(results.some((item) => item.itemType === "TRACE")).toBe(true);
    expect(
      results.every(
        (item) =>
          item.itemType === "TRACE" ||
          item.itemType === "TRACER" ||
          item.itemType === "POST",
      ),
    ).toBe(true);
  });

  it("applies the selected mood tag only to matching demo content", () => {
    const artItems = filterDemoDiscoveryItems(
      demoDiscoveryItems,
      "for_you",
      "",
      "",
      "art",
    );
    expect(artItems.length).toBeGreaterThan(0);
    expect(
      artItems.every((item) => {
        const searchable =
          item.itemType === "TRACE"
            ? `${item.title} ${item.description} ${item.topicTags.join(" ")}`
            : item.itemType === "PLACE"
              ? `${item.name} ${item.description} ${item.category}`
              : item.itemType === "POST"
                ? `${item.body} ${item.author.expertise.join(" ")}`
                : `${item.tracer.expertise.join(" ")} ${item.featuredTrace.title}`;
        return /ศิลป|งานออกแบบ|ถ่ายรูป|gallery|art|design/i.test(searchable);
      }),
    ).toBe(true);
  });
});
