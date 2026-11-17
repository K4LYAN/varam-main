"use strict";

const { query } = require("../db");
const { DEFAULT_SETTINGS } = require("../migrate");

let cache = null;
let cachedAt = 0;
const TTL_MS = 30 * 1000;

async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const rows = await query("SELECT setting_key, setting_value FROM site_settings");
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.setting_key] = r.setting_value;
  cache = s;
  cachedAt = Date.now();
  return s;
}

async function setSettings(values) {
  for (const [k, v] of Object.entries(values)) {
    await query(
      "INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [k, String(v)],
    );
  }
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

module.exports = { getSettings, setSettings, publicSettings };
