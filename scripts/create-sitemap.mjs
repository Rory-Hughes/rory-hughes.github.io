import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../astro.config.mjs";
import { publicPageUrls, sitemapXml } from "../src/lib/sitemap.mjs";

const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url));

async function htmlPaths(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await htmlPaths(path.join(directory, entry.name), relativePath));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(relativePath);
  }
  return files;
}

// Read the built artifact so deferred projects and error pages never become sitemap entries.
const urls = publicPageUrls(await htmlPaths(outputDirectory), config.site);
await writeFile(path.join(outputDirectory, "sitemap.xml"), sitemapXml(urls));
console.log("Sitemap generated for " + urls.length + " public pages.");
