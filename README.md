# VARAM — Premium Cold-Pressed Oils

A custom-coded e-commerce website for **VARAM** with WhatsApp ordering, Google Analytics 4 tracking and a secure admin dashboard.

> **Nature's Purity. Pressed with Tradition.**

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Animation:** Motion (Framer Motion) for reveals, transitions and the hero; GSAP ScrollTrigger for the extraction-process story
- **Data:** PostgreSQL (any provider) — embedded PGlite is used automatically for local development
- **Cart:** Zustand, persisted to `localStorage`, re-validated against live prices on every visit
- **Ordering:** WhatsApp Click-to-Chat (`https://wa.me/<number>?text=…`) — no payment gateway
- **Analytics:** GA4 via `gtag.js`, loaded only after visitor consent

---

## 1. Quick start (local)

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env.local      # then edit values (see below)
npm run hash-password -- "choose-a-strong-password"   # paste output into .env.local
npm run dev
```

Open http://localhost:3000 — the admin dashboard is at http://localhost:3000/admin.

With `DATABASE_URL` empty, an embedded PostgreSQL database is created in `./.data/pglite` and seeded with the **VARAM catalogue** (8 products from the business price list, each as a 1 Litre size) and default content. Uploaded images are stored in `./.data/uploads`. Delete the `.data` folder to start over.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run hash-password -- "pw"` | Generates `ADMIN_PASSWORD_HASH` and an `AUTH_SECRET` |

---

## 2. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical URL for SEO, sitemap, Open Graph, structured data |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Recommended | Fallback WhatsApp business number (digits incl. country code, e.g. `91XXXXXXXXXX`). Admin → Website content overrides it. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | For analytics | GA4 Measurement ID (`G-XXXXXXX`) |
| `NEXT_PUBLIC_GA_ENABLED` | Optional | Analytics runs only in production builds by default. `true` forces on (e.g. staging), `false` forces off. |
| `NEXT_PUBLIC_GA_DEBUG` | Optional | `true` adds `debug_mode` so events show in GA4 DebugView |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `ADMIN_EMAIL` | Yes | Admin login email |
| `ADMIN_PASSWORD_HASH` | Yes | From `npm run hash-password` (base64 bcrypt hash) |
| `AUTH_SECRET` | Yes | Random string ≥ 32 characters for signing admin sessions |
| `BLOB_READ_WRITE_TOKEN` | Production on Vercel | Vercel Blob token for admin image uploads |
| `GOOGLE_PLACES_API_KEY` | Optional | Google Places API (New) key — loads the live Google rating and latest reviews |
| `GOOGLE_PLACE_ID` / `GOOGLE_PLACE_QUERY` | Optional | Which Google listing to load (default query: "VARAM ORGANIC OIL Vijayawada") |

Secrets (`DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`) are only read on the server and are never sent to the browser.

---

## 3. Deploying to Vercel

1. Push this project to a Git repository and import it in Vercel.
2. **Database:** create a PostgreSQL database (Vercel Marketplace → Neon, or Supabase). Copy the *pooled* connection string into `DATABASE_URL`. Tables are created and seeded automatically on first request.
3. **Images:** Vercel → Storage → create a Blob store and connect it to the project (this adds `BLOB_READ_WRITE_TOKEN`).
4. Add the remaining environment variables from the table above. Use separate values per environment — in particular a separate GA4 property/data stream for Preview deployments.
5. Deploy, then add your custom domain (HTTPS is automatic) and set `NEXT_PUBLIC_SITE_URL` to it.
6. **Backups:** enable your database provider's automated backups / point-in-time recovery (Neon and Supabase both offer this).

Any Node.js host works too (`npm run build && npm start`); without Blob storage, uploads are written to `./.data/uploads` (set `UPLOAD_DIR` to a persistent volume).

---

## 4. Before launch — content checklist

The admin dashboard shows a live launch checklist. In particular:

- **Products & prices** come from VARAM's handwritten price list: Groundnut ₹370, Sunflower ₹550, Coconut ₹600, Black Sesame ₹480, White Sesame ₹500, Ghee ₹800, Mustard ₹480, Castor ₹480. All prices are per **1 Litre** (confirmed by VARAM). Add other bottle sizes in Admin → Products when their prices are ready.
- **Photography is placeholder.** Hero, story, process, ingredient and gallery images are Unsplash stock photos. Replace them with VARAM's own photography (Admin → Website content). Products without photos display a rendered VARAM bottle in the product's oil colour.
- **WhatsApp number.** Set it in Admin → Website content → Contact & WhatsApp, then press **Test this number**.
- **Policies are templates** containing `[placeholders]`. Have them reviewed and completed.
- **Testimonials** start empty and the section stays hidden until genuine customer feedback is added.
- **Claims.** The copy deliberately avoids certifications, "organic" claims and health benefits. Only add such statements if VARAM holds the relevant certification/evidence.

