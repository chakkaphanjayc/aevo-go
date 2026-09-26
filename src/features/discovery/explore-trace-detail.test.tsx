import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ExploreTraceDetail } from "@/features/discovery/explore-trace-detail";
import { demoTraces } from "@/features/discovery/demo-discovery";

describe("ExploreTraceDetail visual storytelling itinerary", () => {
  it("renders inline trace context, photo-led stops, and compact journey actions", () => {
    const trace = demoTraces[0];
    render(
      <MemoryRouter>
        <ExploreTraceDetail
          trace={trace}
          demoMode
          creatorFollowing={false}
          creatorFollowPending={false}
          handlers={{}}
          onClose={() => undefined}
          onFollowCreator={() => undefined}
          onStartJourney={() => undefined}
          onSaveStop={() => undefined}
          onCommentSubmit={async () => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(trace.title)).toBeInTheDocument();
    expect(screen.getByText(`${trace.stopCount} Stops`)).toBeInTheDocument();
    expect(screen.queryByText("TRACE SNAPSHOT")).not.toBeInTheDocument();
    expect(screen.getByText("JOURNEY PLAN")).toBeInTheDocument();
    expect(screen.getByText("North Star Coffee")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เปิดภาพ North Star Coffee/ })).toBeInTheDocument();
    expect(screen.getByText("จองผ่าน Aevo Play")).toBeInTheDocument();
    expect(screen.getByText("COMMUNITY PROOF")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ความคิดเห็น" })).toBeInTheDocument();
  });
});
