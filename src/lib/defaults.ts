import type { SiteSettings } from "./types";

/**
 * Placeholder photography (Unsplash licence) used until VARAM's own brand
 * photography is uploaded from the admin dashboard.
 */
const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2400&q=80`;

export const PLACEHOLDER_IMAGES = {
  heroPour: u("photo-1768689033119-c3ac1e437d20"),
  goldenBowl: u("photo-1709293078197-370c804d610c"),
  rusticBottle: u("photo-1611608927037-4e8da6aa170e"),
  darkBottle: u("photo-1726758004519-7ccecda8b076"),
  amberJar: u("photo-1590518563786-901882bf6f82"),
  groundnuts: u("photo-1785619564649-658675821809"),
  sesame: u("photo-1778048840966-04589f37c525"),
  coconuts: u("photo-1777732786332-3e78390f76aa"),
  mustardField: u("photo-1785784276068-d328298aa0d9"),
  bananaLeafMeal: u("photo-1625398407796-82650a8c135f"),
  panCooking: u("photo-1528712306091-ed0763094c98"),
  curryPot: u("photo-1596797038530-2c107229654b"),
  dosa: u("photo-1694849789325-914b71ab4075"),
};

const P = PLACEHOLDER_IMAGES;

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: {
    tagline: "Nature's Purity. Pressed with Tradition.",
    description:
      "VARAM Organic Oil brings traditionally extracted cold-pressed oils and pure ghee to the modern Indian kitchen — pressed slowly, bottled with care, and made for everyday cooking.",
    announcement: "Easy, personal ordering on WhatsApp",
  },
  hero: {
    eyebrow: "Pure · Natural · Traditional",
    headline: "Nature's Purity. Pressed with Tradition.",
    subtext:
      "Discover the goodness of traditionally extracted cold-pressed oils, crafted with care for your everyday kitchen.",
    image: P.heroPour,
    imageAlt: "Golden oil pouring slowly from a metal spout",
  },
  contact: {
    whatsappNumber: "917799228444",
    phone: "+91 77992 28444",
    email: "",
    address: "BRTS Road, Lakshmi Nagar, Satyanarayana Puram, Vijayawada, Andhra Pradesh 520011",
    hours: "Open every day · 8:00 AM – 9:30 PM",
  },
  social: {
    instagram: "https://www.instagram.com/varamorganicoil_india/",
    instagramHandle: "varamorganicoil_india",
    facebook: "",
    youtube: "",
  },
  story: {
    eyebrow: "Our Story",
    title: "A return to the slow, honest way of making oil.",
    intro:
      "VARAM was born from a simple belief: the oil in your kitchen should be as close to its seed as possible.",
    body: `Long before refineries and plastic tins, oil was pressed slowly from seeds — a patient process that respected the ingredient and the people who would cook with it.

VARAM carries that tradition forward. We work with carefully chosen seeds and nuts, press them slowly, and let the oil settle naturally before it is bottled.

Every bottle is a promise of transparency: we will always tell you what goes into it, and how it was made.`,
    quote: "We press slowly, so that nothing of the seed is lost.",
    image: P.rusticBottle,
    secondaryImage: P.groundnuts,
  },
  pillars: [
    {
      title: "Traditional Cold-Press Extraction",
      text: "Seeds are pressed slowly, the traditional way, rather than extracted at high heat.",
    },
    {
      title: "Carefully Selected Ingredients",
      text: "We choose our seeds and nuts with care, because the oil can only be as good as what goes in.",
    },
    {
      title: "Transparent Sourcing",
      text: "We are open about where our ingredients come from and how every bottle is made.",
    },
    {
      title: "Authentic Process",
      text: "Pressed, naturally settled and filtered — a process that stays true to how oil was always made.",
    },
    {
      title: "Thoughtful Packaging",
      text: "Bottled to protect the oil inside and designed to belong in your kitchen.",
    },
  ],
  process: [
    {
      title: "Selecting the seed",
      text: "Seeds and nuts are cleaned and sorted by hand before they reach the press.",
      image: P.groundnuts,
    },
    {
      title: "Slow pressing",
      text: "The seeds are pressed slowly. There is no rush — patience is the method.",
      image: P.heroPour,
    },
    {
      title: "Natural settling",
      text: "Freshly pressed oil is left to rest so that fine particles settle naturally.",
      image: P.goldenBowl,
    },
    {
      title: "Filtering & bottling",
      text: "The settled oil is filtered and bottled, ready for your kitchen.",
      image: P.rusticBottle,
    },
  ],
  ingredients: [
    { name: "Groundnuts", text: "The heart of our everyday cooking oil.", image: P.groundnuts },
    { name: "Sesame Seeds", text: "Tiny seeds behind a deeply aromatic oil.", image: P.sesame },
    { name: "Coconuts", text: "Mature coconuts for a clean, fragrant oil.", image: P.coconuts },
    { name: "Mustard Seeds", text: "Bold seeds for a bold, pungent oil.", image: P.mustardField },
  ],
  gallery: [
    { image: P.bananaLeafMeal, alt: "A traditional South Indian meal served on a banana leaf" },
    { image: P.rusticBottle, alt: "Glass bottle of golden oil on a wooden board" },
    { image: P.panCooking, alt: "Cooking in a pan at home" },
    { image: P.goldenBowl, alt: "Golden oil in a metal bowl" },
    { image: P.dosa, alt: "Crisp dosa with coconut chutney" },
    { image: P.curryPot, alt: "A home-cooked curry in a pot" },
  ],
  stores: [
    {
      name: "VARAM Organic Oil (గానుగ నూనె) — Vijayawada",
      address: "BRTS Road, Lakshmi Nagar, Satyanarayana Puram, Vijayawada, Andhra Pradesh 520011",
      phone: "+91 77992 28444",
      hours: "Open every day · 8:00 AM – 9:30 PM",
      mapsUrl: "https://maps.google.com/?cid=7883840299429229573",
      mapQuery: "VARAM ORGANIC OIL, BRTS Rd, Lakshmi Nagar, Satyanarayana Puram, Vijayawada, Andhra Pradesh 520011",
    },
  ],
  reviews: {
    rating: 4.9,
    count: 19,
    url: "https://maps.google.com/?cid=7883840299429229573",
    writeUrl: "",
  },
  policies: {
    privacy: `## Privacy Policy

