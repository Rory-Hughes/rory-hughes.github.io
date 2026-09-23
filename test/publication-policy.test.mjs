import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { projectSchema, resumeAssetSchema } from "../src/lib/content-contract.mjs";
import { isPublicMediaSizeValid, validateMediaAssets, videoMimeType } from "../src/lib/media-policy.mjs";
import { compilePublicProfile, compilePublicProjects } from "../src/lib/publication-compiler.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));
}

const profile = await readJson("src/content/profile/rory.json");
const projectFiles = [
  "src/content/projects/john-howard.json",
  "src/content/projects/mileage-tracker.json",
  "src/content/projects/bioelectric-simulator.json",
];
const projectEntries = await Promise.all(projectFiles.map(async (relativePath) => {
  const data = await readJson(relativePath);
  return { id: data.slug, data };
}));

test("the public profile must be explicit and use its stable collection ID", () => {
  assert.equal(compilePublicProfile([{ id: "rory", data: profile }]).displayName, "Rory Hughes");
  assert.throws(() => compilePublicProfile([{ id: "someone-else", data: profile }]), /stable rory ID/);
  assert.throws(() => compilePublicProfile([{ id: "rory", data: { ...profile, publicationState: "deferred" } }]), /explicitly marked public/);
  assert.throws(() => compilePublicProfile([]), /Exactly one profile/);
});

test("public project compilation validates stable IDs and excludes deferred records", () => {
  const deferredEntries = projectEntries.map((entry) => entry.data.slug === "bioelectric-simulator"
    ? { ...entry, data: { ...entry.data, publicationState: "deferred" } }
    : entry);
  const publicProjects = compilePublicProjects(deferredEntries);

  assert.equal(publicProjects.length, 2);
  assert(!publicProjects.some((project) => project.slug === "bioelectric-simulator"));
  assert.deepEqual(
    compilePublicProjects([...projectEntries].reverse()).map((project) => project.slug),
    ["john-howard", "mileage-tracker", "bioelectric-simulator"],
  );
  assert.throws(() => compilePublicProjects([{ ...projectEntries[0], id: "wrong-slug" }]), /must match its stable slug/);
  assert.throws(() => compilePublicProjects([projectEntries[0], projectEntries[0]]), /must be unique/);
  assert.throws(() => compilePublicProjects([{ ...projectEntries[0], data: { ...projectEntries[0].data, unexpected: true } }]), /Unrecognized key/);
});

test("John Howard stays text-first with no fabricated demo or repository links", () => {
  const johnHoward = projectEntries.find((entry) => entry.id === "john-howard").data;
  assert.match(johnHoward.currentStatus, /synthetic-data prototype/i);
  assert.match(johnHoward.linkFallback, /pending/i);
  assert.deepEqual(johnHoward.links, []);
  assert(johnHoward.media.every((slot) => slot.availability !== "published" && !slot.assetPath && slot.fallbackText.length >= 24));
});

test("the supplied MileageTracker screen recording is withheld behind text fallbacks", async () => {
  const mileage = projectEntries.find((entry) => entry.id === "mileage-tracker").data;
  assert(mileage.media.some((slot) => slot.kind === "video" && slot.reviewStatus === "withheld"));
  assert(mileage.media.every((slot) => slot.availability !== "published" && !slot.assetPath));
  assert.deepEqual(await validateMediaAssets(compilePublicProjects(projectEntries), path.join(repositoryRoot, "public")), []);
});

test("published media cannot pass without explicit privacy approval", () => {
  const johnHoward = projectEntries.find((entry) => entry.id === "john-howard").data;
  const unreviewedMedia = {
    id: "unreviewed-image",
    label: "Unreviewed project image",
    kind: "image",
    availability: "published",
    publicationState: "public",
    reviewStatus: "pending",
    assetPath: "media/unreviewed.png",
    altText: "A project image whose privacy review is unfinished.",
    caption: "An image cannot be released until privacy review is complete.",
    fallbackText: "The text fallback remains available while review is pending.",
  };

  assert.throws(() => projectSchema.parse({ ...johnHoward, media: [unreviewedMedia] }), /manual privacy review/);
});

test("published videos require an accessible transcript in both validators", async () => {
  const mileage = projectEntries.find((entry) => entry.id === "mileage-tracker").data;
  const publishedVideo = {
    ...mileage.media[0],
    availability: "published",
    publicationState: "public",
    reviewStatus: "approved",
    assetPath: "media/approved-demo.mp4",
    altText: "A synthetic-data demonstration of the mileage application.",
    caption: "A reviewed synthetic-data application walkthrough.",
  };
  const project = { ...mileage, media: [publishedVideo] };

  assert.throws(() => projectSchema.parse(project), /Published recordings require a concise transcript/);
  await assert.rejects(
    validateMediaAssets([project], path.join(repositoryRoot, "public")),
    /missing its accessible transcript/,
  );
});

test("public media size limit is strict and rejects invalid sizes", () => {
  const limit = 100 * 1024 * 1024;
  assert.equal(isPublicMediaSizeValid(limit - 1), true);
  assert.equal(isPublicMediaSizeValid(limit), false);
  assert.equal(isPublicMediaSizeValid(limit + 1), false);
  assert.equal(isPublicMediaSizeValid(-1), false);
  assert.equal(isPublicMediaSizeValid(Number.NaN), false);
});

