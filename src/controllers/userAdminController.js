"use strict";

const userAdminService = require("../services/userAdminService");
const auditService = require("../services/auditService");
const validate = require("../validators");
const { id } = require("../utils/validate");

const ctx = auditService.contextFrom;

async function list(req, res) {
  res.json(await userAdminService.list(validate.userListQuery(req.query)));
}

async function detail(req, res) {
  res.json({ user: await userAdminService.detail(id(req.params.id)) });
}

/** Returns the generated temporary password once (null when the admin typed one). */
async function create(req, res) {
  res.status(201).json(await userAdminService.create(ctx(req), validate.userCreate(req.body)));
}

async function update(req, res) {
  res.json({ user: await userAdminService.update(ctx(req), id(req.params.id), validate.userDetails(req.body)) });
}

async function setRole(req, res) {
  res.json({ user: await userAdminService.setRole(ctx(req), id(req.params.id), validate.userRole(req.body)) });
}

async function setStatus(req, res) {
  res.json({ user: await userAdminService.setStatus(ctx(req), id(req.params.id), validate.userStatus(req.body)) });
}

async function resetPassword(req, res) {
  res.json(await userAdminService.resetPassword(ctx(req), id(req.params.id), validate.optionalPassword(req.body.password)));
}

async function revokeSessions(req, res) {
  res.json({ user: await userAdminService.revokeSessions(ctx(req), id(req.params.id)) });
}

async function remove(req, res) {
  await userAdminService.remove(ctx(req), id(req.params.id));
  res.json({ ok: true });
}

module.exports = { list, detail, create, update, setRole, setStatus, resetPassword, revokeSessions, remove };
