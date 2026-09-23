import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { profileSchema, projectSchema } from "./lib/content-contract.mjs";

const profile = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/profile" }),
  schema: profileSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/projects" }),
  schema: projectSchema,
});

export const collections = { profile, projects };
