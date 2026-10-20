import { z } from "zod";
/** Subject-matte refinement controls (see ai-service/app/matte.py). */
export const matteOptsSchema = z.object({ guided: z.boolean().optional(), temporal: z.number().min(0).max(0.9).optional(), feather: z.number().min(0).max(12).optional(), grow: z.number().min(-8).max(8).optional() }).default({});
export type MatteOptsInput = z.infer<typeof matteOptsSchema>;
export const DEFAULT_MATTE = { guided: true, temporal: 0.7, feather: 1, grow: 0 };
