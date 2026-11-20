"use strict";

const express = require("express");
const { health } = require("../controllers/healthController");
const { apiLimiter, sameOrigin } = require("../middleware/security");
const { verifyCsrfToken } = require("../middleware/csrf");
const { notFound } = require("../middleware/errorHandler");

const api = express.Router();

// Health first: no rate limit, no session work — cheap for uptime monitors
api.get("/health", health);

api.use(apiLimiter);
api.use(sameOrigin); // CSRF layer 1: Origin/Referer must be this site
api.use(verifyCsrfToken); // CSRF layer 2: double-submit token on every state-changing call

api.use("/auth", require("./auth"));
api.use("/", require("./catalog"));
api.use("/", require("./checkout"));
api.use("/admin", require("./admin"));
api.use(notFound);

module.exports = api;
