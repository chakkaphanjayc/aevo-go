import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ExploreBookingPortal } from "./explore-booking-portal";

describe("ExploreBookingPortal", () => {
  const defaultProps = {
    activeCategory: "all" as const,
    area: "",
    date: "",
    demoMode: true,
    heroImageUrl: null,
    inputRef: { current: null },
    partnerPlaces: [],
    partySize: "2",
    query: "",
    promoOpen: false,
    onAreaChange: vi.fn(),
    onBookingSubmit: vi.fn(),
    onCategoryChange: vi.fn(),
    onDateChange: vi.fn(),
    onDismissPromo: vi.fn(),
    onNotify: vi.fn(),
    onPartySizeChange: vi.fn(),
    onQueryChange: vi.fn(),
  };

  it("renders Smart Trace Discovery hero with zero-state prompts and Around Me button", () => {
    render(
      <BrowserRouter>
        <ExploreBookingPortal {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText("ค้นพบเส้นทางและร้านค้าแบบต่อเนื่อง")).toBeDefined();
    expect(screen.getByText("Zero-Friction Trace Engine")).toBeDefined();
    expect(screen.getByText("รอบตัวฉันตอนนี้")).toBeDefined();
    expect(screen.getByText(/รัศมี 500 ม/)).toBeDefined();
  });

  it("allows switching to custom booking parameters mode", () => {
    render(
      <BrowserRouter>
        <ExploreBookingPortal {...defaultProps} />
      </BrowserRouter>
    );

    const customParamsBtn = screen.getByText("Custom Parameters");
    fireEvent.click(customParamsBtn);

    expect(screen.getByLabelText("เลือกพื้นที่")).toBeDefined();
    expect(screen.getByLabelText("เลือกวันที่เดินทาง")).toBeDefined();
    expect(screen.getByLabelText("เลือกจำนวนคน")).toBeDefined();
  });

  it("populates query when clicking prompt chips", () => {
    const onQueryChange = vi.fn();
    render(
      <BrowserRouter>
        <ExploreBookingPortal {...defaultProps} onQueryChange={onQueryChange} />
      </BrowserRouter>
    );

    const aroundMeBtn = screen.getByText("รอบตัวฉันตอนนี้");
    fireEvent.click(aroundMeBtn);

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.stringContaining("รอบตัวฉันตอนนี้")
    );
  });

  it("synthesizes Trace Route Bundle Card and Fluid Timeline Pathway when query is provided", async () => {
    render(
      <BrowserRouter>
        <ExploreBookingPortal
          {...defaultProps}
          query="หาร้านกาแฟเงียบๆ ไว้นั่งทำงาน แล้วต่อด้วยมื้อเที่ยงแถวอารีย์"
        />
      </BrowserRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText("SYNTHESIZED TRACE ROUTE BUNDLE")).toBeDefined();
        expect(screen.getByText("เริ่มเดินจริงบน Trace Map")).toBeDefined();
        expect(screen.getByText(/จุดเริ่มต้น: พิกัดรอบตัวคุณ/)).toBeDefined();
      },
      { timeout: 2000 }
    );
  });
});
