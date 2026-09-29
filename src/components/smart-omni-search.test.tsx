import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { SmartOmniSearch } from "./smart-omni-search";

describe("SmartOmniSearch", () => {
  it("renders zero-state contextual prompts and 'Around me' button when query is empty", () => {
    render(
      <BrowserRouter>
        <SmartOmniSearch isOpen={true} />
      </BrowserRouter>
    );

    expect(screen.getByText("รอบตัวฉันตอนนี้")).toBeDefined();
    expect(screen.getByText(/รัศมี 500 ม/)).toBeDefined();
    expect(screen.getByText(/ซิงก์จาก Aevo Control/)).toBeDefined();
  });

  it("populates search query when clicking a contextual prompt chip", async () => {
    render(
      <BrowserRouter>
        <SmartOmniSearch isOpen={true} />
      </BrowserRouter>
    );

    const aroundMeBtn = screen.getByText("รอบตัวฉันตอนนี้");
    fireEvent.click(aroundMeBtn);

    const input = screen.getByLabelText("ช่องค้นหาเส้นทางแบบชาญฉลาด") as HTMLInputElement;
    expect(input.value).toContain("รอบตัวฉันตอนนี้");
  });

  it("synthesizes Trace Route Card with Fluid Timeline Pathway when user types", async () => {
    render(
      <BrowserRouter>
        <SmartOmniSearch isOpen={true} />
      </BrowserRouter>
    );

    const input = screen.getByLabelText("ช่องค้นหาเส้นทางแบบชาญฉลาด") as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "หาร้านกาแฟเงียบๆ ไว้นั่งทำงาน แล้วต่อด้วยมื้อเที่ยงแถวอารีย์" },
    });

    await waitFor(
      () => {
        expect(screen.getByText("TRACE ROUTE BUNDLE")).toBeDefined();
        expect(screen.getByText("เริ่มเดินจริงบน Trace Map")).toBeDefined();
        expect(screen.getByText(/จุดเริ่มต้น: พิกัดรอบตัวคุณ/)).toBeDefined();
      },
      { timeout: 2000 }
    );
  });
});
