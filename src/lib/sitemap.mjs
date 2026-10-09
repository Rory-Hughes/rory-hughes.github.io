export function publicPageUrls(htmlPaths, siteOrigin) {
  return [...new Set(htmlPaths
    .filter((file) => file.endsWith(".html") && file !== "404.html")
    .map((file) => {
      const route = file === "index.html" ? "/"
        : file.endsWith("/index.html") ? "/" + file.slice(0, -"index.html".length)
          : "/" + file;
      return new URL(route, siteOrigin).href;
    }))].sort();
}

export function sitemapXml(urls) {
  const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((url) => "  <url><loc>" + escapeXml(url) + "</loc></url>").join("\n")
    + "\n</urlset>\n";
}
