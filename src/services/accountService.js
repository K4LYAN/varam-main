"use strict";

const { query, transaction } = require("../db/pool");
const authService = require("./authService");
const catalogService = require("./catalogService");
const { MAX_ADDRESSES } = require("../config/defaults");
const { notFound, conflict, badRequest } = require("../utils/httpError");

/* ---------------- Profile ---------------- */

async function updateProfile(userId, { name, phone, defaultAddress, pincode }) {
  const clash = await query("SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1", [phone, userId]);
  if (clash.length) throw conflict("This phone number is already used by another account");
  await query("UPDATE users SET name = ?, phone = ?, default_address = ?, pincode = ? WHERE id = ?", [name, phone, defaultAddress, pincode, userId]);
  return authService.findById(userId);
}

/* ---------------- Address book ---------------- */

const shapeAddress = (a) => ({
  id: a.id,
  label: a.label,
  name: a.recipient_name,
  phone: a.phone,
  address: a.address_line,
  pincode: a.pincode,
  isDefault: Boolean(a.is_default),
});

async function listAddresses(userId) {
  const rows = await query(
    "SELECT id, label, recipient_name, phone, address_line, pincode, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC",
    [userId],
  );
  return rows.map(shapeAddress);
}

/** Keep users.default_address in sync with the default address-book entry (used to prefill checkout). */
async function syncDefault(conn, userId) {
  const [d] = await query("SELECT address_line, pincode FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC LIMIT 1", [userId], conn);
  await query("UPDATE users SET default_address = ?, pincode = ? WHERE id = ?", [d ? d.address_line : null, d ? d.pincode : null, userId], conn);
}

async function addAddress(userId, a) {
  await transaction(async (conn) => {
    // Lock the user's row so two parallel requests cannot both pass the 10-address limit
    await query("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId], conn);
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?", [userId], conn);
    if (Number(n) >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
    const makeDefault = a.isDefault || Number(n) === 0;
    if (makeDefault) await query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], conn);
    await query(
      "INSERT INTO addresses (user_id, label, recipient_name, phone, address_line, pincode, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, a.label, a.name, a.phone, a.address, a.pincode, makeDefault ? 1 : 0],
      conn,
    );
    await syncDefault(conn, userId);
  });
  return listAddresses(userId);
}

async function updateAddress(userId, id, a) {
  await transaction(async (conn) => {
    const [row] = await query("SELECT id FROM addresses WHERE id = ? AND user_id = ? FOR UPDATE", [id, userId], conn);
    if (!row) throw notFound("Address not found");
    if (a.isDefault) await query("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId], conn);
    await query(
      `UPDATE addresses SET label = ?, recipient_name = ?, phone = ?, address_line = ?, pincode = ?${a.isDefault ? ", is_default = 1" : ""}
       WHERE id = ? AND user_id = ?`,
      [a.label, a.name, a.phone, a.address, a.pincode, id, userId],
      conn,
    );
    await syncDefault(conn, userId);
  });
  return listAddresses(userId);
}

async function deleteAddress(userId, id) {
  await transaction(async (conn) => {
    const [row] = await query("SELECT is_default FROM addresses WHERE id = ? AND user_id = ? FOR UPDATE", [id, userId], conn);
    if (!row) return;
    await query("DELETE FROM addresses WHERE id = ? AND user_id = ?", [id, userId], conn);
    if (row.is_default) {
      const [next] = await query("SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1", [userId], conn);
      if (next) await query("UPDATE addresses SET is_default = 1 WHERE id = ?", [next.id], conn);
    }
    await syncDefault(conn, userId);
  });
  return listAddresses(userId);
}

/* ---------------- Wishlist ---------------- */

async function wishlistIds(userId) {
  return (await query("SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY id DESC", [userId])).map((r) => r.product_id);
}

async function addToWishlist(userId, productId) {
  if (!(await catalogService.isActiveProduct(productId))) throw notFound("Product not found");
  await query("INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)", [userId, productId]);
  return wishlistIds(userId);
}

async function removeFromWishlist(userId, productId) {
  await query("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?", [userId, productId]);
  return wishlistIds(userId);
}

module.exports = {
  updateProfile,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  wishlistIds,
  addToWishlist,
  removeFromWishlist,
};
