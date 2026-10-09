import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { MAX_PUBLIC_MEDIA_BYTES } from "./content-contract.mjs";

const signatures = new Map([
  [".png", (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
  [".jpg", (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff],
  [".jpeg", (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff],
  [".webp", (bytes) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"],
  [".mp4", (bytes) => bytes.toString("ascii", 4, 8) === "ftyp"],
  [".webm", (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))],
]);

async function collectFiles(directory, relativePrefix = "") {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativePrefix, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Symbolic links are not allowed in public media: " + relativePath);
    }
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    } else {
      throw new Error("Unsupported public media entry: " + relativePath);
    }
  }
  return files;
}

function validateAssetPath(assetPath) {
  const parts = assetPath.split("/");
  return assetPath.startsWith("media/")
    && parts.length >= 2
    && parts.every((part) => part !== "" && part !== "." && part !== ".." && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part));
}

function expectedExtensions(kind) {
  return kind === "video"
    ? new Set([".mp4", ".webm"])
    : new Set([".png", ".jpg", ".jpeg", ".webp"]);
}

export function isPublicMediaSizeValid(byteLength) {
  return Number.isSafeInteger(byteLength) && byteLength >= 0 && byteLength < MAX_PUBLIC_MEDIA_BYTES;
}

export function videoMimeType(assetPath) {
  return path.posix.extname(assetPath).toLowerCase() === ".webm" ? "video/webm" : "video/mp4";
}

export async function validateMediaAssets(projects, publicDirectory) {
  const errors = [];
  const referenced = new Map();
  const publicRoot = path.resolve(publicDirectory);

  for (const project of projects) {
    for (const slot of project.media) {
      if (slot.availability !== "published") {
        if (slot.assetPath || slot.posterPath) {
          errors.push(project.slug + "/" + slot.id + " references an asset before publication approval.");
        }
        if (!slot.fallbackText.trim()) {
          errors.push(project.slug + "/" + slot.id + " needs an explanatory text fallback.");
        }
        continue;
      }

      if (slot.publicationState !== "public" || slot.reviewStatus !== "approved") {
        errors.push(project.slug + "/" + slot.id + " is not approved for publication.");
      }
      if (!slot.assetPath || !validateAssetPath(slot.assetPath)) {
        errors.push(project.slug + "/" + slot.id + " must reference a safe path under public/media/.");
        continue;
      }
      if (referenced.has(slot.assetPath)) {
        errors.push("Media asset is referenced by more than one slot: " + slot.assetPath);
        continue;
      }
      referenced.set(slot.assetPath, { project, slot });

      if (slot.kind === "video") {
        if (!slot.posterPath || !validateAssetPath(slot.posterPath)) {
          errors.push(project.slug + "/" + slot.id + " must reference a safe poster image under public/media/.");
        } else if (!expectedExtensions("image").has(path.posix.extname(slot.posterPath).toLowerCase())) {
          errors.push(project.slug + "/" + slot.id + " must use an image file for its poster.");
        } else if (referenced.has(slot.posterPath)) {
          errors.push("Media asset is referenced by more than one slot: " + slot.posterPath);
        } else {
          // Posters share the recording's explicit publication and privacy review.
          referenced.set(slot.posterPath, { project, slot });
        }
      } else if (slot.posterPath) {
        errors.push(project.slug + "/" + slot.id + " is not a recording and cannot reference a poster.");
      }

      const extension = path.posix.extname(slot.assetPath).toLowerCase();
      if (!expectedExtensions(slot.kind).has(extension)) {
        errors.push(project.slug + "/" + slot.id + " has a file extension that does not match its media kind.");
      }
      if (!slot.altText || !slot.caption) {
        errors.push(project.slug + "/" + slot.id + " is missing alternative text or a caption.");
      }
      if (slot.kind === "video" && !slot.transcript) {
        errors.push(project.slug + "/" + slot.id + " is missing its accessible transcript.");
      }
    }
  }

  const mediaRoot = path.join(publicRoot, "media");
  const files = await collectFiles(mediaRoot);
  const found = new Set();

  for (const file of files) {
    const assetPath = path.posix.join("media", file.relativePath);
    const entry = referenced.get(assetPath);
    if (!entry) {
      errors.push("Unreferenced public media file: " + assetPath);
    } else {
      found.add(assetPath);
    }

    const details = await lstat(file.absolutePath);
    if (!isPublicMediaSizeValid(details.size)) {
      errors.push(assetPath + " must be strictly smaller than 100 MiB.");
    }

    const extension = path.posix.extname(assetPath).toLowerCase();
    const signatureCheck = signatures.get(extension);
    if (!signatureCheck) {
      errors.push("Unsupported public media type: " + assetPath);
      continue;
    }
    const mediaFile = await open(file.absolutePath, "r");
    const header = Buffer.alloc(12);
    try {
      await mediaFile.read(header, 0, header.length, 0);
    } finally {
      await mediaFile.close();
    }
    if (!signatureCheck(header)) {
      errors.push("Media file signature does not match its type: " + assetPath);
    }
  }

  for (const assetPath of referenced.keys()) {
    if (!found.has(assetPath)) {
      errors.push("Approved media asset is missing: " + assetPath);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return [...referenced.keys()].sort();
}
