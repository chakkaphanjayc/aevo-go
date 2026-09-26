# ADR 0001 — React/Vite application core for Aevocado Go

- Status: Accepted for the foundation implementation
- Date: 2026-09-19
- Scope: `aevo-go`

## Decision

Use one strict TypeScript React application as the customer experience core.
Build it with Vite for Web/PWA and ship the same static bundle inside
Capacitor when native projects are introduced. Use React Router as the shared
URL/deep-link contract, TanStack Query for server state, and a platform bridge
for browser/native capabilities.

The application is an untrusted client. Customer Gateway/Core API remains the
authority for identity, tenant/store relationship, price, availability,
entitlement, reward, payment and idempotency.

## Rejected alternative

Next.js remains valid for server-rendered products in the ecosystem, but it is
not the application core for Go. A server-rendered Next runtime would create a
second loading model for the Capacitor bundle while map, booking, cart,
tracking and profile interactions are client-heavy.

## Consequences

Positive:

- Web and native use the same routes, screens and interaction states.
- Vite produces a static artifact suitable for CDN/PWA and Capacitor.
- Native capabilities are mockable through `TestPlatformBridge`.
- Server data and UI state have explicit ownership boundaries.

Trade-offs:

- SEO, QR resolver and custom-domain entry remain a separate public surface.
- Production deployment needs an explicit Customer Gateway origin/CORS policy.
- Native iOS/Android projects and plugin implementations are later work.
- The application must not invent business behavior while API contracts are
  still being finalized.

## Migration boundary

The old Phase 0 Next connectivity page is archived as a behavior reference.
The Vite app keeps the safe health/readiness probe through `/health` and
`/ready`, using a local Vite proxy in development and a Customer Gateway URL
in deployed environments. There is intentionally no Next server route or
Supabase client in the new bundle.
