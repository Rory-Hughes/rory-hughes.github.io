import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compilePublicProfile,
  compilePublicProjects,
} from "../src/lib/publication-compiler.mjs";
import {
  resumeAssetSchema,
  resumePdfAssetSchema,
} from "../src/lib/content-contract.mjs";
import { validateMediaAssets } from "../src/lib/media-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(repositoryRoot, "src", "content");
const ignoredDirectories = new Set([".git", "node_modules", "dist", ".astro"]);
const blockedNames = new Set([".env", ".env.local", ".env.production"]);
const sensitiveExtensions = new Set([".keystore", ".jks", ".p12", ".pem", ".pfx"]);
const scannedTextExtensions = new Set([".astro", ".css", ".html", ".json", ".md", ".mjs", ".svg", ".ts", ".yml", ".yaml"]);
const secretPatterns = [
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
  /-----BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/,
];

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error("Could not parse " + path.relative(repositoryRoot, filePath) + ": " + error.message);
  }
}

async function loadProjectEntries() {
  const directory = path.join(contentRoot, "projects");
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  return Promise.all(files.map(async (fileName) => ({
    id: path.basename(fileName, ".json"),
    data: await readJson(path.join(directory, fileName)),
  })));
}

async function scanForSecrets(directory, relativeDirectory = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed in the publication repository: " + path.posix.join(relativeDirectory, entry.name));
    }

    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        await scanForSecrets(absolutePath, relativePath);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    const baseName = entry.name.toLowerCase();
    const extension = path.extname(baseName);
    if (blockedNames.has(baseName) || (baseName.startsWith(".env.") && baseName !== ".env.example")) {
      throw new Error("Environment files are not allowed in the public site repository: " + relativePath);
    }
    if (sensitiveExtensions.has(extension)) {
      throw new Error("Private key or keystore file is not allowed in the public site repository: " + relativePath);
    }

    const isDeclaredMedia = relativePath.startsWith("public/media/");
    if (!isDeclaredMedia && [".mp4", ".mov", ".mkv", ".avi", ".webm"].includes(extension)) {
      throw new Error("Video files must be reviewed and referenced under public/media/: " + relativePath);
    }

    if (scannedTextExtensions.has(extension)) {
      const contents = await readFile(absolutePath, "utf8");
      if (secretPatterns.some((pattern) => pattern.test(contents))) {
        throw new Error("A credential-like value was found in " + relativePath);
      }
    }
  }
}

async function validateResume(profile) {
  const manifestPath = path.join(contentRoot, "resume-asset.json");
  const manifest = resumeAssetSchema.parse(await readJson(manifestPath));
  if (manifest.href !== profile.resumeHref) {
    throw new Error("Profile resume link does not match the approved resume manifest.");
  }

  const resumePath = path.join(repositoryRoot, "public", "downloads", manifest.fileName);
  const details = await lstat(resumePath);
  if (!details.isFile() || details.size !== manifest.byteLength) {
    throw new Error("Resume download size does not match the approved manifest.");
  }
  const bytes = await readFile(resumePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== manifest.sha256) {
    throw new Error("Resume download SHA-256 does not match the approved manifest.");
  }

  const sourcePath = process.env.PORTFOLIO_RESUME_SOURCE;
  if (sourcePath) {
    const sourceBytes = await readFile(sourcePath);
    const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
    if (sourceDigest !== digest || sourceBytes.length !== bytes.length) {
      throw new Error("Resume download is not byte-for-byte identical to the supplied source.");
    }
  }
}

const pdfResumeManifest = resumePdfAssetSchema.parse(await readJson(path.join(contentRoot, "resume-pdf-asset.json")));
const pdfResumeBytes = await readFile(path.join(repositoryRoot, "public", "downloads", pdfResumeManifest.fileName));
if (pdfResumeBytes.subarray(0, 5).toString() !== "%PDF-"
    || pdfResumeBytes.length !== pdfResumeManifest.byteLength
    || createHash("sha256").update(pdfResumeBytes).digest("hex") !== pdfResumeManifest.sha256) {
  throw new Error("PDF resume does not match its reviewed asset manifest.");
}

const profileDirectory = path.join(contentRoot, "profile");
const profileFiles = (await readdir(profileDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
if (profileFiles.length !== 1 || profileFiles[0].name !== "rory.json") {
  throw new Error("The public site requires exactly one authoritative profile record named rory.json.");
}

const profile = compilePublicProfile([{
  id: "rory",
  data: await readJson(path.join(profileDirectory, "rory.json")),
}]);
const projectEntries = await loadProjectEntries();
if (profile.resumePdfHref !== pdfResumeManifest.href) {
  throw new Error("Profile PDF resume link and manifest differ.");
}
const projects = compilePublicProjects(projectEntries);
if (projects.length !== projectEntries.length) {
  throw new Error("Non-public project records cannot be stored in this public site repository.");
}

const requiredSlugs = new Set(["john-howard", "mileage-tracker"]);
for (const slug of requiredSlugs) {
  if (!projects.some((project) => project.slug === slug)) {
    throw new Error("Required public project record is missing: " + slug);
  }
}

const johnHoward = projects.find((project) => project.slug === "john-howard");
if (johnHoward.links.some((link) => link.kind === "demo" || link.kind === "repository")) {
  throw new Error("John Howard demo or repository links require an approved public destination.");
}
if (!johnHoward.linkFallback.toLowerCase().includes("pending")) {
  throw new Error("John Howard's unavailable public destinations need a visible pending explanation.");
}

const publicDirectory = path.join(repositoryRoot, "public");
await validateMediaAssets(projects, publicDirectory);
await validateResume(profile);
await scanForSecrets(repositoryRoot);

console.log("Content policy passed: " + projects.length + " public project records, one profile, and an approved resume asset.");
console.log("Media policy passed: " + projects.reduce((total, project) => total + project.media.length, 0) + " evidence slots; only reviewed allow-listed assets may be published.");
