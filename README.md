# Varam Organic Oil — Node.js website

A Node.js + Express app that serves the Varam store. There is no database: products, prices and settings live in one JSON file, and orders are sent to us on WhatsApp.

## How ordering works

Customers add products to the cart (kept in their browser), enter their details and tap **Send order on WhatsApp**. WhatsApp opens with the itemised order, order number and total already written; stock, delivery and payment are confirmed in the chat.

## Files

| Path | What it is |
| --- | --- |
| `server.js` | Starts the app (`npm start`) |
| `src/app.js` | Express app: security headers, compression, routes, static files, 404 page |
| `src/routes/pages.js` | Clean URLs (`/shop`, `/faq`, `/product/<slug>`), `js/data.js`, redirects for old pages |
| `src/routes/api.js` | Read-only JSON API |
| `src/store.js` | Reads `src/data/store.json` |
| `src/data/store.json` | **Products, pack sizes, prices, stock, delivery fee, contact details, WhatsApp number and coupons** |
| `public/` | Pages, product pages, CSS, browser scripts, logo, `sitemap.xml`, `robots.txt` |
| `scripts/ensure-deps.js` | Installs packages before `npm start` if they are missing |

## Changing prices or products

Edit `src/data/store.json`: change `price`, `mrp` or `stockQty` on a pack size (`stockQty: 0` shows "Out of stock"). The app picks up the change on the next page load; no restart needed.
The page title and Google preview text on each `public/products/*.html` page also mention the starting price, so update that text too when a price changes.

## API

| Request | Returns |
| --- | --- |
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/catalog` | Categories, products and settings |
| `GET /api/products` | All products |
| `GET /api/products/<slug>` | One product (404 if unknown) |
| `GET /api/settings` | Contact details, delivery fee, WhatsApp number |

## Run it locally

```bash
npm install
```

```bash
npm start
```

Then open http://localhost:3000. Use `npm run dev` to restart automatically when you edit the code. Set `PORT` to use another port.

## Deploy

- **MilesWeb (mPanel) Node app:** start command `npm start`, Node 18 or newer. If mPanel doesn't run `npm install`, `npm start` installs the packages itself the first time. No environment variables or database are needed.
- **Any other Node host (Render, Railway, a VPS):** run `npm install` and `npm start`; the app listens on `PORT`.
