"use strict";

/** The Varam Express app: security headers, compression, pages, JSON API and static files. */
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");

const pages = require("./routes/pages");
const api = require("./routes/api");

const PUBLIC = path.join(__dirname, "..", "public");
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    // The pages use Google Fonts, Unsplash photos and a Google Maps embed
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

app.use("/api", api);
app.use(pages);
app.use(
  express.static(PUBLIC, {
    extensions: ["html"],
    setHeaders(res, file) {
      // Pages, styles and scripts: browsers check for a new version on every visit (a quick
      // 304 when nothing changed), so a deploy shows up immediately. Images and fonts
      // rarely change, so they may be kept for a week.
      const longLived = /\.(jpe?g|png|webp|gif|svg|ico|woff2?)$/i.test(file);
      res.set("Cache-Control", longLived ? "public, max-age=604800" : "no-cache");
    },
  })
);

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, "404.html")));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[varam]", err);
  res.status(err.status || 500).send("Something went wrong. Please try again.");
});

module.exports = app;
