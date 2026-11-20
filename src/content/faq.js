"use strict";

/**
 * Frequently asked questions — one source for the /faq page, the home-page
 * teaser and the FAQPage structured data Google reads.
 * Answers are plain text; {threshold}, {phone}, {phone2}, {whatsapp},
 * {email}, {infoEmail}, {supportEmail} and {address} are filled from store settings.
 */
const FAQ = [
  {
    cat: "Our oils",
    q: "What are cold-pressed (wood-pressed) oils?",
    a: "Cold-pressed oils are extracted by slowly crushing seeds without high heat or chemical solvents. We use a traditional wooden ghani — called gaanuga in Telugu and mara chekku in Tamil — which turns slowly so the oil stays cool and keeps its natural aroma, colour and taste. The oil is then left to settle naturally and filtered. It is never refined, bleached or deodorised.",
    featured: true,
  },
  {
    cat: "Our oils",
    q: "How are cold-pressed oils different from refined oils?",
    a: "Most supermarket oils are extracted with high-speed expellers and solvents such as hexane, then refined, bleached and deodorised at high temperatures. Cold-pressed oils skip all of that, so they keep the natural colour, aroma and character of the seed.",
  },
  {
    cat: "Our oils",
    q: "Which oils and products do you sell?",
    a: "Cold-pressed groundnut, white sesame (gingelly), black sesame, coconut, mustard (kachi ghani), sunflower and castor oils, plus pure ghee and natural honey.",
  },
  {
    cat: "Our oils",
    q: "Why is there some sediment at the bottom of the bottle?",
    a: "Cold-pressed oils are unrefined, so a little natural sediment can settle over time. It is normal and a sign that the oil has not been chemically processed. Store the bottle upright and pour gently.",
  },
  {
    cat: "Ordering",
    q: "How do I place an order?",
    a: "Add products to your cart, choose home delivery, store pickup or delivery outside India, and place the order online — or send the whole cart to us on WhatsApp in one tap. You get an order number and a printable invoice straight away.",
    featured: true,
  },
  {
    cat: "Ordering",
    q: "Do I need an account to order?",
    a: "No, you can order as a guest. An account saves your addresses, keeps your cart across devices, shows your order history and lets you reorder in one click.",
  },
  {
    cat: "Ordering",
    q: "How do I order and pay?",
    a: "Add products to your cart, enter your details and tap “Send order on WhatsApp”. Your order opens in WhatsApp with everything filled in, so you just press send. We confirm stock, delivery and payment with you there. No payment is taken on the website.",
  },
  {
    cat: "Ordering",
    q: "Do you take bulk, monthly or business orders?",
    a: "Yes. Families, restaurants, sweet shops, caterers and events can ask for a bulk or monthly quote on WhatsApp ({whatsapp}) or by email at {infoEmail}.",
  },
  {
    cat: "Delivery",
    q: "Do you deliver across India?",
    a: "Yes, we accept orders from all over India. Home delivery is free on orders of ₹{threshold} or more; below that a small delivery charge is shown in your cart before you order. Store pickup in Vijayawada is always free.",
    featured: true,
  },
  {
    cat: "Delivery",
    q: "Do you ship outside India?",
    a: "Yes — we accept orders from other countries too. Choose “Outside India” in your cart and enter your country and address. International shipping depends on weight and destination, so we confirm the shipping charge with you on WhatsApp before we dispatch. Questions? Write to {email}.",
    featured: true,
  },
  {
    cat: "Delivery",
    q: "Where is your store and when is it open?",
    a: "Our store is at {address}. Pickup orders can be collected during store hours; call {phone} or {phone2} if you need directions.",
  },
  {
    cat: "Care & storage",
    q: "How should I store cold-pressed oils?",
    a: "Keep them in a cool, dry place away from direct sunlight and close the cap tightly after use. Coconut oil and ghee may turn solid in cooler weather — that is natural; stand the bottle in warm water to liquefy.",
  },
  {
    cat: "Care & storage",
    q: "My honey has crystallised. Is it still good?",
    a: "Yes. Natural honey can crystallise over time. Stand the jar in warm (not boiling) water for a while and it turns runny again.",
  },
  {
    cat: "Help",
    q: "How can I contact Varam?",
    a: "Call or WhatsApp {phone} or {phone2}. Email {email} for orders, {infoEmail} for product and bulk enquiries, and {supportEmail} for help with an existing order.",
    featured: true,
  },
  {
    cat: "Help",
    q: "Can I cancel or change my order?",
    a: "You can cancel an order yourself from My account while it is still Pending — the items go straight back to stock. Once it is confirmed, message us on WhatsApp or write to {supportEmail} and we will help.",
  },
];

/** Fill the {placeholders} from store settings. */
function fill(text, s) {
  const map = {
    threshold: Number(s.free_delivery_threshold || 0).toLocaleString("en-IN"),
    phone: s.store_phone || "",
    phone2: s.store_phone_2 || s.store_phone || "",
    whatsapp: s.store_phone || "",
    email: s.email_primary || "",
    infoEmail: s.email_info || s.email_primary || "",
    supportEmail: s.email_support || s.email_primary || "",
    address: s.store_address || "",
  };
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : ""));
}

function faqFor(settings) {
  return FAQ.map((f) => ({ ...f, a: fill(f.a, settings) }));
}

module.exports = { faqFor };
