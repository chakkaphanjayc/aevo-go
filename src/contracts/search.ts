import { z } from "zod";

export const searchUserLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy_meters: z.number().optional(),
});

export const searchConstraintsSchema = z.object({
  max_walking_dist_meters: z.number().positive().default(1500),
  max_nodes: z.number().int().min(1).max(5).default(3),
  prefer_aevo_partners: z.boolean().default(true),
  stay_duration_mins: z.number().positive().optional(),
});

export const searchTraceRequestSchema = z.object({
  query: z.string().min(1),
  user_location: searchUserLocationSchema,
  constraints: searchConstraintsSchema.optional(),
  current_slot_id: z.string().optional(),
});

export const traceHopSchema = z.object({
  distance_meters: z.number().nonnegative(),
  mins: z.number().nonnegative(),
});

export const aevoPerkSchema = z.object({
  type: z.enum(["discount", "fast_pass", "free_drink", "reward_pts"]),
  label: z.string(),
  badge_color: z.string().optional(),
});

export const traceWaypointSchema = z.object({
  step: z.number().int().positive(),
  place_id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  vibe_matches: z.array(z.string()),
  walk_to_next: traceHopSchema.nullable(),
  aevo_perk: aevoPerkSchema.optional().nullable(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const parsedIntentVectorSchema = z.object({
  mood_atmosphere: z.array(z.string()),
  spatio_temporal: z.string(),
  sequence_flow: z.array(z.string()),
  privileges: z.array(z.string()),
  semantic_confidence: z.number().min(0).max(1),
});

export const searchTraceResponseSchema = z.object({
  trace_id: z.string(),
  title: z.string(),
  summary: z.string(),
  total_distance_meters: z.number().nonnegative(),
  estimated_walking_mins: z.number().nonnegative(),
  waypoints: z.array(traceWaypointSchema),
  parsed_intent: parsedIntentVectorSchema.optional(),
});

export const searchRankingWeightsSchema = z.object({
  semantic: z.number().min(0).max(1),
  distance: z.number().min(0).max(1),
  partner: z.number().min(0).max(1),
  rating: z.number().min(0).max(1),
  time: z.number().min(0).max(1).default(0.1),
});

export const timeSlotConfigSchema = z.object({
  slot_id: z.string(),
  label: z.string(),
  time_range: z.string(),
  preset_trace_tags: z.array(z.string()),
  recommended_prompts: z.array(z.string()),
  icon: z.string().optional(),
});

export const adminSearchConfigSchema = z.object({
  weights: searchRankingWeightsSchema,
  max_search_radius_meters: z.number().positive(),
  dynamic_rerank_enabled: z.boolean(),
  time_slots: z.array(timeSlotConfigSchema),
});

export type SearchUserLocation = z.infer<typeof searchUserLocationSchema>;
export type SearchConstraints = z.infer<typeof searchConstraintsSchema>;
export type SearchTraceRequest = z.infer<typeof searchTraceRequestSchema>;
export type TraceHop = z.infer<typeof traceHopSchema>;
export type AevoPerk = z.infer<typeof aevoPerkSchema>;
export type TraceWaypoint = z.infer<typeof traceWaypointSchema>;
export type ParsedIntentVector = z.infer<typeof parsedIntentVectorSchema>;
export type SearchTraceResponse = z.infer<typeof searchTraceResponseSchema>;
export type SearchRankingWeights = z.infer<typeof searchRankingWeightsSchema>;
export type TimeSlotConfig = z.infer<typeof timeSlotConfigSchema>;
export type AdminSearchConfig = z.infer<typeof adminSearchConfigSchema>;
