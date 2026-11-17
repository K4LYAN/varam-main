"use strict";

const path = require("path");
const config = require("../config");
const { HttpError } = require("../utils/httpError");

const VIEWS = path.join(config.root, "views");
const isApi = (req) => req.originalUrl.startsWith("/api");

/** 404 for unknown API routes (JSON) and pages (HTML). */
function notFound(req, res) {
  if (isApi(req)) return res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
  res.status(404).sendFile(path.join(VIEWS, "404.html"));
}

/** Translate known framework/database errors into HTTP statuses. */
function statusOf(err) {
  if (err instanceof HttpError) return err.status;
  if (err.type === "entity.parse.failed") return 400;
  if (err.type === "entity.too.large") return 413;
  if (err.code === "POOL_ENQUEUELIMIT" || err.code === "ER_CON_COUNT_ERROR" || err.code === "ER_TOO_MANY_USER_CONNECTIONS") return 503;
  if (err.code === "ER_LOCK_DEADLOCK" || err.code === "ER_LOCK_WAIT_TIMEOUT") return 503;
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 600) return err.status;
  return 500;
}

function messageOf(err, status) {
  if (err instanceof HttpError && err.expose) return err.message;
  if (status === 400) return "The request could not be read.";
  if (status === 413) return "The request is too large.";
  if (status === 503) return "The store is busy right now. Please try again in a moment.";
  if (status < 500 && err.expose !== false && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/**
 * Central error handler. Express 5 forwards rejected promises from async
 * handlers here, so a failing request never takes the process down.
 * Stack traces are logged on the server only, never sent to clients.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = statusOf(err);
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} → ${status}`, config.isProd ? err.message : err);
    if (config.isProd && err.stack) console.error(err.stack);
  }
  if (res.headersSent) return res.end();
  const body = { error: messageOf(err, status) };
  if (err.code && err instanceof HttpError) body.code = err.code;
  if (err.field) body.field = err.field;
  if (err.details) body.details = err.details;
  if (status === 503) res.set("Retry-After", "5");
  if (isApi(req)) return res.status(status).json(body);
  res.status(status).type("text").send(body.error);
}

module.exports = { notFound, errorHandler };
