"use strict";

/** HTML for the printable invoice / packing slip (all values escaped). */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Printable invoice / packing slip. */
function renderInvoice(order, items, settings, { packingSlip = false } = {}) {
  const date = new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const rows = items
    .map(
      (i, n) => `<tr>
        <td>${n + 1}</td>
        <td>${esc(i.product_name)}<div class="muted">${esc(i.size_label)}</div></td>
        <td class="r">${i.quantity}</td>
        ${packingSlip ? '<td class="r">☐</td>' : `<td class="r">${inr(i.unit_price)}</td><td class="r">${inr(i.line_total)}</td>`}
      </tr>`,
    )
    .join("");
  const fulfil =
    order.fulfillment_type === "pickup"
      ? `Store pickup — ${esc(settings.store_address)}`
      : `${order.country && order.country !== "India" ? "International shipping" : "Home delivery"} — ${esc(order.delivery_address)}${order.pincode ? `, ${esc(order.pincode)}` : ""}${
          order.country && order.country !== "India" ? `, ${esc(order.country)}` : ""
        }`;
  const payLabel = { STORE: "Pay at store", INTL: "Secure payment link (sent by email)", UPI: "UPI", COD: "Cash on delivery" }[order.payment_method] || order.payment_method;
  const intl = order.country && order.country !== "India";
  return `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${packingSlip ? "Packing slip" : "Invoice"} ${esc(order.order_number)} · Varam</title>
<link rel="stylesheet" href="/css/invoice.css"></head>
<body>
<div class="sheet">
  <header>
    <div class="brand"><img src="/img/varam-logo.jpg" alt=""><div><strong>${esc(settings.store_name)}</strong>
      <div class="muted">${esc(settings.store_address)}</div><div class="muted">Phone / WhatsApp: ${esc(settings.store_phone)}${settings.store_phone_2 ? ` · ${esc(settings.store_phone_2)}` : ""}</div>${
      settings.email_support ? `<div class="muted">${esc(settings.email_support)}</div>` : ""
    }</div></div>
    <div class="meta"><h1>${packingSlip ? "Packing slip" : "Invoice"}</h1>
      <div><b>${esc(order.order_number)}</b></div><div class="muted">${esc(date)}</div>
      <div class="status">${esc(order.status)}</div></div>
  </header>
  <section class="cols">
    <div><h2>Customer</h2><div>${esc(order.customer_name)}</div><div class="muted">${esc(order.customer_phone)}</div>${
      order.customer_email ? `<div class="muted">${esc(order.customer_email)}</div>` : ""
    }</div>
    <div><h2>Fulfilment</h2><div>${fulfil}</div><div class="muted">Payment: ${esc(payLabel)}</div></div>
  </section>
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th>${packingSlip ? '<th class="r">Packed</th>' : '<th class="r">Rate</th><th class="r">Amount</th>'}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${
    packingSlip
      ? ""
      : `<table class="totals">
    <tr><td>Subtotal</td><td class="r">${inr(order.subtotal)}</td></tr>
    ${Number(order.discount_amount) > 0 ? `<tr><td>Discount${order.coupon_code ? ` (${esc(order.coupon_code)})` : ""}</td><td class="r">− ${inr(order.discount_amount)}</td></tr>` : ""}
    <tr><td>${intl ? "International shipping" : "Delivery"}</td><td class="r">${intl ? "Quoted by email" : Number(order.delivery_fee) > 0 ? inr(order.delivery_fee) : "Free"}</td></tr>
    <tr class="grand"><td>Total</td><td class="r">${inr(order.total_amount)}</td></tr>
  </table>`
  }
  ${order.notes ? `<p class="muted">Note: ${esc(order.notes)}</p>` : ""}
  <footer><p>Thank you for choosing Varam — traditional cold-pressed oils from Vijayawada.</p>
  <button class="print" data-print>Print</button></footer>
</div>
<script src="/js/print.js"></script>
</body></html>`;
}

module.exports = { renderInvoice, esc, inr };
