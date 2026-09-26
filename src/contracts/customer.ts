import { z } from "zod";

export const publicOperatingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean()
});

export const moneySchema = z.object({
  currency: z.string().length(3),
  minor: z.number().int().nonnegative()
});

export const storeSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  storeCode: z.string().min(1).optional(),
  venueSlug: z.string().min(1).optional(),
  publicBookingRoute: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  area: z.string().min(1),
  category: z.string().min(1),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative(),
  priceRange: z.string().min(1),
  imageUrl: z.string().nullable(),
  mediaUrls: z.array(z.string()).optional(),
  facilities: z.array(z.string()).optional(),
  policySummary: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  timezone: z.string().optional(),
  operatingHours: z.array(publicOperatingHourSchema).optional(),
  availabilityLabel: z.string().nullable(),
  description: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  categoryIconKey: z.string().min(1).optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  availableToday: z.boolean().nullable().optional(),
  isAevoPlayPartner: z.boolean().optional(),
  distanceMeters: z.number().nonnegative().optional()
});

export const discoveryResponseSchema = z.object({
  data: z.array(storeSummarySchema),
  nextCursor: z.string().nullable(),
  facets: z.object({
    categories: z.array(z.object({ value: z.string().min(1), count: z.number().int().nonnegative() })),
    areas: z.array(z.object({ value: z.string().min(1), count: z.number().int().nonnegative() })),
    priceRanges: z.array(z.object({ value: z.string().min(1), count: z.number().int().nonnegative() }))
  }).optional(),
  requestId: z.string().min(1).optional(),
  bounds: z.object({
    west: z.number(),
    south: z.number(),
    east: z.number(),
    north: z.number()
  }).optional(),
  totalApproximate: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional()
});

export const searchSuggestionSchema = z.object({
  kind: z.enum(["STORE", "CATEGORY", "AREA"]),
  value: z.string().min(1),
  label: z.string().min(1),
  storeSlug: z.string().min(1).optional()
});

export const searchSuggestionsResponseSchema = z.object({
  suggestions: z.array(searchSuggestionSchema),
  serverTime: z.string().datetime({ offset: true })
});

export const availabilitySlotSchema = z.object({
  id: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(["AVAILABLE", "HELD", "UNAVAILABLE"]),
  remaining: z.number().int().nonnegative().nullable()
});

export const availabilityResponseSchema = z.object({
  timezone: z.string().min(1),
  slots: z.array(availabilitySlotSchema),
  serverTime: z.string().datetime({ offset: true })
});

export type Money = z.infer<typeof moneySchema>;
export type CustomerStoreSummary = z.infer<typeof storeSummarySchema>;
export type PublicOperatingHour = z.infer<typeof publicOperatingHourSchema>;
export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
export type SearchSuggestionsResponse = z.infer<typeof searchSuggestionsResponseSchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;
