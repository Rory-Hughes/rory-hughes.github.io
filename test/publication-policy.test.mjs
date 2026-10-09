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

test("John Howard publishes only the owner-approved walkthrough without fabricated repository links", async () => {
  const johnHoward = projectEntries.find((entry) => entry.id === "john-howard").data;
  assert.match(johnHoward.currentStatus, /synthetic-data prototype/i);
  assert.match(johnHoward.linkFallback, /pending/i);
  assert.deepEqual(johnHoward.links, []);
  const published = johnHoward.media.filter((slot) => slot.availability === "published");
  assert.equal(published.length, 1);
  assert.equal(published[0].assetPath, "media/john-howard-application-walkthrough.mp4");
  assert.equal(published[0].publicationState, "public");
  assert.equal(published[0].reviewStatus, "approved");
  assert(published[0].altText && published[0].caption && published[0].transcript);
  const bytes = await readFile(path.join(repositoryRoot, "public", published[0].assetPath));
  assert.equal(bytes.length, 8701124);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "65fc7b3093b594e72e4643a591f230705c9c1f382d3efb2364812ef90dd5a1fe");
});

test("the five approved MileageTracker recordings include classification without a redundant placeholder", async () => {
  const mileage = projectEntries.find((entry) => entry.id === "mileage-tracker").data;
  const expectedAssets = [
    "media/mileage-dashboard-trip-review.mp4",
    "media/mileage-manual-tracking.mp4",
    "media/mileage-reports-logbook.mp4",
    "media/mileage-settings-and-vehicles.mp4",
    "media/mileage-trip-records.mp4",
  ];
  const expectedAssetDigests = new Map([
    ["media/mileage-dashboard-trip-review.mp4", "2ebf79229ac0cf71fae6b66b2f8309b6ad832a20c6a805ef5077908ed7358400"],
    ["media/mileage-manual-tracking.mp4", "ef6aaa84ed840f99e2a5bc3f1686b15bda115f0f9f676fa29e658ba2df77f4f8"],
    ["media/mileage-reports-logbook.mp4", "90c30daf439f9578893b7c0dd773414acf31f5399144cbb6c01e0f5c16f69736"],
    ["media/mileage-settings-and-vehicles.mp4", "6f9caec5718b06e324c9140ab8355f70a94140370704e12a1ab0683498db17ac"],
    ["media/mileage-trip-records.mp4", "dbe9dcb9d4fcbdbf46b3b78933bac4064c8e6f334e029594e1a9a073b3d69ec1"],
  ]);
  const publishedVideos = mileage.media.filter((slot) => slot.kind === "video" && slot.availability === "published");
  const tripCapture = mileage.media.find((slot) => slot.id === "trip-capture");

  assert.equal(publishedVideos.length, 5);
  assert(publishedVideos.every((slot) => slot.publicationState === "public" && slot.reviewStatus === "approved"));
  assert(publishedVideos.every((slot) => slot.assetPath && slot.altText && slot.caption && slot.transcript));
  assert.deepEqual(publishedVideos.map((slot) => slot.assetPath).sort(), expectedAssets);
  assert.equal(mileage.media.length, 5);
  assert(!mileage.media.some((slot) => slot.availability === "fallback"));
  assert.match(tripCapture.caption, /classify.*business or personal/i);
  assert.match(tripCapture.transcript, /Trip Details/i);
  assert.deepEqual([...expectedAssetDigests.keys()].sort(), expectedAssets);
  for (const [assetPath, expectedDigest] of expectedAssetDigests) {
    const bytes = await readFile(path.join(repositoryRoot, "public", assetPath));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      expectedDigest,
      assetPath + " must match the exact video bytes approved for publication.",
    );
  }
  assert.deepEqual(
    await validateMediaAssets(compilePublicProjects(projectEntries), path.join(repositoryRoot, "public")),
    ["media/john-howard-application-walkthrough.mp4", ...expectedAssets],
  );
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
  delete publishedVideo.transcript;
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
