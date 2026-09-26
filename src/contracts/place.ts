import { z } from "zod";

export const canonicalPlaceIdSchema = z.string().uuid();

export const placeCoordinateSchema = z.tuple([
  z.number().gte(-180).lte(180),
  z.number().gte(-90).lte(90)
]);

const placeCoordinateRingSchema = z.array(placeCoordinateSchema).min(4);
const placePolygonCoordinatesSchema = z.array(placeCoordinateRingSchema).min(1);

export const placeGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: placeCoordinateSchema }),
  z.object({ type: z.literal("Polygon"), coordinates: placePolygonCoordinatesSchema }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(placePolygonCoordinatesSchema).min(1) })
]);

export const placeGeoPointSchema = z.object({
  longitude: z.number().gte(-180).lte(180),
  latitude: z.number().gte(-90).lte(90)
});

export const placeBoundsSchema = z.object({
  west: z.number().gte(-180).lte(180),
  south: z.number().gte(-90).lte(90),
  east: z.number().gte(-180).lte(180),
  north: z.number().gte(-90).lte(90)
}).refine((bounds) => bounds.west < bounds.east && bounds.south < bounds.north, {
  message: "Place bounds must be a non-empty non-antimeridian rectangle"
}).refine((bounds) => bounds.east - bounds.west <= 90 && bounds.north - bounds.south <= 60, {
  message: "Place bounds exceed the bounded V1 viewport"
});

export const placeLocalizedNameSchema = z.object({
  locale: z.string().min(2).max(16),
  value: z.string().trim().min(1).max(240),
  kind: z.enum(["canonical", "alias", "transliteration"])
});

export const placeAddressSchema = z.object({
  countryCode: z.string().length(2).nullable(),
  country: z.string().nullable(),
  administrativeArea1: z.string().nullable(),
  administrativeArea2: z.string().nullable(),
  locality: z.string().nullable(),
  neighborhood: z.string().nullable(),
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  localizedAddresses: z.array(placeLocalizedNameSchema)
});

export const placeFreshnessSchema = z.object({
  state: z.enum(["fresh", "stale", "unknown"]),
  observedAt: z.string().datetime({ offset: true }).nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  sourceRevision: z.string().nullable()
});

export const placeCapabilitySummarySchema = z.object({
  bookable: z.boolean(),
  queueSupported: z.boolean(),
  aevoPlayPartner: z.boolean(),
  commerceEnabled: z.boolean(),
  publicBookingRoute: z.string().nullable(),
  freshness: placeFreshnessSchema
});

export const placeVerificationSchema = z.object({
  status: z.enum(["unverified", "community_reviewed", "business_verified", "admin_verified"]),
  label: z.string().nullable(),
  verifiedAt: z.string().datetime({ offset: true }).nullable(),
  verificationRevision: z.string().nullable()
});

export const placeCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  localizedLabels: z.array(placeLocalizedNameSchema)
});

export const placeBusinessLinkSchema = z.object({
  relationship: z.enum(["operates_at", "owns", "manages", "books_at", "located_in", "contains", "service_location"]),
  organizationId: z.string().nullable(),
  businessId: z.string().nullable(),
  branchId: z.string().nullable(),
  storeId: z.string().nullable(),
  venueId: z.string().nullable(),
  displayName: z.string().nullable(),
  isPrimary: z.boolean(),
  verificationStatus: z.enum(["unverified", "community_reviewed", "business_verified", "admin_verified"])
});

export const placeAttributionSchema = z.object({
  sourceKind: z.enum(["aevo_admin", "verified_business", "community", "booking_domain", "osm", "overture", "government", "derived"]),
  sourceId: z.string().nullable(),
  label: z.string().min(1),
  url: z.string().url().nullable(),
  license: z.string().nullable(),
  requiredText: z.string().nullable()
});

export const placeRedirectMetadataSchema = z.object({
  fromPlaceId: canonicalPlaceIdSchema,
  toPlaceId: canonicalPlaceIdSchema,
  reason: z.enum(["merged", "renamed", "split_compensation", "restored"]),
  hops: z.number().int().nonnegative().max(5),
  resolvedAt: z.string().datetime({ offset: true })
});

export const placeSummarySchema = z.object({
  id: canonicalPlaceIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  localizedNames: z.array(placeLocalizedNameSchema),
  category: placeCategorySchema,
  status: z.enum(["candidate", "visible", "limited", "under_review", "closed", "removed", "merged"]),
  displayPoint: placeGeoPointSchema.nullable(),
  labelPoint: placeGeoPointSchema.nullable(),
  area: z.string().nullable(),
  address: placeAddressSchema.nullable(),
  parentPlaceId: canonicalPlaceIdSchema.nullable(),
  verification: placeVerificationSchema,
  business: placeBusinessLinkSchema.nullable(),
  capabilities: placeCapabilitySummarySchema,
  attribution: z.array(placeAttributionSchema),
  redirectFrom: placeRedirectMetadataSchema.nullable()
});

