import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/app-shell";
import { RouteErrorBoundary } from "@/app/route-error";
import {
  ActivityPage,
  AuthCallbackPage,
  BookingPage,
  CartPage,
  CheckoutPage,
  CreatePage,
  ExplorePage,
  ProfileSectionPage,
  SavedPage,
  SearchPage,
  StoreDetailPage,
  StoreMenuPage
} from "@/pages";

const MapPage = lazy(() => import("@/features/map/map-page").then(({ MapPage: page }) => ({ default: page })));
const CanonicalPlaceDetailPage = lazy(() => import("@/features/map/canonical-place-detail-page").then(({ CanonicalPlaceDetailPage: page }) => ({ default: page })));
const TraceDeeFeedPage = lazy(() => import("@/features/tracedee/trace-dee-feed-page").then(({ TraceDeeFeedPage: page }) => ({ default: page })));
const TraceDeeDetailPage = lazy(() => import("@/features/tracedee/trace-dee-detail-page").then(({ TraceDeeDetailPage: page }) => ({ default: page })));
const CreatorProfilePage = lazy(() => import("@/features/profile/creator-profile-page").then(({ CreatorProfilePage: page }) => ({ default: page })));
const GamificationHubPage = lazy(() => import("@/features/gamification/gamification-hub-page").then(({ GamificationHubPage: page }) => ({ default: page })));

function MapRouteFallback() {
  return <main className="page-content" aria-busy="true"><div className="page-frame"><div className="map-result-state" role="status">กำลังเตรียมแผนที่…</div></div></main>;
}

function ProfileRouteFallback() {
  return <main className="page-content" aria-busy="true"><div className="page-frame"><div className="map-result-state" role="status">กำลังเตรียม Profile…</div></div></main>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <ExplorePage /> },
      {
        path: "trace",
        element: (
          <Navigate
            to="/?tab=for_you&category=trace"
            replace
          />
        ),
      },
      { path: "search", element: <SearchPage /> },
      { path: "map", element: <Suspense fallback={<MapRouteFallback />}><MapPage /></Suspense> },
      { path: "places/:placeId", element: <Suspense fallback={<MapRouteFallback />}><CanonicalPlaceDetailPage /></Suspense> },
      { path: "traces", element: <Suspense fallback={<MapRouteFallback />}><TraceDeeFeedPage /></Suspense> },
      { path: "traces/:traceSlug", element: <Suspense fallback={<MapRouteFallback />}><TraceDeeDetailPage /></Suspense> },
      { path: "saved", element: <SavedPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "activity/reservations/:reservationId", element: <ActivityPage /> },
      { path: "activity/orders/:orderId", element: <ActivityPage /> },
      { path: "stores/:storeSlug", element: <StoreDetailPage /> },
      { path: "stores/:storeSlug/booking", element: <BookingPage /> },
      { path: "stores/:storeSlug/menu", element: <StoreMenuPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "create", element: <CreatePage /> },
      { path: "profile", element: <Suspense fallback={<ProfileRouteFallback />}><CreatorProfilePage /></Suspense> },
      { path: "profile/level", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="level" /></Suspense> },
      { path: "profile/quests", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="quests" /></Suspense> },
      { path: "profile/shop", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="shop" /></Suspense> },
      { path: "profile/coupons", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="coupons" /></Suspense> },
      { path: "shop", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="shop" /></Suspense> },
      { path: "level", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="level" /></Suspense> },
      { path: "quests", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="quests" /></Suspense> },
      { path: "coupons", element: <Suspense fallback={<ProfileRouteFallback />}><GamificationHubPage initialTab="coupons" /></Suspense> },
      { path: "drafts", element: <CreatePage /> },
      { path: "preferences", element: <ProfileSectionPage /> },
      { path: "creators/:creatorId", element: <Suspense fallback={<ProfileRouteFallback />}><CreatorProfilePage /></Suspense> },
      { path: "profile/:section", element: <ProfileSectionPage /> }
    ]
  },
  { path: "/auth/callback", element: <AuthCallbackPage />, errorElement: <RouteErrorBoundary /> }
], { basename: import.meta.env.BASE_URL });
