# Aevocado Go — API gap list

This list records the customer contracts that are delivered, in progress, or
still gated by production configuration. It is intentionally separate from the
client UI so the frontend cannot become a business-rule authority.

## Foundation available now

- `GET /health` — gateway liveness
- `GET /ready` — gateway/database readiness
- Typed client error shape: `error.code`, `error.message`, `error.requestId`
- Request tracing header: `X-Request-Id`
- Mutation replay boundary: `Idempotency-Key` is required for booking/order confirmation paths

## Canonical public surface already available

The Hub Gateway already exposes these routes under `/api/v1/public/*`. Aevo Go
now has typed adapters for the catalog/availability/order transport paths, but
keeps UI mutation confirmation behind the server-side contract gates:

- `GET /api/v1/public/catalog/:storeCode` (also available as `/stores/:storeCode/menu`)
- `GET /api/v1/public/discovery?q=&category=&area=&bbox=&cursor=&limit=`
- `GET /api/v1/public/search?q=&category=&area=&bbox=&cursor=&limit=`
- `GET /api/v1/public/stores/:storeSlug` — explicit opt-in public store projection
- `GET /api/v1/public/search/suggestions?q=` — debounced typed suggestions for
  stores, categories, and areas
- `GET /api/v1/public/venues/:venueSlug/availability?date=YYYY-MM-DD&partySize=`
- `POST /api/v1/public/venues/:venueSlug/booking-holds`
- `POST /api/v1/public/venues/:venueSlug/booking-holds/:holdId/confirm`
- `GET /api/v1/public/bookings/:trackingToken`
- `POST /api/v1/public/venues/:venueSlug/bookings`
- `GET /api/v1/public/me/favorites`, `PUT` and `DELETE /api/v1/public/me/favorites/:storeSlug`
- `POST /api/v1/public/stores/:storeCode/cart/price`
- `POST /api/v1/public/stores/:storeCode/orders`
- `GET /api/v1/public/orders/track/:token?storeCode=...`
- `POST /api/v1/public/orders/:trackingToken/payment-session`

Trace Map also accepts optional public projection fields on discovery/store
responses: `isAevoPlayPartner` identifies an explicit Aevo Play partner and
`venueSlug` identifies the server-owned booking route. The client may merge
these first-party places with an opt-in OSM/Overpass public place layer, but
OSM records remain non-bookable and do not provide Aevo ratings or availability.

The order adapter and live checkout now use the existing Gateway order path,
which accepts an idempotency key and derives the authoritative item pricing in
the trusted `create_order` flow. The UI preserves the same key for an unknown
outcome and stores an opaque tracking token locally. Cart pricing now has a
separate server response with line totals/version/server time, and payment uses
a hosted-provider handoff. Tax, coupon and policy values are explicit fields
but remain zero/extension hooks until the business rules are configured.

The current Go UI uses `VITE_GO_DATA_MODE=live` by default. Setting it to
`demo` is an explicit opt-in for isolated UI shell work. A store must have an
enabled row in `customer_store_profiles`; the Gateway never derives customer
metadata from private address, phone, tax, or organization records.

Discovery and search accept an optional `bbox=west,south,east,north`. The
Gateway validates coordinate ranges and applies the viewport filter to public
profile coordinates before returning results. The client keeps the bounds in
the map URL and passes TanStack Query cancellation signals to stale reads.

The Hub management boundary is `PUT
/api/v1/hub/stores/:storeId/customer-profile`. It requires the authenticated
tenant store-management permission and writes only the explicit public
projection. Migration `20260919095513_customer_public_store_profiles.sql`
enables RLS and grants no anonymous Data API access.

Booking hold and confirmation require `Idempotency-Key` at the Gateway boundary
and persist/replay it through server-only database functions. Holds expire after
10 minutes against server time, overlap/capacity checks run inside the trusted
backend, and the Go UI keeps replay keys across unknown outcomes. Public
reservation reads use an opaque tracking token and Activity polls the server.

## Delivered for Phase 3–4

- discovery/search return server facet metadata and cursor pagination
- search UI has debounced store/category/area suggestions and URL-restored filters
- public store reads include hours, media gallery, facilities and policy projection
- Near me sends a bounded real-location `bbox`; MapLibre has clustering and list fallback
- Map viewport reads use validated `zoom`, category, price, availability and
  party-size filters; bounded requests use the PostGIS-backed public discovery
  RPC and its partial GiST index rather than an unbounded client-side scan
- authenticated favorites use server read/write; local guest favorites merge when a
  customer session becomes available, with rollback on mutation failure

TraceDee product-loop routes are now available through the same typed Gateway
boundary:

- `GET /api/v1/public/tracedee/feed` and `GET /api/v1/public/tracedee/traces/:traceIdOrSlug`
- Trace Save/Unsave and Follow/Unfollow mutations with `Idempotency-Key`
- `POST/DELETE /api/v1/public/tracedee/profiles/:profileId/follow` for the
  separate Follow Tracer action and follower-count reconciliation
- Journey create/start/pause/abandon/stop update/complete routes
- `POST /api/v1/public/tracedee/journeys/:journeyId/rating` for one eligible
  post-completion Trace rating with optional structured tags and review text
- `POST /api/v1/public/tracedee/journeys/:journeyId/posts` for one-target
  Trace/Place contributions after completion
