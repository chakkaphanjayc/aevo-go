import { z } from "zod";

export const customerSessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().nullable().optional()
  }),
  principal: z.unknown().nullable().optional(),
  effectiveUser: z.unknown().nullable().optional(),
  impersonation: z.unknown().nullable().optional()
});

export type CustomerSession = z.infer<typeof customerSessionSchema>;
