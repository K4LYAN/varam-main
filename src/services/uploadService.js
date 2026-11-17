"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const { HttpError, badRequest } = require("../utils/httpError");

/**
 * Identify an image by its magic bytes (the file's real content), never by the
 * file name or the Content-Type the browser claims.
 */
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Save an uploaded product image under a random name; returns its public URL. */
async function saveProductImage(file) {
  if (!file) throw badRequest("Choose an image to upload");
  const ext = sniffImage(file.buffer);
  if (!ext) throw new HttpError(415, "Only JPG, PNG or WebP images are allowed", { code: "UNSUPPORTED_MEDIA" });
  const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, name), file.buffer, { flag: "wx", mode: 0o644 });
  return `/uploads/${name}`;
}

module.exports = { sniffImage, saveProductImage };
