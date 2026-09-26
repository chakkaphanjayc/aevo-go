import {
  publicAvailabilityResponseSchema,
  publicBookingHoldResponseSchema,
  publicBookingResponseSchema,
  publicCartPriceResponseSchema,
  publicCatalogResponseSchema,
  customerFavoritesResponseSchema,
  publicOrderResponseSchema,
  publicPaymentSessionResponseSchema,
  type CreatePublicBookingInput,
  type CreatePublicBookingHoldInput,
  type CreatePublicOrderInput,
  type PublicAvailabilityResponse,
  type PublicBookingHold,
  type PublicBookingResponse,
  type PricePublicCartInput,
  type PublicCartPrice,
  type PublicCatalogResponse,
  type PublicOrderResponse,
  type PublicPaymentSessionResponse
} from "@/contracts/public";
import { requestJson } from "@/lib/api-client";

function parseContract<T>(payload: unknown, parser: { parse: (value: unknown) => T }): T {
  return parser.parse(payload);
}

export async function getPublicCatalog(storeCode: string): Promise<PublicCatalogResponse> {
  const payload = await requestJson<unknown>(`/api/v1/public/catalog/${encodeURIComponent(storeCode)}`);
  return parseContract(payload, publicCatalogResponseSchema);
}

export async function pricePublicCart(storeCode: string, input: PricePublicCartInput): Promise<PublicCartPrice> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeCode)}/cart/price`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return parseContract(payload, publicCartPriceResponseSchema).pricing;
}

export async function getPublicVenueAvailability(venueSlug: string, date: string, partySize = 1): Promise<PublicAvailabilityResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/venues/${encodeURIComponent(venueSlug)}/availability?date=${encodeURIComponent(date)}&partySize=${encodeURIComponent(String(partySize))}`
  );
  return parseContract(payload, publicAvailabilityResponseSchema);
}

export async function createPublicBooking(
  venueSlug: string,
  input: CreatePublicBookingInput,
  idempotencyKey: string
): Promise<PublicBookingResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/venues/${encodeURIComponent(venueSlug)}/bookings`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, publicBookingResponseSchema);
}

export async function createPublicBookingHold(
  venueSlug: string,
  input: CreatePublicBookingHoldInput,
  idempotencyKey: string
): Promise<PublicBookingHold> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/venues/${encodeURIComponent(venueSlug)}/booking-holds`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, publicBookingHoldResponseSchema).hold;
}

export async function confirmPublicBookingHold(
  venueSlug: string,
  holdId: string,
  input: Omit<CreatePublicBookingInput, "resourceId" | "startsAt" | "endsAt" | "totalAmountMinor" | "partySize">,
  idempotencyKey: string
): Promise<PublicBookingResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/venues/${encodeURIComponent(venueSlug)}/booking-holds/${encodeURIComponent(holdId)}/confirm`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, publicBookingResponseSchema);
}

export async function getPublicBookingTracking(trackingToken: string): Promise<PublicBookingResponse> {
  const payload = await requestJson<unknown>(`/api/v1/public/bookings/${encodeURIComponent(trackingToken)}`);
  return parseContract(payload, publicBookingResponseSchema);
}

export async function createPublicOrder(
  storeCode: string,
  input: CreatePublicOrderInput,
  idempotencyKey: string
): Promise<PublicOrderResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeCode)}/orders`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey }
  );
  return parseContract(payload, publicOrderResponseSchema);
}

export async function getPublicOrderTracking(storeCode: string, trackingToken: string): Promise<PublicOrderResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/orders/track/${encodeURIComponent(trackingToken)}?storeCode=${encodeURIComponent(storeCode)}`
  );
  return parseContract(payload, publicOrderResponseSchema);
}

export async function createPublicPaymentSession(storeCode: string, trackingToken: string): Promise<PublicPaymentSessionResponse> {
  const payload = await requestJson<unknown>(
    `/api/v1/public/orders/${encodeURIComponent(trackingToken)}/payment-session`,
    { method: "POST", body: JSON.stringify({ storeCode }) }
  );
  return parseContract(payload, publicPaymentSessionResponseSchema);
}

export async function listCustomerFavorites(): Promise<string[]> {
  const payload = await requestJson<unknown>("/api/v1/public/me/favorites");
  const response = parseContract(payload, customerFavoritesResponseSchema);
  return response.favorites.map((favorite) => favorite.storeSlug);
}

export async function saveCustomerFavorite(storeSlug: string): Promise<void> {
  await requestJson<unknown>(`/api/v1/public/me/favorites/${encodeURIComponent(storeSlug)}`, { method: "PUT" });
}

export async function removeCustomerFavorite(storeSlug: string): Promise<void> {
  await requestJson<unknown>(`/api/v1/public/me/favorites/${encodeURIComponent(storeSlug)}`, { method: "DELETE" });
}
