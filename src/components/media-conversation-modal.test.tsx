import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaConversationModal } from "@/components/media-conversation-modal";
import type { DiscoveryTrace } from "@/features/discovery/types";

const trace: DiscoveryTrace = {
  id: "trace-modal-test",
  itemType: "TRACE",
  slug: "trace-modal-test",
  title: "Trace modal test",
  description: "A focused media story.",
  area: "Ari",
  creator: {
    id: "creator-test",
    name: "Mina P.",
    initials: "MP",
    expertise: ["กาแฟ"],
    area: "Ari",
    following: false,
  },
  coverTiles: ["ONE", "TWO", "THREE"],
  coverImages: ["/one.jpg", "/two.jpg", "/three.jpg"],
  topicTags: ["กาแฟ"],
  stopCount: 3,
  durationMinutes: 120,
  distanceKm: 2.4,
  budgetLabel: "฿฿",
  followerCount: 4,
  remixCount: 1,
  completionCount: 3,
  rating: 4.8,
  saved: false,
  followed: false,
  comments: [],
  reason: { code: "SIMILAR_TASTE", matchedTopics: ["กาแฟ"] },
};

describe("MediaConversationModal", () => {
  it("locks the page, changes media through the vertical stack, and restores the page on close", () => {
    const onClose = vi.fn();
    render(<MediaConversationModal trace={trace} demoMode onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Media Viewer" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.wheel(screen.getByRole("region", { name: "Media viewer" }), { deltaY: 80 });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("enforces Single Intent Wheel Locking: multiple rapid wheel events advance strictly 1 card", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    const canvas = screen.getByRole("region", { name: "Media viewer" });

    // First wheel gesture advances from 1 / 3 to 2 / 3
    fireEvent.wheel(canvas, { deltaY: 100 });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // Rapid successive wheel events within the 450ms lock period are rejected (preventing runaway momentum)
    fireEvent.wheel(canvas, { deltaY: 120 });
    fireEvent.wheel(canvas, { deltaY: 80 });
    fireEvent.wheel(canvas, { deltaY: 60 });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("allows clicking a stacked card spine to jump directly to that card", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Cards 2 and 3 are stacked behind card 1
    const stackedCards = screen.getAllByRole("img", { hidden: true });
    expect(stackedCards.length).toBeGreaterThanOrEqual(1);

    // Click on the 3rd card element (index 2)
    const card3 = document.querySelector('[data-stack-index="2"]');
    expect(card3).toBeInTheDocument();
    if (card3) {
      fireEvent.click(card3);
      expect(screen.getByText("3 / 3")).toBeInTheDocument();
    }
  });

  it("navigates using step controls (Chevron buttons)", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "ภาพถัดไป" });
    const prevBtn = screen.getByRole("button", { name: "ภาพก่อนหน้า" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(prevBtn).toBeEnabled();

    fireEvent.click(prevBtn);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("handles touch swipe gestures to navigate cards", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    const canvas = screen.getByRole("region", { name: "Media viewer" });

    // Swipe up: deltaY is negative (finger moves up from y=200 to y=100) -> next card
    fireEvent.touchStart(canvas, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(canvas, { changedTouches: [{ clientX: 100, clientY: 100 }] });

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("displays explicit remaining image count and changes to รูปสุดท้าย on the final card", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    // 1st card: shows 1 / 3 and remaining 2
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("เหลืออีก 2 รูป")).toBeInTheDocument();

    // Advance to 2nd card
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("เหลืออีก 1 รูป")).toBeInTheDocument();

    // Advance to 3rd card
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("รูปสุดท้าย")).toBeInTheDocument();

    // When on the 3rd card, there are NO cards stacked behind it (past cards have is-past, not is-stacked)
    expect(document.querySelectorAll(".media-conversation-modal__stack-card.is-stacked")).toHaveLength(0);
    expect(document.querySelectorAll(".media-conversation-modal__stack-card.is-past")).toHaveLength(2);
  });

  it("supports interactive story segment progress bars to jump directly to any photo", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    const segment3 = screen.getByRole("tab", { name: "ไปยังรูปที่ 3 จาก 3" });
    fireEvent.click(segment3);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("รูปสุดท้าย")).toBeInTheDocument();

    const segment1 = screen.getByRole("tab", { name: "ไปยังรูปที่ 1 จาก 3" });
    fireEvent.click(segment1);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("เหลืออีก 2 รูป")).toBeInTheDocument();
  });

  it("navigates using side floating quick navigation chevrons", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    const nextSideBtn = screen.getByRole("button", { name: "เลื่อนไปรูปถัดไป" });
    const prevSideBtn = screen.getByRole("button", { name: "เลื่อนไปรูปก่อนหน้า" });

    expect(prevSideBtn).toBeDisabled();
    expect(nextSideBtn).toBeEnabled();

    fireEvent.click(nextSideBtn);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(prevSideBtn).toBeEnabled();

    fireEvent.click(nextSideBtn);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(nextSideBtn).toBeDisabled();

    fireEvent.click(prevSideBtn);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("applies playful organic tilt rotation and horizontal drift to stacked cards", () => {
    render(<MediaConversationModal trace={trace} demoMode onClose={vi.fn()} />);

    // On card 1 (index 0): active card has rotate 0deg, card 2 has rotate 2.2deg, card 3 has rotate -2.8deg
    const card1 = document.querySelector('[data-stack-index="0"]') as HTMLElement;
    const card2 = document.querySelector('[data-stack-index="1"]') as HTMLElement;
    const card3 = document.querySelector('[data-stack-index="2"]') as HTMLElement;

    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
    expect(card3).toBeInTheDocument();

    expect(card1.style.transform).toContain("rotate(0deg)");
    expect(card2.style.transform).toContain("rotate(2.2deg)");
    expect(card3.style.transform).toContain("rotate(-2.8deg)");
  });
});
