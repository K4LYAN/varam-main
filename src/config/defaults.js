"use strict";

/** Business constants shared by services, validators and the migration. */

const ORDER_STATUSES = ["Pending", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Cancelled"];
const FULFILLMENT_TYPES = ["delivery", "pickup"];
// Cash on delivery is not offered: UPI in India, pay at the store for pickups,
// and a payment link / bank transfer (sent by email) for orders from outside India
const PAYMENT_METHODS = ["UPI", "STORE", "INTL"];
const HOME_COUNTRY = "India";

const MAX_QTY = 50; // per cart line
const MAX_CART_LINES = 100;
const MAX_ADDRESSES = 10;
const LOW_STOCK_AT = 5;

// Default admin login used when ADMIN_EMAIL / ADMIN_PASSWORD are not set.
// The account is flagged must_change_password until the admin changes it.
const DEFAULT_ADMIN = { email: "admin@varam.in", password: "Varam@12345" };

const DEFAULT_SETTINGS = {
  announcement: "Free home delivery on orders above ₹999 · Free pickup at our Vijayawada store",
  free_delivery_threshold: "999",
  delivery_fee: "60",
  store_name: "Varam Organic Oil (గానుగ నూనె)",
  store_address: "BRTS Rd, Lakshmi Nagar, Satyaranayana Puram, Vijayawada, Andhra Pradesh 520011",
  store_phone: "077992 28444",
  whatsapp_number: "917799228444",
  store_phone_2: "+91 95157 18720",
  email_primary: "varam@varams.in",
  email_info: "info@varams.in",
  email_support: "support@varams.in",
  store_hours: "Open every day · 8:00 AM – 9:30 PM",
  maps_url: "https://maps.google.com/?cid=7883840299429229573",
  upi_id: "",
  instagram_url: "https://www.instagram.com/varamorganicoil_india/",
  google_rating: "4.9",
  google_review_count: "19",
  google_reviews_url: "https://maps.google.com/?cid=7883840299429229573",
  // Genuine reviews only: [{"name":"…","text":"…","rating":5,"source":"Google"}]
  testimonials: "[]",
};

module.exports = {
  ORDER_STATUSES,
  FULFILLMENT_TYPES,
  PAYMENT_METHODS,
  HOME_COUNTRY,
  MAX_QTY,
  MAX_CART_LINES,
  MAX_ADDRESSES,
  LOW_STOCK_AT,
  DEFAULT_ADMIN,
  DEFAULT_SETTINGS,
};
