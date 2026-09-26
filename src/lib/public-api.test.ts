import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmPublicBookingHold, createPublicBooking, createPublicBookingHold, createPublicOrder, createPublicPaymentSession, getPublicBookingTracking, getPublicCatalog, getPublicVenueAvailability, listCustomerFavorites, removeCustomerFavorite, saveCustomerFavorite, pricePublicCart } from "@/lib/public-api";
import { getPublicSearchSuggestions } from "@/lib/customer-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public Gateway adapter", () => {
  it("reads typed search suggestions from the public Gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      suggestions: [{ kind: "STORE", value: "North Star", label: "North Star", storeSlug: "north-star" }],
      serverTime: "2026-09-19T08:00:00.000Z"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicSearchSuggestions("north");

    expect(result.suggestions[0]?.storeSlug).toBe("north-star");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/search/suggestions?q=north");
  });

  it("requests the canonical catalog endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      store: { id: "store-1", code: "DEMO", name: "Demo Store", currency: "THB" },
      channel: "QR",
      categories: [],
      products: []
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPublicCatalog("DEMO");

    expect(result.store?.code).toBe("DEMO");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/catalog/DEMO");
  });

  it("preserves the selected date when requesting availability", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: "2026-09-22",
      venueId: "venue-1",
      timezone: "Asia/Bangkok",
      slotDurationMinutes: 60,
      serverTime: "2026-09-19T00:00:00.000Z",
      slots: []
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await getPublicVenueAvailability("north-star", "2026-09-22");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/venues/north-star/availability?date=2026-09-22");
  });

  it("sends an idempotency key for the booking confirmation boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      booking: {
        id: "booking-1",
        organizationId: "org-1",
        venueId: "venue-1",
        resourceId: "resource-1",
        orderId: null,
        customerName: "Guest",
        customerPhone: null,
        customerEmail: null,
        startAt: "2026-09-22T11:00:00.000Z",
        endAt: "2026-09-22T12:00:00.000Z",
        status: "CONFIRMED",
        amountMinor: 50000,
        checkinCode: null,
        checkedInAt: null,
        notes: null,
        createdAt: "2026-09-19T08:00:00.000Z",
        updatedAt: "2026-09-19T08:00:00.000Z"
      }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await createPublicBooking("north-star", {
      resourceId: "resource-1",
      customerName: "Guest",
      startsAt: "2026-09-22T11:00:00.000Z",
      endsAt: "2026-09-22T12:00:00.000Z"
    }, "booking-intent-1");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("idempotency-key")).toBe("booking-intent-1");
  });

  it("creates a server slot hold with an idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      hold: {
        id: "00000000-0000-4000-8000-000000000010",
        venueId: "00000000-0000-4000-8000-000000000011",
        resourceId: "00000000-0000-4000-8000-000000000012",
        startAt: "2026-09-22T11:00:00.000Z",
        endAt: "2026-09-22T12:00:00.000Z",
        partySize: 2,
        amountMinor: 50000,
        expiresAt: "2026-09-19T08:10:00.000Z",
        serverTime: "2026-09-19T08:00:00.000Z"
      }
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const hold = await createPublicBookingHold("north-star", {
      resourceId: "00000000-0000-4000-8000-000000000012",
      startsAt: "2026-09-22T11:00:00.000Z",
      endsAt: "2026-09-22T12:00:00.000Z",
      partySize: 2
    }, "hold-intent-1");

    expect(hold.partySize).toBe(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/venues/north-star/booking-holds");
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("idempotency-key")).toBe("hold-intent-1");
  });

  it("confirms a hold and reads a reservation by opaque token", async () => {
    const booking = {
      id: "00000000-0000-4000-8000-000000000020",
      customerName: "Guest",
      startAt: "2026-09-22T11:00:00.000Z",
      endAt: "2026-09-22T12:00:00.000Z",
      partySize: 2,
      status: "CONFIRMED",
      amountMinor: 50000,
      publicTrackingToken: "00000000-0000-4000-8000-000000000021",
      createdAt: "2026-09-19T08:00:00.000Z",
      updatedAt: "2026-09-19T08:00:00.000Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ booking }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ booking }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const confirmed = await confirmPublicBookingHold("north-star", "00000000-0000-4000-8000-000000000010", {
      customerName: "Guest"
    }, "confirm-intent-1");
    const tracked = await getPublicBookingTracking("00000000-0000-4000-8000-000000000021");

    expect(confirmed.booking.status).toBe("CONFIRMED");
    expect(tracked.booking.publicTrackingToken).toBe("00000000-0000-4000-8000-000000000021");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("booking-holds/00000000-0000-4000-8000-000000000010/confirm");
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("idempotency-key")).toBe("confirm-intent-1");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/v1/public/bookings/00000000-0000-4000-8000-000000000021");
  });

  it("requests authoritative cart pricing before checkout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      pricing: {
        storeCode: "NORTH-01",
        currency: "THB",
        pricingVersion: "catalog-v1",
        subtotalMinor: 18000,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 18000,
        lines: [{ productId: "00000000-0000-4000-8000-000000000001", productName: "Coffee", modifierIds: [], quantity: 1, unitPriceMinor: 18000, modifierTotalMinor: 0, subtotalMinor: 18000 }],
        serverTime: "2026-09-19T08:00:00.000Z"
      }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const pricing = await pricePublicCart("NORTH-01", {
      channel: "QR",
      fulfillmentType: "TAKEAWAY",
      items: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 1 }]
    });

    expect(pricing.totalMinor).toBe(18000);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/stores/NORTH-01/cart/price");
  });

  it("keeps hosted payment handoff separate from order creation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      payment: null,
      order: {
        orderNumber: "SO-20260919-00001",
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        fulfillmentType: "TAKEAWAY",
        currency: "THB",
        subtotalMinor: 18000,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 18000,
        items: [],
        createdAt: "2026-09-19T08:00:00.000Z",
        updatedAt: "2026-09-19T08:00:00.000Z"
      }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPublicPaymentSession("NORTH-01", "00000000-0000-4000-8000-000000000021");

    expect(result.payment).toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/orders/00000000-0000-4000-8000-000000000021/payment-session");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
  });

  it("keeps order creation on the public route and sends the replay key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      order: {
        orderNumber: "A-001",
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        fulfillmentType: "TAKEAWAY",
        currency: "THB",
        subtotalMinor: 18000,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 18000,
        customerName: "Guest",
        items: [{ productName: "Americano", quantity: 1, subtotalMinor: 18000, modifiers: [] }],
        createdAt: "2026-09-19T08:00:00.000Z",
        updatedAt: "2026-09-19T08:00:00.000Z",
        publicTrackingToken: "aabbccddeeff00112233445566778899"
      },
      trackingToken: "aabbccddeeff00112233445566778899"
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPublicOrder("DEMO", {
      channel: "QR",
      fulfillmentType: "TAKEAWAY",
      items: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 1 }]
    }, "order-intent-1");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(result.order.orderNumber).toBe("A-001");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/stores/DEMO/orders");
    expect(new Headers(request.headers).get("idempotency-key")).toBe("order-intent-1");
  });

  it("reads authenticated customer favorites from the Gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      favorites: [{ storeSlug: "north-star-coffee", savedAt: "2026-09-19T08:00:00.000Z" }]
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCustomerFavorites()).resolves.toEqual(["north-star-coffee"]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/public/me/favorites");
  });

  it("uses idempotent save and delete verbs for account favorites", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ favorite: { storeSlug: "north-star-coffee", savedAt: "2026-09-19T08:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await saveCustomerFavorite("north-star-coffee");
    await removeCustomerFavorite("north-star-coffee");

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("PUT");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
  });
});
