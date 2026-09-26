import { z } from "zod";

const catalogStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const publicCatalogVariantSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  priceMinor: z.number().int().nonnegative(),
  sortOrder: z.number().int(),
  status: catalogStatusSchema
});

export const publicCatalogModifierSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  priceDeltaMinor: z.number().int(),
  sortOrder: z.number().int(),
  status: catalogStatusSchema
});

export const publicCatalogModifierGroupSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  selectionType: z.enum(["SINGLE", "MULTIPLE"]),
  minSelections: z.number().int().nonnegative(),
  maxSelections: z.number().int().nonnegative(),
  required: z.boolean(),
  modifiers: z.array(publicCatalogModifierSchema),
  status: catalogStatusSchema
});

export const publicCatalogProductSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string(),
  basePriceMinor: z.number().int().nonnegative(),
  effectivePriceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  soldOut: z.boolean(),
  variants: z.array(publicCatalogVariantSchema),
  modifierGroups: z.array(publicCatalogModifierGroupSchema)
});

export const publicCatalogResponseSchema = z.object({
  success: z.literal(true),
  // The Gateway returns only categories/products when the store has no active
  // public catalog. Keep that server shape explicit instead of inventing
  // store metadata in the client.
  store: z.object({
    id: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    currency: z.string().length(3)
  }).optional(),
  channel: z.enum(["POS", "QR", "KIOSK"]).optional(),
  categories: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    sortOrder: z.number().int()
  })),
  products: z.array(publicCatalogProductSchema)
});

export const publicCartPriceLineSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  variantId: z.string().uuid().optional(),
  variantName: z.string().optional(),
  modifierIds: z.array(z.string().uuid()),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  modifierTotalMinor: z.number().int(),
  subtotalMinor: z.number().int().nonnegative()
});

export const publicCartPriceResponseSchema = z.object({
  pricing: z.object({
    storeCode: z.string().min(1),
    currency: z.string().length(3),
    pricingVersion: z.string().min(1),
    subtotalMinor: z.number().int().nonnegative(),
    discountMinor: z.number().int().nonnegative(),
    taxMinor: z.number().int().nonnegative(),
    totalMinor: z.number().int().nonnegative(),
    lines: z.array(publicCartPriceLineSchema),
    serverTime: z.string().datetime({ offset: true })
  })
});

export const publicAvailabilitySlotSchema = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  resourceId: z.string().min(1),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  localStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  localEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  priceMinor: z.number().int().nonnegative(),
  available: z.boolean(),
  reason: z.enum(["PAST", "BLOCKED", "BOOKED"]).optional()
});

export const publicAvailabilityResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venueId: z.string().min(1),
  timezone: z.string().min(1),
  slotDurationMinutes: z.number().int().positive(),
  serverTime: z.string().datetime({ offset: true }),
  slots: z.array(publicAvailabilitySlotSchema)
});

export const publicBookingResponseSchema = z.object({
  booking: z.object({
    id: z.string().min(1),
    organizationId: z.string().min(1).optional(),
    venueId: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional(),
    orderId: z.string().nullable().optional(),
    customerName: z.string().min(1),
    customerPhone: z.string().nullable().optional(),
    customerEmail: z.string().nullable().optional(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    partySize: z.number().int().positive().default(1),
    status: z.enum(["HELD", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"]),
    amountMinor: z.number().int().nonnegative(),
    checkinCode: z.string().nullable().optional(),
    checkedInAt: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().nullable().optional(),
    publicTrackingToken: z.string().nullable().optional(),
    slotHoldId: z.string().nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
});

export const publicBookingHoldSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  resourceId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  partySize: z.number().int().positive(),
  amountMinor: z.number().int().nonnegative(),
  expiresAt: z.string().datetime({ offset: true }),
  serverTime: z.string().datetime({ offset: true })
});

export const publicBookingHoldResponseSchema = z.object({
  hold: publicBookingHoldSchema
});

export const publicOrderProjectionSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.enum([
    "DRAFT", "PENDING_PAYMENT", "PAID", "CONFIRMED", "QUEUED", "ACCEPTED",
    "PREPARING", "PARTIALLY_READY", "READY", "SERVED", "PICKED_UP", "COMPLETED",
    "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "NO_SHOW"
  ]),
  paymentStatus: z.enum(["UNPAID", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"]),
  fulfillmentType: z.enum(["TAKEAWAY", "DINE_IN", "PICKUP"]),
  currency: z.string().length(3),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  customerName: z.string().optional(),
  items: z.array(z.object({
    productName: z.string().min(1),
    variantName: z.string().optional(),
    quantity: z.number().int().positive(),
    subtotalMinor: z.number().int().nonnegative(),
    modifiers: z.array(z.object({ name: z.string().min(1) }))
  })),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  publicTrackingToken: z.string().min(1).optional()
});

export const publicOrderResponseSchema = z.object({
  order: publicOrderProjectionSchema,
  trackingToken: z.string().min(1).optional()
});

export const publicPaymentSessionResponseSchema = z.object({
  payment: z.object({
    provider: z.enum(["STRIPE", "OPN", "XENDIT", "MANUAL"]),
    sessionId: z.string().min(1),
    url: z.string().url(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional()
  }).nullable(),
  order: publicOrderProjectionSchema
});

export const customerFavoriteSchema = z.object({
  storeSlug: z.string().min(1),
  savedAt: z.string().datetime({ offset: true })
});

export const customerFavoritesResponseSchema = z.object({
  favorites: z.array(customerFavoriteSchema)
});

export type PublicCatalogResponse = z.infer<typeof publicCatalogResponseSchema>;
export type PublicCatalogProduct = z.infer<typeof publicCatalogProductSchema>;
export type PublicCartPrice = z.infer<typeof publicCartPriceResponseSchema>["pricing"];
export type PublicAvailabilityResponse = z.infer<typeof publicAvailabilityResponseSchema>;
export type PublicAvailabilitySlot = z.infer<typeof publicAvailabilitySlotSchema>;
export type PublicBookingResponse = z.infer<typeof publicBookingResponseSchema>;
export type PublicBookingHold = z.infer<typeof publicBookingHoldSchema>;
export type PublicOrderResponse = z.infer<typeof publicOrderResponseSchema>;
export type PublicPaymentSessionResponse = z.infer<typeof publicPaymentSessionResponseSchema>;
export type CustomerFavorite = z.infer<typeof customerFavoriteSchema>;

export const publicBookingDetailsSchema = z.object({
  customerName: z.string().trim().min(1, "กรุณาระบุชื่อ").max(160),
  customerPhone: z.string().trim().max(32).optional(),
  customerEmail: z.union([z.literal(""), z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง")]).optional(),
  notes: z.string().trim().max(500).optional()
});

export type PublicBookingDetails = z.infer<typeof publicBookingDetailsSchema>;

export interface CreatePublicBookingInput {
  resourceId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  startsAt: string;
  endsAt: string;
  totalAmountMinor?: number;
  partySize?: number;
  notes?: string;
}

export interface CreatePublicBookingHoldInput {
  resourceId: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
}

export interface CreatePublicOrderInput {
  channel: "QR" | "KIOSK";
  fulfillmentType: "TAKEAWAY" | "DINE_IN";
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  scheduledPickupAt?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    modifierIds?: string[];
    quantity: number;
    note?: string;
  }>;
}

export interface PricePublicCartInput {
  channel: "QR" | "KIOSK";
  fulfillmentType: "TAKEAWAY" | "DINE_IN";
  items: CreatePublicOrderInput["items"];
}
