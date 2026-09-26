import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CreatorProfilePage } from "@/features/profile/creator-profile-page";

vi.mock("@/lib/env", () => ({
  customerDataMode: "demo",
  mapStyleUrl: "https://tiles.openfreemap.org/styles/dark",
}));

function renderProfile(path = "/creators/tracer-ari") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/creators/:creatorId" element={<CreatorProfilePage />} />
          <Route path="/profile" element={<CreatorProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CreatorProfilePage", () => {
  it("renders the public taste identity and switches between profile surfaces", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Mina P." })).toBeInTheDocument();
    expect(screen.getByText(/Taste Match Matrix/i)).toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Posts/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Posts/ }));
    expect(screen.getByText(/ถ้ามีเวลาช่วงเช้า/)).toBeInTheDocument();
  });

  it("opens inline detail first, then promotes a detail image to theater mode", () => {
    renderProfile();

    fireEvent.click(screen.getAllByRole("button", { name: /เปิด Trace/ })[0]!);

    expect(screen.queryByRole("dialog", { name: "Media Viewer" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /เดินตามจังหวะที่ Mina P\./ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ขยายภาพ 1 ของ 3/ }));
    expect(screen.getByRole("dialog", { name: "Media Viewer" })).toBeInTheDocument();
    expect(screen.getByText("MEDIA / TRACE")).toBeInTheDocument();
    expect(screen.getByText("บทสนทนา")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ปิด Media Viewer" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Media Viewer" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /เดินตามจังหวะที่ Mina P\./ })).toBeInTheDocument();
  });

  it("executes spatial layout transitions when opening and gracefully exiting inline detail", async () => {
    vi.useFakeTimers();
    renderProfile();

    const openButton = screen.getAllByRole("button", { name: /เปิด Trace/ })[0]!;
    fireEvent.click(openButton);

    const layout = document.querySelector(".creator-profile-layout");
    expect(layout).toHaveClass("has-detail");
    const detailPanel = document.querySelector(".creator-profile-inline-detail");
    expect(detailPanel).toBeInTheDocument();
    expect(detailPanel).not.toHaveClass("is-closing");

    // Close detail via close button
    const closeButton = screen.getByRole("button", { name: "ปิดรายละเอียด" });
    fireEvent.click(closeButton);

    // Immediately upon close: layout drops has-detail so feed animates back to center,
    // and detailPanel receives .is-closing for 200ms graceful exit animation
    expect(layout).not.toHaveClass("has-detail");
    expect(detailPanel).toHaveClass("is-closing");

    // After 200ms exit transition completes, panel unmounts cleanly
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(document.querySelector(".creator-profile-inline-detail")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps owner-only shortcuts on the self profile view", () => {
    renderProfile("/profile");

    expect(screen.getByText("Draft Traces")).toBeInTheDocument();
    expect(screen.getByText("Saved Places")).toBeInTheDocument();
    expect(screen.getByText("Level & badges")).toBeInTheDocument();
    expect(screen.getByText("Aevo Perks & Coupons")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /แก้ไขโปรไฟล์/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /แชร์โปรไฟล์/i })).toBeInTheDocument();
    expect(screen.getByLabelText("ตั้งค่าโปรไฟล์")).toBeInTheDocument();
  });

  it("enforces human-centric copywriting, numeric 0 stats, and friendly empty states", () => {
    renderProfile("/creators/empty-creator");

    // 100% elimination of developer technical jargon
    expect(screen.queryByText(/Customer Gateway/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/projection/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Customer data boundary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ACCOUNT SIGNAL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NEXT SURFACE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not available/i)).not.toBeInTheDocument();

    // Human stats bar renders clean numeric 0 for empty stats (never '—' or 'not available')
    expect(screen.getByLabelText("สถิติของคุณ")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(4);

    // Friendly empty state copy
    expect(screen.getByText("ยังไม่มีเส้นทางสาธารณะ")).toBeInTheDocument();
  });
});
