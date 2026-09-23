import { z } from "zod";

export const publicationStateSchema = z.enum(["public", "deferred", "private"]);

const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Public external links must use HTTPS and may not embed credentials.");

const publicHref = z.string().refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  return httpsUrl.safeParse(value).success;
}, "Use a root-relative internal URL or an HTTPS external URL.");

const skillGroupSchema = z.object({
  name: z.string().min(2),
  note: z.string().min(12),
  items: z.array(z.string().min(1)).min(2),
}).strict();

const experienceSchema = z.object({
  organization: z.string().min(2),
  role: z.string().min(2),
  location: z.string().min(2),
  description: z.string().min(20),
}).strict();

export const profileSchema = z.object({
  publicationState: publicationStateSchema,
  displayName: z.string().min(2),
  location: z.string().min(4),
  headline: z.string().min(12),
  introduction: z.string().min(40),
  about: z.array(z.string().min(40)).min(2),
  email: z.string().email(),
  phoneDisplay: z.string().min(7),
  phoneHref: z.string().regex(/^tel:\+[0-9]+$/),
  githubUrl: httpsUrl,
  resumeHref: z.literal("/downloads/Rory-Hughes-Resume.docx"),
  skills: z.array(skillGroupSchema).min(3),
  experience: z.array(experienceSchema).min(3),
  education: z.object({
    program: z.string().min(4),
    institution: z.string().min(4),
    location: z.string().min(2),
    expectedGraduation: z.string().regex(/^20[0-9]{2}$/),
    gpa: z.string().regex(/^[0-9]+\.[0-9]{2}$/),
    training: z.array(z.object({
      name: z.string().min(2),
      credential: z.string().min(2),
    }).strict()).min(1),
  }).strict(),
}).strict();

const linkSchema = z.object({
  label: z.string().min(2),
  href: publicHref,
  kind: z.enum(["repository", "demo", "paper"]),
}).strict();

const citationSchema = z.object({
  title: z.string().min(8),
  authors: z.string().min(3),
  publication: z.string().min(4),
  year: z.number().int().min(1900).max(2100),
  href: httpsUrl,
}).strict();

const mediaSlotSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().min(3),
  kind: z.enum(["image", "video", "diagram"]),
  availability: z.enum(["fallback", "candidate", "published"]),
  publicationState: publicationStateSchema,
  reviewStatus: z.enum(["not-provided", "pending", "withheld", "approved"]),
  assetPath: z.string().regex(/^media\/[A-Za-z0-9._/-]+$/).optional(),
  altText: z.string().min(12).optional(),
  caption: z.string().min(12).optional(),
  transcript: z.string().min(20).optional(),
  fallbackText: z.string().min(24),
}).strict().superRefine((slot, context) => {
  if (slot.availability === "published") {
    if (slot.publicationState !== "public") {
      context.addIssue({ code: "custom", path: ["publicationState"], message: "Published media must be explicitly public." });
    }
    if (slot.reviewStatus !== "approved") {
      context.addIssue({ code: "custom", path: ["reviewStatus"], message: "Published media must pass manual privacy review." });
    }
    for (const field of ["assetPath", "altText", "caption"]) {
      if (!slot[field]) {
        context.addIssue({ code: "custom", path: [field], message: "Published media requires an asset, useful alternative text, and a caption." });
      }
    }
    if (slot.kind === "video" && !slot.transcript) {
      context.addIssue({ code: "custom", path: ["transcript"], message: "Published recordings require a concise transcript." });
    }
  } else {
    if (slot.assetPath) {
      context.addIssue({ code: "custom", path: ["assetPath"], message: "Deferred or candidate media cannot reference a public asset." });
    }
    if (slot.publicationState === "public") {
      context.addIssue({ code: "custom", path: ["publicationState"], message: "Fallback and candidate media must remain deferred or private." });
    }
  }
});

const sectionSchema = z.object({
  heading: z.string().min(3),
  paragraphs: z.array(z.string().min(20)).min(1),
  bullets: z.array(z.string().min(8)).optional(),
}).strict();

export const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(4),
  shortTitle: z.string().min(4),
  order: z.number().int().positive(),
  featured: z.boolean(),
  category: z.enum(["client-system", "mobile-application", "research-project"]),
  summary: z.string().min(40).max(260),
  problem: z.string().min(40),
  role: z.string().min(8),
  stakeholders: z.array(z.string().min(2)).min(1),
  technologies: z.array(z.string().min(2)).max(12),
  statusLabel: z.string().min(3),
  currentStatus: z.string().min(20),
  publicationState: publicationStateSchema,
  publicationBoundary: z.string().min(24),
  limitations: z.array(z.string().min(12)).min(1),
  claimPolicy: z.array(z.string().min(12)).min(1),
  evidence: z.array(z.string().min(16)).min(1),
  sections: z.array(sectionSchema).min(2),
  links: z.array(linkSchema),
  linkFallback: z.string().min(20),
  citations: z.array(citationSchema),
  media: z.array(mediaSlotSchema),
}).strict().superRefine((project, context) => {
  const mediaIds = project.media.map((media) => media.id);
  if (new Set(mediaIds).size !== mediaIds.length) {
    context.addIssue({ code: "custom", path: ["media"], message: "Media slot IDs must be unique within a project." });
  }
  if (project.category === "research-project" && project.citations.length === 0) {
    context.addIssue({ code: "custom", path: ["citations"], message: "Research projects must cite their source material." });
  }
});

export const resumeAssetSchema = z.object({
  href: z.literal("/downloads/Rory-Hughes-Resume.docx"),
  fileName: z.literal("Rory-Hughes-Resume.docx"),
  byteLength: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDescription: z.string().min(20),
}).strict();

export const MAX_PUBLIC_MEDIA_BYTES = 100 * 1024 * 1024;
