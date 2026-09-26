import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileInsightCard } from "@/features/profile/profile-insight-card";

describe("ProfileInsightCard", () => {
  it("reveals the insight face without inventing unavailable values", () => {
    render(
      <ProfileInsightCard
        name="Guest profile"
        email={null}
        initials="GP"
        accountLabel="GUEST PROFILE"
        accountDescription="บันทึกสถานที่ไว้ในเครื่องนี้"
        isAuthenticated={false}
        savedPlaces={null}
        reservations={null}
        orders={null}
        localDataReady={false}
        action={<button type="button">เข้าสู่ระบบ</button>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "ดู profile insights" }));

    expect(screen.getByText("สัญญาณการใช้งานของคุณ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "กลับไปดู profile" })).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