test("reviewed media must be referenced, correctly signed, and traversal-free", async (context) => {
  const scratchRoot = await mkdtemp(path.join(os.tmpdir(), "portfolio-media-policy-"));
  context.after(async () => rm(scratchRoot, { recursive: true, force: true }));

  const mediaDirectory = path.join(scratchRoot, "media");
  await mkdir(mediaDirectory);
  const safeImage = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const approvedProject = {
    slug: "test-project",
    media: [{
      id: "approved-image",
      label: "Reviewed synthetic image",
      kind: "image",
      availability: "published",
      publicationState: "public",
      reviewStatus: "approved",
      assetPath: "media/privacy-safe.png",
      altText: "A synthetic project screenshot with no personal data.",
      caption: "A reviewed synthetic screenshot created for this portfolio.",
      fallbackText: "This fallback is retained for unsupported media clients.",
    }],
  };
  await writeFile(path.join(mediaDirectory, "privacy-safe.png"), safeImage);
  assert.deepEqual(await validateMediaAssets([approvedProject], scratchRoot), ["media/privacy-safe.png"]);

  await writeFile(path.join(mediaDirectory, "unreferenced.png"), safeImage);
  await assert.rejects(validateMediaAssets([approvedProject], scratchRoot), /Unreferenced public media file/);
  await rm(path.join(mediaDirectory, "unreferenced.png"));

  const traversalProject = {
    ...approvedProject,
    media: [{ ...approvedProject.media[0], assetPath: "media/..\\private.png" }],
  };
  await assert.rejects(validateMediaAssets([traversalProject], scratchRoot), /safe path/);

  await writeFile(path.join(mediaDirectory, "privacy-safe.png"), Buffer.from("not an image"));
  await assert.rejects(validateMediaAssets([approvedProject], scratchRoot), /signature does not match/);
});

test("video MIME type follows a case-insensitive file extension", () => {
  assert.equal(videoMimeType("media/demo.webm"), "video/webm");
  assert.equal(videoMimeType("media/demo.WEBM"), "video/webm");
  assert.equal(videoMimeType("media/demo.MP4"), "video/mp4");
});

test("credential scanning accepts clean text and rejects a synthetic credential", async (context) => {
  const fixtureRoot = await mkdtemp(path.join(repositoryRoot, ".portfolio-secret-scan-"));
  const fixturePath = path.join(fixtureRoot, "synthetic-credential.md");
  const validatorPath = path.join(repositoryRoot, "scripts", "validate-content.mjs");
  context.after(async () => rm(fixtureRoot, { recursive: true, force: true }));

  const runContentCheck = () => spawnSync(process.execPath, [validatorPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });

  await writeFile(fixturePath, "No credential is present in this clean fixture.\n");
  const cleanRun = runContentCheck();
  assert.equal(cleanRun.status, 0, cleanRun.stderr);

  const syntheticCredential = "AIza" + "A".repeat(32);
  await writeFile(fixturePath, syntheticCredential + "\n");
  const rejectedRun = runContentCheck();
  assert.notEqual(rejectedRun.status, 0, "a credential-like fixture must fail the publication check");
  assert.match(rejectedRun.stderr, /credential-like value was found in \.portfolio-secret-scan-/);
});

test("the public resume matches its pinned unchanged DOCX digest", async () => {
  const manifest = resumeAssetSchema.parse(await readJson("src/content/resume-asset.json"));
  const resumeBytes = await readFile(path.join(repositoryRoot, "public", "downloads", manifest.fileName));

  assert.equal(resumeBytes.length, manifest.byteLength);
  assert.equal(createHash("sha256").update(resumeBytes).digest("hex"), manifest.sha256);
});

test("Pages builds only on manual dispatch and deploys only with an explicit main-branch choice", async () => {
  const workflowText = await readFile(path.join(repositoryRoot, ".github", "workflows", "pages.yml"), "utf8");
  const workflow = parseYaml(workflowText);
  const dispatchInput = workflow.on.workflow_dispatch.inputs.deploy_now;
  const deploymentCondition = workflow.jobs.deploy.if;

  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.on.pull_request, undefined);
  assert.equal(dispatchInput.type, "boolean");
  assert.equal(dispatchInput.required, true);
  assert.equal(dispatchInput.default, false);
  assert.equal(deploymentCondition, "${{ inputs.deploy_now && github.ref == 'refs/heads/main' }}");

  const mayDeploy = (deployNow, ref) => deployNow === true && ref === "refs/heads/main";
  assert.equal(mayDeploy(dispatchInput.default, "refs/heads/main"), false);
  assert.equal(mayDeploy(true, "refs/heads/feature"), false);
  assert.equal(mayDeploy(true, "refs/heads/main"), true);

  assert.equal(workflow.jobs.build.steps[0].uses, "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
  assert.equal(workflow.jobs.build.steps[1].uses, "withastro/action@3eafd002e65cc31b4f0eae0bb05450d521562247");
  assert.equal(workflow.jobs.deploy.steps[0].uses, "actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346");
  assert.equal(workflow.jobs.deploy.environment.name, "github-pages");
});
