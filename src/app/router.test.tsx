import { describe, expect, it } from "vitest";
import { Navigate } from "react-router-dom";
import { router } from "@/app/router";

describe("application routes", () => {
  it("redirects the retired TraceDee feed entry to the canonical Explore feed", () => {
    const rootRoute = router.routes.find((route) => route.path === "/");
    const tracesRoute = rootRoute?.children?.find((route) => route.path === "traces");

    expect(tracesRoute?.element).toEqual(
      expect.objectContaining({
        type: Navigate,
        props: expect.objectContaining({
          replace: true,
          to: "/?tab=for_you&category=trace",
        }),
      }),
    );
  });

  it("keeps the TraceDee detail route available for existing links", () => {
    const rootRoute = router.routes.find((route) => route.path === "/");
    const detailRoute = rootRoute?.children?.find((route) => route.path === "traces/:traceSlug");

    expect(detailRoute).toBeDefined();
    expect(detailRoute?.element).toBeDefined();
  });
});
