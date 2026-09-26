# Aevo Go

Aevo Go is the shared React application layer for the customer experience. It
builds a Web/PWA bundle now and is structured to run inside Capacitor for iOS
and Android without duplicating routes, screens, or domain logic.

The client is untrusted. It calls the Aevocado Customer Gateway using typed
transport helpers; it never contains Supabase service-role credentials and it
does not decide price, availability, entitlement, reward, or authorization.

The default Aevo Go visual theme is matte dark with neutral optical glass. A
flat light variant remains available as a user preference and accessibility
fallback.

## Local development

```bash
bun install
cp .env.example .env.local
bun run dev
```

The app runs at `http://localhost:4324`. During local development, Vite proxies
`/health` and `/ready` to `http://localhost:4000`; set
`VITE_API_BASE_URL` when the Customer Gateway is hosted elsewhere.

To open the Trace Map immediately with deterministic local places and clickable
store/booking flows, run:

```bash
bun run dev:demo
```

Then open `http://localhost:4324/map`. This uses explicitly labelled demo
fixtures and does not change the live-mode data boundary.

`VITE_GO_DATA_MODE=live` is the default. Only stores with an enabled
`customer_store_profiles` row are shown; configure that projection and the
related catalog/booking records in the Admin/Hub surface before testing the
customer flow. `demo` remains an explicit opt-in for isolated UI shell work
and is not a production data source. Live mode validates discovery, store,
catalog, and availability responses at runtime.

Live Explore always uses the Core Feed transport: one server-ranked
`/api/v1/public/feed?surface=explore` cursor stream, with impressions and
interactions sent using the server-issued feed session and item token. There is
no client Feed mode flag or browser-side legacy fallback. The separate
`/traces` page and Trace Map compatibility flows still use their own TraceDee
routes until those surfaces receive a separately scoped Core contract. Explore
does not change the Trace detail/action routes.

The canonical Place adapter is controlled by `VITE_PLACE_API_MODE`. It remains
`legacy` by default while Core projection rows and deployment smoke tests are
being prepared. `canonical` routes the Map list through Core's bounded
`/api/v1/public/places/search` contract and the marker layer through
`/api/v1/public/places/map`; canonical marker/list selection resolves to the
`/places/:placeId` detail route. It never calls Supabase or an external POI
provider from the browser. Canonical mode also disables the direct OSM query
and only enables booking actions when an explicit public booking route or
venue mapping is present.

Trace Map can optionally enrich first-party results with public OpenStreetMap
places in non-production environments. Set `VITE_OSM_OVERPASS_MODE=mock` for
deterministic local fixtures, or explicitly opt in to `remote` with
`VITE_OSM_OVERPASS_URL` for an Overpass endpoint. Production forcibly disables
this direct client adapter. OSM data is not an Aevo profile and never supplies
ratings, availability, or booking authority.

Live booking uses server availability with party-size filtering, a ten-minute
slot hold, server-time expiry countdown, and idempotent hold confirmation. The
UI reuses the same `Idempotency-Key` when an outcome is unknown, stores only a
local recovery snapshot plus an opaque tracking token, and polls the public
reservation-read endpoint from Activity. Demo mode never claims a booking
success.

Live checkout also uses the existing public idempotent order route. The server
derives the authoritative order price from catalog data. Checkout requests an
explicit server cart-pricing response first, then asks the Gateway for a hosted
payment session. The client never collects card data; provider-unavailable and
payment-recovery states remain visible and link back to Activity.

## Sign-in and Hub SSO

Aevo Go starts customer sign-in at Aevo Accounts. The browser creates a
short-lived PKCE verifier, stores it in session storage, and returns to
`/auth/callback` with a one-time code. Accounts and Core API consume that code
and set an opaque GO-scoped session cookie; Supabase access and refresh tokens
remain server-side.

Configure `VITE_ACCOUNTS_URL` for staging/production. Local development
defaults to `http://localhost:8787`; production intentionally fails closed if
the Accounts origin is missing.

The Go client uses /api/auth/go/me, /api/auth/go/refresh, and
/api/auth/go/logout, so its session cannot be confused with the Hub, Play, or
POS cookie.

## Build targets

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

Capacitor configuration lives in `capacitor.config.ts`. Native platform
projects are added only when the iOS/Android signing and device workflow is
ready; the web build remains the shared source of truth.
