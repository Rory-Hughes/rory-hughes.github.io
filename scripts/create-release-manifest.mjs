import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "dist");
const manifestPath = path.join(outputDirectory, "release-manifest.json");

async function collectFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error("Build output may not contain symbolic links: " + relativePath);
    }
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath));
    } else if (entry.isFile() && relativePath !== "release-manifest.json") {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

let sourceCommit = process.env.GITHUB_SHA;
if (!sourceCommit) {
  sourceCommit = gitOutput(["rev-parse", "HEAD"]);
}
if (!/^[a-f0-9]{40,64}$/i.test(sourceCommit)) {
  throw new Error("The release manifest requires a canonical source commit SHA.");
}

const isWorkingTreeDirty = gitOutput(["status", "--porcelain", "--untracked-files=all"]).length > 0;
const runId = process.env.GITHUB_RUN_ID ?? "local";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
const workflowRunUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? process.env.GITHUB_SERVER_URL + "/" + process.env.GITHUB_REPOSITORY + "/actions/runs/" + process.env.GITHUB_RUN_ID
  : null;
const files = await collectFiles(outputDirectory);
const records = [];

for (const file of files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
  const details = await lstat(file.absolutePath);
  const bytes = await readFile(file.absolutePath);
  records.push({
    path: file.relativePath.replaceAll("\\", "/"),
    bytes: details.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const manifest = {
  schemaVersion: 1,
  sourceCommit,
  sourceRef: process.env.GITHUB_REF ?? "local-working-tree",
  workingTreeDirty: isWorkingTreeDirty,
  workflowRun: {
    id: runId,
    attempt: runAttempt,
    url: workflowRunUrl,
  },
  files: records,
};

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("Release manifest created for " + records.length + " output files.");