- `GET /api/v1/public/tracedee/traces/:traceIdOrSlug/posts` for visible/limited
  Trace community posts with thread and comment counts
- `GET/POST /api/v1/public/tracedee/threads/:threadId/comments` for visible
  comment reads and depth-one replies
- `POST /api/v1/public/tracedee/comments/:commentId/helpful` for a retry-safe
  helpful reaction with authoritative count reconciliation
- `POST /api/v1/public/tracedee/reports` for authenticated content reports
- `GET /api/v1/public/tracedee/profiles/:profileId/expertise` for the
  versioned expertise projection (returns disabled/empty while the rollout
  flag is off)
- `GET /api/v1/public/tracedee/traces/:traceIdOrSlug/lineage` for the
  published source/root/ancestor/descendant lineage graph
- `GET /api/v1/public/tracedee/places/search?q=&area=&limit=` for the
  moderated public place picker used by Remix editing
- `POST /api/v1/public/tracedee/traces/:traceIdOrSlug/remix` to create an
  idempotent private remix draft; `PATCH /api/v1/public/tracedee/remixes/:traceId`
  updates draft metadata/stops with an expected revision, and
  `POST /api/v1/public/tracedee/remixes/:traceId/publish` publishes the edge
  with creator attribution and notification
- `GET /api/v1/public/tracedee/remixes/:traceId` returns the owner-only draft
  read model for editor recovery; it never exposes another user's private draft
- `GET/PATCH /api/v1/public/tracedee/preferences` stores three-to-five topic/
  area/category interests, explicit personalization opt-out, and replay-safe
  preference events
- `POST /api/v1/public/tracedee/feed/items/:itemId/interactions` records
  authenticated OPENED/DISMISSED/QUICK_BACK outcomes with idempotency
- `GET /api/v1/public/tracedee/notifications` and
  `POST /api/v1/public/tracedee/notifications/:notificationId/read` for
  aggregated notification reads and idempotent read state
- `POST /api/v1/public/tracedee/profiles/:profileId/relations` for authenticated
  block/mute controls; the server applies suppression to feed, community, and
  notification projections
- `PATCH/DELETE /api/v1/public/tracedee/posts/:postId` and
  `PATCH/DELETE /api/v1/public/tracedee/comments/:commentId` for owner-only
  optimistic-concurrency edit and audit-safe soft delete

TraceDee rating eligibility, uniqueness, review moderation status, activity
event, outbox, and replay semantics remain server-owned; Aevo Go never reads
the `tracedee_*` tables directly.

Recognition projections can be rebuilt with `bun run db:rebuild:tracedee`; each
run records before/after snapshots and can be inspected or rolled back through
the privileged `/api/v1/admin/tracedee/projections/*` routes. Deterministic
fallback remains the served order while `taste_ranking_v1` is in SHADOW mode.
Moderation queue actions are isolated behind the Admin `content.moderate`
platform permission and never run from Aevo Go.

Recognition and rollout operations:

- `GET /api/v1/admin/tracedee/reputation/evidence` exposes versioned evidence
  inputs to `system.jobs` operators
- `GET /api/v1/admin/tracedee/ranking/guardrails` exposes evaluation volume,
  creator/category concentration, hide/quick-back rates, latency, and pass/fail
  guardrails
- `PATCH /api/v1/admin/go/feature-flags/taste_ranking_v1` accepts audited
  `SHADOW`/`LIVE` mode plus the staged rollout percentage; the current default
  remains SHADOW with deterministic serving

Completion verification and recognition controls are also server-owned. Journey
completion accepts optional client-time/coarse-location evidence and returns a
verification status/summary. The TraceDee projector reconciles bounded XP
awards from authoritative completion/content/rating events with a 24-hour
provisional window, UTC daily cap, diminishing returns, and reversals for
invalidated source state; cloning a remix alone is never an XP signal.

The current `/api/v1/public/*` routes are the first normalized read façade.
Public store summaries now include an optional active `venueSlug` so booking
does not have to guess the venue route. The MapLibre client uses a clustered
GeoJSON source, URL-restored camera/committed bounds, an initial bounded search,
Search this area, stale response protection, source-aware SVG marker icons,
15-metre OSM deduplication, safe-area-aware mobile sheet scrolling and a list
fallback. ETag/cache policy, edge-proxied Overpass traffic and device-level map
validation remain release-hardening work.

## Remaining Phase 5–6 production gates

- Configure and verify payment provider secrets/webhook signing in the target
  environment; local current environment intentionally fails closed
- Replace zero tax/discount/coupon/policy extension fields with approved business
  rules and add price-change/coupon E2E coverage
- Add cancellation/refund policy commands, calendar/reminder actions, and
  kill/relaunch payment recovery tests on Web/Capacitor

## Required for Phase 7–8

- `GET /v1/me/loyalty`, `/v1/me/quests` and coupon read/redemption contracts
- `POST /v1/devices/push-registration` with token rotation/revoke behavior
- Customer auth callback, PKCE state validation and guest-to-member merge
- Secure session storage contract for native Keychain/Keystore
- Universal/App Link resolution and allowlisted `returnTo` behavior

## Contract gates

Every contract must define version, stable error code, request ID, pagination,
timestamps/timezone, currency minor units, auth requirement, tenant/store
scope, RLS/IDOR tests and idempotency behavior where a mutation is involved.
