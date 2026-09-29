import { z } from "zod";

export const discoveryUgcStatusSchema = z.enum([
  "PRIVATE",
  "QUARANTINED",
  "APPROVED",
  "NEEDS_REVIEW",
  "REJECTED",
  "REMOVED",
]);
export const discoveryUgcKindSchema = z.enum([
  "REVIEW",
  "PHOTO",
  "COMMENT",
  "POST",
  "TIP",
  "QUESTION",
  "ANSWER",
]);
export const discoverySafetyReasonCodeSchema = z.enum([
  "SEXUAL_OR_EXPLICIT",
  "NUDITY",
  "GRAPHIC_VIOLENCE",
  "HATE_OR_HARASSMENT",
  "PERSONAL_INFORMATION",
  "ILLEGAL_OR_DANGEROUS",
  "SPAM",
  "FAKE_ENGAGEMENT",
  "OFF_TOPIC",
  "DUPLICATE",
  "PROMOTIONAL_ABUSE",
  "MODERATION_UNAVAILABLE",
  "NOT_APPROVED",
]);

export const discoveryUgcEligibilitySchema = z
  .object({
    kind: discoveryUgcKindSchema,
    status: discoveryUgcStatusSchema,
    publicVariantAvailable: z.boolean(),
    reasonCode: discoverySafetyReasonCodeSchema.optional(),
  })
  .strict();

export function isPublicDiscoveryUgc(value: unknown): boolean {
  const result = discoveryUgcEligibilitySchema.safeParse(value);
  return result.success
    && result.data.status === "APPROVED"
    && result.data.publicVariantAvailable
    && result.data.reasonCode === undefined;
}

export type DiscoveryUgcStatus = z.infer<typeof discoveryUgcStatusSchema>;
export type DiscoveryUgcKind = z.infer<typeof discoveryUgcKindSchema>;
export type DiscoverySafetyReasonCode = z.infer<typeof discoverySafetyReasonCodeSchema>;
export type DiscoveryUgcEligibility = z.infer<typeof discoveryUgcEligibilitySchema>;