- **"Organic".** The brand name and logo say "Organic Oil". If products are sold with an organic claim, make sure the required certification (e.g. FSSAI Jaivik Bharat / NPOP) is in place; the website copy itself avoids certification and health claims.

### Loading screen
A branded loading screen with the VARAM logo (`public/brand/varam-logo.jpg`) shows on the first page view of each browser session (1.5–3 s), then lifts to start the hero animation. Later page views in the same session skip it, and a CSS fail-safe hides it after 6 s even if JavaScript fails.

### VARAM Assistant (chatbot)
The ✦ button opens a **rule-based** assistant (`src/components/assistant/Assistant.tsx`) — no AI service, API key or running cost, and it can only say what is written in the code, so it never invents claims. It can:
- recommend oils by use (everyday, South Indian, North Indian & pickles, frying, sweets & festivals, hair & skin care) with live prices and add-to-cart buttons;
- list current prices from the catalogue;
- explain ordering, delivery and payment;
- collect requirements (products, quantity, city/PIN, notes) and send them to VARAM as a WhatsApp message, or add them to the cart;
- understand simple typed questions and product names in English, Tamil, Telugu and Hindi (e.g. "nallennai", "kobbari", "sarson", "neyyi").

The recommendation table (`USES`) and keyword list are easy to edit. Typed text and delivery locations are never sent to analytics; only the type of action (`assistant_open`, `assistant_action`, `assistant_requirements_sent`) is tracked.

---

### Design system
Colours come from the VARAM logo and are defined once in `src/app/globals.css`: `brand` (chocolate brown), `accent` (golden oil), `leaf` (leaf green), `ivory`/`cream` backgrounds. Change them there to re-theme the whole site.

### Dynamic Island navigation
`src/components/site/Header.tsx` — a floating pill that shows the full menu at the top of the page, shrinks to a compact island while scrolling down (expands again on scroll-up or hover), briefly turns into an "Added to cart" live activity, and on phones opens into the full menu.

### Stores & Google reviews
- **Stores** (`/stores`, plus a section on the homepage): name, address, hours, phone, Google Maps link and an embedded map, editable in Admin → Website content → Stores. Pre-filled with the Vijayawada store from its Google listing.
- **Google reviews:** without an API key the site shows the saved summary (4.9★ from 19 reviews) with "Read on Google" / "Write a review" links — update the numbers in Admin → Website content → Google reviews. With `GOOGLE_PLACES_API_KEY` set, the live rating and up to 5 latest reviews are loaded through Google's official Places API (cached for 12 hours, so the cost is negligible) and shown with Google attribution. To get a key: Google Cloud Console → enable "Places API (New)" → create an API key restricted to that API.
- For a direct "Write a review" link, copy it from your Google Business Profile ("Ask for reviews") into the admin.

---

## 5. WhatsApp ordering

Customer journey: browse → choose size & quantity → **Add to cart** (never redirects) → add more → open cart → **Order via WhatsApp** → WhatsApp opens with a pre-filled message → customer taps send.

- Message builder: `src/lib/whatsapp.ts` (`buildOrderMessage`). Totals are calculated in paise to avoid rounding errors. Delivery charges are always "To Be Confirmed" and never added to the total.
- The number is read from Admin → Website content, falling back to `NEXT_PUBLIC_WHATSAPP_NUMBER` — one source for every button (cart, product enquiry, floating button, header, footer, contact page).
- After clicking, the cart shows a confirmation panel with **Open WhatsApp again** and **Copy order message** fallbacks. The cart is kept until the customer chooses to clear it. If a popup blocker stops the new tab, the same tab navigates to WhatsApp instead.
- On each visit the stored cart is re-checked against live prices/availability (`/api/cart/sync`), so a changed price is never sent in an order.

---

## 6. Google Analytics 4

