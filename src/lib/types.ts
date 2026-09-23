import type { z } from "zod";
import type { profileSchema, projectSchema } from "./content-contract.mjs";

export type PublicProfile = z.infer<typeof profileSchema>;
export type ProjectRecord = z.infer<typeof projectSchema>;
