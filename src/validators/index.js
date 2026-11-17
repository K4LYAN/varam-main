"use strict";

/**
 * Request-body parsers. Each returns a clean, typed object or throws a
 * ValidationError (400). Fields the server computes itself — prices, totals,
 * discounts — are never read from the request.
 */
const v = require("../utils/validate");
const { normaliseItems } = require("../services/pricingService");
const { FULFILLMENT_TYPES, PAYMENT_METHODS, HOME_COUNTRY, MAX_QTY } = require("../config/defaults");

// Passwords that appear at the top of every breach list (and obvious store-specific ones)
const COMMON_PASSWORDS = new Set(
  (
    "password password1 password123 passw0rd 12345678 123456789 1234567890 11111111 00000000 12341234 87654321 " +
    "qwerty123 qwertyuiop qwerty12 1q2w3e4r asdfghjk iloveyou iloveyou1 welcome1 welcome123 admin123 administrator " +
    "abc12345 abcd1234 letmein1 monkey123 dragon123 sunshine1 princess1 football1 baseball1 superman1 india123 " +
    "india@123 bharat123 hello123 test1234 testing123 changeme1 secret123 varam123 varam@123 varam12345 " +
    "gaanuga123 vijayawada1 vijayawada123 sairam123 omsairam1 krishna123"
  ).split(/\s+/),
);

/**
 * Password rules: 8–200 characters, at least one letter and one number, not a
 * well-known password, and not built from the person's own name, email or phone.
 */
function password(value, field = "password", label = "Password", context = {}) {
  const s = String(value || "");
  if (s.length < 8 || s.length > 200) throw new v.ValidationError(`${label} must be at least 8 characters`, field);
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) throw new v.ValidationError(`${label} must include at least one letter and one number`, field);
  const lower = s.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(s)) throw new v.ValidationError(`${label} is too easy to guess — try a short phrase with a number`, field);
  const personal = [
    String(context.email || "").split("@")[0],
    ...String(context.name || "").split(/\s+/),
    String(context.phone || "").replace(/\D/g, "").slice(-10),
  ]
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 4);
  if (personal.some((t) => lower.includes(t))) throw new v.ValidationError(`${label} must not contain your name, email or phone number`, field);
  return s;
}

/** Hidden "website" field: people never see or fill it, simple bots do. */
function notABot(b) {
  if (b && typeof b.website === "string" && b.website.trim() !== "") throw new v.ValidationError("Please try again", "form");
}

function register(b) {
  notABot(b);
  const name = v.str(b.name, "Name", { required: true, min: 2, max: 120 });
  const email = v.email(b.email);
  const phone = v.phone(b.phone);
  if (b.confirmPassword !== undefined && String(b.confirmPassword) !== String(b.password || "")) {
    throw new v.ValidationError("The two passwords don't match", "confirmPassword");
  }
  if (b.acceptTerms !== undefined && !v.bool(b.acceptTerms)) throw new v.ValidationError("Please accept the terms to continue", "acceptTerms");
  return { name, email, phone, password: password(b.password, "password", "Password", { name, email, phone }) };
}

function login(b) {
  notABot(b);
  const identifier = v.clean(b.identifier ?? b.email, 190).toLowerCase();
  const pw = String(b.password || "").slice(0, 200);
  if (!identifier || !pw) throw new v.ValidationError("Enter your email or phone and password", "identifier");
  return { identifier, password: pw, adminOnly: v.bool(b.adminOnly) };
}

const passwordChange = (b, user = {}) => ({
  current: String(b.currentPassword || "").slice(0, 200),
  next: password(b.newPassword, "newPassword", "New password", user),
});

const profile = (b) => ({
  name: v.str(b.name, "Name", { required: true, min: 2, max: 120 }),
  phone: v.phone(b.phone),
  defaultAddress: v.str(b.defaultAddress, "Address", { max: 500 }) || null,
  pincode: v.pincode(b.pincode, "Pincode", false) || null,
});

const address = (b) => ({
  label: v.str(b.label || "Home", "Label", { max: 40 }) || "Home",
  name: v.str(b.name, "Recipient name", { required: true, min: 2, max: 120 }),
  phone: v.phone(b.phone),
  address: v.str(b.address, "Address", { required: true, min: 8, max: 500 }),
  pincode: v.pincode(b.pincode),
  isDefault: v.bool(b.isDefault),
});

const cartQuantity = (b) => ({
  variantId: v.id(b.variantId, "variantId"),
  quantity: v.int(b.quantity, "quantity", { min: 0, max: MAX_QTY }),
});

const fulfillment = (value) => (value === "pickup" ? "pickup" : "delivery");

