import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { demoTraces } from "@/features/discovery/demo-discovery";
import { DiscoveryModuleShelf } from "@/features/discovery/discovery-modules";
import type { DiscoveryModuleView } from "@/features/discovery/feed-adapter";

describe("DiscoveryModuleShelf", () => {
  it("renders entity cards with a safe module reason", () => {
    const trace = demoTraces[0];
    const module: DiscoveryModuleView = {
      moduleId: "FOR_YOU",
      reasonCode: "BECAUSE_VIBE",
      items: [trace],
    };

    render(
      <MemoryRouter>
        <DiscoveryModuleShelf modules={[module]} handlers={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "คัดสรรให้คุณ" })).toBeInTheDocument();
    expect(screen.getByText("อิงจากบรรยากาศที่คุณเลือก")).toBeInTheDocument();
    expect(screen.getByText(trace.title)).toBeInTheDocument();
    expect(screen.getByText(/เหตุผลเป็นคำอธิบายระดับหมวดหมู่/iu)).toBeInTheDocument();
  });
});