_This policy is a template. Please review it with your legal adviser and replace the bracketed details before publishing._

**Who we are.** This website is operated by [Business legal name], [Registered address] ("VARAM", "we", "us").

### Information we collect
- **Order enquiries via WhatsApp.** When you choose to send us an order on WhatsApp, the message and your WhatsApp contact details are handled by WhatsApp and received by our business account. We use them only to respond to your enquiry and fulfil your order.
- **Shopping cart.** Your cart is stored only in your own browser (local storage). It is not sent to our servers.
- **Maps.** Our store pages show an embedded Google Map, which is provided by Google and subject to Google's privacy policy.
- **Analytics (only with your consent).** If you accept analytics cookies, we use Google Analytics 4 to understand how visitors use the site (pages viewed, products viewed, items added to cart, and clicks on WhatsApp buttons). We never send your name, phone number, address, email address or the contents of your WhatsApp message to Google Analytics.

### Your choices
You can accept or decline analytics at any time using **Cookie preferences** in the website footer.

### Contact
For privacy questions, contact us at [email address].`,
    terms: `## Terms & Conditions

_This is a template. Please review it with your legal adviser before publishing._

1. **Order enquiries.** Placing items in the cart and sending them to us on WhatsApp is an order enquiry, not a confirmed order. An order is confirmed only after we confirm availability, delivery charges and payment details with you on WhatsApp.
2. **Prices.** Prices shown on the website are in Indian Rupees (INR). Delivery charges are not included and will be confirmed separately.
3. **Product information.** We make every effort to describe our products accurately. Product images are representative.
4. **Governing law.** These terms are governed by the laws of India. [Jurisdiction city] courts shall have jurisdiction.`,
    shipping: `## Shipping Policy

_Template — please update with your actual delivery areas, timelines and charges._

- We currently deliver to [delivery areas].
- Delivery charges depend on your location and order size, and are confirmed with you on WhatsApp before the order is final.
- Orders are typically dispatched within [X] business days of confirmation.
- You will receive dispatch details on WhatsApp.`,
    returns: `## Cancellation & Return Policy

_Template — please update with your actual policy._

- **Cancellations.** You may cancel an order on WhatsApp any time before it is dispatched.
- **Damaged or incorrect items.** If your order arrives damaged or incorrect, please message us on WhatsApp within [X] hours of delivery with photos of the product and packaging.
- **Refunds.** Approved refunds are processed to the original payment method within [X] business days.
- For hygiene and food-safety reasons, opened products cannot be returned unless they are damaged or incorrect.`,
  },
  analytics: {
    reportUrl: "https://analytics.google.com/",
  },
};

/** Deep-merge stored settings over defaults so new fields always exist. */
export function mergeSettings(stored: unknown): SiteSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<SiteSettings>;
  const d = DEFAULT_SETTINGS;
  return {
    brand: { ...d.brand, ...(s.brand ?? {}) },
    hero: { ...d.hero, ...(s.hero ?? {}) },
    contact: { ...d.contact, ...(s.contact ?? {}) },
    social: { ...d.social, ...(s.social ?? {}) },
    story: { ...d.story, ...(s.story ?? {}) },
    pillars: Array.isArray(s.pillars) ? s.pillars : d.pillars,
    process: Array.isArray(s.process) ? s.process : d.process,
    ingredients: Array.isArray(s.ingredients) ? s.ingredients : d.ingredients,
    gallery: Array.isArray(s.gallery) ? s.gallery : d.gallery,
    stores: Array.isArray(s.stores) ? s.stores : d.stores,
    reviews: { ...d.reviews, ...(s.reviews ?? {}) },
    policies: { ...d.policies, ...(s.policies ?? {}) },
    analytics: { ...d.analytics, ...(s.analytics ?? {}) },
  };
}