export const placeMapOverlayPlacePropertiesSchema = z.object({
  featureKind: z.literal("place"),
  placeId: canonicalPlaceIdSchema,
  name: z.string().min(1),
  categoryId: z.string().min(1),
  markerKind: z.string().min(1),
  verificationStatus: placeVerificationSchema.shape.status,
  bookable: z.boolean(),
  aevoPlayPartner: z.boolean()
}).strict();

export const placeMapOverlayClusterPropertiesSchema = z.object({
  featureKind: z.literal("cluster"),
  clusterId: z.string().min(1),
  pointCount: z.number().int().positive()
}).strict();

const placeMapOverlayPlaceFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: z.object({ type: z.literal("Point"), coordinates: placeCoordinateSchema }),
  properties: placeMapOverlayPlacePropertiesSchema
}).strict();

const placeMapOverlayClusterFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1),
  geometry: z.object({ type: z.literal("Point"), coordinates: placeCoordinateSchema }),
  properties: placeMapOverlayClusterPropertiesSchema
}).strict();

export const placeMapOverlayFeatureSchema = z.union([
  placeMapOverlayPlaceFeatureSchema,
  placeMapOverlayClusterFeatureSchema
]);

export const placeResponseMetadataSchema = z.object({
  contractVersion: z.literal("v1"),
  schemaVersion: z.literal("1"),
  projectionVersion: z.string().min(1),
  sourceRevision: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  freshness: placeFreshnessSchema,
  requestId: z.string().min(1).optional()
});

export const placeMapOverlayResponseSchema = placeResponseMetadataSchema.extend({
  bounds: placeBoundsSchema,
  zoom: z.number().finite(),
  features: z.array(placeMapOverlayFeatureSchema),
  truncated: z.boolean(),
  density: z.object({
    mode: z.enum(["points", "clusters"]),
    featureCount: z.number().int().nonnegative(),
    clusterCount: z.number().int().nonnegative(),
    maxFeatures: z.number().int().positive()
  })
});

export const placeSearchResultSchema = placeSummarySchema.extend({
  rank: z.number().int().positive(),
  distanceMeters: z.number().nonnegative().nullable(),
  matchReasons: z.array(z.string())
});

export const placeSearchResponseSchema = placeResponseMetadataSchema.extend({
  data: z.array(placeSearchResultSchema),
  nextCursor: z.string().nullable(),
  totalApproximate: z.number().int().nonnegative().nullable(),
  truncated: z.boolean()
});

export const placeNearbyResponseSchema = placeResponseMetadataSchema.extend({
  origin: placeGeoPointSchema,
  radiusMeters: z.number().int().positive(),
  data: z.array(placeSearchResultSchema),
  nextCursor: z.string().nullable(),
  truncated: z.boolean()
});

export const placeDetailSchema = placeSummarySchema.extend({
  canonicalGeometry: placeGeometrySchema.nullable(),
  centroid: placeGeoPointSchema.nullable(),
  boundingGeometry: placeGeometrySchema.nullable(),
  children: z.array(z.object({
    placeId: canonicalPlaceIdSchema,
    relationship: z.enum(["contains", "tenant", "facility", "campus", "unit"]),
    name: z.string().min(1)
  })),
  businessLinks: z.array(placeBusinessLinkSchema),
  fieldProvenance: z.array(z.object({
    field: z.enum(["name", "localizedNames", "category", "geometry", "displayPoint", "address", "businessLink", "capability", "verification", "status"]),
    sourceKind: z.enum(["aevo_admin", "verified_business", "community", "booking_domain", "osm", "overture", "government", "derived"]),
    sourceId: z.string().nullable(),
    sourceVersion: z.string().nullable(),
    observedAt: z.string().datetime({ offset: true }),
    approvedBy: z.string().nullable(),
    canonicalRevision: z.string().min(1),
    method: z.string().nullable()
  })),
  legacyReferences: z.array(z.object({
    namespace: z.enum(["aevo.place", "aevo.store", "aevo.venue", "aevo.tracedee", "osm", "overture", "government", "feed.item"]),
    id: z.string().min(1),
    sourceVersion: z.string().nullable().optional(),
    retainedFor: z.array(z.enum(["read", "analytics", "migration", "support"])).optional()
  }))
});

export const placeDetailResponseSchema = placeResponseMetadataSchema.extend({
  place: placeDetailSchema
});

export type CanonicalPlaceId = z.infer<typeof canonicalPlaceIdSchema>;
export type PlaceGeometry = z.infer<typeof placeGeometrySchema>;
export type PlaceGeoPoint = z.infer<typeof placeGeoPointSchema>;
export type PlaceSummary = z.infer<typeof placeSummarySchema>;
export type PlaceMapOverlayResponse = z.infer<typeof placeMapOverlayResponseSchema>;
export type PlaceSearchResult = z.infer<typeof placeSearchResultSchema>;
export type PlaceSearchResponse = z.infer<typeof placeSearchResponseSchema>;
export type PlaceNearbyResponse = z.infer<typeof placeNearbyResponseSchema>;
export type PlaceDetail = z.infer<typeof placeDetailSchema>;
