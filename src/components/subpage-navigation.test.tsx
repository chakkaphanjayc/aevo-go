import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubpageNavigation } from "./subpage-navigation";
import { GamificationHubPage } from "@/features/gamification/gamification-hub-page";
import { CreatorProfilePage } from "@/features/profile/creator-profile-page";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

describe("Global Navigation Hierarchy Standards", () => {
  const createQueryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it("Rule 1: Level-0 Primary /profile has NO back button or 'กลับ Explore' link", () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<CreatorProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Root views must NEVER show a back link or button
    expect(screen.queryByText(/กลับ Explore/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /กลับ Explore/i })).not.toBeInTheDocument();
  });

  it("Rule 2: /shop renders interactive hierarchical breadcrumbs [ โปรไฟล์ ] / ร้านค้า & รางวัล", () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/shop"]}>
          <LocationDisplay />
          <Routes>
            <Route path="/shop" element={<GamificationHubPage />} />
            <Route path="/profile" element={<div data-testid="profile-page">Profile Root</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const profileCrumb = screen.getByRole("link", { name: /โปรไฟล์/i });
    expect(profileCrumb).toBeInTheDocument();
    expect(screen.getByText("ร้านค้า & รางวัล")).toBeInTheDocument();

    // Clicking [ โปรไฟล์ ] takes the user back to /profile
    fireEvent.click(profileCrumb);
    expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    expect(screen.getByTestId("location-display")).toHaveTextContent("/profile");
  });

  it("Rule 2: /profile/coupons renders 3-level breadcrumbs [ โปรไฟล์ ] / [ ร้านค้า & รางวัล ] / คูปองของฉัน", () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/profile/coupons"]}>
          <LocationDisplay />
          <Routes>
            <Route path="/profile/coupons" element={<GamificationHubPage />} />
            <Route path="/shop" element={<div data-testid="shop-page">Shop Page</div>} />
            <Route path="/profile" element={<div data-testid="profile-page">Profile Root</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const profileCrumb = screen.getByRole("link", { name: /โปรไฟล์/i });
    const shopCrumb = screen.getByRole("link", { name: /ร้านค้า & รางวัล/i });
    expect(profileCrumb).toBeInTheDocument();
    expect(shopCrumb).toBeInTheDocument();
    expect(screen.getByText("คูปองของฉัน")).toBeInTheDocument();

    // Clicking [ ร้านค้า & รางวัล ] navigates back 1 step to /shop
    fireEvent.click(shopCrumb);
    expect(screen.getByTestId("shop-page")).toBeInTheDocument();
    expect(screen.getByTestId("location-display")).toHaveTextContent("/shop");
  });

  it("SubpageNavigation component renders compact capsule with ChevronRight and aria-current", () => {
    render(
      <MemoryRouter initialEntries={["/sub"]}>
        <SubpageNavigation
          breadcrumbs={[
            { label: "โปรไฟล์", to: "/profile" },
            { label: "ร้านค้า & รางวัล", to: "/shop" },
            { label: "คูปองของฉัน" },
          ]}
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: /ลำดับการนำทาง/i });
    expect(nav).toBeInTheDocument();

    const currentItem = screen.getByText("คูปองของฉัน").closest(".subpage-breadcrumb-current");
    expect(currentItem).toHaveAttribute("aria-current", "page");
  });
});
