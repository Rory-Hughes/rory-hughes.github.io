import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createBrowserDraftStore } from "../src/lib/browser-draft-store.mjs";
import {
  extractCSharpBlock,
  extractCSharpBlocks,
  extractCodeBlock,
  extractCodeBlocks,
} from "../src/lib/code-excerpt-content.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(path.join(repositoryRoot, "src/data/john-howard-excerpts.json"), "utf8"),
);
const mileageCatalog = JSON.parse(
  await readFile(path.join(repositoryRoot, "src/data/mileage-tracker-excerpts.json"), "utf8"),
);
const mileageProject = JSON.parse(
  await readFile(path.join(repositoryRoot, "src/content/projects/mileage-tracker.json"), "utf8"),
);
const bioelectricCatalog = JSON.parse(
  await readFile(path.join(repositoryRoot, "src/data/bioelectric-simulator-excerpts.json"), "utf8"),
);
const bioelectricProject = JSON.parse(
  await readFile(path.join(repositoryRoot, "src/content/projects/bioelectric-simulator.json"), "utf8"),
);

test("John Howard code excerpt catalog has six unique cards and supporting sections", async () => {
  assert.equal(catalog.length, 6);
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((item) => item.afterHeading)).size, catalog.length);

  for (const excerpt of catalog) {
    assert.ok(excerpt.title.trim());
    assert.ok(excerpt.description.trim());
    assert.ok(excerpt.sourcePath.trim());
    assert.ok(Number.isInteger(excerpt.previewFenceIndex));
    const source = await readFile(path.join(repositoryRoot, excerpt.contentPath), "utf8");
    assert.ok(source.startsWith("# "));
    assert.ok(extractCSharpBlock(source, excerpt.previewFenceIndex).trim().length > 20);
    assert.ok(extractCSharpBlocks(source).length > excerpt.previewFenceIndex);
  }
});

test("C# fence parser handles CRLF, aliases, and empty-block rejection", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const markdown = [
    fence + "cs",
    "public sealed class Example {}",
    fence,
    "",
    fence + "csharp",
    "return true;",
    fence,
  ].join("\r\n");

  assert.deepEqual(extractCSharpBlocks(markdown), [
    "public sealed class Example {}",
    "return true;",
  ]);
  assert.throws(() => extractCSharpBlock(fence + "csharp\r\n\r\n" + fence), /missing or empty/);
});

test("MileageTracker excerpt cards map to published demos and contain Kotlin source", async () => {
  assert.equal(mileageCatalog.length, 5);
  assert.equal(new Set(mileageCatalog.map((item) => item.id)).size, mileageCatalog.length);
  assert.equal(new Set(mileageCatalog.map((item) => item.mediaId)).size, mileageCatalog.length);

  const publishedVideos = new Set(
    mileageProject.media
      .filter((item) => item.kind === "video" && item.availability === "published")
      .map((item) => item.id),
  );

  for (const excerpt of mileageCatalog) {
    assert.ok(publishedVideos.has(excerpt.mediaId), excerpt.id + " points to a published demo video");
    assert.equal(excerpt.language, "kotlin");
    assert.ok(excerpt.title.trim());
    assert.ok(excerpt.description.trim());
    assert.ok(excerpt.sourcePath.trim());
    assert.match(excerpt.sourceHref, /^https:\/\/github\.com\/Rory-Hughes\/MilageTracker\/blob\/main\//);
    assert.ok(Number.isInteger(excerpt.previewFenceIndex));
    const source = await readFile(path.join(repositoryRoot, excerpt.contentPath), "utf8");
    assert.ok(source.startsWith("# "));
    assert.ok(extractCodeBlock(source, excerpt.language, excerpt.previewFenceIndex).trim().length > 100);
  }
});

test("Bioelectric excerpts use public Python sources and preserve the research boundary", async () => {
  assert.equal(bioelectricCatalog.length, 4);
  assert.equal(new Set(bioelectricCatalog.map((item) => item.id)).size, bioelectricCatalog.length);
  assert.deepEqual(bioelectricProject.technologies, ["Python", "NumPy", "Matplotlib", "pytest"]);
  assert.ok(bioelectricProject.links.some((link) =>
    link.kind === "repository" &&
    link.href === "https://github.com/Rory-Hughes/simple-multicellular-bioelectric-simulator",
  ));
  assert.match(bioelectricProject.evidence.join(" "), /do not compare results with the cited paper/i);

  for (const excerpt of bioelectricCatalog) {
    assert.equal(excerpt.language, "python");
    assert.ok(excerpt.title.trim());
    assert.ok(excerpt.description.trim());
    assert.match(excerpt.sourceHref, /^https:\/\/github\.com\/Rory-Hughes\/simple-multicellular-bioelectric-simulator\/blob\/master\/.+#L\d+-L\d+$/);
    const source = await readFile(path.join(repositoryRoot, excerpt.contentPath), "utf8");
    assert.ok(source.startsWith("# "));
    assert.match(source, /Source: \[.+\]\(https:\/\/github\.com\/Rory-Hughes\/simple-multicellular-bioelectric-simulator\//);
    assert.ok(extractCodeBlock(source, "python", excerpt.previewFenceIndex).trim().length > 100);
  }
});

test("language-aware fence parser accepts Kotlin aliases and tilde fences", () => {
  const tickFence = String.fromCharCode(96).repeat(3);
  const markdown = [
    "~~~kt",
    "fun classifyTrip() = true",
    "~~~",
    "",
    tickFence + "kotlin",
    "fun openTripDetails() = Unit",
    tickFence,
  ].join("\n");

  assert.deepEqual(extractCodeBlocks(markdown, "kotlin"), [
    "fun classifyTrip() = true",
    "fun openTripDetails() = Unit",
  ]);
  assert.throws(() => extractCodeBlock(markdown, "kotlin", 2), /missing or empty/);
});

test("language-aware fence parser accepts Python aliases and tilde fences", () => {
  const markdown = [
    "~~~py",
    "def first(): return 1",
    "~~~",
    "",
    "```python",
    "def second(): return 2",
    "```",
  ].join("\n");

  assert.deepEqual(extractCodeBlocks(markdown, "python"), [
    "def first(): return 1",
    "def second(): return 2",
  ]);
});

test("browser draft storage restores saved edits and falls back to session memory when storage throws", () => {
  const values = new Map();
  const storage = () => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  const firstVisit = createBrowserDraftStore(storage);
  assert.deepEqual(firstVisit.read("excerpt-a"), { value: null, storageAvailable: true });
  assert.deepEqual(firstVisit.write("excerpt-a", "edited Markdown"), { saved: true, storageAvailable: true });
  assert.deepEqual(createBrowserDraftStore(storage).read("excerpt-a"), { value: "edited Markdown", storageAvailable: true });

  const unavailable = () => ({
    getItem: () => { throw new Error("Storage denied"); },
    setItem: () => { throw new Error("Storage denied"); },
    removeItem: () => { throw new Error("Storage denied"); },
  });
  const sessionOnly = createBrowserDraftStore(unavailable);
  assert.deepEqual(sessionOnly.read("excerpt-b"), { value: null, storageAvailable: false });
  sessionOnly.retain("excerpt-b", "original Markdown");
  assert.deepEqual(sessionOnly.write("excerpt-b", "session edit"), { saved: false, storageAvailable: false });
  assert.deepEqual(sessionOnly.read("excerpt-b"), { value: "session edit", storageAvailable: false });
  assert.deepEqual(sessionOnly.clear("excerpt-b"), { cleared: false, storageAvailable: false });
});
