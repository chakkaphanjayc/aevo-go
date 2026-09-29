import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryIntentPrompt } from "@/features/discovery/discovery-intent-prompt";

describe("DiscoveryIntentPrompt", () => {
  it("shows request-local intent without exposing a generic live post composer", () => {
    const onClear = vi.fn();
    render(
      <DiscoveryIntentPrompt
        area="Ari"
        vibe="quiet"
        category="cafe"
        date="2026-09-26"
        partySize="2"
        onClear={onClear}
      />,
    );

    expect(screen.getByText("ตั้งโจทย์ให้คำแนะนำวันนี้")).toBeInTheDocument();
    expect(screen.getByText("พื้นที่: Ari")).toBeInTheDocument();
    expect(screen.getByText("บรรยากาศ: Quiet Space")).toBeInTheDocument();
    expect(screen.getByText("หมวด: Cafe")).toBeInTheDocument();
    expect(screen.queryByText("SHARE YOUR CITY")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ล้างโจทย์การค้นพบ" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("states the deterministic fallback when no intent is selected", () => {
    render(
      <DiscoveryIntentPrompt
        area=""
        vibe=""
        category="all"
        date=""
        partySize="2"
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText(/deterministic discovery/iu)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ล้างโจทย์การค้นพบ" })).not.toBeInTheDocument();
  });
});
