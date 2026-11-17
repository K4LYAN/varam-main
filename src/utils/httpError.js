"use strict";

/**
 * Errors that carry an HTTP status. Services throw these; the central error
 * handler turns them into JSON (API) or plain text (pages).
 */
class HttpError extends Error {
  constructor(status, message, { code, field, details, expose = true } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.details = details;
    this.expose = expose;
  }
}

class ValidationError extends HttpError {
  constructor(message, field) {
    super(400, message, { code: "VALIDATION", field });
    this.name = "ValidationError";
  }
}

const badRequest = (message, opts) => new HttpError(400, message, { code: "BAD_REQUEST", ...opts });
const unauthorized = (message = "Please sign in") => new HttpError(401, message, { code: "UNAUTHORIZED" });
const forbidden = (message = "Not allowed", code = "FORBIDDEN") => new HttpError(403, message, { code });
const notFound = (message = "Not found") => new HttpError(404, message, { code: "NOT_FOUND" });
const conflict = (message, details) => new HttpError(409, message, { code: "CONFLICT", details });

/** Map a MySQL duplicate-key error to a friendly 409; rethrow anything else. */
function rethrowDuplicate(err, what) {
  if (err && err.code === "ER_DUP_ENTRY") throw conflict(`Another ${what} already uses this value`);
  throw err;
}

module.exports = { HttpError, ValidationError, badRequest, unauthorized, forbidden, notFound, conflict, rethrowDuplicate };
