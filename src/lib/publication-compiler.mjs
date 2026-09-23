import { profileSchema, projectSchema } from "./content-contract.mjs";

export function compilePublicProfile(entries) {
  if (!Array.isArray(entries) || entries.length !== 1) {
    throw new Error("Exactly one profile record is required.");
  }

  const entry = entries[0];
  const data = profileSchema.parse(entry.data ?? entry);
  if (entry.id && entry.id !== "rory") {
    throw new Error("The public profile record must use the stable rory ID.");
  }
  if (data.publicationState !== "public") {
    throw new Error("The public profile must be explicitly marked public.");
  }

  return data;
}

export function compilePublicProjects(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Project content must be an array of records.");
  }

  const validated = entries.map((entry) => {
    const data = projectSchema.parse(entry.data ?? entry);
    const id = entry.id ?? data.slug;
    if (id !== data.slug) {
      throw new Error("Project collection ID must match its stable slug: " + id);
    }
    return data;
  });

  const slugs = validated.map((project) => project.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("Project slugs must be unique.");
  }

  return validated
    .filter((project) => project.publicationState === "public")
    .sort((left, right) => left.order - right.order);
}
