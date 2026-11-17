"use strict";

const config = require("../config");
const { query, queryRaw, transaction } = require("../db/pool");
const auditService = require("./auditService");
const { DEFAULT_SETTINGS } = require("../config/defaults");

let cache = null;
let cachedAt = 0;
let inflight = null;

/** All settings (defaults overlaid with saved values), cached briefly per process. */
async function getSettings() {
  if (cache && Date.now() - cachedAt < config.settingsCacheMs) return cache;
  if (!inflight) {
    inflight = query("SELECT setting_key, setting_value FROM site_settings")
      .then((rows) => {
        const s = { ...DEFAULT_SETTINGS };
        for (const r of rows) s[r.setting_key] = r.setting_value;
        cache = Object.freeze(s);
        cachedAt = Date.now();
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Upsert several settings in one statement. */
async function setSettings(values, conn) {
  const rows = Object.entries(values).map(([k, v]) => [k, String(v)]);
  if (rows.length) {
    await queryRaw(
      "INSERT INTO site_settings (setting_key, setting_value) VALUES ? ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [rows],
      conn,
    );
  }
  invalidate();
}

/** Admin save: upsert + audit entry (only changed keys) in one transaction. */
async function updateSettings(ctx, values) {
  await transaction(async (conn) => {
    const rows = await query("SELECT setting_key, setting_value FROM site_settings FOR UPDATE", [], conn);
    const before = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
    await setSettings(values, conn);
    const d = auditService.diff(
      Object.fromEntries(Object.keys(values).map((k) => [k, before[k] ?? null])),
      Object.fromEntries(Object.entries(values).map(([k, val]) => [k, String(val)])),
    );
    if (Object.keys(d.after).length) {
      await auditService.record(conn, ctx, { action: "settings.update", entityType: "settings", summary: Object.keys(d.after).join(", "), ...d });
    }
  });
  invalidate();
  return getSettings();
}

function invalidate() {
  cache = null;
}

/** Settings that are safe to expose to the browser. */
function publicSettings(s) {
  let testimonials = [];
  try {
    testimonials = JSON.parse(s.testimonials || "[]");
  } catch {
    testimonials = [];
  }
  return {
    announcement: s.announcement,
    freeDeliveryThreshold: Number(s.free_delivery_threshold) || 0,
    deliveryFee: Number(s.delivery_fee) || 0,
    storeName: s.store_name,
    storeAddress: s.store_address,
    storePhone: s.store_phone,
    whatsappNumber: s.whatsapp_number,
    storePhone2: s.store_phone_2 || "",
    emails: { primary: s.email_primary || "", info: s.email_info || "", support: s.email_support || "" },
    storeHours: s.store_hours,
    mapsUrl: s.maps_url,
    upiId: s.upi_id,
    instagramUrl: s.instagram_url,
    googleRating: Number(s.google_rating) || 0,
    googleReviewCount: Number(s.google_review_count) || 0,
    googleReviewsUrl: s.google_reviews_url,
    testimonials: Array.isArray(testimonials) ? testimonials : [],
  };
}

module.exports = { getSettings, setSettings, updateSettings, publicSettings, invalidate };