/** Country name; anything that isn't India (in any casing) is an international order. */
function country(value) {
  const s = v.clean(value || HOME_COUNTRY, 60);
  if (!/^[A-Za-z][A-Za-z .'()&-]{1,59}$/.test(s)) throw new v.ValidationError("Choose your country", "country");
  return s.toLowerCase() === HOME_COUNTRY.toLowerCase() ? HOME_COUNTRY : s;
}
const isInternational = (c) => c !== HOME_COUNTRY;

/** International phone in E.164 style: + and 8–15 digits. */
function intlPhone(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!/^\+?[\d\s()-]{8,22}$/.test(String(value ?? "").trim()) || digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
    throw new v.ValidationError("Enter your phone number with the country code, e.g. +1 415 555 0100", "phone");
  }
  return `+${digits}`;
}

function postalCode(value) {
  const s = v.clean(value, 12).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(s)) throw new v.ValidationError("Enter a valid postal / ZIP code", "pincode");
  return s;
}

/** Checkout form. Only variant ids + quantities are taken from the cart. */
function order(b) {
  const items = normaliseItems(b.items);
  if (!items.length) throw new v.ValidationError("Your cart is empty", "items");
  const ctry = country(b.country);
  const intl = isInternational(ctry);
  const ful = v.oneOf(b.fulfillment, "Fulfilment", FULFILLMENT_TYPES);
  const paymentMethod = v.oneOf(String(b.paymentMethod || "").toUpperCase(), "Payment method", PAYMENT_METHODS);
  if (intl) {
    if (ful !== "delivery") throw new v.ValidationError("Orders from outside India are shipped to you", "fulfillment");
    if (paymentMethod !== "INTL") throw new v.ValidationError("For orders outside India we email you a secure payment link", "paymentMethod");
  } else {
    if (paymentMethod === "INTL") throw new v.ValidationError("Choose UPI or pay at store for orders in India", "paymentMethod");
    if (paymentMethod === "STORE" && ful !== "pickup") throw new v.ValidationError("Pay at store is only available for store pickup", "paymentMethod");
  }
  return {
    items,
    name: v.str(b.name, "Name", { required: true, min: 2, max: 120 }),
    phone: intl ? intlPhone(b.phone) : v.phone(b.phone),
    email: v.email(b.email, "Email", intl) || null, // required abroad: payment link and shipping quote go by email
    country: ctry,
    fulfillment: ful,
    paymentMethod,
    address: ful === "delivery" ? v.str(b.address, "Delivery address", { required: true, min: 8, max: 500 }) : null,
    pincode: ful === "delivery" ? (intl ? postalCode(b.pincode) : v.pincode(b.pincode)) : null,
    notes: v.str(b.notes, "Notes", { max: 500 }) || null,
    couponCode: v.clean(b.couponCode, 40).toUpperCase() || null,
  };
}

const category = (b) => {
  const name = v.str(b.name, "Category name", { required: true, max: 80 });
  return { name, slug: v.slug(b.slug || name) };
};

const product = (b) => ({
  name: v.str(b.name, "Product name", { required: true, max: 150 }),
  slug: v.slug(b.slug || b.name),
  categoryId: b.categoryId ? v.id(b.categoryId, "Category") : null,
  tagline: v.str(b.tagline, "Tagline", { max: 255 }),
  description: v.str(b.description, "Description", { max: 5000 }),
  imageUrl: v.url(b.imageUrl, "Image"),
  accentColor: v.hexColor(b.accentColor || "#D97706", "Bottle colour"),
  badgeText: v.str(b.badgeText, "Badge", { max: 40 }),
  rating: v.money(b.rating ?? 0, "Rating", { min: 0, max: 5 }),
  reviewCount: v.int(b.reviewCount ?? 0, "Review count", { min: 0, max: 1e7 }),
  isFeatured: v.bool(b.isFeatured) ? 1 : 0,
  isActive: b.isActive === undefined ? 1 : v.bool(b.isActive) ? 1 : 0,
  sortOrder: v.int(b.sortOrder ?? 0, "Sort order", { min: 0, max: 10000 }),
});

function variant(b) {
  const price = v.money(b.price, "Price", { min: 0, max: 1e7 });
  const mrp = b.mrp === "" || b.mrp === undefined || b.mrp === null ? price : v.money(b.mrp, "MRP", { min: 0, max: 1e7 });
  if (mrp < price) throw new v.ValidationError("MRP cannot be lower than the selling price", "mrp");
  return {
    sizeLabel: v.str(b.sizeLabel, "Pack size", { required: true, max: 40 }),
    sku: v.str(b.sku, "SKU", { required: true, max: 60 }).toUpperCase(),
    price,
    mrp,
    stockQty: v.int(b.stockQty ?? 0, "Stock", { min: 0, max: 1e6 }),
    sortOrder: v.int(b.sortOrder ?? 0, "Sort order", { min: 0, max: 10000 }),
  };
}

function productWithVariants(b) {
  const variants = (Array.isArray(b.variants) ? b.variants : []).slice(0, 50).map(variant);
  if (!variants.length) throw new v.ValidationError("Add at least one pack size with a price", "variants");
  return { product: product(b), variants };
}

const flags = (b) => ({
  isActive: b.isActive === undefined ? undefined : v.bool(b.isActive),
  isFeatured: b.isFeatured === undefined ? undefined : v.bool(b.isFeatured),
});

