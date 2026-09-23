import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePublicProfile, compilePublicProjects } from "../src/lib/publication-compiler.mjs";
import { resumeAssetSchema } from "../src/lib/content-contract.mjs";
import { validateMediaAssets } from "../src/lib/media-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "dist");
const siteOrigin = new URL("https://rory-hughes.github.io");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function collectFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Static output may not contain symbolic links: " + relativePath);
    }
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

function routeUrl(relativeHtmlPath) {
  if (relativeHtmlPath === "index.html") return new URL("/", siteOrigin);
  if (relativeHtmlPath.endsWith("/index.html")) {
    return new URL("/" + relativeHtmlPath.slice(0, -"index.html".length), siteOrigin);
  }
  return new URL("/" + relativeHtmlPath, siteOrigin);
}

function fileForPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = path.posix.normalize("/" + decoded.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (decoded.endsWith("/")) return path.join(outputDirectory, normalized, "index.html");
  const directPath = path.join(outputDirectory, normalized);
  if (path.extname(decoded)) return directPath;
  return path.join(outputDirectory, normalized, "index.html");
}

function attributeValues(markup, name) {
  const matcher = new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "gi");
  return [...markup.matchAll(matcher)].map((match) => match[2].replaceAll("&amp;", "&"));
}

function tagContents(markup, tagName) {
  return [...markup.matchAll(new RegExp("<" + tagName + "\\b[^>]*>", "gi"))].map((match) => match[0]);
}

