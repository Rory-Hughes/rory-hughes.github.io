import assert from "node:assert/strict";
import test from "node:test";
import { publicPageUrls, sitemapXml } from "../src/lib/sitemap.mjs";

test("the sitemap includes built public routes once and excludes the error page and assets", () => {
  const urls = publicPageUrls([
    "index.html", "education/index.html", "projects/john-howard/index.html",
    "education/index.html", "404.html", "social/portfolio-preview.png",
  ], "https://rory-hughes.github.io");
  assert.deepEqual(urls, [
    "https://rory-hughes.github.io/",
    "https://rory-hughes.github.io/education/",
    "https://rory-hughes.github.io/projects/john-howard/",
  ]);
  assert.doesNotMatch(sitemapXml(urls), /404|portfolio-preview/);
  assert.match(sitemapXml(["https://example.com/?a=1&b=2"]), /a=1&amp;b=2/);
});