function coupon(b) {
  const discountType = v.oneOf(b.discountType, "Discount type", ["percent", "flat"]);
  const limitRaw = b.usageLimit;
  return {
    code: v.str(b.code, "Code", { required: true, max: 40 }).toUpperCase().replace(/\s+/g, ""),
    discountType,
    discountValue: v.money(b.discountValue, "Discount value", { min: 0.01, max: discountType === "percent" ? 100 : 1e6 }),
    minOrderAmount: v.money(b.minOrderAmount ?? 0, "Minimum order", { min: 0, max: 1e7 }),
    usageLimit: limitRaw === undefined || limitRaw === null || limitRaw === "" ? null : v.int(limitRaw, "Usage limit", { min: 1, max: 1e7 }),
    expiresAt: v.optionalDate(b.expiresAt, "Expiry date"),
    isActive: b.isActive === undefined ? true : v.bool(b.isActive),
  };
}

function settings(b) {
  let testimonials;
  if (b.testimonials !== undefined) {
    const list = Array.isArray(b.testimonials) ? b.testimonials : [];
    testimonials = JSON.stringify(
      list.slice(0, 20).map((t) => ({
        name: v.str(t?.name, "Reviewer name", { required: true, max: 80 }),
        text: v.str(t?.text, "Review text", { required: true, max: 800 }),
        rating: v.int(t?.rating ?? 5, "Rating", { min: 1, max: 5 }),
        source: v.str(t?.source || "Google", "Source", { max: 30 }),
      })),
    );
  }
  const waDigits = String(b.whatsapp_number ?? "").replace(/\D/g, "");
  if (waDigits && (waDigits.length < 11 || waDigits.length > 15)) {
    throw new v.ValidationError("WhatsApp number must include the country code, e.g. 917799228444", "whatsapp_number");
  }
  return {
    announcement: v.str(b.announcement, "Announcement", { max: 200 }),
    free_delivery_threshold: v.money(b.free_delivery_threshold, "Free delivery threshold", { min: 0, max: 1e6 }),
    delivery_fee: v.money(b.delivery_fee, "Delivery charge", { min: 0, max: 1e5 }),
    store_name: v.str(b.store_name, "Store name", { required: true, max: 120 }),
    store_address: v.str(b.store_address, "Store address", { required: true, max: 300 }),
    store_phone: v.str(b.store_phone, "Store phone", { required: true, max: 30 }),
    whatsapp_number: waDigits || "917799228444",
    store_phone_2: v.str(b.store_phone_2, "Second phone", { max: 30 }),
    email_primary: v.email(b.email_primary, "Main email", false),
    email_info: v.email(b.email_info, "Info email", false),
    email_support: v.email(b.email_support, "Support email", false),
    store_hours: v.str(b.store_hours, "Store hours", { max: 120 }),
    maps_url: v.url(b.maps_url, "Google Maps link"),
    upi_id: v.str(b.upi_id, "UPI ID", { max: 80 }),
    instagram_url: v.url(b.instagram_url, "Instagram link"),
    google_rating: v.money(b.google_rating ?? 0, "Google rating", { min: 0, max: 5 }),
    google_review_count: v.int(b.google_review_count ?? 0, "Google review count", { min: 0, max: 1e7 }),
    google_reviews_url: v.url(b.google_reviews_url, "Google reviews link"),
    ...(testimonials !== undefined ? { testimonials } : {}),
  };
}

const orderNumber = (value) => v.clean(value, 30);

/* ---------------- Admin user management ---------------- */

const userDetails = (b) => ({
  name: v.str(b.name, "Name", { required: true, min: 2, max: 120 }),
  email: v.email(b.email),
  phone: v.phone(b.phone, "Phone", false) || null,
});

function optionalPassword(value, context = {}) {
  const s = String(value ?? "");
  if (!s) return null;
  return password(s, "password", "Password", context);
}

function userCreate(b) {
  const details = userDetails(b);
  return { ...details, role: v.oneOf(b.role || "customer", "Role", ["customer", "admin"]), password: optionalPassword(b.password, details) };
}

const userRole = (b) => v.oneOf(b.role, "Role", ["customer", "admin"]);

function userStatus(b) {
  if (b.isActive === undefined) throw new v.ValidationError("isActive is required", "isActive");
  return v.bool(b.isActive);
}

const userListQuery = (q) => ({
  q: v.clean(q.q, 60),
  role: ["customer", "admin"].includes(q.role) ? q.role : "",
  status: ["active", "disabled"].includes(q.status) ? q.status : "",
  page: Math.max(1, Math.min(10000, Math.floor(Number(q.page) || 1))),
});

module.exports = {
  register,
  login,
  passwordChange,
  password,
  profile,
  address,
  cartQuantity,
  fulfillment,
  country,
  isInternational,
  order,
  category,
  product,
  variant,
  productWithVariants,
  flags,
  coupon,
  settings,
  orderNumber,
  userDetails,
  userCreate,
  userRole,
  userStatus,
  userListQuery,
  optionalPassword,
};