function assertNamedAnchors(markup, relativePath) {
  for (const match of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const attributes = match[1];
    const body = match[2];
    const hasExplicitName = /\b(?:aria-label|title)\s*=/i.test(attributes);
    const hasImageName = /<img\b[^>]*\balt\s*=\s*(["'])\s*\S[\s\S]*?\1/i.test(body);
    const text = body.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|lt|gt|quot|#\d+|#x[\da-f]+);/gi, " ").trim();
    assert(hasExplicitName || hasImageName || text.length > 0, relativePath + " contains a link without an accessible name.");
  }
}

function routeForLink(href, currentPageUrl) {
  if (/^(mailto:|tel:)/i.test(href)) return null;
  if (/^javascript:/i.test(href) || decodeURIComponent(href.split(/[?#]/, 1)[0]).split("/").some((part) => part === "..")) {
    throw new Error("Unsafe or traversing output link found: " + href);
  }

  const target = new URL(href, currentPageUrl);
  if (target.origin !== siteOrigin.origin) {
    if (target.protocol !== "https:") {
      throw new Error("External links must use HTTPS: " + href);
    }
    return null;
  }
  return target;
}

const profileDirectory = path.join(repositoryRoot, "src", "content", "profile");
const profile = compilePublicProfile([{
  id: "rory",
  data: await readJson(path.join(profileDirectory, "rory.json")),
}]);
const projectDirectory = path.join(repositoryRoot, "src", "content", "projects");
const projectFileNames = (await readdir(projectDirectory)).filter((name) => name.endsWith(".json")).sort();
const projects = compilePublicProjects(await Promise.all(projectFileNames.map(async (name) => ({
  id: path.basename(name, ".json"),
  data: await readJson(path.join(projectDirectory, name)),
}))));
const outputFiles = await collectFiles(outputDirectory);
const htmlFiles = outputFiles.filter((file) => file.relativePath.endsWith(".html"));

const requiredOutput = [
  "index.html",
  "projects/index.html",
  "projects/john-howard/index.html",
  "projects/mileage-tracker/index.html",
  "projects/bioelectric-simulator/index.html",
  "404.html",
];
for (const relativePath of requiredOutput) {
  assert(outputFiles.some((file) => file.relativePath === relativePath), "Missing static output: " + relativePath);
}

for (const file of htmlFiles) {
  const html = await readFile(file.absolutePath, "utf8");
  const pageUrl = routeUrl(file.relativePath);
  assert.match(html, /<html\b[^>]*\blang="en"/i, file.relativePath + " must declare its language.");
  assert.match(html, /<main\b[^>]*\bid="main-content"/i, file.relativePath + " must provide a main landmark.");
  assert.match(html, /class="skip-link"[^>]*href="#main-content"/i, file.relativePath + " must have a skip link.");
  assert.match(html, /<meta\b[^>]*name="description"/i, file.relativePath + " must include a description.");
  assert.equal([...html.matchAll(/<h1\b/gi)].length, 1, file.relativePath + " must have exactly one H1.");

  for (const imageTag of tagContents(html, "img")) {
    const alt = attributeValues(imageTag, "alt")[0];
    assert(alt && alt.trim(), file.relativePath + " contains an image without useful alt text.");
  }

  for (const href of attributeValues(html, "href")) {
    const target = routeForLink(href, pageUrl);
    if (!target) continue;
    const targetPath = fileForPath(target.pathname);
    assert(outputFiles.some((entry) => path.resolve(entry.absolutePath) === path.resolve(targetPath)), file.relativePath + " links to a missing target: " + href);
    if (target.hash) {
      const targetHtml = await readFile(targetPath, "utf8");
      const ids = new Set([...targetHtml.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]));
      assert(ids.has(decodeURIComponent(target.hash.slice(1))), file.relativePath + " links to a missing fragment: " + href);
    }
  }

  for (const src of attributeValues(html, "src")) {
    const target = routeForLink(src, pageUrl);
    if (!target) continue;
    const targetPath = fileForPath(target.pathname);
    assert(outputFiles.some((entry) => path.resolve(entry.absolutePath) === path.resolve(targetPath)), file.relativePath + " loads a missing asset: " + src);
  }

  assertNamedAnchors(html, file.relativePath);
}

const homeHtml = await readFile(path.join(outputDirectory, "index.html"), "utf8");
for (const sectionId of ["about", "skills", "projects", "experience", "education", "contact"]) {
  assert(homeHtml.includes('id="' + sectionId + '"'), "Homepage is missing required section: " + sectionId);
}

const johnHtml = await readFile(path.join(outputDirectory, "projects", "john-howard", "index.html"), "utf8");
assert.match(johnHtml, /public demo and sanitized repository are pending approval/i);
assert.doesNotMatch(johnHtml, /href="[^"]*(john-howard-demo|john-howard-repository)[^"]*"/i);

const mediaAssets = await validateMediaAssets(projects, outputDirectory);
for (const file of outputFiles) {
  if ([".mp4", ".mov", ".mkv", ".avi", ".webm"].includes(path.extname(file.relativePath).toLowerCase())) {
    const assetPath = "media/" + file.relativePath.replaceAll("\\", "/").replace(/^media\//, "");
    assert(mediaAssets.includes(assetPath), "Video or media output is not approved by the content manifest: " + file.relativePath);
  }
}

const resumeManifest = resumeAssetSchema.parse(await readJson(path.join(repositoryRoot, "src", "content", "resume-asset.json")));
const resumeOutputPath = path.join(outputDirectory, "downloads", resumeManifest.fileName);
const resumeBytes = await readFile(resumeOutputPath);
assert.equal(resumeBytes.length, resumeManifest.byteLength, "Static resume download has the wrong size.");
assert.equal(createHash("sha256").update(resumeBytes).digest("hex"), resumeManifest.sha256, "Static resume download has the wrong SHA-256.");
assert.equal(profile.resumeHref, resumeManifest.href, "Profile resume link and manifest differ.");

const manifest = await readJson(path.join(outputDirectory, "release-manifest.json"));
assert.match(manifest.sourceCommit, /^[a-f0-9]{40,64}$/i, "Release manifest must include a canonical commit SHA.");
assert(manifest.workflowRun && manifest.workflowRun.id, "Release manifest must identify the workflow run or local build.");
const expectedPaths = new Set(outputFiles.filter((file) => file.relativePath !== "release-manifest.json").map((file) => file.relativePath.replaceAll("\\", "/")));
const listedPaths = new Set(manifest.files.map((file) => file.path));
assert.deepEqual([...listedPaths].sort(), [...expectedPaths].sort(), "Release manifest file list does not match the generated artifact.");
for (const record of manifest.files) {
  const target = path.join(outputDirectory, record.path);
  const bytes = await readFile(target);
  assert.equal(bytes.length, record.bytes, "Release manifest byte count mismatch: " + record.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), record.sha256, "Release manifest digest mismatch: " + record.path);
}

console.log("Static output passed: " + htmlFiles.length + " HTML pages, all required routes and links, media policy, resume digest, and release manifest.");
