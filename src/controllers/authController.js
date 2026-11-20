"use strict";

const authService = require("../services/authService");
const validate = require("../validators");
const { issueSession, clearSession } = require("../middleware/auth");

async function login(req, res) {
  const user = await authService.login(validate.login(req.body));
  issueSession(res, user);
  res.json({ user: authService.publicUser(user) });
}

function logout(_req, res) {
  clearSession(res);
  res.json({ ok: true });
}

function me(req, res) {
  res.json({ user: req.user ? authService.publicUser(req.user) : null });
}

/** Change password, sign out every other device, keep this one signed in. */
async function changePassword(req, res) {
  const { current, next } = validate.passwordChange(req.body, req.user);
  const user = await authService.changePassword(req.user.id, current, next);
  issueSession(res, user);
  res.json({ ok: true, user: authService.publicUser(user) });
}

/** Fresh CSRF token for scripts that lost theirs (the cookie is set by middleware). */
function csrfToken(req, res) {
  res.set("Cache-Control", "no-store");
  res.json({ token: req.csrfToken });
}

module.exports = { login, logout, me, changePassword, csrfToken };
