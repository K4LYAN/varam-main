"use strict";

/**
 * Tiny static file server for hosts that run the site as a Node.js app
 * (e.g. MilesWeb mPanel runs `npm start`). No dependencies, no database.
 * On plain static hosting this file is not needed.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
// Never serve these, even if they sit next to the site files
const PRIVATE = /(^|\/)(\.|node_modules\/|server\.js$|package(-lock)?\.json$|README\.md$)/;

function resolve(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  p = path.posix.normalize(p).replace(/^\/+/, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  if (PRIVATE.test(p)) return null;
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep)) return null;
  // /shop → shop.html, /product/x → products/x.html (old links)
  for (const f of [file, file + ".html", path.join(ROOT, p.replace(/^product\//, "products/") + ".html")]) {
    try {
      if (fs.statSync(f).isFile()) return f;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

function send(res, status, file) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    // Old store pages that no longer exist
    if (/^\/(login|register|account|admin)(\/|$|\?)/.test(req.url)) {
      res.writeHead(301, { Location: "/" });
      return res.end();
    }
    const file = resolve(req.url);
    if (file) return send(res, 200, file);
    send(res, 404, path.join(ROOT, "404.html"));
  })
  .listen(PORT, () => console.log(`[varam] static site on port ${PORT}`));
