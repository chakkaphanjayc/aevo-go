import { afterEach, describe, expect, it } from "vitest";
import {
  EXPLORE_DETAIL_OPEN_ATTRIBUTE,
  setExploreDetailViewportState,
} from "@/features/discovery/detail-viewport-lock";

describe("Explore detail viewport state", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(EXPLORE_DETAIL_OPEN_ATTRIBUTE);
  });

  it("marks the document while the split surface owns the viewport", () => {
    setExploreDetailViewportState(true);

    expect(document.documentElement).toHaveAttribute(
      EXPLORE_DETAIL_OPEN_ATTRIBUTE,
      "true",
    );

    setExploreDetailViewportState(false);

    expect(document.documentElement).not.toHaveAttribute(
      EXPLORE_DETAIL_OPEN_ATTRIBUTE,
    );
  });
});