### Setup
1. Create a GA4 property → Web data stream for your domain → copy the Measurement ID into `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
2. Keep **Enhanced measurement → Page changes based on browser history events** ON (default). The site relies on it for page views on client-side navigation and does not send `page_view` manually, which prevents double counting.
3. Admin → Data display → Events → mark **`whatsapp_order_click`** as a **key event** (it appears after the first event is received).
4. Admin → Custom definitions → create event-scoped custom dimensions `order_source`, `enquiry_source`, `contact_source`, and a custom metric `total_items`.
5. Admin → Property access management → add the business owner's Google account as **Administrator**.
6. Paste the property's report URL in the website admin (Admin → Analytics) for one-click access.

### Consent & privacy
GA4 is loaded **only after the visitor clicks Accept** in the cookie banner (Google Signals and ad personalisation are disabled). Declining or changing the choice later via **Cookie preferences** in the footer turns collection off. No names, phone numbers, addresses, emails or WhatsApp message contents are ever sent to GA4.

### Events

| Event | When | Key parameters |
|---|---|---|
| `view_item_list` | Product list shown (shop, homepage, related) | `item_list_id`, `items[]` |
| `select_item` | Product clicked in a list | `items[]` |
| `view_item` | Product page / quick view opened | `currency`, `value`, `items[]` |
| `add_to_cart` | Added to cart or quantity increased | `currency`, `value`, `items[]` |
| `remove_from_cart` | Removed or quantity decreased | `currency`, `value`, `items[]` |
| `view_cart` | Cart drawer opened | `currency`, `value`, `items[]` |
| `whatsapp_order_click` ★ | **Order via WhatsApp** clicked | `value`, `currency`, `total_items`, `item_ids`, `item_categories`, `order_source`, `items[]` |
| `whatsapp_product_enquiry` | Product page WhatsApp enquiry | `item_id`, `item_name`, `item_category`, `item_variant`, `enquiry_source` |
| `whatsapp_contact_click` | Floating / header / footer / contact WhatsApp | `contact_source` |

Every item carries `item_id`, `item_name`, `item_brand`, `item_category`, `item_variant` (bottle size), `price`, `quantity`; currency is `INR`. **No `purchase` event is sent** — a WhatsApp click is an enquiry, not a confirmed order. Identical events fired within 1.5 s are de-duplicated (`src/lib/analytics.ts`).

### Verifying
1. Set `NEXT_PUBLIC_GA_DEBUG=true` (and `NEXT_PUBLIC_GA_ENABLED=true` if testing locally with a *test* property).
2. Open the site, accept the cookie banner, then open GA4 → Admin → DebugView.
3. Browse a product, add to cart, open the cart and click Order via WhatsApp — each event should appear once with its parameters.
4. Check Reports → Realtime on both desktop and a phone.
5. Turn debug off again for production.

### Useful reports
- **Enquiry funnel:** Explore → Funnel exploration: `view_item` → `add_to_cart` → `view_cart` → `whatsapp_order_click`; break down by device category or session source/medium.
- **Product performance:** Reports → Monetisation → E-commerce purchases (item views, add-to-carts by item).
- **Traffic sources generating enquiries:** Reports → Acquisition → Traffic acquisition with the `whatsapp_order_click` key event selected.

---

## 7. Admin dashboard

`/admin` — protected by email + bcrypt-hashed password, an 8-hour signed (HS256) HttpOnly, SameSite=Strict session cookie, route protection in `src/proxy.ts`, a second check in every page/server action, server-side Zod validation of all input, and a login rate limit (5 failed attempts / 15 min per IP).

| Section | What you can do |
|---|---|
| Dashboard | Launch checklist, catalogue overview |
| Products | Add / edit / delete; sizes & prices; availability, featured and "new" toggles; photos (upload or URL); specs; bottle colour |
| Categories | Add / rename / reorder / delete (only when empty) |
| Website content | WhatsApp number & contact details, homepage banner, brand text & announcement bar, brand story, "Why VARAM" points, process steps, ingredients, Instagram gallery, social links, policy pages |
| Testimonials | Add genuine customer feedback; hide/show |
| Analytics | Tracking status, link to the GA4 property, event reference |

Changes are live immediately (cached storefront data is invalidated on save).

Image uploads accept JPG, PNG, WebP and AVIF up to 5 MB; the file type is verified from its contents, not the file name.

---

## 8. Project structure

```
src/
  app/
    (site)/            storefront: home, /oils, /oils/[slug], /our-story, /our-process, /contact, /policies/[slug]
    admin/             login, dashboard and management pages; actions.ts = server actions
    api/cart/sync      live price/availability check for stored carts
    api/admin/upload   image upload (Vercel Blob or local disk)
    uploads/[file]     serves locally stored uploads
    sitemap.ts, robots.ts, opengraph-image.tsx, icon.svg
  components/
    home/              hero, process story (GSAP), pillars, ingredients, gallery…
    product/           product card, quick view, shop catalogue, detail, bottle render
    site/              header, footer, cart drawer, floating WhatsApp, toasts
    analytics/         GA4 loader + consent banner
    admin/             admin UI
  lib/
    db/                PostgreSQL / PGlite connection, schema, sample seed
    data.ts            cached data access
    whatsapp.ts        Click-to-Chat URLs + order message builder
    analytics.ts       GA4 event helpers (dedupe, no PII)
    auth.ts, session.ts  admin authentication
    validation.ts      Zod schemas
    config.ts          central configuration from env vars
  store/               cart, consent and toast state
  proxy.ts             admin route protection
```

### SEO
Unique titles and descriptions per page, canonical URLs, Open Graph/Twitter cards, a generated social image, `sitemap.xml` (includes every product), `robots.txt` (blocks `/admin` and `/api`), `Organization`, `Product` (one `Offer` per bottle size, with availability) and `BreadcrumbList` structured data.

### Performance
Next.js image optimisation (AVIF/WebP, responsive sizes, lazy loading), self-hosted Google Fonts via `next/font`, cached catalogue reads, GA loaded after interaction/consent only, `prefers-reduced-motion` respected.
# varam-main
